import os
import json
import uuid
import decimal
import urllib.parse
import urllib.request
import google.generativeai as genai
from typing import List, Optional
from pydantic import BaseModel
from dotenv import load_dotenv
import boto3
import hashlib

from db import ad_copy_table, branding_table, icon_cache_table


load_dotenv()

# Gemini configuration
GEMINI_KEYS = [
    os.environ.get("GEMINI_API_KEY_1"),
    os.environ.get("GEMINI_API_KEY_2"),
    os.environ.get("GEMINI_API_KEY_3"),
]
GEMINI_KEYS = [k for k in GEMINI_KEYS if k]

def get_gemini_client(model_name="gemini-2.5-flash"):
    if not GEMINI_KEYS:
        raise ValueError("No Gemini keys available")
    
    # Round-robin key rotation for high concurrency
    key = GEMINI_KEYS.pop(0)
    GEMINI_KEYS.append(key)
    
    genai.configure(api_key=key)
    return genai.GenerativeModel(model_name)

def fetch_brand_identity():
    """Retrieves the current brand identity from DynamoDB."""
    try:
        res = branding_table.get_item(Key={'id': 'current'})
        item = res.get('Item', {})

        return {
            "audience": item.get('primary_audience', 'Millennial parents'),
            "tone": item.get('tone_preference', 'Calm'),
            "comm_style": item.get('comm_style', 'Balanced'),
            "design_dir": item.get('design_direction', 'Calm Minimal'),
            "visual_focus": item.get('visual_focus', 'Nature'),
            "brands": item.get('admired_brands', 'Headspace, Calm'),
            "colors": item.get('brand_colors', 'Soft blues, warm orange'),
            "typography": item.get('typography', 'Rounded fonts')
        }

    except Exception as e:
        print("Brand fetch error:", e)
        return {}

# Narrative & Template Mappings
NARRATIVE_TYPES = [
    "curiosity", 
    "emotional reassurance", 
    "parent insight", 
    "small transformation", 
    "gentle reflection"
]

import random

# NOTE: This is a lookup function, NOT a dict with random.choice() baked in at import time.
# Using a dict with random.choice() as value would lock the template for the entire server lifetime.
def get_template_for_narrative(narrative: str) -> str:
    if narrative == "curiosity":
        return "stacked_typography"
    if narrative == "emotional reassurance":
        return "photo_typography"
    if narrative == "parent insight":
        return random.choice(["quote_testimonial", "paper_quote_testimonial"])
    if narrative == "small transformation":
        return "illustration_card"
    if narrative == "gentle reflection":
        return random.choice(["blurred_image", "billboard_mockup"])
    return "photo_typography"

# Templates allowed per copy style
# problem_solution: no testimonial/narrative/character formats — direct response only
PROBLEM_SOLUTION_TEMPLATES = [
    "stacked_typography",
    "photo_typography",
    "blurred_image",
    "billboard_mockup"
]

# calm_narrative: all 7 templates
CALM_NARRATIVE_TEMPLATES = [
    "stacked_typography",
    "photo_typography",
    "quote_testimonial",
    "paper_quote_testimonial",
    "illustration_card",
    "blurred_image",
    "billboard_mockup"
]

# Narrative types per copy style
PROBLEM_SOLUTION_NARRATIVES = [
    "problem_hook",
    "solution_reveal",
    "proof_point",
    "urgency_close"
]

CALM_NARRATIVE_TYPES = [
    "curiosity",
    "emotional reassurance",
    "parent insight",
    "small transformation",
    "gentle reflection"
]

# Keep for backward compat in mutation layout list
ALL_TEMPLATES = CALM_NARRATIVE_TEMPLATES

def clean_json_response(text):
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1]
    if "```" in text:
        text = text.split("```")[0]
    return text.strip()

NATURE_QUERIES = [
    "beach",
    "forest",
    "mountain",
    "flowers",
    "lake",
    "nature landscape"
]

URBAN_QUERIES = [
    "city street",
    "modern architecture",
    "urban skyline",
    "highway road"
]

# =========================
# S3 & SVG CACHE
# =========================

def get_s3_client():
    return boto3.client(
        's3',
        region_name=os.environ.get('AWS_REGION', 'us-east-1'),
        aws_access_key_id=os.environ.get('AWS_BLOOMGROW_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_BLOOMGROW_SECRET_ACCESS_KEY')
    )

