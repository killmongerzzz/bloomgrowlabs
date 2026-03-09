import os
import json
import uuid
import datetime
from typing import List, Optional
from pydantic import BaseModel
from dotenv import load_dotenv

# Meta SDK
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.campaign import Campaign

from db import campaigns_table
from sandbox_agent import validate_campaign_structure

# Meta Ads Setup
META_ACCESS_TOKEN = os.environ.get("META_ACCESS_TOKEN")
META_APP_ID = os.environ.get("META_APP_ID", "YOUR_APP_ID")
META_APP_SECRET = os.environ.get("META_APP_SECRET", "YOUR_APP_SECRET")
# Note: You need the actual Ad Account ID to push campaigns
META_AD_ACCOUNT_ID = os.environ.get("META_AD_ACCOUNT_ID", "act_YOUR_AD_ACCOUNT_ID")

if META_ACCESS_TOKEN:
    FacebookAdsApi.init(META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN)


class CampaignLaunchRequest(BaseModel):
    name: str
    creative_id: str
    platform: str # 'meta' or 'google'
    budget: float
    audience_target: str
    objective: str

def launch_meta_campaign(req: CampaignLaunchRequest) -> dict:
    """Creates a campaign in Meta Ads Manager."""
    print("Launching Meta Campaign...")
    try:
         account = AdAccount(META_AD_ACCOUNT_ID)
         
         # In a real scenario, you'd create Campaign -> AdSet -> Ad.
         # This is a structural skeleton.
         params = {
             'name': f'BloomGrow Agent Test - {req.audience_target}',
             'objective': 'OUTCOME_TRAFFIC', 
             'status': 'PAUSED', # Start paused for safety
             'special_ad_categories': [],
         }
         
         # Uncomment to actually create via API when Ad Account ID is valid
         # campaign = account.create_campaign(
         #    fields=[Campaign.Field.id],
         #    params=params,
         # )
         # campaign_id = campaign.get_id()
         
         campaign_id = "mock_meta_camp_12345"
         return {"status": "success", "platform_campaign_id": campaign_id}
         
    except Exception as e:
         print(f"Meta API Error: {e}")
         return {"status": "error", "message": str(e)}

def launch_google_campaign(req: CampaignLaunchRequest) -> dict:
    """Creates a campaign in Google Ads."""
    print("Launching Google Campaign...")
    # Requires google-ads Python client and a populated google-ads.yaml or env vars.
    # Skeleton structure for Google.
    campaign_id = "mock_google_camp_67890"
    return {"status": "success", "platform_campaign_id": campaign_id}

def run_ad_launcher_pipeline(req: CampaignLaunchRequest):
    """Main routing function to prepare a campaign as a 'Draft'."""
    # Step 1: Sandbox Validation (Mandatory for Experimentation)
    sandbox_res = validate_campaign_structure({
        "destination_link": "https://bloomgrow.ai/download", # Placeholder
        "budget": req.budget,
        "objective": req.objective,
        "creative_id": req.creative_id
    })
    
    if sandbox_res["status"] == "error":
        return sandbox_res
        
    # Step 2: Save as Draft (No real API launch)
    try:
        campaign_id = str(uuid.uuid4())
        campaigns_table.put_item(
            Item={
                "id": campaign_id,
                "name": req.name,
                "platform": req.platform,
                "budget": str(req.budget),
                "status": "Draft", # Default to Draft as per experiment requirements
                "objective": req.objective,
                "audience": req.audience_target,
                "sandbox_validated": True,
                "created_at": datetime.datetime.utcnow().isoformat() + "Z",
                "variant_name": req.creative_id
            }
        )
        return {
            "status": "success",
            "message": "Campaign prepared as Draft and validated in Sandbox.",
            "internal_id": campaign_id,
            "sandbox_details": sandbox_res
        }
    except Exception as e:
        print(f"Error saving to DB: {e}")
        return {"status": "error", "message": f"DB Error: {str(e)}"}

if __name__ == "__main__":
    test_req = CampaignLaunchRequest(
        creative_id="cr-123",
        platform="meta",
        budget=50.0,
        audience_target="Parents 25-45",
        objective="App Installs"
    )
    print(json.dumps(run_ad_launcher_pipeline(test_req), indent=2))
