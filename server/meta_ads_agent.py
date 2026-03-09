"""
Meta Ads Optimization & Automation Agent
------------------------------------------
Handles Meta (Facebook/Instagram) Ads at the campaign level using the
Marketing API. In sandbox/test mode, all mutations are tracked in DynamoDB
without touching real budget.

Capabilities:
  - Create campaigns, ad sets, ads in Meta sandbox (test ad account)
  - Pull real Insights (impressions, clicks, CTR, CPC, spend) via Meta Insights API
  - Auto-optimize: pause underperformers, scale winners
  - Automation rules engine (threshold-based, no LLM cost)
  - Full audit trail in DynamoDB

Env vars required (add to .env):
  META_ACCESS_TOKEN        — long-lived user or system token
  META_APP_ID              — Meta App ID
  META_APP_SECRET          — Meta App Secret
  META_AD_ACCOUNT_ID       — act_XXXXXXXXXX (test account or real)
  META_PAGE_ID             — Facebook Page ID for the ads
  META_SANDBOX_MODE        — "true" to block real mutations, default "true"
"""

import os
import uuid
import json
import datetime
import requests
from typing import Optional
from dotenv import load_dotenv

from db import campaigns_table, ad_performance_table

load_dotenv()

# ── Meta credentials ──────────────────────────────────────────────────────────
META_ACCESS_TOKEN = os.environ.get("META_ACCESS_TOKEN", "")
META_APP_ID = os.environ.get("META_APP_ID", "")
META_APP_SECRET = os.environ.get("META_APP_SECRET", "")
META_AD_ACCOUNT_ID = os.environ.get("META_AD_ACCOUNT_ID", "")  # e.g. act_123456
META_PAGE_ID = os.environ.get("META_PAGE_ID", "")
META_SANDBOX_MODE = os.environ.get("META_SANDBOX_MODE", "true").lower() == "true"

GRAPH_API_BASE = "https://graph.facebook.com/v20.0"

# ── Optimization thresholds ───────────────────────────────────────────────────
THRESHOLDS = {
    "pause_ctr_below": 0.8,        # % — pause ad if CTR < 0.8%
    "pause_cpc_above": 5.00,       # $ — pause ad if CPC > $5.00
    "scale_ctr_above": 2.5,        # % — increase budget 20% if CTR > 2.5%
    "scale_cpc_below": 1.50,       # $ — increase budget if CPC < $1.50
    "min_impressions": 500,        # minimum impressions before judging
    "fatigue_ctr_drop": 0.30,      # 30% CTR drop from peak = fatigue
    "scale_budget_multiplier": 1.2,
    "max_daily_budget_usd": 200.0,
}


# ── Meta Graph API helpers ────────────────────────────────────────────────────

def _meta_get(endpoint: str, params: dict = None) -> dict:
    """GET from Graph API."""
    if not META_ACCESS_TOKEN:
        return {"error": "META_ACCESS_TOKEN not configured"}
    url = f"{GRAPH_API_BASE}/{endpoint}"
    p = {"access_token": META_ACCESS_TOKEN}
    if params:
        p.update(params)
    try:
        res = requests.get(url, params=p, timeout=15)
        return res.json()
    except Exception as e:
        return {"error": str(e)}


def _meta_post(endpoint: str, data: dict = None) -> dict:
    """POST to Graph API."""
    if not META_ACCESS_TOKEN:
        return {"error": "META_ACCESS_TOKEN not configured"}
    if META_SANDBOX_MODE:
        return {"sandbox": True, "mock_id": f"sandbox_{uuid.uuid4().hex[:8]}", "data": data}
    url = f"{GRAPH_API_BASE}/{endpoint}"
    d = {"access_token": META_ACCESS_TOKEN}
    if data:
        d.update(data)
    try:
        res = requests.post(url, data=d, timeout=15)
        return res.json()
    except Exception as e:
        return {"error": str(e)}


def _meta_update(object_id: str, data: dict) -> dict:
    """POST to a specific object ID (update)."""
    if not META_ACCESS_TOKEN:
        return {"error": "META_ACCESS_TOKEN not configured"}
    if META_SANDBOX_MODE:
        return {"sandbox": True, "updated": object_id, "changes": data}
    url = f"{GRAPH_API_BASE}/{object_id}"
    d = {"access_token": META_ACCESS_TOKEN}
    d.update(data)
    try:
        res = requests.post(url, data=d, timeout=15)
        return res.json()
    except Exception as e:
        return {"error": str(e)}


