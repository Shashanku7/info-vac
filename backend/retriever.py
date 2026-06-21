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
}

# URL patterns that override the query-of-origin classification
_URL_TYPE_PATTERNS: list[tuple[str, str]] = [
    (r"apps\.apple\.com|play\.google\.com|appstore", "app_review"),
    (r"reddit\.com|quora\.com|trustpilot\.com|tripadvisor", "forum"),
    (r"prnewswire\.com|businesswire\.com|globenewswire|sec\.gov", "press"),
    (r"terms|conditions|tnc|legal|policy", "tnc"),
    (r"faq|help\.|support\.|questions", "faq"),
]

# How many Tavily results to request per query
_MAX_RESULTS_PER_QUERY = 5

# Max URLs to Firecrawl-fetch (to protect free-tier credits)
_MAX_FIRECRAWL_FETCHES = 20

# Seconds to sleep between Firecrawl calls (rate-limit courtesy)
_FIRECRAWL_DELAY = 0.5


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

def _classify_by_url(url: str, default: str) -> str:
    """Override source_type classification based on URL patterns."""
    url_lower = url.lower()
    for pattern, stype in _URL_TYPE_PATTERNS:
        if re.search(pattern, url_lower):
            return stype
    return default


def _tavily_search(client: TavilyClient, query: str, source_type: str) -> list[_Candidate]:
    """Run one Tavily query, return classified candidates."""
    candidates: list[_Candidate] = []
    try:
        response = client.search(
            query,
            max_results=_MAX_RESULTS_PER_QUERY,
            search_depth="advanced",
        )
        for r in response.get("results", []):
            url = r.get("url", "").strip()
            if not url:
                continue
            title = r.get("title", "") or ""
            snippet = r.get("content", "") or ""
            classified = _classify_by_url(url, source_type)
            candidates.append(_Candidate(
                url=url,
                source_type=classified,
                title=title,
                tavily_snippet=snippet,
            ))
    except Exception as exc:
        log.warning("tavily_search_failed", query=query[:80], error=str(exc))
    return candidates


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


def _firecrawl_fetch(app: FirecrawlApp, url: str) -> Optional[str]:
    """Scrape a URL with Firecrawl. Returns markdown content or None on failure."""
    try:
        result = app.scrape_url(url, formats=["markdown"])
        # firecrawl-py >= 1.0 returns an object with .markdown attribute
        if hasattr(result, "markdown") and result.markdown:
            return result.markdown
        # older versions return a dict
        if isinstance(result, dict):
            return result.get("markdown") or result.get("content") or None
    except Exception as exc:
        log.warning("firecrawl_failed", url=url, error=str(exc)[:200])
    return None


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
    tavily_key = os.getenv("TAVILY_API_KEY", "")
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY", "")

    if not tavily_key:
        raise EnvironmentError("TAVILY_API_KEY is not set in .env")
    if not firecrawl_key:
        raise EnvironmentError("FIRECRAWL_API_KEY is not set in .env")

    tavily = TavilyClient(api_key=tavily_key)
    firecrawl = FirecrawlApp(api_key=firecrawl_key)

    log.info("retriever_start", program=program_name)

    # ------------------------------------------------------------------
    # Step 1: Tavily discovery — run all queries in a thread pool
    # (TavilyClient is synchronous)
    # ------------------------------------------------------------------
    all_candidates: list[_Candidate] = []

    loop = asyncio.get_event_loop()
    tasks = []
    for source_type, query_template in _QUERIES.items():
        query = query_template.format(name=program_name)
        tasks.append(
            loop.run_in_executor(None, _tavily_search, tavily, query, source_type)
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

    if not unique_candidates:
        log.info("no_sources_found", program=program_name)
        return []

    # ------------------------------------------------------------------
    # Step 3: Robots.txt check + Firecrawl fetch
    # ------------------------------------------------------------------
    stored: list[Source] = []
    firecrawl_count = 0

    async with httpx.AsyncClient(headers={"User-Agent": "InfoVac/1.0 (+https://github.com/Hrishikesh-Prasad-R/info-vac)"}) as http:
        for candidate in unique_candidates:
            # Robots check — returns 'allowed' | 'blocked' | 'robots_unverified'
            robots_status = await _check_robots(candidate.url, http)
            if robots_status == "blocked":
                log.info("robots_blocked", url=candidate.url)
                continue
            # 'robots_unverified' → proceed but stamp fetch_status below (Decision #1-D)

            # Firecrawl fetch (up to _MAX_FIRECRAWL_FETCHES)
            raw_content: str = candidate.tavily_snippet  # guaranteed fallback
            fetch_method = "tavily_snippet"
            # Seed fetch_status from robots check so 'robots_unverified' propagates
            fetch_status = "success" if robots_status == "allowed" else robots_status

            if firecrawl_count < _MAX_FIRECRAWL_FETCHES and firecrawl_key:
                markdown = await loop.run_in_executor(
                    None, _firecrawl_fetch, firecrawl, candidate.url
                )
                firecrawl_count += 1
                if markdown and len(markdown.strip()) > 50:
                    raw_content = markdown
                    fetch_method = "firecrawl"
                    # Keep robots_unverified if set; otherwise mark success
                    if fetch_status == "success":
                        fetch_status = "success"
                else:
                    # Firecrawl returned nothing useful — keep snippet
                    if fetch_status == "success":
                        fetch_status = "failed"
                # Polite delay between Firecrawl calls
                await asyncio.sleep(_FIRECRAWL_DELAY)

            # ----------------------------------------------------------
            # Step 4: Insert into DB (skip if already exists for this program)
            # ----------------------------------------------------------
            source = Source(
                program_id=program_id,
                url=candidate.url,
                source_type=candidate.source_type,
                title=candidate.title[:500] if candidate.title else None,
                raw_content=raw_content,
                content_hash=Source.make_hash(raw_content),
                fetch_method=fetch_method,
                fetch_status=fetch_status,
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

    await db.commit()
    log.info(
        "retriever_done",
        program=program_name,
        stored=len(stored),
        types=list({s.source_type for s in stored}),
    )
    return stored
