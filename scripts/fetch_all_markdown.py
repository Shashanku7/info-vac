import os
import re
import sys
import time
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

    app = FirecrawlApp(api_key=api_key)
    output_file = "all_starbucks_markdown.txt"
    input_file = "phase1_output.txt"

    # Extract URLs from phase1_output.txt
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    urls = []
    with open(input_file, "r", encoding="utf-8") as f:
        for line in f:
            match = re.search(r'(https?://[^\s]+)', line)
            if match:
                url = match.group(1)
                if url not in urls:
                    urls.append(url)

    print(f"Found {len(urls)} unique URLs. Starting batch scrape...")

    with open(output_file, "w", encoding="utf-8") as out:
        for i, url in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] Scraping: {url}")
            out.write(f"\n{'='*80}\n")
            out.write(f"SOURCE URL: {url}\n")
            out.write(f"{'='*80}\n\n")

            try:
                res = app.scrape_url(url, formats=["markdown"])
                markdown_text = ""
                if hasattr(res, "markdown") and res.markdown:
                    markdown_text = res.markdown
                elif isinstance(res, dict):
                    markdown_text = res.get("markdown") or res.get("content") or ""
                
                if markdown_text:
                    out.write(markdown_text)
                    print(f"  -> Success: {len(markdown_text)} characters")
                else:
                    out.write("[FAILED TO EXTRACT MARKDOWN]")
                    print("  -> Failed: No markdown content")
            except Exception as e:
                out.write(f"[ERROR SCRAPING]: {e}")
                print(f"  -> Error: {str(e)[:100]}")
            
            # Sleep briefly to avoid hammering the API
            time.sleep(1)

    print(f"\nAll done! Massive dump saved to {output_file}")

if __name__ == "__main__":
    main()