# ── Account info ──────────────────────────────────────────────────────────────

def get_meta_account_info() -> dict:
    """Fetch basic ad account info + spending limits."""
    if not META_AD_ACCOUNT_ID:
        return {"error": "META_AD_ACCOUNT_ID not configured"}
    data = _meta_get(
        META_AD_ACCOUNT_ID,
        {"fields": "id,name,account_status,currency,spend_cap,amount_spent,balance,timezone_name"}
    )
    return data


# ── Campaign CRUD ─────────────────────────────────────────────────────────────

def create_meta_campaign(name: str, objective: str, daily_budget_cents: int, status: str = "PAUSED") -> dict:
    """
    Create a campaign on Meta. In sandbox mode, returns a mock ID.
    objective: OUTCOME_TRAFFIC | OUTCOME_AWARENESS | OUTCOME_LEADS | OUTCOME_APP_PROMOTION
    daily_budget_cents: e.g. 1000 = $10.00
    """
    if not META_AD_ACCOUNT_ID:
        return {"error": "META_AD_ACCOUNT_ID not configured"}

    payload = {
        "name": name,
        "objective": objective,
        "status": status,
        "special_ad_categories": "[]",
    }

    result = _meta_post(f"{META_AD_ACCOUNT_ID}/campaigns", payload)

    # Record in DynamoDB regardless of sandbox/real
    camp_id = str(uuid.uuid4())
    meta_id = result.get("id") or result.get("mock_id", "sandbox_no_token")

    campaigns_table.put_item(Item={
        "id": camp_id,
        "name": name,
        "platform": "meta",
        "objective": objective,
        "status": "Draft" if META_SANDBOX_MODE else status,
        "meta_campaign_id": meta_id,
        "sandbox": META_SANDBOX_MODE,
        "daily_budget_usd": str(daily_budget_cents / 100),
        "budget": str(daily_budget_cents / 100),
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "sandbox_validated": True,
    })

    return {
        "status": "success",
        "internal_id": camp_id,
        "meta_campaign_id": meta_id,
        "sandbox": META_SANDBOX_MODE,
        "message": f"Campaign '{name}' created {'(sandbox)' if META_SANDBOX_MODE else '(live)'}.",
    }


def list_meta_campaigns() -> dict:
    """List all campaigns from Meta + merge with our DynamoDB records."""
    if not META_AD_ACCOUNT_ID:
        return {"error": "META_AD_ACCOUNT_ID not configured"}

    # Pull from Meta API
    meta_data = _meta_get(
        f"{META_AD_ACCOUNT_ID}/campaigns",
        {"fields": "id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time"}
    )

    # Pull from our DB
    db_res = campaigns_table.scan()
    db_campaigns = {c.get("meta_campaign_id"): c for c in db_res.get("Items", []) if c.get("meta_campaign_id")}

    meta_campaigns = meta_data.get("data", [])

    # Merge
    merged = []
    for mc in meta_campaigns:
        db_entry = db_campaigns.get(mc["id"], {})
        merged.append({**mc, "internal_id": db_entry.get("id"), "db_status": db_entry.get("status")})

    # Also include sandbox-only campaigns (no real meta ID)
    for internal_id, db_camp in db_campaigns.items():
        if db_camp.get("sandbox") and not any(m.get("id") == internal_id for m in meta_campaigns):
            merged.append({
                "id": db_camp.get("meta_campaign_id", "sandbox"),
                "name": db_camp.get("name"),
                "status": db_camp.get("status"),
                "objective": db_camp.get("objective"),
                "internal_id": db_camp.get("id"),
                "sandbox": True,
                "daily_budget": str(float(db_camp.get("daily_budget_usd", 0)) * 100),
                "created_time": db_camp.get("created_at"),
            })

    return {"status": "success", "data": merged, "count": len(merged), "sandbox": META_SANDBOX_MODE}


# ── Insights (real or simulated) ─────────────────────────────────────────────

def get_campaign_insights(meta_campaign_id: str, date_preset: str = "last_7d") -> dict:
    """
    Pull insights from Meta Insights API for a campaign.
    Falls back to deterministic simulation if no token/sandbox.
    """
    fields = "impressions,clicks,ctr,cpc,spend,reach,frequency,actions,cost_per_action_type"

    if not META_ACCESS_TOKEN or META_SANDBOX_MODE:
        return _simulate_insights(meta_campaign_id)

    data = _meta_get(
        f"{meta_campaign_id}/insights",
        {
            "fields": fields,
            "date_preset": date_preset,
            "level": "campaign",
        }
    )

    if "error" in data:
        return _simulate_insights(meta_campaign_id)

    insights = data.get("data", [{}])
    return {"source": "meta_api", "data": insights[0] if insights else {}}


