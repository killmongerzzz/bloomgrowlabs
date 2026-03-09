import os
import requests
import json
import google.generativeai as genai
import uuid
from typing import List
from pydantic import BaseModel
from dotenv import load_dotenv

from db import pain_points_table

# API Keys
PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY")

# Simple rotation for Gemini keys
GEMINI_KEYS = [
    os.environ.get("GEMINI_API_KEY_1"),
    os.environ.get("GEMINI_API_KEY_2"),
    os.environ.get("GEMINI_API_KEY_3"),
]
# Remove Nones
GEMINI_KEYS = [k for k in GEMINI_KEYS if k]

def get_gemini_client():
    """Tries to configure Gemini using available keys with a basic fallback mechanism."""
    # For a robust production app, you would want to catch quota errors specifically and cycle.
    # Here, we'll try configuring with the first available key.
    if not GEMINI_KEYS:
        raise ValueError("No Gemini keys available")
    genai.configure(api_key=GEMINI_KEYS[0])
    return genai.GenerativeModel("gemini-2.5-flash")

class PainPoint(BaseModel):
    source: str
    source_type: str  # New: "Reddit", "App Store", "Youtube", etc.
    text: str
    frequency: int
    relevance_score: int # New: 0-100 score of how well it fits the product context

class ProductContext(BaseModel):
    name: str
    description: str
    target_audience: str
    key_features: List[str]
    competitors: List[str]

def analyze_product_context(site_url: str) -> ProductContext:
    """Uses Perplexity to 'read' the site and extract product context."""
    print(f"Analyzing product context for: {site_url}...")
    
    url = "https://api.perplexity.ai/chat/completions"
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    prompt = f"Visit {site_url} and provide a structured analysis of what this product is, who it is for (pains/audience), and its core features. List any key competitors mentioned or implied."
    
    payload = {
        "model": "sonar-pro",
        "messages": [
            {"role": "system", "content": "You are a product researcher. Extract structured details from URLs."},
            {"role": "user", "content": prompt}
        ]
    }
    
    response = requests.post(url, headers=headers, json=payload)
    if not response.ok:
        print(f"Perplexity Product Analysis Error: {response.text}")
        # Return a default if it fails
        return ProductContext(
            name="Unknown Product",
            description="Could not analyze URL",
            target_audience="General",
            key_features=[],
            competitors=[]
        )
        
    raw_analysis = response.json()["choices"][0]["message"]["content"]
    
    # Use Gemini to turn raw analysis into structured ProductContext
    model = get_gemini_client()
    structure_prompt = f"Turn this raw product analysis into a valid JSON object matching this schema: {{'name': string, 'description': string, 'target_audience': string, 'key_features': [string], 'competitors': [string]}}.\n\nRAW ANALYSIS:\n{raw_analysis}"
    
    res = model.generate_content(structure_prompt)
    res_text = res.text.strip()
    if "```json" in res_text:
        res_text = res_text.split("```json")[-1].split("```")[0].strip()
    
    try:
        return ProductContext(**json.loads(res_text))
    except:
        return ProductContext(name="Generic App", description=raw_analysis[:200], target_audience="Parents", key_features=[], competitors=[])