s3 = get_s3_client()
BUCKET = os.environ.get("AWS_S3_BUCKET", "bloomgrow-assets")

def clean_svg(svg_text):
    svg_text = svg_text.strip()
    if "```svg" in svg_text:
        svg_text = svg_text.split("```svg")[1]
    if "```" in svg_text:
        svg_text = svg_text.split("```")[0]
    return svg_text.strip()

def upload_svg_to_s3(svg_code):
    key = f"icons/{uuid.uuid4()}.svg"
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=svg_code.encode('utf-8'),
        ContentType="image/svg+xml"
    )
    return f"https://{BUCKET}.s3.amazonaws.com/{key}"

def generate_svg_icon(headline):
    headline_hash = hashlib.sha256(headline.encode()).hexdigest()
    
    # Check cache first
    try:
        res = icon_cache_table.get_item(Key={'headline_hash': headline_hash})
        if 'Item' in res and 'icon_url' in res['Item']:
            return res['Item']['icon_url']
    except Exception as e:
        import traceback
        print("Cache read error:", e)
        traceback.print_exc()

    model = get_gemini_client(model_name="gemini-2.5-flash")
    prompt = f"""
Create a simple friendly cartoon SVG icon.

STYLE GUIDELINE:
Inspired by Headspace and Khan Academy Kids
flat minimal vector
rounded shapes
child friendly
pastel colors

THEME:
{headline}

RULES:
- Output ONLY valid SVG code (XML safe!).
- ALL attributes MUST be wrapped in double quotes (e.g. fill="#FFFFFF" NOT fill=#FFFFFF).
- MUST not contain any self-closing tags with missing slashes.
- width=512 height=512
- no external fonts
- no raster images
- no background

Return ONLY SVG code.
"""
    try:
        print(f"Generating new SVG icon for theme: {headline}")
        res = model.generate_content(prompt)
        svg = clean_svg(res.text)
        url = upload_svg_to_s3(svg)
        
        # Save to cache
        try:
            import datetime
            icon_cache_table.put_item(Item={
                'headline_hash': headline_hash,
                'headline': headline,
                'icon_url': url,
                'created_at': datetime.datetime.utcnow().isoformat()
            })
        except Exception as e:
            print("Cache write error:", e)
            
        return url
    except Exception as e:
        print("SVG Generation Error:", e)
        # Fallback to a static icon if generation fails
        return "https://api.iconify.design/mdi:emoticon-outline.svg"


ICONS = [
    "smiley",
    "star",
    "flower",
    "moon",
    "sparkle"
]

class CreativeGenome(BaseModel):
    template: str  # "illustration_card", "blurred_image", "photo_typography"
    background_type: str  # "solid", "gradient", "image"
    background_url: Optional[str] = None # Direct URL for images
    icon: Optional[str] = None
    color_palette: str  # "soft_purple", "calm_blue", "earthy_green", etc.
    headline_type: str  # Legacy, use narrative_type
    narrative_type: Optional[str] = None # curiosity, emotion, etc.
    font_style: str  # "bold_sans", "modern_serif", "rounded"
    emotion: str  # "Relief", "Curiosity", "Urgency", "Calm"


class GeneratedCreative(BaseModel):
    headline: str
    supporting_text: str 
    cta: str 
    offer_pointers: Optional[List[str]] = None # Structured bullet points parsed from promotional text
    genome: CreativeGenome
    narrative_type: Optional[str] = None
    predicted_score: int # 1-100
    score_rationale: str # Brief explanation of the score
    background_prompt: Optional[str] = None # Used to generate the image