def get_adset_insights(meta_adset_id: str, date_preset: str = "last_7d") -> dict:
    """Pull ad-set level insights."""
    fields = "impressions,clicks,ctr,cpc,spend,reach,frequency"

    if not META_ACCESS_TOKEN or META_SANDBOX_MODE:
        return _simulate_insights(meta_adset_id)

    data = _meta_get(
        f"{meta_adset_id}/insights",
        {"fields": fields, "date_preset": date_preset, "level": "adset"}
    )
    insights = data.get("data", [{}])
    return {"source": "meta_api", "data": insights[0] if insights else {}}


def _simulate_insights(campaign_id: str) -> dict:
    """Deterministic simulation so sandbox campaigns still have useful metrics."""
    seed = sum(ord(c) for c in campaign_id) % 100
    impressions = 1500 + seed * 60
    ctr = round(0.8 + seed * 0.025, 2)
    clicks = int(impressions * ctr / 100)
    cpc = round(1.20 + (100 - seed) * 0.03, 2)
    spend = round(clicks * cpc, 2)
    reach = int(impressions * 0.72)
    return {
        "source": "simulation",
        "data": {
            "impressions": str(impressions),
            "clicks": str(clicks),
            "ctr": str(ctr),
            "cpc": str(cpc),
            "spend": str(spend),
            "reach": str(reach),
            "frequency": str(round(impressions / reach, 2)) if reach > 0 else "1.0",
        }
    }


# ── Sync: Pull insights for all tracked campaigns ─────────────────────────────

def sync_meta_insights() -> dict:
    """
    Fetch insights for every campaign in our DB that has a meta_campaign_id,
    and log them to BloomGrow_AdPerformance.
    """
    db_res = campaigns_table.scan()
    campaigns = db_res.get("Items", [])

    synced = []
    errors = []

    for camp in campaigns:
        meta_id = camp.get("meta_campaign_id")
        if not meta_id:
            continue

        insights_res = get_campaign_insights(meta_id)
        insights = insights_res.get("data", {})

        perf_id = str(uuid.uuid4())
        try:
            ad_performance_table.put_item(Item={
                "id": perf_id,
                "campaign_id": camp["id"],
                "meta_campaign_id": meta_id,
                "platform": "meta",
                "impressions": int(insights.get("impressions", 0)),
                "clicks": int(insights.get("clicks", 0)),
                "ctr": float(insights.get("ctr", 0)),
                "cpc": float(insights.get("cpc", 0)),
                "spend": float(insights.get("spend", 0)),
                "reach": int(insights.get("reach", 0)),
                "source": insights_res.get("source", "unknown"),
                "recorded_at": datetime.datetime.utcnow().isoformat() + "Z",
            })
            synced.append({"campaign": camp.get("name"), "ctr": insights.get("ctr"), "spend": insights.get("spend")})
        except Exception as e:
            errors.append({"campaign": camp.get("name"), "error": str(e)})

    return {
        "status": "success",
        "synced": len(synced),
        "errors": len(errors),
        "results": synced,
        "error_details": errors,
    }


# ── Optimization Engine ───────────────────────────────────────────────────────

def _get_latest_performance(campaign_id: str) -> Optional[dict]:
    """Get latest perf record for a campaign from BloomGrow_AdPerformance."""
    try:
        res = ad_performance_table.scan()
        records = [r for r in res.get("Items", []) if r.get("campaign_id") == campaign_id]
        if not records:
            return None
        records.sort(key=lambda x: x.get("recorded_at", ""), reverse=True)
        return records[0]
    except Exception:
        return None


