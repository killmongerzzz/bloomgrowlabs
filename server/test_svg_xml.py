import xml.etree.ElementTree as ET
from creative_agent import generate_svg_icon
import urllib.request
import traceback

print("Generating new SVG with strict XML rules...")
url = generate_svg_icon("A curious and happy baby learning to walk")
print(f"Generated URL: {url}")

print("Validating XML structure from URL...")
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    svg_data = response.read().decode('utf-8')
    
    print("Downloaded SVG Data Length:", len(svg_data))
    # Parse to check for well-formed XML
    ET.fromstring(svg_data)
    print("XML Validation: SUCCESS (Well-formed SVG)")
except Exception as e:
    print("XML Validation: FAILED")
    traceback.print_exc()
    print("--- RAW SVG ---")
    print(svg_data if 'svg_data' in locals() else "Could not download")