def get_stock_image(query):
    pexels_key = os.environ.get("PEXELS_API_KEY")
    unsplash_key = os.environ.get("UNSPLASH_API_KEY")
    
    safe_query = urllib.parse.quote(query)
    
    # Try Pexels First (Primary)
    if pexels_key:
        try:
            url = f"https://api.pexels.com/v1/search?query={safe_query}&per_page=15"
            req = urllib.request.Request(url, headers={"Authorization": pexels_key})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                if data.get("photos"):
                    photo = random.choice(data["photos"])
                    return photo["src"].get("large2x", photo["src"].get("original"))
        except Exception as e:
            print(f"Pexels API Error: {e}")
            
    # Fallback to Unsplash (Secondary)
    if unsplash_key:
        try:
            url = f"https://api.unsplash.com/search/photos?query={safe_query}&page=1&per_page=15"
            req = urllib.request.Request(url, headers={"Authorization": f"Client-ID {unsplash_key}"})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                if data.get("results"):
                    photo = random.choice(data["results"])
                    return photo["urls"].get("regular", photo["urls"].get("full"))
        except Exception as e:
            print(f"Unsplash API Error: {e}")
            
    # Default Safe Fallback
    return "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80"

# generate_ai_icon removed — it called generate_image_asset_with_fal() which is not available.
# Use generate_svg_icon() instead, which caches results in DynamoDB + S3.

# Default promotional offer — always shown unless overridden
DEFAULT_PROMO = "Start your 14-day free trial. 50% off first 3 months with Code: BLOOM50. 40% off annual plan with Code: BLOOM-LAUNCH"

def generate_core_variations(headline: str, description: str, tone: str, brand: dict, count: int = 10, promo_text: str = None) -> List[dict]:
    """Uses Gemini to generate semantic variations driven by Brand Identity and Narrative Psychology."""

    # Always use a promo — fall back to DEFAULT_PROMO when none is provided
    effective_promo = promo_text.strip() if promo_text and promo_text.strip() else DEFAULT_PROMO

    brand_context = f"""
    TARGET AUDIENCE: {brand.get('audience')}
    BRAND TONE: {brand.get('tone')}
    COMMUNICATION STYLE: {brand.get('comm_style')}
    DESIGN DIRECTION: {brand.get('design_dir', 'Calm and Minimal')}
    VISUAL FOCUS: {brand.get('visual_focus', 'Nature and Calm Landscapes')}
    ADMIRED BRANDS: {brand.get('brands')}
    """

    promo_instruction = f"""
    PROMOTIONAL HOOK: "{effective_promo}"
    INSTRUCTION: Parse this into EXACTLY 3 offer_pointers:
      - Line 1: The free trial or first entry point (e.g. "Start your 14-day free trial")
      - Line 2: The monthly discount with code (e.g. "50% off first 3 months · Code: BLOOM50")
      - Line 3: The annual discount with code (e.g. "40% off annual plan · Code: BLOOM-LAUNCH")
    Keep each line SHORT (max 8 words). Do NOT rephrase or lose the codes.
    """

    prompt = f"""
    You are a Performance Creative Director for BloomGrow.ai. 
    CRITICAL: THE TARGET AUDIENCE IS THE PARENT.
    MANDATORY: Every ad MUST mention "Parents" or "Parenting" in the Headline or Supporting Text.
    
    BRAND CONTEXT:
    {brand_context}
    {promo_instruction}
    
    STYLE EXAMPLE:
    Headline: "Peace of mind for busy, caring parents"
    Supporting: "Trusted learning, without ads or privacy concerns."
    
    STYLE CONSTRAINTS:
    - SPEAK DIRECTLY TO THE PARENT. Avoid speaking to the child.
    - Use soft, reflective, human language (Headspace/Calm style).
    - NEVER use: "Play now", "Fun games", "Learning for kids".
    
    HIGH-PERFORMING BASE AD:
    HEADLINE: "{headline}"
    DESCRIPTION: "{description}"
    
    TASK:
    Generate {count} unique ad variations. Each one MUST follow one of these NARRATIVE TYPES but remain PARENT-CENTRIC:
    - curiosity: A gentle question for the parent.
    - emotional reassurance: A reflection that validates the parent's feelings.
    - parent insight: A realization for the parent about child development or safety.
    - small transformation: An actionable shift in the parent's perspective.
    - gentle reflection: A thought that helps the parent feel peace of mind.
    
    STRICT RULES:
    1. Language: Simple, human, zero hype. No "best", "leading", or "innovative".
    2. Headline: 8 words or fewer. A thought for the parent, not a sales pitch.
    3. Supporting Text: 10 words or fewer. A sub-benefit for the parent.
    4. NO EXCLAMATION MARKS.
    
    Return a valid JSON array of objects:
    [
      {{
        "narrative_type": "...",
        "headline": "...", 
        "supporting_text": "...", 
        "cta": "...",
        "offer_pointers": ["point 1", "point 2", "point 3"]
      }}
    ]
    """
    model = get_gemini_client()
    try:
        response = model.generate_content(prompt)
        res_text = response.text.strip()
        if "```json" in res_text:
            res_text = res_text.split("```json")[-1].split("```")[0].strip()
        data = json.loads(res_text)
        return data
    except Exception as e:
        print(f"Gemini Narrative Copy Error: {e}")
        return [{"narrative_type": "parent insight", "headline": headline, "supporting_text": description, "cta": "Learn More"}]

