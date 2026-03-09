import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY_1"))

print("Available Models:")
try:
    for m in genai.list_models():
        print(f"- {m.name} (Methods: {m.supported_generation_methods})")
except Exception as e:
    print(f"Error listing models: {e}")
