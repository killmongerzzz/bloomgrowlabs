"""
Ad Lifecycle Agent
-------------------
Manages the full lifecycle of ad copy variants:
  1. score_ad_variants()   - Compute a performance score for each variant
  2. promote_winner(id)    - Set status = active
  3. demote_loser(id)      - Set status = paused
  4. retire_fatigued_ads() - Auto-retire ads where CTR has fallen >30% from peak
  5. refresh_variants()    - Generate new variants from winning copy via code templates
                             (pure Python, no LLM cost for the base logic)
"""

import os
import uuid
import json
import decimal
from datetime import datetime, timedelta
from dotenv import load_dotenv

from db import ad_copy_table, ad_performance_table, campaigns_table

# Decimals are required for DynamoDB floats
from boto3.dynamodb.conditions import Key, Attr


# --------------------------
# HEADLINE / CTA TEMPLATES
# Code-based variants (no LLM cost)
# --------------------------

HEADLINE_TRANSFORMS = [
    lambda h: h,                                          # Original
    lambda h: h.replace(".", "!"),                        # Add urgency
    lambda h: f"Why {h.lower()}",                         # Question frame
    lambda h: f"Finally: {h}",                            # Relief frame
    lambda h: f"Stop {h.lower().split(' ')[0]}ing — {h}", # Pattern interrupt
]

CTA_VARIANTS = [
    "Start Free Trial",
    "Get Started Today",
    "Try It Free",
    "See How It Works",
    "Claim Your Spot",
]

DESCRIPTION_SUFFIXES = [
    " No commitment needed.",
    " Join 10,000+ parents.",
    " Results in 7 days.",
    " Start free, cancel anytime.",
    " Used by pediatric experts.",
]


def get_all_variants() -> list:
    """Returns all ad_copy variants from the DB with their current status and scores."""
    try:
        res = ad_copy_table.scan()
        data = res.get('Items', [])
        # Provide default sort
        data.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        # Convert Decimals
        for row in data:
            if 'performance_score' in row: row['performance_score'] = float(row['performance_score'])
            if 'peak_ctr' in row: row['peak_ctr'] = float(row['peak_ctr'])
            if 'days_active' in row: row['days_active'] = int(row['days_active'])
        return data
    except Exception as e:
        print(f"[lifecycle] Error fetching variants: {e}")
        return []


def score_ad_variants() -> dict:
    """
    Compute performance scores for all active ad variants.
    Score = (CTR * 4) - (CPC * 1.5) + impressions/1000
    Higher is better.
    """
    try:
        # Fetch performance data grouped by variant via campaigns
        perf_res = ad_performance_table.scan()
        
        perf_by_campaign: dict = {}
        for row in perf_res.get('Items', []):
            cid = row["campaign_id"]
            if cid not in perf_by_campaign:
                perf_by_campaign[cid] = {"ctr_sum": 0.0, "cpc_sum": 0.0, "impressions": 0.0, "count": 0}
            perf_by_campaign[cid]["ctr_sum"] += float(row.get("ctr", 0))
            perf_by_campaign[cid]["cpc_sum"] += float(row.get("cpc", 0))
            perf_by_campaign[cid]["impressions"] += float(row.get("impressions", 0))
            perf_by_campaign[cid]["count"] += 1

        # Get all campaigns with variant linking
        camp_res = campaigns_table.scan()
        
        updated = 0
        for camp in camp_res.get('Items', []):
            vid = camp.get("variant_name")  # variant_name stores the ad_copy id
            cid = camp["id"]
            if vid and cid in perf_by_campaign:
                p = perf_by_campaign[cid]
                n = p["count"] or 1
                avg_ctr = p["ctr_sum"] / n
                avg_cpc = p["cpc_sum"] / n
                imp = p["impressions"]
                score = round((avg_ctr * 4) - (avg_cpc * 1.5) + (imp / 1000), 3)
                
                # Fetch variant to update peak
                existing_res = ad_copy_table.get_item(Key={'id': vid})
                existing = existing_res.get('Item', {})
                if not existing:
                    continue
                    
                new_peak = max(float(existing.get("peak_ctr", 0)), avg_ctr)
                days = int(existing.get("days_active", 0)) + 1
                
                ad_copy_table.update_item(
                    Key={'id': vid},
                    UpdateExpression="set performance_score=:score, peak_ctr=:peak, days_active=:days",
                    ExpressionAttributeValues={
                        ':score': decimal.Decimal(str(score)),
                        ':peak': decimal.Decimal(str(new_peak)),
                        ':days': days
                    }
                )
                updated += 1
        
        return {"status": "success", "message": f"Scored {updated} ad variants."}
    except Exception as e:
        print(f"[lifecycle] Score error: {e}")
        return {"status": "error", "message": str(e)}


