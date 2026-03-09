import os
import uuid
import datetime
import random
from typing import List, Dict, Any
from pydantic import BaseModel
import google.generativeai as genai

from db import competitor_ads_table

# Initialize Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
generation_config = {
    "temperature": 0.4,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 1024,
    "response_mime_type": "application/json",
}
model = genai.GenerativeModel(
    model_name="gemini-2.5-flash",
    generation_config=generation_config,
)

class ScrapedAd(BaseModel):
    id: str
    brand: str
    image_url: str
    headline: str
    subtext: str
    cta: str
    landing_page: str
    
class ExtractedStyle(BaseModel):
    template_type: str
    background_style: str
    color_palette: str
    icon_presence: bool

class CopyPattern(BaseModel):
    headline_pattern: str
    angle: str

def scrape_competitor_ads(brands: List[str]) -> List[ScrapedAd]:
    """
    Module 1: Ad Collection Module
    In a production system, this would interface with Meta Ad Library API or a headless browser scraper.
    For this lab, we mock the collection of high-performing competitor ads based on input brands.
    """
    mock_ads = [
        ScrapedAd(
            id=str(uuid.uuid4()),
            brand="Headspace" if "Headspace" in brands else "FocusApp",
            image_url="https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80",
            headline="Find your calm, anytime.",
            subtext="Guided meditation for busy minds.",
            cta="Try Free",
            landing_page="https://example.com/calm"
        ),
        ScrapedAd(
            id=str(uuid.uuid4()),
            brand="Lingokids" if "Lingokids" in brands else "EduPlay",
            image_url="https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=800&q=80",
            headline="Is screen time actually helping?",
            subtext="Turn playtime into brain time.",
            cta="Get Started",
            landing_page="https://example.com/kids"
        ),
        ScrapedAd(
            id=str(uuid.uuid4()),
            brand="Duolingo" if "Duolingo" in brands else "Fluent",
            image_url="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
            headline="\"I learned Spanish in 3 months!\"",
            subtext="The fun, free way to learn a language.",
            cta="Download Now",
            landing_page="https://example.com/learn"
        ),
        ScrapedAd(
            id=str(uuid.uuid4()),
            brand="BetterHelp" if "BetterHelp" in brands else "TherapyApp",
            image_url="https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=800&q=80",
            headline="Therapy on your terms.",
            subtext="Match with a licensed therapist today.",
            cta="Match Me",
            landing_page="https://example.com/therapy"
        )
    ]
    return mock_ads

def extract_image_style(ad: ScrapedAd) -> ExtractedStyle:
    """
    Module 2: Image Style Extraction
    Uses heuristics (or a Vision model if implemented) to classify the visual design of the ad.
    """
    # Vision logic mock: infer from the mock ads
    if "calm" in ad.headline.lower() or "therapy" in ad.headline.lower():
        return ExtractedStyle(
            template_type="photo_typography",
            background_style="nature_photo",
            color_palette="earthy_green",
            icon_presence=False
        )
    elif "time" in ad.headline.lower():
        return ExtractedStyle(
            template_type="illustration_card",
            background_style="solid",
            color_palette="warm_orange",
            icon_presence=True
        )
    elif "learned" in ad.headline.lower() or '\"' in ad.headline:
        return ExtractedStyle(
            template_type="paper_quote_testimonial",
            background_style="nature_photo",
            color_palette="calm_blue",
            icon_presence=False
        )
    else:
        return ExtractedStyle(
            template_type="billboard_mockup",
            background_style="city_street",
            color_palette="bold_teal",
            icon_presence=True
        )

def extract_copy_pattern(ad: ScrapedAd) -> CopyPattern:
    """
    Module 3: Copy Pattern Extraction
    Uses Gemini to analyze the messaging strategy of the competitor ad.
    """
    prompt = f"""
    Analyze the following ad copy and extract its structural pattern and emotional angle.
    Headline: "{ad.headline}"
    Subtext: "{ad.subtext}"
    
    Output JSON exactly matching this schema:
    {{
        "headline_pattern": "e.g., question_hook, declarative, testimonial, benefit_driven, curiosity",
        "angle": "e.g., FOMO, solution-oriented, social_proof, urgency"
    }}
    """
    try:
        response = model.generate_content(prompt)
        import json
        data = json.loads(response.text)
        return CopyPattern(
            headline_pattern=data.get("headline_pattern", "benefit_driven"),
            angle=data.get("angle", "solution-oriented")
        )
    except Exception as e:
        print(f"Error extracting copy pattern: {e}")
        return CopyPattern(headline_pattern="benefit_driven", angle="solution-oriented")

def run_scraper_pipeline(brands: List[str]) -> Dict[str, Any]:
    """
    Runs the full collection, extraction, clustering, and storage pipeline.
    """
    ads = scrape_competitor_ads(brands)
    
    results = []
    clusters = {}
    
    for ad in ads:
        # Module 2 & 3: Extraction
        style = extract_image_style(ad)
        pattern = extract_copy_pattern(ad)
        
        # Module 4: Style Clustering
        # We group by template type to create generic reusable "Style Clusters"
        cluster_name = f"{style.template_type}_cluster"
        if cluster_name not in clusters:
            clusters[cluster_name] = {
                "name": cluster_name,
                "template_type": style.template_type,
                "common_palettes": set(),
                "icon_usage": style.icon_presence,
                "patterns": set(),
                "examples": []
            }
        
        clusters[cluster_name]["common_palettes"].add(style.color_palette)
        clusters[cluster_name]["patterns"].add(pattern.headline_pattern)
        clusters[cluster_name]["examples"].append(ad.image_url)
        
        # Format the record
        record = {
            "id": ad.id,
            "brand": ad.brand,
            "image_url": ad.image_url,
            "headline": ad.headline,
            "subtext": ad.subtext,
            "cta": ad.cta,
            "landing_page": ad.landing_page,
            "style_metadata": style.dict(),
            "copy_pattern": pattern.dict(),
            "cluster": cluster_name,
            "created_at": datetime.datetime.utcnow().isoformat() + "Z"
        }
        results.append(record)
        
        # Store in DB
        try:
            competitor_ads_table.put_item(Item=record)
        except Exception as e:
            print(f"Failed to save scraped ad {ad.id}: {e}")
            
    # Serialize sets for returning
    for c in clusters.values():
        c["common_palettes"] = list(c["common_palettes"])
        c["patterns"] = list(c["patterns"])

    return {
        "status": "success",
        "message": f"Scraped and clustered {len(ads)} ads.",
        "ads": results,
        "clusters": list(clusters.values())
    }

def generate_template_from_cluster(cluster_name: str) -> Dict[str, Any]:
    """
    Module 5: Template Generator
    Maps a discovered style cluster back into a BloomGrow creative template config.
    """
    # In a real app we'd fetch the cluster config from DB
    # We mock the mapping here based on the cluster_name string
    
    base_template = cluster_name.replace("_cluster", "")
    
    config = {
        "template": base_template,
        "color_palette": "bold_teal", # Default fallback
        "background_type": "image" if base_template != "illustration_card" else "solid",
        "icon": "none" if base_template != "illustration_card" else "smiley",
        "source": cluster_name
    }
    
    return config
