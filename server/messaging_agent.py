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
    You are a direct-response conversion copywriter for BloomGrow.ai — a privacy-first, ad-free,
    one-stop learning platform for children. You write ads that parents immediately connect with
    because they name the exact problem and offer a concrete, believable solution.
    {branding_context}

    PARENT PAIN POINT:
    "{pain_point_text}"

    Generate 3 ad copy variations. Each one MUST follow this strict Problem → Solution structure:

    LAYER 1 — PROBLEM HOOK (Headline):
    - Name the problem directly. Make the parent feel "that's exactly my situation."
    - Use a rhetorical question OR a bold statement of the problem.
    - Examples: "Are ads spoiling your child's screen time?"
                "Random content. No filters. No control."
                "Your child deserves a screen-free-from-ads space."
    - Max 10 words. No punctuation gimmicks. No exclamation marks.

    LAYER 2 — SOLUTION + PROOF (Supporting Text):
    - State exactly what BloomGrow gives them. Be specific and concrete.
    - Must include at least one of: "no ads", "ad-free", "privacy-first", "no interruptions", "parent-guided", "safe".
    - Examples: "BloomGrow.ai gives kids a safe, ad-free learning space — no surprises, no interruptions."
                "Create a secure, enriching environment with zero ads and full parent control."
    - Max 120 characters.

    LAYER 3 — ACTION CUE (CTA):
    - A direct, verb-first action. 2-4 words only.
    - Examples: "Try Free Today", "Start Safe Learning", "Explore Secure Play", "Get Ad-Free Access"

    RULES:
    - NEVER use: "innovative", "world-class", "comprehensive", "platform", "solution", "best".
    - Keep language plain, direct, and parent-relatable.
    - Each of the 3 variations must use a DIFFERENT problem angle.

    Return a valid JSON array (no markdown). Each object:
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
    You are an expert Performance Copywriter for BloomGrow, a children's educational app.
    {branding_context}

    Parents have expressed the following pain point:
    "{pain_point_text}"

    Generate 3 distinct ad copy variations addressing this pain point.
    The tone of the ads should be: {tone}.

    CRITICAL STRUCTURE: Each ad MUST follow this three-layer structure:
    1. Scroll-stopping Hook: Use curiosity, questions, or emotional triggers.
    2. Clear Benefit: Explain the transformation or value the product delivers.
    3. Action Cue: A brief reason/cue to try the product now (max 5 words).

    HEADLINE PATTERNS (Rotate between these):
    - Question Hook (e.g., "Is your toddler's screen time actually helping?")
    - Curiosity Statement (e.g., "The 5-minute habit that changes everything.")
    - Transformation Promise (e.g., "From screen addiction to skill-building.")
    - Testimonial Quote (e.g., "My son finally chooses books over iPads.")

    NEGATIVE CONSTRAINTS:
    - NEVER use generic marketing fluff like "best solution", "innovative platform", "world-class".
    - Avoid exclamation marks in headlines.
    - Keep it short, emotionally resonant, and modern mobile app style.

    Return a valid JSON array (no markdown). Each object:
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