def promote_variant(variant_id: str) -> dict:
    """Set a variant to 'active' status."""
    try:
        ad_copy_table.update_item(
            Key={'id': variant_id},
            UpdateExpression="set #st=:status",
            ExpressionAttributeNames={'#st': 'status'},
            ExpressionAttributeValues={':status': 'active'}
        )
        return {"status": "success", "message": f"Variant {variant_id} promoted to active."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def demote_variant(variant_id: str) -> dict:
    """Set a variant to 'paused' status."""
    try:
        ad_copy_table.update_item(
            Key={'id': variant_id},
            UpdateExpression="set #st=:status",
            ExpressionAttributeNames={'#st': 'status'},
            ExpressionAttributeValues={':status': 'paused'}
        )
        return {"status": "success", "message": f"Variant {variant_id} paused."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def retire_variant(variant_id: str) -> dict:
    """Manually retire a variant."""
    try:
        ad_copy_table.update_item(
            Key={'id': variant_id},
            UpdateExpression="set #st=:status",
            ExpressionAttributeNames={'#st': 'status'},
            ExpressionAttributeValues={':status': 'retired'}
        )
        return {"status": "success", "message": f"Variant {variant_id} retired."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def retire_fatigued_ads(fatigue_threshold_pct: float = 30.0, min_days: int = 3) -> dict:
    """
    Auto-retire active ads where CTR has dropped more than `fatigue_threshold_pct`%
    below their peak, and they've been active for at least `min_days` days.
    """
    try:
        # Query GSI for active ads
        active_res = ad_copy_table.query(
            IndexName='status-index',
            KeyConditionExpression=Key('status').eq('active')
        )
        
        retired_ids = []
        
        for ad in active_res.get('Items', []):
            if int(ad.get("days_active", 0)) < min_days:
                continue
            peak = float(ad.get("peak_ctr", 0))
            if peak == 0:
                continue
            
            # Get campaigns using this variant
            camp_res = campaigns_table.scan(FilterExpression=Attr('variant_name').eq(ad['id']))
            camp_ids = [c['id'] for c in camp_res.get('Items', [])]
            
            if not camp_ids:
                continue
                
            # Fetch recent performances for these campaigns
            perf_res = ad_performance_table.scan(
                FilterExpression=Attr('campaign_id').is_in(camp_ids)
            )
            perfs = perf_res.get('Items', [])
            perfs.sort(key=lambda x: x.get('date', ''), reverse=True)
            perfs = perfs[:3] # Top 3 recent
            
            recent_ctrs = [float(r.get("ctr", 0)) for r in perfs]
            if not recent_ctrs:
                continue
            
            current_ctr = sum(recent_ctrs) / len(recent_ctrs)
            drop_pct = ((peak - current_ctr) / peak) * 100 if peak > 0 else 0
            
            if drop_pct >= fatigue_threshold_pct:
                retire_variant(ad["id"])
                retired_ids.append(ad["id"])
                print(f"[lifecycle] Retired fatigued ad {ad['id']} — CTR dropped {drop_pct:.1f}%")
        
        return {
            "status": "success",
            "message": f"Retired {len(retired_ids)} fatigued ads.",
            "retired_ids": retired_ids
        }
    except Exception as e:
        print(f"[lifecycle] Fatigue retire error: {e}")
        return {"status": "error", "message": str(e)}


def refresh_variants_from_winners() -> dict:
    """
    Find the top performing ad variants (by performance_score) and generate
    3 new code-based variants for each winner using template transformations.
    This is pure Python — no LLM calls, no API cost.
    """
    try:
        # Get active variants
        active_res = ad_copy_table.query(
            IndexName='status-index',
            KeyConditionExpression=Key('status').eq('active')
        )
        
        all_active = active_res.get('Items', [])
        # Filter for score >= 0.5
        winners = [w for w in all_active if float(w.get("performance_score", 0)) >= 0.5]
        
        # Sort by score desc
        winners.sort(key=lambda x: float(x.get("performance_score", 0)), reverse=True)
        winners = winners[:3] # Limit 3
        
        if not winners:
            return {"status": "success", "message": "No qualifying winners to refresh from.", "created": 0}
        
        new_variants = []
        for winner in winners:
            group_id = winner.get("variant_group") or str(uuid.uuid4())
            base_headline = winner.get("headline", "")
            base_desc = winner.get("description", "")
            base_tone = winner.get("tone", "professional")
            
            # Pick 3 unique transformations (skip index 0 = original)
            for i in range(1, 4):
                transform = HEADLINE_TRANSFORMS[i % len(HEADLINE_TRANSFORMS)]
                new_headline = transform(base_headline)
                new_desc = base_desc + DESCRIPTION_SUFFIXES[i % len(DESCRIPTION_SUFFIXES)]
                new_cta = CTA_VARIANTS[i % len(CTA_VARIANTS)]
                
                new_variant = {
                    "id": str(uuid.uuid4()),
                    "pain_point_id": winner.get("pain_point_id", ""),
                    "headline": new_headline[:100],
                    "description": new_desc[:200],
                    "cta": new_cta,
                    "tone": base_tone,
                    "status": "draft",
                    "performance_score": decimal.Decimal("0.0"),
                    "days_active": 0,
                    "variant_group": group_id,
                    "peak_ctr": decimal.Decimal("0.0"),
                    "created_at": datetime.utcnow().isoformat() + "Z",
                }
                new_variants.append(new_variant)
        
        if new_variants:
            with ad_copy_table.batch_writer() as batch:
                for v in new_variants:
                    batch.put_item(Item=v)
        
        return {
            "status": "success",
            "message": f"Generated {len(new_variants)} fresh variants from {len(winners)} winners.",
            "created": len(new_variants),
            "variants": new_variants
        }
    except Exception as e:
        print(f"[lifecycle] Refresh error: {e}")
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    print("Scoring variants...")
    print(json.dumps(score_ad_variants(), indent=2))
    print("\nRetiring fatigued ads...")
    print(json.dumps(retire_fatigued_ads(), indent=2))
    print("\nRefreshing winners...")
    print(json.dumps(refresh_variants_from_winners(), indent=2))