def optimize_campaign(campaign_id: str) -> dict:
    """
    Run the optimization engine on a single campaign.
    Applies threshold rules and returns recommended + executed actions.
    """
    # Fetch campaign from DB
    res = campaigns_table.get_item(Key={"id": campaign_id})
    campaign = res.get("Item")
    if not campaign:
        return {"status": "error", "message": "Campaign not found"}

    meta_id = campaign.get("meta_campaign_id")
    if not meta_id:
        return {"status": "error", "message": "No Meta campaign ID linked"}

    # Pull latest insights (real or simulated)
    insights_res = get_campaign_insights(meta_id)
    insights = insights_res.get("data", {})

    impressions = int(insights.get("impressions", 0))
    ctr = float(insights.get("ctr", 0))
    cpc = float(insights.get("cpc", 0))
    spend = float(insights.get("spend", 0))

    actions_taken = []
    recommendations = []

    # Not enough data yet
    if impressions < THRESHOLDS["min_impressions"]:
        return {
            "status": "waiting",
            "message": f"Only {impressions} impressions — need {THRESHOLDS['min_impressions']} before optimization.",
            "insights": insights,
        }

    current_budget = float(campaign.get("daily_budget_usd", 20.0))

    # Rule 1: Pause low CTR
    if ctr < THRESHOLDS["pause_ctr_below"]:
        action = _pause_campaign(campaign, meta_id)
        actions_taken.append({
            "rule": "BC-101 Low CTR",
            "trigger": f"CTR {ctr}% < threshold {THRESHOLDS['pause_ctr_below']}%",
            "action": "PAUSED",
            "meta_result": action,
        })

    # Rule 2: Pause high CPC
    elif cpc > THRESHOLDS["pause_cpc_above"]:
        action = _pause_campaign(campaign, meta_id)
        actions_taken.append({
            "rule": "BC-102 High CPC",
            "trigger": f"CPC ${cpc} > threshold ${THRESHOLDS['pause_cpc_above']}",
            "action": "PAUSED",
            "meta_result": action,
        })

    # Rule 3: Scale winner
    elif ctr > THRESHOLDS["scale_ctr_above"] and cpc < THRESHOLDS["scale_cpc_below"]:
        new_budget = min(
            current_budget * THRESHOLDS["scale_budget_multiplier"],
            THRESHOLDS["max_daily_budget_usd"]
        )
        action = _scale_campaign_budget(campaign, meta_id, new_budget)
        actions_taken.append({
            "rule": "Scale Winner",
            "trigger": f"CTR {ctr}% > {THRESHOLDS['scale_ctr_above']}% AND CPC ${cpc} < ${THRESHOLDS['scale_cpc_below']}",
            "action": f"BUDGET_SCALED ${current_budget:.2f} → ${new_budget:.2f}",
            "meta_result": action,
        })

    # Recommendations (no action taken)
    if ctr >= THRESHOLDS["pause_ctr_below"] and ctr <= THRESHOLDS["scale_ctr_above"]:
        recommendations.append(f"CTR {ctr}% is within normal range. Monitor for 24h before scaling.")

    if cpc > 3.0:
        recommendations.append(f"CPC ${cpc} is elevated. Consider narrowing audience or refreshing creative.")

    # Log to performance table
    ad_performance_table.put_item(Item={
        "id": str(uuid.uuid4()),
        "campaign_id": campaign_id,
        "meta_campaign_id": meta_id,
        "platform": "meta",
        "impressions": impressions,
        "clicks": int(insights.get("clicks", 0)),
        "ctr": ctr,
        "cpc": cpc,
        "spend": spend,
        "source": insights_res.get("source", "simulation"),
        "optimization_actions": json.dumps(actions_taken),
        "recorded_at": datetime.datetime.utcnow().isoformat() + "Z",
    })

    return {
        "status": "success",
        "campaign": campaign.get("name"),
        "insights": {"impressions": impressions, "ctr": ctr, "cpc": cpc, "spend": spend},
        "actions_taken": actions_taken,
        "recommendations": recommendations,
        "sandbox": META_SANDBOX_MODE,
    }


def _pause_campaign(campaign: dict, meta_id: str) -> dict:
    """Pause a campaign on Meta + update DynamoDB."""
    result = _meta_update(meta_id, {"status": "PAUSED"})

    campaigns_table.update_item(
        Key={"id": campaign["id"]},
        UpdateExpression="SET #s = :s, updated_at = :u",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":s": "Paused",
            ":u": datetime.datetime.utcnow().isoformat() + "Z",
        }
    )
    return result


def _scale_campaign_budget(campaign: dict, meta_id: str, new_budget_usd: float) -> dict:
    """Update campaign daily budget on Meta + update DynamoDB."""
    new_budget_cents = int(new_budget_usd * 100)
    result = _meta_update(meta_id, {"daily_budget": str(new_budget_cents)})

    campaigns_table.update_item(
        Key={"id": campaign["id"]},
        UpdateExpression="SET daily_budget_usd = :b, budget = :bs, updated_at = :u",
        ExpressionAttributeValues={
            ":b": str(new_budget_usd),
            ":bs": str(new_budget_usd),
            ":u": datetime.datetime.utcnow().isoformat() + "Z",
        }
    )
    return result