def query_segmented_search(context: ProductContext, sources: List[str], competitors: List[str] = None) -> str:
    """Performs a segmented search across specified sources."""
    print(f"Running segmented search for {context.name} across {sources}...")
    
    comp_context = f" Pay special attention to competitors: {', '.join(competitors or [])}." if competitors else ""
    sources_str = ", ".join(sources) if sources else "Reddit, YouTube, App Store, and parenting forums"
    
    url = "https://api.perplexity.ai/chat/completions"
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    prompt = (
        f"Research parent pain points for a product described as: {context.description}. "
        f"Target Audience: {context.target_audience}.{comp_context} "
        f"Search specifically on these platforms: {sources_str}. "
        "Find specific complaints, frustrations, and 'unmet needs' related to this category. "
        "Be extremely specific. Mention the platform where each common complaint was found."
    )
    
    payload = {
        "model": "sonar-pro",
        "messages": [
            {"role": "system", "content": "You are a deep-dive marketing researcher. Find raw, gritty user complaints and frustrations."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3
    }
    
    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def extract_themes_with_gemini(raw_text: str, context: ProductContext) -> List[PainPoint]:
    """Feeds raw Perplexity text to Gemini to extract structured JSON data."""
    print("Extracting themes with Gemini...")
    model = get_gemini_client()
    
    prompt = f"""
    Analyze the following raw research report about parent complaints.
    The goal is to find pain points RELEVANT to the following product context:
    Name: {context.name}
    Description: {context.description}
    Target Audience: {context.target_audience}
    
    RAW RESEARCH REPORT:
    {raw_text}
    
    Extract the top distinct pain points.
    Return a valid JSON array of objects.
    Each object must have:
    - "source": string (The specific community or platform, e.g., "Reddit (r/Parenting)")
    - "source_type": string ("Reddit", "App Store", "YouTube", "Facebook", or "Forum")
    - "text": string (the core complaint)
    - "frequency": integer (0-100 based on the report)
    - "relevance_score": integer (0-100: How specifically this complaint applies to OUR product context)
    
    JSON Array Output:
    """
    
    response = model.generate_content(prompt)
    response_text = response.text.strip()
    
    # Strip markdown formatting if present
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.endswith("```"):
         response_text = response_text[:-3]
         
    try:
        data = json.loads(response_text)
        points = []
        for item in data:
            points.append(PainPoint(**item))
        return points
    except Exception as e:
        print(f"Error parsing Gemini JSON: {e}")
        print(f"Raw response: {response.text}")
        return []

def run_research_pipeline(site_url: str = None, competitors: List[str] = None, sources: List[str] = None):
    """Main pipeline to run the research agent with product context and branding settings."""
    try:
        # Fetch Branding settings for audience targeting
        from db import branding_table
        target_audience_override = None
        try:
            res = branding_table.get_item(Key={'id': 'current'})
            settings = res.get('Item', {})
            if settings and settings.get('primary_audience'):
                target_audience_override = f"{settings.get('primary_audience')} ({settings.get('market_segment', '')})"
        except Exception as e:
            print(f"Branding fetch error in research: {e}")

        # 1. Product Context Analysis
        if site_url:
            context = analyze_product_context(site_url)
            # Merge competitor lists
            if competitors:
                context.competitors = list(set(context.competitors + competitors))
            if target_audience_override:
                context.target_audience = target_audience_override
        else:
            context = ProductContext(
                name="General Parenting App",
                description="Educational and activity apps for parents and young children.",
                target_audience=target_audience_override or "Parents with children ages 0-8",
                key_features=[],
                competitors=competitors or []
            )

        # 2. Segmented Search
        raw_data = query_segmented_search(context, sources, context.competitors)
        
        # 3. Structuring
        pain_points = extract_themes_with_gemini(raw_data, context)
        
        saved_count = 0
        if pain_points:
            import datetime
            for p in pain_points:
                try:
                    pain_points_table.put_item(
                        Item={
                            "id": str(uuid.uuid4()),
                            "source": p.source,
                            "source_type": p.source_type,
                            "text": p.text,
                            "frequency": p.frequency,
                            "relevance_score": p.relevance_score,
                            "created_at": datetime.datetime.utcnow().isoformat() + "Z"
                        }
                    )
                    saved_count += 1
                except Exception as e:
                    print(f"Error saving to DB: {e}")
                    
        return {
            "status": "success",
            "message": f"Research complete for {context.name}. Extracted {len(pain_points)} themes. Saved {saved_count} to DB.",
            "product_context": context.dict(),
            "data": [p.dict() for p in pain_points]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    result = run_research_pipeline()
    print(json.dumps(result, indent=2))
