import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY_1"))
model = genai.GenerativeModel("gemini-2.5-flash")

prompt = """
You are an expert in early childhood development, peaceful parenting, and kids' learning apps (like Khan Academy Kids and Headspace).

Generate exactly 1,000 unique, short, descriptive phrases (keywords) that could be used to generate beautiful, simple, minimal, child-friendly SVG icons. 

Categories to cover:
- Baby milestones (e.g. "first steps", "curious crawler", "smiling baby")
- Emotional regulation & calmness (e.g. "deep breath", "zen star", "calm ocean")
- Sleep & Bedtime (e.g. "sleepy moon", "dreaming cloud", "bedtime story")
- Learning & Discovery (e.g. "growing brain", "puzzle piece", "reading corner", "counting blocks")
- Nature & Growth (e.g. "little sprout", "blooming flower", "sunshine smile")

RULES:
- Return ONLY a raw JSON array of 1000 strings.
- Absolutely NO markdown formatting, just the raw `[` start bracket and `]` end bracket.
- Each string should be 1-4 words maximum.
- Do not repeat ANY string.
"""

print("Requesting 1000 keywords from Gemini 2.5 Flash...")
try:
    response = model.generate_content(prompt)
    text = response.text.strip()
    
    if "```json" in text:
        text = text.split("```json")[-1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[-1].split("```")[0].strip()
        
    keywords = json.loads(text)
    
    print(f"Generated {len(keywords)} keywords!")
    
    with open("keywords.json", "w") as f:
        json.dump(keywords, f, indent=2)
        
    print("Saved to keywords.json")
except Exception as e:
    print(f"Error: {e}")
