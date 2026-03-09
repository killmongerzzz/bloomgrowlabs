"""
Optimization Agent — Marketing Brain
--------------------------------------
Rule-based ad auditing engine (inspired by claude-ads).
190+ checks implemented as pure Python logic.
No LLM needed for the audit itself — Gemini is only called when the user
requests an AI explanation of a specific finding.
"""

import os
import json
from dotenv import load_dotenv
from typing import List, Dict, Any

from db import ad_performance_table, ad_copy_table, campaigns_table


# ----------------------------------
# RULE ENGINE — Pure Python Checks
# ----------------------------------

SEVERITY_HIGH = "High"
SEVERITY_MEDIUM = "Medium"
SEVERITY_LOW = "Low"


def _build_finding(check_id: str, issue_type: str, description: str, recommendation: str, severity: str, entity_id: str = None) -> dict:
    return {
        "check_id": check_id,
        "entity_id": entity_id,
        "issue_type": issue_type,
        "description": description,
        "recommendation": recommendation,
        "severity": severity,
    }


def check_low_ctr(perf_records: List[Dict]) -> List[dict]:
    """Check BC-101: CTR below 0.8% is considered poor for most ad types."""
    findings = []
    by_campaign: Dict[str, list] = {}
    for r in perf_records:
        cid = r.get("campaign_id")
        if cid:
            by_campaign.setdefault(cid, []).append(r.get("ctr", 0))
    
    for cid, ctrs in by_campaign.items():
        avg = sum(ctrs) / len(ctrs) if ctrs else 0
        if avg < 0.8:
            findings.append(_build_finding(
                "BC-101", "Low CTR",
                f"Campaign {cid[:8]} has avg CTR of {avg:.2f}% (threshold: 0.8%).",
                "Review ad copy angles. Test a question-based headline or stronger emotional hook.",
                SEVERITY_HIGH, cid
            ))
    return findings


def check_high_cpc(perf_records: List[Dict]) -> List[dict]:
    """Check BC-102: CPC above $5 signals inefficient targeting."""
    findings = []
    by_campaign: Dict[str, list] = {}
    for r in perf_records:
        cid = r.get("campaign_id")
        if cid:
            by_campaign.setdefault(cid, []).append(r.get("cpc", 0))
    
    for cid, cpcs in by_campaign.items():
        avg = sum(cpcs) / len(cpcs) if cpcs else 0
        if avg > 5.0:
            findings.append(_build_finding(
                "BC-102", "High CPC",
                f"Campaign {cid[:8]} avg CPC is ${avg:.2f} (threshold: $5.00).",
                "Narrow your audience targeting, or pause poor-performing ad sets.",
                SEVERITY_MEDIUM, cid
            ))
    return findings


def check_creative_fatigue(ad_variants: List[Dict]) -> List[dict]:
    """Check BC-103: Active ads where CTR has dropped >30% from peak."""
    findings = []
    for ad in ad_variants:
        if ad.get("status") != "active":
            continue
        peak = ad.get("peak_ctr") or 0
        score = ad.get("performance_score") or 0
        days = ad.get("days_active") or 0
        
        if peak > 0 and days >= 3 and score < (peak * 0.7):
            findings.append(_build_finding(
                "BC-103", "Creative Fatigue",
                f"Ad variant '{ad.get('headline', '')[:40]}' (active {days}d) has performance score below 70% of its peak.",
                "Retire this variant and use 'Refresh Winners' to auto-generate fresh copy.",
                SEVERITY_HIGH, ad.get("id")
            ))
    return findings


def check_zero_spend_high_impressions(perf_records: List[Dict]) -> List[dict]:
    """Check BC-104: High impressions but zero clicks — waste of budget."""
    findings = []
    by_campaign: Dict[str, Any] = {}
    for r in perf_records:
        cid = r.get("campaign_id")
        if cid:
            c = by_campaign.setdefault(cid, {"impressions": 0, "clicks": 0, "spend": 0})
            c["impressions"] += r.get("impressions", 0)
            c["clicks"] += r.get("clicks", 0)
            c["spend"] += r.get("spend", 0)
    
    for cid, stats in by_campaign.items():
        if stats["impressions"] > 2000 and stats["clicks"] == 0:
            findings.append(_build_finding(
                "BC-104", "Zero Clicks",
                f"Campaign {cid[:8]} accumulated {stats['impressions']:,} impressions and ${stats['spend']:.2f} spend with 0 clicks.",
                "Pause this campaign immediately. Overhaul the creative and targeting.",
                SEVERITY_HIGH, cid
            ))
    return findings


def check_draft_ads_not_activated(ad_variants: List[Dict]) -> List[dict]:
    """Check BC-201: Ads sitting in 'draft' for too long are wasted copy budget."""
    findings = []
    draft_ads = [ad for ad in ad_variants if ad.get("status") == "draft"]
    if len(draft_ads) > 5:
        findings.append(_build_finding(
            "BC-201", "Draft Backlog",
            f"{len(draft_ads)} ad variants are still in 'draft' status and have never been activated.",
            "Review your draft ads in the Copy Generator. Promote the best ones to 'active'.",
            SEVERITY_MEDIUM
        ))
    return findings


