import os
import sys
from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv()

_QUERIES = {
    "faq": '"{name}" loyalty program FAQ frequently asked questions',
    "tnc": '"{name}" loyalty program terms and conditions',
    "app_review": '"{name}" app reviews ratings',
    "press": '"{name}" loyalty program press release announcement',
    "news": '"{name}" loyalty program news 2024 2025',
    "forum": '"{name}" loyalty rewards reddit community discussion',
}

def main(program_name):
    tavily_key = os.getenv("TAVILY_API_KEY", "")
    if not tavily_key:
        print("No TAVILY_API_KEY found.")
        return
        
    tavily = TavilyClient(api_key=tavily_key)
    print(f"Finding sources for: {program_name}\n")
    
    seen_urls = set()
    
    for source_type, query_template in _QUERIES.items():
        query = query_template.format(name=program_name)
        try:
            response = tavily.search(query, max_results=3) # limit to 3 for speed
            for r in response.get("results", []):
                url = r.get("url", "").strip()
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                title = r.get("title", "")
                print(f"[{source_type.upper()}] {url}")
                print(f"  Title: {title[:80]}...")
        except Exception as e:
            print(f"Error querying {source_type}: {e}")
            
    print(f"\nTotal unique sources found: {len(seen_urls)}")

if __name__ == "__main__":
    name = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Starbucks Rewards"
    main(name)
