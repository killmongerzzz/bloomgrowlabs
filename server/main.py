import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from db import pain_points_table, ad_copy_table, campaigns_table, branding_table

# Import Agents
from research_agent import run_research_pipeline
from messaging_agent import run_messaging_pipeline
from creative_agent import (
    run_creative_generation_pipeline,
    regenerate_creative_directive,
    regenerate_creative_background,
    mutate_creative
)
from competitor_scraper_agent import run_scraper_pipeline
from db import competitor_ads_table
from ad_launcher_agent import run_ad_launcher_pipeline, CampaignLaunchRequest
from analytics_agent import run_analytics_sweep, get_aggregated_dashboard_data
from optimization_agent import run_marketing_brain_audit
from bedrock_client import explain_finding_with_claude
from ad_lifecycle_agent import (
    get_all_variants,
    score_ad_variants,
    promote_variant,
    demote_variant,
    retire_variant,
    retire_fatigued_ads,
    refresh_variants_from_winners,
)
from meta_ads_agent import (
    get_meta_account_info,
    create_meta_campaign,
    list_meta_campaigns,
    get_campaign_insights,
    sync_meta_insights,
    optimize_campaign,
    run_bulk_optimization,
    run_automation_rules,
    get_meta_performance_dashboard,
    AUTOMATION_RULES,
    THRESHOLDS,
)

load_dotenv()