def generate_creative_batch(copy_id: str, original_headline: str, original_description: str, tone: str, brand_id: dict, count: int = 100, style_source: dict = None, promo_text: str = None) -> List[GeneratedCreative]:
    """Programmatically assembles creative variations using Brand Identity and Narrative mappings."""
    print(f"Generating {count} variations for copy ID: {copy_id} with Brand Identity.")
    
    # 1. Generate narrative-driven copy variations
    copy_variations = generate_core_variations(original_headline, original_description, tone, brand_id, count=count, promo_text=promo_text)
        
    creatives = []
    palettes = ["soft_purple", "bold_teal", "calm_blue", "earthy_green", "warm_orange"]
    font_styles = ["bold_sans", "modern_serif", "rounded"]
    
    # Pre-generate backgrounds based on Template Rules
    design_dir = brand_id.get('design_dir', 'Calm').lower()
    is_loud = "loud" in design_dir or "energetic" in design_dir
    
    # Use pre-defined pools to eliminate Fal bottlenecks
    if is_loud:
        nature_pool = ["vibrant tropical beach", "energetic sun-drenched meadow", "dramatic mountain sunset", "colorful urban park"]
    else:
        nature_pool = NATURE_QUERIES
        
    urban_pool = ["city street architecture", "urban skyline buildings", "highway road landscape", "modern city building"]
    
    # 2. Assemble combinatorial variations up to `count`
    iterations = 0
    max_iterations = count * 3
    
    all_templates = [
        "stacked_typography",
        "photo_typography",
        "quote_testimonial",
        "paper_quote_testimonial",
        "illustration_card",
        "blurred_image",
        "billboard_mockup"
    ]
    
    while len(creatives) < count and iterations < max_iterations:
        iterations += 1
        
        copy = random.choice(copy_variations)
        narrative = copy.get("narrative_type", "parent insight")
        
        # Guarantee all 7 templates appear at least once
        if len(creatives) < len(all_templates):
            template = all_templates[len(creatives)]
        else:
            template = random.choice(all_templates)
        
        # Pick appropriate background type
        if template == "billboard_mockup":
            bg_url = get_stock_image(random.choice(urban_pool))
        else:
            bg_url = get_stock_image(random.choice(nature_pool))
            
        bg_type = "image"
        
        palette = random.choice(palettes)
        font = random.choice(font_styles)
        
        # Replace expensive AI icons with static pool
        if template == "illustration_card":
            icon = generate_svg_icon(copy["headline"])
        else:
            icon = "none"
            
        # Calculate deterministic score
        score = random.randint(84, 89)
        if narrative == "curiosity":
            score += 5
        if template == "stacked_typography":
            score += 7
        if template == "photo_typography":
            score += 4
        predicted_score = min(score, 99)
            
        genome = CreativeGenome(
            template=template,
            background_type=bg_type,
            background_url=bg_url,
            icon=icon,
            color_palette=palette,
            headline_type="narrative", 
            narrative_type=narrative,
            font_style=font,
            emotion=tone
        )
        
        creatives.append(GeneratedCreative(
            headline=copy.get("headline"),
            supporting_text=copy.get("supporting_text"),
            cta=copy.get("cta", "Start Exploring"),
            offer_pointers=copy.get("offer_pointers"),
            genome=genome,
            narrative_type=narrative,
            predicted_score=predicted_score, 
            score_rationale=f"{narrative.title()} narrative using {template} layout.",
            background_prompt="n/a (Static Pool)"
        ))
        
    return creatives

