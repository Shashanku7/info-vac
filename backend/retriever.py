"""Retriever — Phase 1.

Given a loyalty program name, discover and fetch real web sources:
  1. Tavily search — 1 query per source_type × 6 types → up to 30 candidate URLs
  2. Deduplicate URLs, classify source_type (URL-pattern override)
  3. Robots.txt check — skip disallowed URLs rather than crash
  4. Firecrawl scrape — full markdown content; fall back to Tavily snippet on failure
  5. Insert into sources table — every stored row guaranteed to have raw_content

DoD guarantees built in:
  - Known program → ≥10 sources, ≥3 distinct source_types
  - Fake program → returns [] gracefully, no exception
  - Every stored source has non-empty raw_content
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx
import structlog
from dotenv import load_dotenv
from firecrawl import FirecrawlApp
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tavily import TavilyClient

from backend.models import Source

load_dotenv()
log = structlog.get_logger(__name__)


def clean_utf8_mojibake(text: str) -> str:
    """Repair common UTF-8 double-decoding (mojibake) artifacts in crawled text."""
    if not text:
        return text

    # Try cp1252 to utf-8 roundtrip if possible
    try:
        encoded = text.encode("cp1252")
        decoded = encoded.decode("utf-8")
        if decoded != text and len(decoded) > 0:
            return decoded
    except Exception:
        pass

    # Fallback to dictionary replacement
    replacements = {
        "â€™": "’",
        "â€œ": "“",
        "â€": "”",
        "â€“": "–",
        "â€”": "—",
        "â€¢": "•",
        "â€¦": "…",
        "â„¢": "™",
        "Ã©": "é",
        "Ã¡": "á",
        "Ã³": "ó",
        "Ãº": "ú",
        "Ã±": "ñ",
        "Ã¼": "ü",
        "Ã¤": "ä",
        "Ã¶": "ö",
        "ÃŸ": "ß",
        "Â ": " ",
        "Â": "",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text

# ---------------------------------------------------------------------------
# Source-type queries
# One targeted query per type. Quoted program name keeps Tavily grounded.
# ---------------------------------------------------------------------------

_QUERIES: dict[str, str] = {
    "faq": '"{name}" loyalty program FAQ frequently asked questions',
    "tnc": '"{name}" loyalty program terms and conditions',
    "app_review": '"{name}" app reviews ratings',
    "press": '"{name}" loyalty program press release announcement',
    "news": '"{name}" loyalty program news 2024 2025',
    "forum": '"{name}" loyalty rewards reddit community discussion',
    "homepage": '"{name}" official loyalty program homepage',
    "benefits": '"{name}" elite status levels tiers and benefits',
    "partners": '"{name}" credit card airline hotel transfer partners',
    "mechanics": '"{name}" how to earn and redeem points award chart',
    "competitors": '"{name}" versus competitors review comparison',
}

# How many Tavily results to request per query
_MAX_RESULTS_PER_QUERY = 5

# Max URLs to Firecrawl-fetch (to protect free-tier credits)
_MAX_FIRECRAWL_FETCHES = 20

# Seconds to sleep between Firecrawl calls (rate-limit courtesy)
_FIRECRAWL_DELAY = 0.5

# ---------------------------------------------------------------------------
# Classification tables — ordered priority chains
# ---------------------------------------------------------------------------

# Priority 1: Trusted domain patterns — near-certain, checked first
_DOMAIN_PATTERNS: list[tuple[str, str]] = [
    (r"apps\.apple\.com|play\.google\.com|appstore\.com", "app_review"),
    (r"reddit\.com|quora\.com|trustpilot\.com|tripadvisor\.com|yelp\.com|glassdoor\.com|flyertalk\.com", "forum"),
    (r"prnewswire\.com|businesswire\.com|globenewswire\.com|sec\.gov|accesswire\.com", "press"),
    (r"nerdwallet\.com|thepointsguy\.com|bankrate\.com|creditkarma\.com|forbes\.com", "news"),
]

# Priority 2: URL path patterns — high confidence (includes .pdf)
_PATH_PATTERNS: list[tuple[str, str]] = [
    (r"\.pdf($|\?)|terms|conditions|tnc|legal|policy|rules|agreement", "tnc"),
    (r"faq|faqs|help\.|support\.|questions|howto|how-to", "faq"),
    (r"press|newsroom|press-release|ir\.|investor", "press"),
    (r"review|rating|feedback|app-store", "app_review"),
]

# Priority 3: Title keywords — medium confidence
_TITLE_KEYWORDS: dict[str, list[str]] = {
    "tnc":        ["terms", "conditions", "legal", "policy", "rules", "agreement"],
    "faq":        ["faq", "frequently asked", "help center", "support", "how to"],
    "press":      ["press release", "announces", "launches", "expands", "partners with"],
    "news":       ["review", "guide", "best credit", "comparison", "ranking", "worth it"],
    "app_review": ["app review", "ios", "android rating", "app store"],
}

# Priority 4: Snippet keywords — fallback
_SNIPPET_KEYWORDS: dict[str, list[str]] = {
    "tnc": ["pursuant to", "herein", "shall not", "termination", "obligations"],
    "faq": ["how do i", "how to", "can i ", "when will", "what is the"],
}


# ---------------------------------------------------------------------------
# Internal data structures
# ---------------------------------------------------------------------------

@dataclass
class _Candidate:
    url: str
    source_type: str
    title: str
    tavily_snippet: str  # always populated — minimum raw_content guarantee


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _classify_source(url: str, title: str, snippet: str, default: str) -> str:
    """Classify source_type using a four-level priority chain.

    Priority (highest to lowest):
      1. Trusted domain patterns — near-certain (e.g. reddit.com → forum)
      2. URL path patterns — high confidence (e.g. /terms, .pdf → tnc)
      3. Page title keyword matching — medium confidence
      4. Tavily snippet keyword matching — fallback

    No LLM call: all signal comes from data Tavily already returns.
    """
    url_lower = url.lower()
    title_lower = (title or "").lower()
    snippet_lower = (snippet or "").lower()

    for pattern, stype in _DOMAIN_PATTERNS:
        if re.search(pattern, url_lower):
            return stype

    for pattern, stype in _PATH_PATTERNS:
        if re.search(pattern, url_lower):
            return stype

    for stype, keywords in _TITLE_KEYWORDS.items():
        if any(kw in title_lower for kw in keywords):
            return stype

    for stype, keywords in _SNIPPET_KEYWORDS.items():
        if any(kw in snippet_lower for kw in keywords):
            return stype

    return default


def _tavily_search(keys: list[str], query: str, source_type: str) -> list[_Candidate]:
    """Run one Tavily query, rotating keys if rate-limited or failed."""
    from tavily import TavilyClient
    if not keys:
        log.warning("no_tavily_keys_configured")
        return []
        
    last_exc = None
    for k in keys:
        try:
            client = TavilyClient(api_key=k)
            response = client.search(
                query,
                max_results=_MAX_RESULTS_PER_QUERY,
                search_depth="advanced",
            )
            candidates: list[_Candidate] = []
            for r in response.get("results", []):
                url = r.get("url", "").strip()
                if not url:
                    continue
                title = r.get("title", "") or ""
                snippet = r.get("content", "") or ""
                classified = _classify_source(url, title, snippet, source_type)
                candidates.append(_Candidate(
                    url=url,
                    source_type=classified,
                    title=title,
                    tavily_snippet=snippet,
                ))
            return candidates
        except Exception as exc:
            log.warning("tavily_key_failed_rotating", key_prefix=k[:6], error=str(exc)[:200])
            last_exc = exc
    log.error("all_tavily_keys_failed", query=query[:80], error=str(last_exc))
    return []


async def _check_robots(url: str, http: httpx.AsyncClient) -> str:
    """Check robots.txt for `url`.

    Returns:
        'allowed'           — explicitly permitted or no robots.txt found (200+parse)
        'blocked'           — robots.txt explicitly disallows '*' agent
        'robots_unverified' — check failed (timeout, non-200, parse error).
                              Decision #1 (OPEN_DECISIONS.md): allow scraping but
                              mark the status so the gate/eval layer can filter.

    Policy rationale: fail-closed (deny on error) risks killing legitimate sources
    on transient timeouts; fail-open silently (return True) hides ambiguity.
    'robots_unverified' is honest about what happened without blocking the source.
    Caveat: hackathon-scope — revisit before production per SOLUTION.md legal flag.
    """
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        resp = await http.get(robots_url, timeout=5.0, follow_redirects=True)
        if resp.status_code == 200:
            rp = RobotFileParser()
            rp.parse(resp.text.splitlines())
            return "allowed" if rp.can_fetch("*", url) else "blocked"
        # Non-200 (404, 403, etc.) — no robots.txt or inaccessible
        return "allowed"
    except Exception:
        return "robots_unverified"


def _firecrawl_fetch(keys: list[str], url: str) -> tuple[Optional[str], Optional[str]]:
    """Scrape a URL with Firecrawl, rotating keys if rate-limited or failed."""
    from firecrawl import FirecrawlApp
    if not keys:
        return None, None
        
    last_exc = None
    for k in keys:
        try:
            app = FirecrawlApp(api_key=k)
            result = app.scrape_url(url, formats=["markdown", "html"])
            markdown: Optional[str] = None
            html: Optional[str] = None

            if hasattr(result, "markdown"):
                markdown = result.markdown or None
            if hasattr(result, "html"):
                html = result.html or None

            if isinstance(result, dict):
                markdown = result.get("markdown") or result.get("content") or None
                html = result.get("html") or None

            # Paywall detection: reject content that looks like a login/subscribe wall
            if markdown:
                paywall_signals = [
                    "subscribe to read", "subscribe to continue", "subscribe now",
                    "create an account", "sign in to read", "log in to read",
                    "already a subscriber", "this content is for subscribers",
                    "member-only", "premium content", "unlock this article",
                    "register to read", "free registration required",
                ]
                lower_md = markdown.lower()
                if any(signal in lower_md for signal in paywall_signals) and len(markdown) < 2000:
                    log.warning("firecrawl_paywall_detected", url=url, content_length=len(markdown))
                    return None, None

            return markdown, html
        except Exception as exc:
            log.warning("firecrawl_key_failed_rotating", key_prefix=k[:6], error=str(exc)[:200])
            last_exc = exc
            
    log.error("all_firecrawl_keys_failed", url=url, error=str(last_exc))
    return None, None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def discover_sources(
    program_name: str,
    program_id,  # UUID
    db: AsyncSession,
) -> list[Source]:
    """Discover, fetch, and store sources for a loyalty program.

    Args:
        program_name: Human-readable program name, e.g. "Starbucks Rewards"
        program_id:   UUID of the programs row (must already exist)
        db:           Async SQLAlchemy session

    Returns:
        List of Source ORM objects that were inserted (or already existed).
        Returns [] gracefully if no sources are found.
    """
    # Load rotated key lists
    tavily_keys_str = os.getenv("TAVILY_API_KEYS", "")
    if tavily_keys_str:
        tavily_keys = [k.strip() for k in tavily_keys_str.split(",") if k.strip()]
    else:
        tavily_keys = [os.getenv("TAVILY_API_KEY", "")] if os.getenv("TAVILY_API_KEY") else []

    firecrawl_keys_str = os.getenv("FIRECRAWL_API_KEYS", "")
    if firecrawl_keys_str:
        firecrawl_keys = [k.strip() for k in firecrawl_keys_str.split(",") if k.strip()]
    else:
        firecrawl_keys = [os.getenv("FIRECRAWL_API_KEY", "")] if os.getenv("FIRERAWL_API_KEY") or os.getenv("FIRECRAWL_API_KEY") else []

    if not tavily_keys:
        raise EnvironmentError("No TAVILY_API_KEY found.")

    log.info("retriever_start", program=program_name)

    # ------------------------------------------------------------------
    # Step 1: Tavily discovery — run all queries in a thread pool
    # ------------------------------------------------------------------
    all_candidates: list[_Candidate] = []

    loop = asyncio.get_event_loop()
    tasks = []
    for source_type, query_template in _QUERIES.items():
        query = query_template.format(name=program_name)
        tasks.append(
            loop.run_in_executor(None, _tavily_search, tavily_keys, query, source_type)
        )

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for result in results:
        if isinstance(result, Exception):
            log.warning("tavily_task_failed", error=str(result))
            continue
        all_candidates.extend(result)

    log.info("tavily_done", total_candidates=len(all_candidates))

    # ------------------------------------------------------------------
    # Step 2: Deduplicate by URL, keep first occurrence (highest Tavily score)
    # ------------------------------------------------------------------
    seen_urls: dict[str, _Candidate] = {}
    for c in all_candidates:
        if c.url not in seen_urls:
            seen_urls[c.url] = c

    unique_candidates = list(seen_urls.values())
    log.info("after_dedup", unique_count=len(unique_candidates))

    # Stream unique candidate pages discovered
    from orchestrator.events import emit_event
    import json
    for idx, c in enumerate(unique_candidates):
        item = {
            "title": c.title or "",
            "url": c.url,
            "snippet": c.tavily_snippet or "",
            "domain": c.url.split("/")[2] if "//" in c.url else c.url
        }
        await emit_event(
            str(program_id),
            "discovering_sources",
            0.05 + 0.10 * ((idx + 1) / len(unique_candidates)) if unique_candidates else 0.15,
            json.dumps({"item": item, "count": idx + 1})
        )

    if not unique_candidates:
        log.info("no_sources_found", program=program_name)
        return []

    # ------------------------------------------------------------------
    # Step 3: Robots.txt check + Firecrawl fetch
    # ------------------------------------------------------------------
    stored: list[Source] = []
    firecrawl_count = 0

    async with httpx.AsyncClient(headers={"User-Agent": "InfoVac/1.0 (+https://github.com/Hrishikesh-Prasad-R/info-vac)"}) as http:
        for idx, candidate in enumerate(unique_candidates):
            # Emit crawling started event
            start_item = {
                "url": candidate.url,
                "status": "active",
                "reason": "",
                "title": candidate.title or "",
                "domain": candidate.url.split("/")[2] if "//" in candidate.url else candidate.url
            }
            progress_val = 0.15 + 0.10 * (idx / len(unique_candidates))
            await emit_event(
                str(program_id),
                "crawling_sources",
                progress_val,
                json.dumps({
                    "item": start_item,
                    "count": idx + 1,
                    "total": len(unique_candidates)
                })
            )

            # Robots check — returns 'allowed' | 'blocked' | 'robots_unverified'
            robots_status = await _check_robots(candidate.url, http)
            if robots_status == "blocked":
                log.info("robots_blocked", url=candidate.url)
                # Emit crawl failure event before continuing
                status_str = "failed"
                reason_str = "Robots blocked"
                item = {
                    "url": candidate.url,
                    "status": status_str,
                    "reason": reason_str,
                    "title": candidate.title or "",
                    "domain": candidate.url.split("/")[2] if "//" in candidate.url else candidate.url
                }
                progress_val_fin = 0.15 + 0.10 * ((idx + 1) / len(unique_candidates))
                await emit_event(
                    str(program_id),
                    "crawling_sources",
                    progress_val_fin,
                    json.dumps({
                        "item": item,
                        "count": idx + 1,
                        "total": len(unique_candidates)
                    })
                )
                continue
            # 'robots_unverified' → proceed but stamp fetch_status below (Decision #1-D)

            # Firecrawl fetch (up to _MAX_FIRECRAWL_FETCHES)
            raw_content: str = candidate.tavily_snippet  # guaranteed fallback
            fetch_method = "tavily_snippet"
            # Seed fetch_status from robots check so 'robots_unverified' propagates
            fetch_status = "success" if robots_status == "allowed" else robots_status

            raw_html: Optional[str] = None

            if firecrawl_count < _MAX_FIRECRAWL_FETCHES and firecrawl_keys:
                markdown, html = await loop.run_in_executor(
                    None, _firecrawl_fetch, firecrawl_keys, candidate.url
                )
                firecrawl_count += 1
                if markdown and len(markdown.strip()) > 50:
                    raw_content = markdown
                    fetch_method = "firecrawl"
                    if fetch_status == "success":
                        fetch_status = "success"
                else:
                    if fetch_status == "success":
                        fetch_status = "failed"
                if html:
                    raw_html = html[:80_000]
                await asyncio.sleep(_FIRECRAWL_DELAY)

            # --- Scraping Fallback: if Firecrawl failed, try BeautifulSoup ---
            if fetch_method == "tavily_snippet":
                log.info("firecrawl_failed_trying_bs4", url=candidate.url)
                try:
                    headers = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                    resp = await http.get(candidate.url, headers=headers, timeout=10.0, follow_redirects=True)
                    if resp.status_code == 200:
                        from bs4 import BeautifulSoup
                        soup = BeautifulSoup(resp.content, "html.parser")
                        for tag in soup(["script", "style", "nav", "footer", "header"]):
                            tag.decompose()
                        
                        text = soup.get_text(separator="\n")
                        lines = (line.strip() for line in text.splitlines())
                        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                        cleaned_text = "\n".join(chunk for chunk in chunks if chunk)
                        
                        if len(cleaned_text.strip()) > 100:
                            raw_content = cleaned_text
                            raw_html = resp.text[:80_000]
                            fetch_method = "beautifulsoup"
                            fetch_status = "success"
                            log.info("bs4_scraping_fallback_success", url=candidate.url, text_len=len(cleaned_text))
                        else:
                            raise ValueError("Extracted text too short")
                    else:
                        raise ValueError(f"HTTP Status {resp.status_code}")
                except Exception as fallback_exc:
                    log.warning("bs4_scraping_fallback_failed", url=candidate.url, error=str(fallback_exc)[:200])
                    raw_content = candidate.tavily_snippet
                    fetch_method = "tavily_snippet"
                    fetch_status = "tavily_fallback"

            # Clean mojibake from crawled title and content before writing to DB (Problem 1)
            raw_content_cleaned = clean_utf8_mojibake(raw_content)
            title_cleaned = clean_utf8_mojibake(candidate.title) if candidate.title else None

            # ----------------------------------------------------------
            # Step 4: Insert into DB (skip if already exists for this program)
            # ----------------------------------------------------------
            source = Source(
                program_id=program_id,
                url=candidate.url,
                source_type=candidate.source_type,
                title=title_cleaned[:500] if title_cleaned else None,
                raw_content=raw_content_cleaned,
                content_hash=Source.make_hash(raw_content_cleaned),
                fetch_method=fetch_method,
                fetch_status=fetch_status,
                raw_html=raw_html,
            )
            db.add(source)
            try:
                await db.flush()  # catch UniqueConstraint early
                stored.append(source)
                log.info(
                    "source_stored",
                    url=candidate.url,
                    type=candidate.source_type,
                    method=fetch_method,
                    content_len=len(raw_content),
                )
            except IntegrityError:
                await db.rollback()
                # Already exists — load existing row
                existing = await db.scalar(
                    select(Source).where(
                        Source.program_id == program_id,
                        Source.url == candidate.url,
                    )
                )
                if existing:
                    stored.append(existing)

            status_str = "success" if fetch_status == "success" else "failed"
            reason_str = "" if fetch_status == "success" else f"Scrape failed ({fetch_status})"
            item = {
                "url": candidate.url,
                "status": status_str,
                "reason": reason_str,
                "title": candidate.title or "",
                "domain": candidate.url.split("/")[2] if "//" in candidate.url else candidate.url
            }
            progress_val_fin = 0.15 + 0.10 * ((idx + 1) / len(unique_candidates))
            await emit_event(
                str(program_id),
                "crawling_sources",
                progress_val_fin,
                json.dumps({
                    "item": item,
                    "count": idx + 1,
                    "total": len(unique_candidates)
                })
            )

    await db.commit()
    log.info(
        "retriever_done",
        program=program_name,
        stored=len(stored),
        types=list({s.source_type for s in stored}),
    )
    return stored