# ── Bulk optimizer: run across all running campaigns ──────────────────────────

def run_bulk_optimization() -> dict:
    """Run optimization engine across all campaigns with a meta_campaign_id."""
    db_res = campaigns_table.scan()
    campaigns = db_res.get("Items", [])

    # Target active/running campaigns
    targets = [c for c in campaigns if c.get("meta_campaign_id") and c.get("status") in ("Running", "Active", "Draft")]

    results = []
    for camp in targets:
        res = optimize_campaign(camp["id"])
        results.append({"campaign": camp.get("name"), "result": res})

    return {
        "status": "success",
        "campaigns_evaluated": len(targets),
        "results": results,
        "sandbox": META_SANDBOX_MODE,
    }


# ── Automation Rules Engine ───────────────────────────────────────────────────

AUTOMATION_RULES = [
    {
        "id": "AUTO-001",
        "name": "Pause Zero-Click Ads",
        "condition": "impressions > 2000 AND clicks == 0",
        "action": "PAUSE",
        "severity": "critical",
    },
    {
        "id": "AUTO-002",
        "name": "Scale CTR Winners",
        "condition": f"ctr > {THRESHOLDS['scale_ctr_above']} AND cpc < {THRESHOLDS['scale_cpc_below']}",
        "action": "SCALE_BUDGET_20PCT",
        "severity": "opportunity",
    },
    {
        "id": "AUTO-003",
        "name": "Pause High CPC",
        "condition": f"cpc > {THRESHOLDS['pause_cpc_above']} AND impressions > {THRESHOLDS['min_impressions']}",
        "action": "PAUSE",
        "severity": "warning",
    },
    {
        "id": "AUTO-004",
        "name": "Pause Low CTR",
        "condition": f"ctr < {THRESHOLDS['pause_ctr_below']} AND impressions > {THRESHOLDS['min_impressions']}",
        "action": "PAUSE",
        "severity": "warning",
    },
    {
        "id": "AUTO-005",
        "name": "Alert High Frequency (Creative Fatigue)",
        "condition": "frequency > 3.5",
        "action": "ALERT_CREATIVE_REFRESH",
        "severity": "warning",
    },
]


def run_automation_rules(campaign_id: str) -> dict:
    """
    Evaluates all automation rules against live/simulated insights for a campaign.
    Returns which rules fired and actions taken.
    """
    res = campaigns_table.get_item(Key={"id": campaign_id})
    campaign = res.get("Item")
    if not campaign:
        return {"status": "error", "message": "Campaign not found"}

    meta_id = campaign.get("meta_campaign_id")
    insights_res = get_campaign_insights(meta_id or campaign_id)
    insights = insights_res.get("data", {})

    impressions = int(insights.get("impressions", 0))
    clicks = int(insights.get("clicks", 0))
    ctr = float(insights.get("ctr", 0))
    cpc = float(insights.get("cpc", 0))
    spend = float(insights.get("spend", 0))
    frequency = float(insights.get("frequency", 1.0))

    fired_rules = []
    actions = []

    for rule in AUTOMATION_RULES:
        fired = False
        action_taken = None

        if rule["id"] == "AUTO-001" and impressions > 2000 and clicks == 0:
            fired = True
            if meta_id:
                action_taken = _pause_campaign(campaign, meta_id)
            actions.append("PAUSED — Zero clicks after 2000+ impressions")

        elif rule["id"] == "AUTO-002" and ctr > THRESHOLDS["scale_ctr_above"] and cpc < THRESHOLDS["scale_cpc_below"]:
            fired = True
            current_budget = float(campaign.get("daily_budget_usd", 20.0))
            new_budget = min(current_budget * 1.2, THRESHOLDS["max_daily_budget_usd"])
            if meta_id:
                action_taken = _scale_campaign_budget(campaign, meta_id, new_budget)
            actions.append(f"BUDGET_SCALED to ${new_budget:.2f}")

        elif rule["id"] == "AUTO-003" and cpc > THRESHOLDS["pause_cpc_above"] and impressions > THRESHOLDS["min_impressions"]:
            fired = True
            if meta_id:
                action_taken = _pause_campaign(campaign, meta_id)
            actions.append(f"PAUSED — CPC ${cpc} too high")

        elif rule["id"] == "AUTO-004" and ctr < THRESHOLDS["pause_ctr_below"] and impressions > THRESHOLDS["min_impressions"]:
            fired = True
            if meta_id:
                action_taken = _pause_campaign(campaign, meta_id)
            actions.append(f"PAUSED — CTR {ctr}% below threshold")

        elif rule["id"] == "AUTO-005" and frequency > 3.5:
            fired = True
            actions.append(f"ALERT — Frequency {frequency} is high, refresh creatives")

        if fired:
            fired_rules.append({
                "rule_id": rule["id"],
                "name": rule["name"],
                "severity": rule["severity"],
                "action": actions[-1] if actions else rule["action"],
                "meta_api_result": action_taken,
            })

    return {
        "status": "success",
        "campaign": campaign.get("name"),
        "insights_source": insights_res.get("source"),
        "metrics": {"impressions": impressions, "clicks": clicks, "ctr": ctr, "cpc": cpc, "spend": spend, "frequency": frequency},
        "rules_fired": len(fired_rules),
        "details": fired_rules,
        "sandbox": META_SANDBOX_MODE,
    }