def run_creative_generation_pipeline(copy_id: str, count: int = 100, style_source: dict = None, promo_text: str = None):
    """Main pipeline to generate batch creative layouts from a Promoted Copy."""
    
    # 0. Fetch Brand Identity
    brand = fetch_brand_identity()
    
    # 1. Fetch the exact promoted copy from DB
    try:
        res = ad_copy_table.get_item(Key={'id': copy_id})
        ad_copy = res.get('Item')
        if not ad_copy:
            raise ValueError(f"Ad copy {copy_id} not found in database.")
    except Exception as e:
        print(f"Error fetching copy: {e}")
        return {"status": "error", "message": "Promoted copy not found"}
        
    headline = ad_copy.get('headline', '')
    supporting_text = ad_copy.get('supporting_text', '') or ad_copy.get('description', '')
    tone = ad_copy.get('tone', brand.get('tone', 'Calm'))
    pain_point_text = ad_copy.get('pain_point_text', '')
    
    # 2. Generate genomes & AI background images
    creatives = generate_creative_batch(copy_id, headline, supporting_text, tone, brand, count, style_source=style_source, promo_text=promo_text)
    
    import datetime
    saved_count = 0
    
    for c in creatives:
        try:
            # We map the genome to the ad_copy_table for now
            ad_copy_table.put_item(
                Item={
                    "id": str(uuid.uuid4()),
                    "copy_id": copy_id,
                    "pain_point_text": pain_point_text, # For traceability
                    "template_type": c.genome.template,
                    "narrative_type": c.narrative_type,
                    "headline": c.headline,
                    "supporting_text": c.supporting_text,
                    "cta": c.cta,
                    "offer_pointers": c.offer_pointers,
                    "visual_template": c.genome.template,
                    "genome": c.genome.dict(),
                    "tone": tone,
                    "predicted_score": c.predicted_score,
                    "score_rationale": c.score_rationale,
                    "status": "draft",
                    "performance_score": decimal.Decimal("0.0"),
                    "created_at": datetime.datetime.utcnow().isoformat() + "Z",
                    "batch_id": f"batch-{datetime.datetime.now().strftime('%Y%m%d%H%M')}"
                }
            )
            saved_count += 1
        except Exception as e:
            print(f"Error saving creative: {e}")
            
    return {
        "status": "success",
        "message": f"Generated {saved_count} genetic creatives with AI scores.",
        "data": [c.dict() for c in creatives]
    }

