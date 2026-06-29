import os
import sys
from dotenv import load_dotenv

# Allow running from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from firecrawl import FirecrawlApp

def main():
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        print("Error: FIRECRAWL_API_KEY not found in .env")
        return

    print("Connecting to Firecrawl to fetch Starbucks Rewards Terms...")
    app = FirecrawlApp(api_key=api_key)
    
    # We will scrape the actual Starbucks Terms & Conditions URL
    url = "https://www.starbucks.com/rewards/terms"
    
    try:
        res = app.scrape_url(url, formats=["markdown"])
        if hasattr(res, "markdown") and res.markdown:
            markdown_text = res.markdown
        elif isinstance(res, dict):
            markdown_text = res.get("markdown") or res.get("content") or ""
        else:
            markdown_text = ""
        
        # Save it to a file so the user can see exactly what goes into the DB
        output_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dumps", "starbucks_raw_markdown.txt")
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(markdown_text)
            
        print(f"\nSUCCESS! Scraped {len(markdown_text)} characters of Markdown.")
        print(f"Saved directly to: {output_file}")
        print("This is exactly what gets inserted into the `raw_content` column of the database!")
        
    except Exception as e:
        print(f"Failed to scrape: {e}")

if __name__ == "__main__":
    main()
