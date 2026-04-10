import os
import json
import decimal
import google.generativeai as genai
import uuid
from typing import List
from pydantic import BaseModel
from dotenv import load_dotenv

from db import ad_copy_table

# Simple rotation for Gemini keys
GEMINI_KEYS = [
    os.environ.get("GEMINI_API_KEY_1"),
    os.environ.get("GEMINI_API_KEY_2"),
    os.environ.get("GEMINI_API_KEY_3"),
]
GEMINI_KEYS = [k for k in GEMINI_KEYS if k]

def get_gemini_client():
    if not GEMINI_KEYS:
        raise ValueError("No Gemini keys available")
    genai.configure(api_key=GEMINI_KEYS[0])
    return genai.GenerativeModel("gemini-2.5-flash")

class GeneratedCopy(BaseModel):
    headline: str
    supporting_text: str
    call_to_action: str
    visual_template: str # e.g., 'proof_focus', 'minimalist', 'split_screen'

def generate_ad_copy(pain_point_text: str, tone: str, copy_style: str = "calm_narrative") -> List[GeneratedCopy]:
    """Uses Gemini to generate ad copy variations based on a pain point and branding context."""
    print(f"Generating ad copy [{copy_style}] for: '{pain_point_text}' tone: '{tone}'...")

    # Fetch Branding Context
    from db import branding_table
    branding_context = ""
    try:
        res = branding_table.get_item(Key={'id': 'current'})
        settings = res.get('Item', {})
        if settings:
            branding_context = f"""
            BRANDING CONTEXT:
            - Primary Audience: {settings.get('primary_audience', 'Parents')}
            - Market Segment: {settings.get('market_segment', 'Mass market')}
            - Tone Preference: {settings.get('tone_preference', tone)}
            - Communication Style: {settings.get('comm_style', 'Balanced')}
            - AI Prominence: {settings.get('ai_prominence', 'Subtle')}
            """
    except Exception as e:
        print(f"Branding fetch error (using defaults): {e}")

    model = get_gemini_client()

    if copy_style == "problem_solution":
        prompt = f"""
    You are a direct-response conversion copywriter for BloomGrow.ai. 
    CRITICAL: YOU ARE WRITING TO PARENTS. THE TARGET CUSTOMER IS THE PARENT.
    
    MANDATORY RULE: You MUST use the word "Parents" or "Parenting" in either the Headline OR the Supporting Text.
    
    {branding_context}
    
    STYLE EXAMPLE:
    Headline: "Peace of mind for busy, caring parents"
    Supporting: "Trusted learning, without ads or privacy concerns."
    
    APP VALUE PROP: BloomGrow.ai is a privacy-first, ad-free learning platform for children.
    
    PARENT PAIN POINT:
    "{pain_point_text}"
    
    Generate 3 ad copy variations. Each one MUST follow this strict Problem → Solution structure:
    
    LAYER 1 — PROBLEM HOOK (Headline):
    - Name the parent's problem or emotional tension directly.
    - Style: Empathetic, calm, and deeply parent-centric.
    - Max 10 words. No exclamation marks.
    
    LAYER 2 — SOLUTION + PROOF (Supporting Text):
    - State exactly how BloomGrow solves the parent's tension.
    - Use "your child" or "their screen time" to maintain the parent-to-parent dialogue.
    - Must include: "no ads" or "ad-free" or "privacy-first".
    - Max 120 characters.
    
    LAYER 3 — ACTION CUE (CTA):
    - A direct, parent-oriented action: "Start your 14-day free trial".
    
    Return a valid JSON array. Each object:
    {{
      "headline": "...",
      "supporting_text": "...",
      "call_to_action": "...",
      "visual_template": "split_screen" | "proof_focus" | "testimony_paper"
    }}
    JSON Array:
    """
    else:
        # calm_narrative — original Headspace-style prompt
        prompt = f"""
    You are an expert Performance Copywriter specializing in Parent-to-Parent communication.
    {branding_context}
    
    CRITICAL: YOU ARE WRITING TO PARENTS. MANDATORY: The word "Parents" or "Parenting" MUST appear in every variation.
    
    STYLE EXAMPLE:
    Headline: "Peace of mind for busy, caring parents"
    Supporting: "Trusted learning, without ads or privacy concerns."
    
    Parents have expressed the following pain point:
    "{pain_point_text}"
    
    Generate 3 distinct ad copy variations. Each MUST speak directly to the parent's perspective.
    
    HEADLINE PATTERNS (Parent-First):
    - Question Hook (e.g., "Is their screen time actually helping?")
    - Curiosity (e.g., "The quiet shift in their learning habit.")
    - Transformation (e.g., "Give your child a safer start.")
    - Insight (e.g., "Why privacy matters for your child's first app.")
    
    STRICT RULES:
    - NEVER address the child.
    - Use soft, human language (Headspace style).
    - No exclamation marks in headlines.
    - Supporting text must be a short, reflective benefit for the PARENT.
    
    Return a valid JSON array. Each object:
    {{
      "headline": "...",
      "supporting_text": "...",
      "call_to_action": "...",
      "visual_template": "proof_focus" | "minimalist" | "split_screen" | "testimony_paper" | "character_smile"
    }}
    JSON Array:
    """

    response = model.generate_content(prompt)
    response_text = response.text.strip()
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.endswith("```"):
        response_text = response_text[:-3]

    try:
        data = json.loads(response_text)
        return [GeneratedCopy(**item) for item in data]
    except Exception as e:
        print(f"Error parsing Gemini JSON: {e}\nRaw: {response.text}")
        return []

def run_messaging_pipeline(pain_point_id: str, pain_point_text: str, tone: str, copy_style: str = "calm_narrative"):
    """Generates copy and saves it to the database."""
    variations = generate_ad_copy(pain_point_text, tone, copy_style=copy_style)
    
    saved_count = 0
    if variations:
        import datetime
        for v in variations:
            try:
                ad_copy_table.put_item(
                    Item={
                        "id": str(uuid.uuid4()),
                        "pain_point_id": pain_point_id,
                        "headline": v.headline,
                        "supporting_text": v.supporting_text,
                        "cta": v.call_to_action,
                        "visual_template": v.visual_template,
                        "tone": tone,
                        "copy_style": copy_style,
                        "status": "draft",
                        "performance_score": decimal.Decimal("0.0"),
                        "days_active": 0,
                        "variant_group": f"vg-{uuid.uuid4().hex[:8]}",
                        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
                        "peak_ctr": decimal.Decimal("0.0")
                    }
                )
                saved_count += 1
            except Exception as e:
                print(f"Error saving ad copy to DB: {e}")
                
    return {
        "status": "success",
        "message": f"Generated and saved {saved_count} variations.",
        "data": [v.dict() for v in variations]
    }

if __name__ == "__main__":
    # Test execution
    res = run_messaging_pipeline(
        pain_point_id="test-id", 
        pain_point_text="Kids addicted to screens and toxic content", 
        tone="Empathetic & Educational"
    )
    print(json.dumps(res, indent=2))
