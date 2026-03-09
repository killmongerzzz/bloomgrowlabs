import json
import concurrent.futures
import time
from creative_agent import generate_svg_icon

def load_keywords(filepath="keywords.json"):
    try:
        with open(filepath, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return []

def worker(keyword, index, total):
    print(f"[{index}/{total}] Generating for: '{keyword}'...")
    try:
        url = generate_svg_icon(keyword)
        return {"keyword": keyword, "url": url, "status": "success"}
    except Exception as e:
        return {"keyword": keyword, "url": None, "status": f"error: {e}"}

def main():
    keywords = load_keywords()
    if not keywords:
        print("No keywords found. Exiting.")
        return
        
    total = len(keywords)
    print(f"Starting parallel generation of {total} SVGs...")
    
    results = []
    start_time = time.time()
    
    # Use ThreadPoolExecutor for IO-bound S3/Gemini calls
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_keyword = {
            executor.submit(worker, kw, i+1, total): kw 
            for i, kw in enumerate(keywords)
        }
        
        for future in concurrent.futures.as_completed(future_to_keyword):
            kw = future_to_keyword[future]
            try:
                data = future.result()
                results.append(data)
                if data["status"] != "success":
                    print(f"Failed on: {kw} -> {data['status']}")
            except Exception as exc:
                print(f"{kw} generated an exception: {exc}")
                
    elapsed = time.time() - start_time
    success_count = sum(1 for r in results if r["status"] == "success")
    print(f"\nCOMPLETED IN {elapsed:.2f} SECONDS.")
    print(f"Successfully generated and uploaded {success_count} / {total} SVGs.")

if __name__ == "__main__":
    main()