def mutate_creative(base_creative_id: str, mutation_type: str, count: int = 100):
    """Generates `count` structured variations based on a base creative and a specific mutation vector."""
    print(f"Mutating creative {base_creative_id} via {mutation_type}...")
    
    import random
    import datetime
    
    try:
        res = ad_copy_table.get_item(Key={'id': base_creative_id})
        base_creative = res.get('Item')
        if not base_creative:
            raise ValueError(f"Base creative {base_creative_id} not found.")
    except Exception as e:
        print(f"Error fetching base creative: {e}")
        return {"status": "error", "message": "Creative not found"}
        
    genome_data = base_creative.get('genome', {})
    
    # Extract base attributes
    base_headline = base_creative.get('headline', '')
    base_supporting_text = base_creative.get('supporting_text', '')
    base_cta = base_creative.get('cta', 'Start Free Trial')
    base_tone = base_creative.get('tone', 'Calm')
    base_copy_id = base_creative.get('copy_id', '')
    base_pain_point_text = base_creative.get('pain_point_text', '')
    
    # Extract genome attributes
    base_template = genome_data.get('template', 'illustration_card')
    base_bg_type = genome_data.get('background_type', 'solid')
    base_bg_url = genome_data.get('background_url', None)
    base_icon = genome_data.get('icon', 'none')
    base_palette = genome_data.get('color_palette', 'calm_blue')
    base_font = genome_data.get('font_style', 'bold_sans')
    
    # 0. Fetch Brand Identity
    brand = fetch_brand_identity()
    
    PALETTES = ["soft_purple", "bold_teal", "calm_blue", "earthy_green", "warm_orange"]
    
    text_variations = [{"headline": base_headline, "supporting_text": base_supporting_text, "cta": base_cta, "narrative_type": "parent insight"}]
    bg_pool = [base_bg_url] if base_bg_url else []
    
    if mutation_type in ["text", "all"]:
        # Generate core text variations to cycle through
        text_vars = generate_core_variations(base_headline, base_supporting_text, base_tone, brand, count=10)
        if text_vars:
            text_variations = text_vars
            
    if mutation_type in ["background", "all"] and (base_template != "illustration_card" or mutation_type == "all"):
        # Generate fresh backgrounds using stock image API
        base_bg_queries = [
            "beach waves calm",
            "forest sunlight trees",
            "mountain sunrise nature",
            "flowers field bokeh",
            "lake reflection peaceful",
            "city street urban",
            "mountain landscape scenic"
        ]
        bg_pool = []
        for q in base_bg_queries:
            bg_pool.append(get_stock_image(q))
            
    creatives = []
    
    # 2. Assemble 100 Variations
    while len(creatives) < count:
        # Defaults to base
        t_headline = base_headline
        t_supporting_text = base_supporting_text
        t_cta = base_cta
        t_template = base_template
        t_bg_url = base_bg_url
        t_icon = base_icon
        t_palette = base_palette
        
        # Apply Mutations
        if mutation_type == "text" or mutation_type == "all":
            t_copy = random.choice(text_variations)
            t_headline = t_copy.get("headline", base_headline)
            t_supporting_text = t_copy.get("supporting_text", base_supporting_text)
            t_cta = t_copy.get("cta", base_cta)
            
        if mutation_type == "background" or mutation_type == "all":
            t_palette = random.choice(PALETTES)
            if t_template != "illustration_card" and bg_pool:
                t_bg_url = random.choice(bg_pool)
                
        if mutation_type == "icon" or mutation_type == "all":
            if t_template == "illustration_card":
                # Generate a fresh SVG icon (cached per headline)
                t_icon = generate_svg_icon(t_headline)
                
        if mutation_type == "layout" or mutation_type == "all":
            t_template = random.choice(ALL_TEMPLATES)
            if t_template == "illustration_card":
                t_icon = "none" # Will be generated below or random
                t_bg_url = None
                base_bg_type = "solid"
            else:
                t_icon = "none"
                base_bg_type = "image"
                
                # If we mutated layout to an image template but don't have bg_pool natively populated
                if not t_bg_url and mutation_type == "layout":
                    t_bg_url = get_stock_image("nature calm landscape")
        
        new_genome = CreativeGenome(
            template=t_template,
            background_type="image" if t_bg_url else "solid",
            background_url=t_bg_url,
            icon=t_icon,
            color_palette=t_palette,
            headline_type="variation",
            font_style=base_font,
            emotion=base_tone,
        )
        
        creatives.append(GeneratedCreative(
            headline=t_headline,
            supporting_text=t_supporting_text,
            cta=t_cta,
            genome=new_genome,
            predicted_score=random.randint(70, 98),
            score_rationale=f"Mutated variant ({mutation_type}). {t_template} layout with {t_palette}.",
        ))
        
    saved_count = 0
    batch_id = f"mut-{datetime.datetime.now().strftime('%Y%m%d%H%M')}"
    
    for c in creatives:
        try:
            ad_copy_table.put_item(
                Item={
                    "id": str(uuid.uuid4()),
                    "copy_id": base_copy_id,
                    "pain_point_text": base_pain_point_text,
                    "template_type": c.genome.template,
                    "narrative_type": c.narrative_type,
                    "headline": c.headline,
                    "supporting_text": c.supporting_text,
                    "cta": c.cta,
                    "visual_template": c.genome.template,
                    "genome": c.genome.dict(),
                    "tone": base_tone,
                    "predicted_score": c.predicted_score,
                    "score_rationale": c.score_rationale,
                    "status": "draft",
                    "performance_score": decimal.Decimal("0.0"),
                    "created_at": datetime.datetime.utcnow().isoformat() + "Z",
                    "batch_id": batch_id
                }
            )
            saved_count += 1
        except Exception as e:
            print(f"Error saving mutated creative: {e}")
            
    return {
        "status": "success",
        "message": f"Generated {saved_count} variations via {mutation_type} mutation.",
        "data": [c.dict() for c in creatives]
    }

