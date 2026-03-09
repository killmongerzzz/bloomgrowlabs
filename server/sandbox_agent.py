
import re

def validate_campaign_structure(campaign_data: dict):
    """Mocks Meta Ads API validation for campaign structure."""
    errors = []
    
    # 1. Destination URL check
    link = campaign_data.get("destination_link", "")
    if not link.startswith("http"):
        errors.append("Invalid Destination URL. Must start with http/https.")
    elif "bloomgrow.ai" not in link and "appstore" not in link.lower():
        errors.append("Destination Link must be an authorized BloomGrow or App Store domain.")
        
    # 2. Objective vs Format check
    objective = campaign_data.get("objective", "")
    if objective == "App Installs" and not campaign_data.get("creative_id"):
        errors.append("App Install campaigns require a valid creative_id mapping.")
        
    # 3. Budget sanity check
    budget = float(campaign_data.get("budget", 0))
    if budget < 5:
        errors.append("Daily budget must be at least $5.00 for Meta Sandbox validation.")
        
    if errors:
        return {"status": "error", "errors": errors}
    
    return {
        "status": "success",
        "message": "Campaign structure validated in Sandbox mode. Ready for manual export.",
        "sandbox_id": "sbx-vld-9981"
    }