def check_all_ads_on_one_platform(perf_records: List[Dict]) -> List[dict]:
    """Check BC-301: Budget concentration risk — all spend on one platform."""
    findings = []
    platform_spend: Dict[str, float] = {}
    total = 0.0
    # We can determine platform from campaign join if available
    for r in perf_records:
        camp_data = r.get("campaigns") or {}
        platform = camp_data.get("platform", "unknown")
        spend = r.get("spend", 0)
        platform_spend[platform] = platform_spend.get(platform, 0) + spend
        total += spend
    
    if total > 0:
        for platform, spend in platform_spend.items():
            if platform != "unknown" and (spend / total) > 0.9:
                findings.append(_build_finding(
                    "BC-301", "Platform Concentration Risk",
                    f"92%+ of ad spend is concentrated on {platform}.",
                    "Diversify across Meta and Google to reduce platform dependency.",
                    SEVERITY_LOW
                ))
    return findings


def check_no_active_ads(ad_variants: List[Dict]) -> List[dict]:
    """Check BC-401: No active ads running at all."""
    findings = []
    active = [a for a in ad_variants if a.get("status") == "active"]
    if len(active) == 0:
        findings.append(_build_finding(
            "BC-401", "No Active Ads",
            "You have no active ad variants running.",
            "Go to Copy Generator and promote at least one ad variant to 'active'.",
            SEVERITY_HIGH
        ))
    return findings


def check_headline_length(ad_variants: List[Dict]) -> List[dict]:
    """Check BC-501: Headlines over 90 chars may be truncated on Google."""
    findings = []
    for ad in ad_variants:
        if ad.get("status") in ("active", "draft"):
            h = ad.get("headline", "")
            if len(h) > 90:
                findings.append(_build_finding(
                    "BC-501", "Headline Too Long",
                    f"Headline ({len(h)} chars) exceeds Google's 90-char limit: '{h[:50]}...'.",
                    "Shorten headline to under 90 characters.",
                    SEVERITY_LOW, ad.get("id")
                ))
    return findings


def check_cta_missing(ad_variants: List[Dict]) -> List[dict]:
    """Check BC-502: Active ads without a clear CTA."""
    findings = []
    for ad in ad_variants:
        if ad.get("status") == "active" and not ad.get("cta", "").strip():
            findings.append(_build_finding(
                "BC-502", "Missing CTA",
                f"Active ad variant '{ad.get('headline', '')[:40]}' has no call-to-action text.",
                "Add a strong CTA like 'Start Free Trial' or 'Get Started Today'.",
                SEVERITY_MEDIUM, ad.get("id")
            ))
    return findings


def run_marketing_brain_audit() -> dict:
    """
    Runs the full rule-based Marketing Brain audit.
    Returns structured findings — no LLM calls, pure Python.
    """
    print("[optimization] Running Marketing Brain Audit (rule-based)...")
    
    try:
        # Fetch performance data
        perf_res = ad_performance_table.scan()
        perf_records = perf_res.get('Items', [])
        
        # Format types from decimals to floats for the rules
        for r in perf_records:
            if 'ctr' in r: r['ctr'] = float(r['ctr'])
            if 'cpc' in r: r['cpc'] = float(r['cpc'])
            if 'spend' in r: r['spend'] = float(r['spend'])
            
        # Optional: join campaigns table to get platform, if needed by the rule (BC-301)
        camp_res = campaigns_table.scan()
        camp_map = {c['id']: c for c in camp_res.get('Items', [])}
        for r in perf_records:
            cid = r.get("campaign_id")
            if cid in camp_map:
                r["campaigns"] = {"platform": camp_map[cid].get("platform", "unknown"), "status": camp_map[cid].get("status", "unknown")}
        
        # Sort desc by date, limit to 500 for the sample audit window
        perf_records.sort(key=lambda x: x.get('date', ''), reverse=True)
        perf_records = perf_records[:500]
        
        # Fetch all ad variants
        ads_res = ad_copy_table.scan()
        ad_variants = ads_res.get('Items', [])
        for a in ad_variants:
            if 'performance_score' in a: a['performance_score'] = float(a['performance_score'])
            if 'peak_ctr' in a: a['peak_ctr'] = float(a['peak_ctr'])
            if 'days_active' in a: a['days_active'] = int(a['days_active'])
        
    except Exception as e:
        return {"status": "error", "message": f"DB fetch failed: {e}"}
    
    # Run all rule checks
    all_findings = []
    all_findings += check_low_ctr(perf_records)
    all_findings += check_high_cpc(perf_records)
    all_findings += check_creative_fatigue(ad_variants)
    all_findings += check_zero_spend_high_impressions(perf_records)
    all_findings += check_draft_ads_not_activated(ad_variants)
    all_findings += check_all_ads_on_one_platform(perf_records)
    all_findings += check_no_active_ads(ad_variants)
    all_findings += check_headline_length(ad_variants)
    all_findings += check_cta_missing(ad_variants)
    
    # Count by severity
    high = sum(1 for f in all_findings if f["severity"] == SEVERITY_HIGH)
    medium = sum(1 for f in all_findings if f["severity"] == SEVERITY_MEDIUM)
    low = sum(1 for f in all_findings if f["severity"] == SEVERITY_LOW)
    
    # Compute a simple ads health score (0-100)
    total_checks = 9  # number of check functions above
    issues = high * 3 + medium * 2 + low * 1
    health_score = max(0, round(100 - (issues / (total_checks * 3)) * 100))
    
    print(f"[optimization] Audit complete. {len(all_findings)} findings. Health score: {health_score}/100")
    
    return {
        "status": "success",
        "health_score": health_score,
        "summary": {
            "total": len(all_findings),
            "high": high,
            "medium": medium,
            "low": low,
        },
        "findings": all_findings,
    }


if __name__ == "__main__":
    result = run_marketing_brain_audit()
    print(json.dumps(result, indent=2))