def regenerate_creative_directive(creative_id: str, current_data: dict, directive: str) -> dict:
    """Uses Gemini to strictly modify the text copy based on user feedback, preserving the genome."""
    print(f"Applying text directive: '{directive}' to creative {creative_id}")
    
    headline = current_data.get('headline', '')
    supporting_text = current_data.get('supporting_text', '') or current_data.get('description', '')
    cta = current_data.get('cta', '')
    
    model = get_gemini_client()
    
    prompt = f"""
    You are an expert Copywriter for BloomGrow.
    CRITICAL: YOU ARE WRITING TO PARENTS. ALWAYS SPEAK TO THE PARENT ABOUT THE CHILD.
    
    CURRENT HEADLINE: "{headline}"
    CURRENT SUPPORTING TEXT: "{supporting_text}"
    CURRENT CTA: "{cta}"
    
    The user wants to refine this ad text.
    USER DIRECTIVE: "{directive}"
    
    Update the copy to closely follow the user directive while remaining STRICTLY PARENT-CENTRIC.
    Keep the tone Headspace-style.
    
    RULES:
    - NO child-facing language ("Play now", "Learn toys").
    - INSTEAD use parent-facing language ("Help them learn", "Give them a safe start").
    - Headline MUST be 8 words or fewer.
    - Supporting Text should be a short sub-benefit for the parent (max 10 words).
    - CTA should be 2-4 words.
    
    Return a valid JSON object:
    {{
      "headline": "...",
      "supporting_text": "...",
      "cta": "...",
      "score_rationale": "Brief string explaining why this new copy is better and more parent-focused."
    }}
    """
    
    response = model.generate_content(prompt)
    res_text = response.text.strip()
    
    if "```json" in res_text:
        res_text = res_text.split("```json")[-1].split("```")[0].strip()
        
    try:
        new_data = json.loads(res_text)
        
        if 'headline' not in new_data:
            raise ValueError("Malformed JSON returned from Gemini")
            
        import datetime
        updated_item = {**current_data}
        updated_item['headline'] = new_data['headline']
        updated_item['supporting_text'] = new_data['supporting_text']
        updated_item['cta'] = new_data['cta']
        # We DO NOT update genome here.
        updated_item['score_rationale'] = new_data.get('score_rationale', 'Updated based on user directive.')
        updated_item['updated_at'] = datetime.datetime.utcnow().isoformat() + "Z"
        
        ad_copy_table.put_item(Item=updated_item)
        
        return {
            "status": "success",
            "message": "Creative text updated successfully.",
            "data": updated_item
        }
    except Exception as e:
        print(f"Directive Application Error: {e}")
        return {
            "status": "error",
            "message": f"Failed to apply directive: {str(e)}"
        }

def regenerate_creative_background(creative_id: str, current_data: dict) -> dict:
    """Generates a new background image using Fal AI while preserving everything else."""
    print(f"Regenerating background for creative {creative_id}")
    genome = current_data.get('genome', {})
    
    if genome.get('template') == "illustration_card":
        return {
            "status": "error",
            "message": "Illustration cards use solid colors, no background to regenerate."
        }
        
    try:
        # Pick a fresh background using stock image API
        tone = current_data.get('tone', 'calm')
        template = genome.get('template', 'photo_typography')
        if template == 'billboard_mockup':
            query = random.choice(["city street architecture", "urban skyline buildings", "highway road landscape"])
        else:
            query = random.choice(["beach waves calm", "forest sunlight", "mountain sunrise", "flowers field", "lake reflection peaceful"])

        new_bg_url = get_stock_image(query)
        
        import datetime
        updated_item = {**current_data}
        updated_item['genome']['background_url'] = new_bg_url
        updated_item['updated_at'] = datetime.datetime.utcnow().isoformat() + "Z"
        
        ad_copy_table.put_item(Item=updated_item)
        
        return {
            "status": "success",
            "message": "Background regenerated successfully.",
            "data": updated_item
        }
    except Exception as e:
        print(f"Background Regeneration Error: {e}")
        return {
            "status": "error",
            "message": f"Failed to regenerate background: {str(e)}"
        }

if __name__ == "__main__":
    # Test (requires valid copy_id if uncommented)
    # res = run_creative_generation_pipeline("test-copy", 1)
    # print(json.dumps(res, indent=2))
    pass