app = FastAPI(title="BloomGrow Growth OS — Agentic Marketing Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:9000", "http://localhost:9002", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BrandingSettings(BaseModel):
    id: str = "current"
    primary_audience: str = "" # age group, geography, income
    market_segment: str = "" # premium urban vs mass-market
    comm_style: str = "" # Tech-forward, Science-backed, Emotion-led, Balanced
    content_mix: list = [] # Thought leadership, Parenting insights, etc.
    content_length: str = "" # short, explanatory
    ai_prominence: str = "" # how prominently AI is highlighted
    tone_preference: str = "" # Calm, Bold, Warm, Visionary
    design_direction: str = "" # Minimal, Soft, Modern SaaS, Playful
    visual_focus: str = "" # Parents, Children, Product UI, Abstract
    admired_brands: str = ""
    brand_colors: str = "" # Hex codes or direction (Trust blues, etc.)
    avoid_colors: str = ""
    typography: str = "" # Modern sans-serif, Rounded, etc.
    execution_priority: str = "" # Website, App, Instagram, etc.

@app.get("/settings/branding")
def get_branding():
    try:
        res = branding_table.get_item(Key={'id': 'current'})
        item = res.get('Item')
        
        if not item:
            # Default "Headspace-style" Brand Identity
            item = {
                "id": "current",
                "primary_audience": "Millennial parents, 30-45, urban/suburban",
                "market_segment": "Premium digital wellness/education",
                "comm_style": "Calm, science-backed, supportive, empathetic",
                "content_mix": "Mindful parenting tips, benefits of play, screen-time balance",
                "content_length": "Short, punchy, breathing room",
                "ai_prominence": "Invisible tech, human outcomes",
                "tone_preference": "Calm, Warm, Visionary, Modern",
                "design_direction": "Soft, Modern SaaS, Playful yet structured",
                "visual_focus": "Children playing, calm nature, abstract shapes",
                "admired_brands": "Headspace, Calm, Khan Academy Kids, Apple",
                "brand_colors": "Soft blues, earthy greens, warm orange, white space",
                "avoid_colors": "Neon colors, harsh reds, pure black",
                "typography": "Modern rounded sans-serif, bold clear headers",
                "execution_priority": "Mobile App, Instagram, Meta Ads"
            }
        return {"status": "success", "data": item}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/settings/branding")
def update_branding(req: BrandingSettings):
    try:
        branding_table.put_item(Item=req.dict())
        return {"status": "success", "message": "Branding settings updated."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Initialize Application


@app.get("/icons/random")
def get_random_icon():
    """Returns a random icon URL from the BloomGrow_IconCache table, proxied through our backend."""
    try:
        from db import icon_cache_table
        import random
        res = icon_cache_table.scan(Limit=100)
        items = res.get('Items', [])
        if not items:
            return {"status": "success", "url": "https://api.iconify.design/mdi:emoticon-outline.svg"}
        
        choice = random.choice(items)
        raw_url = choice.get('icon_url')
        
        # Proxy it to avoid S3 CORS issues
        proxied_url = f"http://localhost:8000/icons/proxy?url={raw_url}"
        return {"status": "success", "url": proxied_url}
    except Exception as e:
        return {"status": "error", "message": str(e), "url": "https://api.iconify.design/mdi:emoticon-outline.svg"}

@app.get("/icons/proxy")
def proxy_icon(url: str):
    """Proxies S3 SVG icons to bypass CORS issues in the browser."""
    import requests
    from fastapi.responses import Response
    
    # Validation: Only allow our bucket
    if "bloomgrow-assets.s3.amazonaws.com" not in url and ".s3.amazonaws.com" not in url:
        raise HTTPException(status_code=403, detail="Unauthorized icon source")
        
    try:
        res = requests.get(url, timeout=5)
        if res.status_code != 200:
            raise HTTPException(status_code=404, detail="Icon not found")
            
        return Response(content=res.content, media_type="image/svg+xml")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "BloomGrow Growth OS — Backend Online", "version": "2.0"}


# --------------------------------
# Research Agent
# --------------------------------
class ResearchRunRequest(BaseModel):
    site_url: str | None = None
    competitors: list = []
    sources: list = []

@app.post("/research/run")
def run_research(req: ResearchRunRequest):
    """Triggers the Research Agent (Product Analysis → Segmented Search → Gemini structuring)."""
    return run_research_pipeline(
        site_url=req.site_url,
        competitors=req.competitors,
        sources=req.sources
    )

@app.get("/research/results")
def get_research_results():
    try:
        res = pain_points_table.scan()
        data = res.get('Items', [])
        data.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------------
# Messaging / Copy Agent
# --------------------------------
class CopyGenerateRequest(BaseModel):
    pain_point_id: str
    pain_point_text: str
    tone: str
    copy_style: str = "calm_narrative"

class ScraperRequest(BaseModel):
    brands: list[str]

@app.post("/competitors/scrape")
def trigger_competitor_scrape(req: ScraperRequest):
    """Triggers the Scraper Agent to find and analyze competitor ads."""
    try:
        if not req.brands:
            return {"status": "error", "message": "Please provide a list of brands to scrape."}
        return run_scraper_pipeline(req.brands)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/competitors/ads")
def get_competitor_ads():
    """Fetches all scraped and clustered competitor ads."""
    try:
        from boto3.dynamodb.conditions import Key
        
        # In DynamoDB, scan retrieves all.
        res = competitor_ads_table.scan()
        data = res.get('Items', [])
        
        # Sort by creation
        data.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # Re-derive clusters for the UI from the stored data dynamically
        # or just return the raw ads and let the UI handle grouping.
        # We will return the raw clustered data.
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/copy/generate")
def generate_copy(req: CopyGenerateRequest):
    """Triggers the Messaging Agent (Gemini copy generation)."""
    return run_messaging_pipeline(req.pain_point_id, req.pain_point_text, req.tone, req.copy_style)

class CreativeBatchRequest(BaseModel):
    copy_id: str
    count: int = 5
    style_source: dict | None = None
    promo_text: str | None = None

@app.post("/creatives/batch-generate")
def batch_generate_creatives(req: CreativeBatchRequest):
    """Triggers the Creative Agent (Gemini background + genomes for an existing copy)."""
    return run_creative_generation_pipeline(
        req.copy_id, 
        req.count, 
        style_source=req.style_source,
        promo_text=req.promo_text
    )

@app.get("/copy/results")
def get_copy_results():
    try:
        res = ad_copy_table.scan()
        data = res.get('Items', [])
        data.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/copy/promoted")
def get_promoted_copy():
    """Returns only ad copies that have been promoted (status = 'active')."""
    try:
        res = ad_copy_table.scan()
        data = res.get('Items', [])
        promoted = [item for item in data if item.get('status') == 'active']
        promoted.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return {"status": "success", "data": promoted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreativeRegenerateRequest(BaseModel):
    directive: str

@app.post("/creatives/{creative_id}/regenerate-text")
def regenerate_text_creative(creative_id: str, req: CreativeRegenerateRequest):
    """Refines ONLY the text copy of a creative using an AI directive."""
    try:
        res = ad_copy_table.get_item(Key={'id': creative_id})
        current_data = res.get('Item')
        
        if not current_data:
            raise HTTPException(status_code=404, detail="Creative not found")
            
        return regenerate_creative_directive(creative_id, current_data, req.directive)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/creatives/{creative_id}/regenerate-background")
def regenerate_bg_creative(creative_id: str):
    """Generates a new background image using Fal AI."""
    try:
        res = ad_copy_table.get_item(Key={'id': creative_id})
        current_data = res.get('Item')
        
        if not current_data:
            raise HTTPException(status_code=404, detail="Creative not found")
            
        return regenerate_creative_background(creative_id, current_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MutateRequest(BaseModel):
    mutation_type: str

@app.post("/creatives/{creative_id}/mutate")
def mutate_creative_endpoint(creative_id: str, req: MutateRequest):
    """Generates 100 variations of a base creative."""
    try:
        return mutate_creative(creative_id, req.mutation_type, 100)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreativeManualEditRequest(BaseModel):
    headline: str
    supporting_text: str
    cta: str
    destination_link: str | None = None
    offer_pointers: list[str] | None = None

@app.put("/creatives/{creative_id}/text")
def manual_edit_creative(creative_id: str, req: CreativeManualEditRequest):
    """Manually updates the text, pointers and URL of a creative."""
    try:
        res = ad_copy_table.get_item(Key={'id': creative_id})
        current_data = res.get('Item')
        
        if not current_data:
            raise HTTPException(status_code=404, detail="Creative not found")
            
        import datetime
        current_data['headline'] = req.headline
        current_data['supporting_text'] = req.supporting_text
        current_data['cta'] = req.cta
        if req.offer_pointers is not None:
            current_data['offer_pointers'] = req.offer_pointers
        if req.destination_link is not None:
            current_data['genome']['destination_link'] = req.destination_link
        current_data['updated_at'] = datetime.datetime.utcnow().isoformat() + "Z"
        
        ad_copy_table.put_item(Item=current_data)
        
        return {"status": "success", "message": "Creative updated.", "data": current_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------------
# Ad Lifecycle Agent
# --------------------------------
@app.get("/ads/variants")
def list_variants():
    """Returns all ad variants from the DB with status + performance score."""
    data = get_all_variants()
    return {"status": "success", "data": data, "count": len(data)}

@app.post("/ads/score")
def score_variants():
    """Compute performance scores for all active ad variants."""
    return score_ad_variants()

@app.post("/ads/promote/{variant_id}")
def promote_ad(variant_id: str):
    """Promote a variant to 'active' status."""
    return promote_variant(variant_id)

@app.post("/ads/demote/{variant_id}")
def demote_ad(variant_id: str):
    """Demote a variant to 'paused' status."""
    return demote_variant(variant_id)

@app.post("/ads/retire/{variant_id}")
def retire_ad(variant_id: str):
    """Retire a specific ad variant."""
    return retire_variant(variant_id)

@app.post("/ads/retire-fatigued")
def retire_fatigued():
    """Auto-detect and retire fatigued ads (CTR dropped >30% from peak)."""
    return retire_fatigued_ads()

@app.post("/ads/refresh")
def refresh_ads():
    """Auto-generate fresh code-based variants from top performing winners."""
    return refresh_variants_from_winners()


# --------------------------------
# Campaign / Ad Launcher
# --------------------------------
@app.post("/campaigns/launch")
def launch_campaign(req: CampaignLaunchRequest):
    """Triggers the Ad Launcher Agent (Meta/Google)."""
    return run_ad_launcher_pipeline(req)

@app.get("/campaigns/list")
def list_campaigns():
    try:
        res = campaigns_table.scan()
        data = res.get('Items', [])
        data.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------------
# Analytics
# --------------------------------
@app.post("/analytics/sync")
def sync_analytics():
    """Triggers an analytics sweep for all active campaigns."""
    return run_analytics_sweep()

@app.get("/analytics/dashboard")
def get_dashboard_data():
    """Fetches aggregated performance data + time-series for charts."""
    return get_aggregated_dashboard_data()


# --------------------------------
# Optimization — Marketing Brain
# --------------------------------
@app.post("/optimization/audit")
def run_optimization_audit():
    """Runs the pure rule-based Marketing Brain audit (no LLM cost)."""
    return run_marketing_brain_audit()

class ExplainRequest(BaseModel):
    check_id: str
    issue_type: str
    description: str
    recommendation: str
    severity: str

@app.post("/optimization/explain")
def explain_finding(req: ExplainRequest):
    """Calls Claude 3 Haiku via Bedrock to explain a specific audit finding."""
    return explain_finding_with_claude(
        issue_type=req.issue_type,
        description=req.description,
        recommendation=req.recommendation,
        check_id=req.check_id,
        severity=req.severity,
    )

@app.get("/optimization/checks")
def get_available_checks():
    """Returns a list of all available optimization check IDs and descriptions."""
    return {
        "status": "success",
        "checks": [
            {"id": "BC-101", "name": "Low CTR", "threshold": "< 0.8%"},
            {"id": "BC-102", "name": "High CPC", "threshold": "> $5.00"},
            {"id": "BC-103", "name": "Creative Fatigue", "threshold": "score < 70% of peak"},
            {"id": "BC-104", "name": "Zero Clicks", "threshold": ">2000 impressions, 0 clicks"},
            {"id": "BC-201", "name": "Draft Backlog", "threshold": "> 5 draft ads"},
            {"id": "BC-301", "name": "Platform Concentration", "threshold": ">90% on one platform"},
            {"id": "BC-401", "name": "No Active Ads", "threshold": "0 active variants"},
            {"id": "BC-501", "name": "Headline Too Long", "threshold": "> 90 chars"},
            {"id": "BC-502", "name": "Missing CTA", "threshold": "No CTA text"},
        ]
    }


# --------------------------------
# Meta Ads Optimization & Automation
# --------------------------------

class MetaCampaignCreateRequest(BaseModel):
    name: str
    objective: str = "OUTCOME_TRAFFIC"
    daily_budget_usd: float = 20.0
    status: str = "PAUSED"

class MetaCampaignInsightsRequest(BaseModel):
    date_preset: str = "last_7d"

@app.get("/meta/account")
def meta_account_info():
    """Returns Meta Ad Account info (spend limits, currency, status)."""
    try:
        return get_meta_account_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/meta/campaigns/create")
def meta_create_campaign(req: MetaCampaignCreateRequest):
    """Create a new campaign on Meta (sandbox or live based on META_SANDBOX_MODE)."""
    try:
        return create_meta_campaign(
            name=req.name,
            objective=req.objective,
            daily_budget_cents=int(req.daily_budget_usd * 100),
            status=req.status,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/meta/campaigns")
def meta_list_campaigns():
    """List all Meta campaigns (merged from Meta API + DynamoDB)."""
    try:
        return list_meta_campaigns()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/meta/campaigns/{campaign_id}/insights")
def meta_campaign_insights(campaign_id: str, date_preset: str = "last_7d"):
    """Get insights for a specific Meta campaign (real or simulated)."""
    try:
        return get_campaign_insights(campaign_id, date_preset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/meta/sync")
def meta_sync_insights():
    """Pull latest Meta Insights for all tracked campaigns → log to DynamoDB."""
    try:
        return sync_meta_insights()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/meta/campaigns/{campaign_id}/optimize")
def meta_optimize_campaign(campaign_id: str):
    """Run optimization rules on a single campaign (pause, scale, etc.)."""
    try:
        return optimize_campaign(campaign_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/meta/optimize/bulk")
def meta_bulk_optimize():
    """Run optimization engine across ALL active Meta campaigns."""
    try:
        return run_bulk_optimization()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/meta/campaigns/{campaign_id}/automation")
def meta_run_automation(campaign_id: str):
    """Evaluate all automation rules against a campaign and execute triggered actions."""
    try:
        return run_automation_rules(campaign_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/meta/dashboard")
def meta_dashboard():
    """Unified Meta Ads performance dashboard with health scores for all campaigns."""
    try:
        return get_meta_performance_dashboard()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/meta/automation/rules")
def meta_list_rules():
    """Returns all available automation rules with their thresholds."""
    return {
        "status": "success",
        "thresholds": THRESHOLDS,
        "rules": AUTOMATION_RULES,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