# ── Performance Dashboard ─────────────────────────────────────────────────────

def get_meta_performance_dashboard() -> dict:
    """
    Returns a unified dashboard: all campaigns with latest metrics + health score.
    """
    db_res = campaigns_table.scan()
    campaigns = db_res.get("Items", [])

    perf_res = ad_performance_table.scan()
    all_perf = perf_res.get("Items", [])

    dashboard = []
    total_spend = 0.0
    total_impressions = 0
    total_clicks = 0

    for camp in campaigns:
        # Find latest performance record
        camp_perfs = [p for p in all_perf if p.get("campaign_id") == camp["id"]]
        camp_perfs.sort(key=lambda x: x.get("recorded_at", ""), reverse=True)
        latest = camp_perfs[0] if camp_perfs else {}

        # If no record, simulate
        if not latest and camp.get("meta_campaign_id"):
            sim = _simulate_insights(camp.get("meta_campaign_id", camp["id"]))["data"]
            latest = {
                "impressions": int(sim.get("impressions", 0)),
                "clicks": int(sim.get("clicks", 0)),
                "ctr": float(sim.get("ctr", 0)),
                "cpc": float(sim.get("cpc", 0)),
                "spend": float(sim.get("spend", 0)),
                "source": "simulation",
            }

        ctr = float(latest.get("ctr", 0))
        cpc = float(latest.get("cpc", 0))
        impressions = int(latest.get("impressions", 0))
        spend = float(latest.get("spend", 0))

        # Health score: 0–100
        health = 100
        if ctr < THRESHOLDS["pause_ctr_below"]:
            health -= 40
        elif ctr < 1.5:
            health -= 15
        if cpc > THRESHOLDS["pause_cpc_above"]:
            health -= 30
        elif cpc > 3.0:
            health -= 10
        if impressions < THRESHOLDS["min_impressions"]:
            health -= 10
        health = max(0, health)

        health_label = "Excellent" if health >= 80 else "Good" if health >= 60 else "At Risk" if health >= 40 else "Critical"

        total_spend += spend
        total_impressions += impressions
        total_clicks += int(latest.get("clicks", 0))

        dashboard.append({
            "id": camp["id"],
            "name": camp.get("name"),
            "status": camp.get("status"),
            "platform": camp.get("platform", "meta"),
            "objective": camp.get("objective"),
            "daily_budget_usd": float(camp.get("daily_budget_usd", camp.get("budget", 0))),
            "sandbox": camp.get("sandbox", True),
            "meta_campaign_id": camp.get("meta_campaign_id"),
            "metrics": {
                "impressions": impressions,
                "clicks": int(latest.get("clicks", 0)),
                "ctr": ctr,
                "cpc": cpc,
                "spend": spend,
                "source": latest.get("source", "none"),
            },
            "health_score": health,
            "health_label": health_label,
            "created_at": camp.get("created_at"),
        })

    overall_ctr = round((total_clicks / total_impressions * 100), 2) if total_impressions > 0 else 0

    return {
        "status": "success",
        "summary": {
            "total_campaigns": len(dashboard),
            "total_spend_usd": round(total_spend, 2),
            "total_impressions": total_impressions,
            "total_clicks": total_clicks,
            "overall_ctr": overall_ctr,
        },
        "campaigns": dashboard,
        "sandbox": META_SANDBOX_MODE,
    }
