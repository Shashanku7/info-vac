# InfoVac — Progress & Handoff Log

---

## Handoff — 2026-06-27 — Phase 7 [COMPLETE]

### Status
Live Chat Script verified: Successfully grounded the `gemma4:31b` LLM using Qdrant semantic search. Accurately provided a null-response when exact benefits were missing, preventing hallucination.

### What Phase 7 Built & Modified
| File | Role |
|---|---|
| `backend/embeddings.py` | Migrated to an offline, memory-safe, 4-bit quantized embedding model (`AMAImedia/Qwen3-Embedding-8B-NOESIS-AWQ-INT4`). Avoids laptop OOM crashes while processing chunks. |
| `backend/qdrant_client.py` | Transitioned to enterprise Qdrant Cloud. Enforced mandatory `KEYWORD` payload index on `program_id` to allow strict filtering. Updated `client.search` to `client.query_points`. |
| `backend/chat.py` | RAG endpoint. Vectorizes user questions, queries Qdrant for semantic chunks matching `program_id`, merges extracted facts from Postgres, and prompts the LLM to answer strictly from provided context. |
| `backend/retriever.py` | Added 5 targeted Tavily search queries (`homepage`, `benefits`, `partners`, `mechanics`, `competitors`) to ensure the scraper discovers actual program details rather than just legal terms and app reviews. |
| `setup.bat` & `.env.example` | Fully automated 5-step Windows onboarding script to install dependencies, boot Docker, run migrations, and prevent Docker-offline crashes. |

---

## Handoff — 2026-06-27 — Phase 6 [COMPLETE]

### Status
Unit tests: **40/40 passed** in 4.72s (zero regressions).
Live E2E tests: **7/7 passed** in 8.3 minutes (full DB, live FastAPI server, LangGraph pipelines, Ollama). Phase 0-6 fully verified.

### What Phase 6 Built
| File | Role |
|---|---|
| `backend/comparator.py` | Strategic two-program comparison grounded in gate-verified `extracted_fields`. Uses `_make_client()` (Ollama Cloud / gemma4:31b-cloud). Structured Pydantic output: executive summary, advantages per program, category diffs, gaps, strategic recommendation. All facts require `(source: <url>)` inline citations. |
| `backend/models.py` | Added `Comparison` ORM model (JSONB `analysis_json` column). |
| `backend/main.py` | Added `POST /api/compare` (validates both programs are `complete`, runs comparison, returns analysis) and `GET /api/compare/{id}` (retrieve stored comparison). |
| `tests/test_comparator.py` | 6 unit tests: context filtering, both-programs-present, DB storage, grounding constraint, LLM failure graceful-None, empty-program handling. |

### Design Decisions
1. **Not part of the pipeline orchestrator.** Comparisons are on-demand via `POST /api/compare`, not triggered automatically. Both programs must already have `status='complete'`.
2. **Re-comparison allowed.** No unique constraint on `(program_a_id, program_b_id)` — each comparison gets a fresh UUID. Data may have changed between runs.
3. **Same grounding pattern as narrator.** Only `gate_passed=TRUE AND is_null=FALSE` fields fed to the LLM. Source URLs from `extracted_fields → sources.url`.

---

## Handoff — 2026-06-27 — Phase 5 [COMPLETE]

### Status
Live e2e tests (`test_orchestrator_e2e.py`): **2/2 passed** (Testing Starbucks Rewards and Delta SkyMiles against real-world data).

### What Phase 5 Built & Modified
| File | Role |
|---|---|
| `backend/extractor.py` | Migrated LLM client to `gemma4:31b-cloud` via Ollama OpenAI-compatible endpoint. Set `https://ollama.com/v1`. |
| `backend/narrator.py` | Built `generate_narrative()` to write 200-1000 word analyst briefs. Lowered `_MIN_WORDS` to 200 to prevent LLM hallucinations on sparse data. Enforced `(source: <url>)` inline citations. |
| `backend/retriever.py` | Verified fallback resilience: if Firecrawl hits a 402 Payment Required limit, seamlessly falls back to Tavily snippets. |

### Fixes Applied to Pass Phase 5
1. **Negative Constraint Collision:** Tuned the narrator system prompt. Discovered that asking for exactly 500 words of dense prose *without* allowing the LLM to extrapolate caused `gemma4:31b-cloud` to write 500-word apologies explaining why it didn't have enough data. Lowering `_MIN_WORDS = 200` solved this.
2. **Unicode Logging Crash:** Fixed a `UnicodeEncodeError` that crashed the pipeline during the verification stage when `structlog` attempted to print un-encodable characters (like `★` from app reviews) to the console. Enforced UTF-8 logging.
3. **LLM Swapping:** Successfully swapped the backend off of Gemini's API to the Ollama Cloud API (`gemma4:31b-cloud`), proving the architecture's modularity.
## Handoff — 2026-06-24 — Phase 4 [COMPLETE]

### Status
Unit tests: **28/28 passed** (no API, no DB, no live marker).
Live e2e test (`-m live`): **2/2 passed** in ~3.5 minutes.

### What Phase 4 Built
| File | Lines | Role |
|---|---|---|
| `orchestrator/state.py` | 37 | PipelineState TypedDict + iter_fields() |
| `orchestrator/events.py` | 74 | emit_event() + set_status() |
| `orchestrator/nodes.py` | 238 | 4 async nodes: retrieve (tenacity 3×), extract, verify, narrate stub |
| `orchestrator/graph.py` | 58 | Thin wiring + run_pipeline() entry point |
| `backend/models.py` | 120 | Added ExtractedField + PipelineEvent ORM models |
| `backend/db.py` | 40 | Added make_background_session() NullPool ctx manager |
| `backend/main.py` | 161 | POST /run, GET /{id}, GET /{id}/stream (asyncpg LISTEN SSE) |
| `tests/test_orchestrator_unit.py` | 303 | 4 unit tests: event order, retry, iter_fields, short-circuit |
| `tests/test_orchestrator_e2e.py` | 131 | 2 live tests (@pytest.mark.live) |
| `backend/extractor.py` | 343 | Reduced payload source truncation to 4000 chars |

### Fixes Applied to Pass Phase 4
1. **Async Starvation:** Switched from `make_background_session()` (NullPool) to `AsyncSessionLocal()` in `orchestrator/events.py` so the SSE streams don't time out.
2. **SSE Race Condition:** Modified `test_orchestrator_e2e.py` to open the SSE stream *before* triggering the pipeline run. This prevented the test from missing the initial `retrieving` event.
3. **TPM Rate Limit:** Truncated sources from `8000` down to `4000` characters in `backend/extractor.py`. This ensures 8 sequential category extractions stay safely under Gemini's `250,000` Tokens-Per-Minute limit.

### Decisions & Findings closed this session
- **Rate Limit Reality Check:** Both `gemini-2.5-flash` and `gemini-2.5-flash-lite` currently enforce a strict `20 requests per day` free tier quota for generating content (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). 
- **Orchestrator Resilience:** Confirmed that when the LLM throws `429` quota errors, the orchestrator gracefully catches the exception, logs it, inserts `null` for that category, and successfully completes the remaining pipeline without crashing.

---

## Handoff — 2026-06-21T07:57:00Z — Phases 2 + 3 [COMPLETE]

### Phase 2 — Extractor + Gate
Test run: **10/10 gate tests passed in 0.70s**

Built:
- `backend/extractor.py` (343L): 8-category ExtractedSchema, one Instructor call per category,
  content-sanitizer injection defense, `model_certainty_hint` (NOT `confidence`)
- `backend/gate.py` (156L): deterministic rapidfuzz gate, `partial_ratio ≥ 0.80`,
  `GateResult` dataclass, batch verify helper
- `tests/test_gate.py` (199L): 10 tests — null pass, missing-quote reject, exact match,
  hallucination reject (DoD), batch, determinism — no live marker

**CRITICAL design rule (confidence column ownership):**
- `model_certainty_hint` = LLM self-assessment, a hint only. NEVER written to `extracted_fields.confidence`.
- `extracted_fields.confidence` is ONLY written by Phase 3's verifier formula.

### Phase 3 — Verifier
Test run: **14/14 verifier tests passed in 0.70s**

Built:
- `backend/verifier.py` (252L): `confidence = 0.5×corroboration + 0.3×authority + 0.2×recency`,
  contradiction detection + cap at 0.4, ONLY writer of `extracted_fields.confidence`
- `tests/test_verifier.py` (255L): 14 tests — hand-calculated formula, mixed authority,
  stale recency, contradiction cap (DoD), 10-run determinism (DoD) — no live marker

Authority weights: `tnc=1.0, press=0.9, faq=0.8, news=0.7, app_review=0.6, forum=0.5`
Recency: linear decay 1.0 (≤30 days) → 0.3 (≥365 days), floor 0.3

### Decisions closed this session
- **OPEN_DECISIONS.md #1** (robots.txt): Option D — allow + mark `fetch_status='robots_unverified'`
- **OPEN_DECISIONS.md #2** (test mocking): Option B — `@pytest.mark.live` marker
  - Default `pytest` = fast, no API calls, <5s
  - Phase-gate: `pytest -m live -v -s`

---

## Handoff — 2026-06-21T02:19:00+05:30 — Phase 1 [COMPLETE]

### Test run (actual output)
```
pytest tests/test_retriever.py -m live -v -s → 4 passed in 368.69s (0:06:08)
```

### Built and verified
- `backend/models.py`: Source ORM model
- `backend/retriever.py`: discover_sources() — Tavily (6 types × 5 results), dedup,
  robots.txt check (3-value: allowed/blocked/robots_unverified), Firecrawl fetch,
  Tavily-snippet fallback, DB insert
- `tests/conftest.py`: NullPool engine per test — definitive fix for asyncpg cross-loop
  crash on Windows Python 3.14
- `tests/test_retriever.py`: 4 DoD tests (@pytest.mark.live)
- `scripts/run_retriever.py`: manual spot-check table printer

### Real results verified
```
Starbucks Rewards : types={faq, tnc, app_review, press, news, forum}
Marriott Bonvoy   : 21 sources, types={press, faq, tnc, app_review, news}
Delta SkyMiles    : 21 sources, types={forum, press, faq, tnc, app_review, news}
Fake program      : 0 sources, no crash
Reddit/Facebook   : correctly robots_blocked
```

### Decisions
- Tavily: 1 query/type × 6 types × 5 results = 30 candidates → dedup → ~15 unique
- Firecrawl: full markdown fetch; Tavily snippet fallback guarantees raw_content never empty
- robots.txt: 3-value return (allowed/blocked/robots_unverified) — Decision #1-D
- Source-type: query-of-origin primary, URL pattern override secondary

---

## Handoff — 2026-06-20T20:56:00+05:30 — Phase 0 [COMPLETE]

### Test run (actual output)
```
pytest tests/phase0_test.py -v
5 passed in 8.38s
```

### Built and verified
- `docker-compose.yml`: Postgres 15-alpine, healthcheck, persistent volume
- `alembic/versions/0001_initial_schema.py`: 9 tables, LISTEN/NOTIFY trigger, 5 indexes
- `backend/main.py`: FastAPI POST /api/programs → UUID insert
- `backend/db.py`: async SQLAlchemy + asyncpg session
- `backend/models.py`: Program ORM model
- `orchestrator/graph.py`: LangGraph 4-node stub
- `scripts/instructor_smoke.py`: Instructor+Gemini-2.5-flash one-field extraction
- `tests/phase0_test.py`: 5 DoD checks

### Decisions
- `google-generativeai` (old SDK) kept for instructor compat — `instructor.from_gemini()`
  requires `genai.GenerativeModel`. FutureWarning suppressed in pytest.ini.
- `Mode.MD_JSON` replaces deprecated `Mode.GEMINI_JSON` (instructor ≥ 1.15)
- 9 tables (not 7) — eval_ground_truth + redteam_tests per SOLUTION.md Day 8-9 plan
- No Redis — Postgres LISTEN/NOTIFY replaces it entirely
- NullPool in test conftest — only reliable fix for Windows Python 3.14 asyncpg

---

## Do Not Reconsider (accumulated invariants)
- No Redis anywhere — Postgres LISTEN/NOTIFY handles all pub/sub
- NullPool in `tests/conftest.py` — do not revert
- One Instructor call per category (not one monolithic call)
- `model_certainty_hint` ≠ `confidence` — only verifier.py writes `extracted_fields.confidence`
- `google-generativeai` SDK kept for instructor compat — FutureWarning suppressed, not fixed
- `asyncio.create_task()` in FastAPI + same event loop → use `AsyncSessionLocal` for emit/status
  (NullPool only for test fixtures and thread-executor callers)
- All files must stay ≤ 500 lines — split into modules if approaching limit
- Default `pytest` = fast (no live marker) — always runs clean in <10s
- Phase-gate certification = `pytest -m live`

---

## Pending Phases

### Phase 5 — Narrator (next after Phase 4 live tests green)
- `backend/narrator.py`: generate_narrative(program_id) → 200-1000 word brief
- Use Gemini-2.5-flash, word count enforced in code (not LLM-trusted)
- Input: gate-verified extracted_fields rows only
- Output: stored in `narratives` table
- DoD: `pytest tests/test_narrator.py` — word count within bounds, no hallucination beyond
  extracted_fields data

### Phase 6 — Comparator [COMPLETE]
- `backend/comparator.py`: compare two programs by UUID
- Input: extracted_fields rows for both programs
- Output: strategic diff stored in `comparisons` table

### Phase 7 — Chat (grounded Q&A)
- Grounded-only follow-up Q&A (no outside knowledge)
- Input re-injected from extracted_fields + narratives every turn

### Phase 8 — Eval harness + threshold calibration
- Hand-verify 8-10 programs → populate eval_ground_truth
- Calibrate gate threshold (currently 0.80, untuned placeholder)
- Calibrate confidence null-threshold against rubric math (+1/+0.5/0/-3)

### Phase 9 — Red-team + injection tests
- Indirect prompt injection: scraped content containing instructions
- Low web-presence programs: graceful null, no padding
- Recently-rebranded programs: contradiction detection verification

---

## Handoff — Documentation Update [COMPLETE]

### Status
- Created `docs/solution.md` containing a brief, simple, summary of the solution approach, incorporating the MVP architecture diagram via Mermaid.
- The document begins with the problem statement and concludes with the specific question for the Kobie mentor regarding standard RAG vs. PostgreSQL-backed deterministic verification.

---

## Handoff — 2026-06-28 — Resilience, Schema & Comparator Upgrades [COMPLETE]

### Status
Unit tests: **52/52 passed** in 18.14s (100% green). All resilience fallbacks, schema evolutionary migrations, and comparator matrix upgrades fully verified.

### What was Built & Modified
| File | Role |
|---|---|
| `backend/retriever.py` | Added local raw BeautifulSoup HTTP scraping fallback with user-agent spoofing if Firecrawl rate limits or fails. |
| `backend/extractor.py` | Built a dynamic LLM client proxy `FallbackClient` that automatically retries the next backend (Gemini -> Ollama Cloud -> Claude -> OpenAI) if the current provider fails. |
| `backend/chat.py` | Implemented RAG Chat fallback to Structured SQL context (facts + Narrator brief) if Qdrant Vector DB is completely unreachable. |
| `backend/models.py` | Dropped `UNIQUE(program_id, field_name)` unique constraints (Migration `0005`), supporting history tracking and multiple pipeline runs. Added `program_ids` JSONB to `Comparison`. |
| `backend/main.py` | Created `GET /api/programs/{id}/evolution` comparative changelog endpoint. Upgraded `POST /api/compare` to accept lists of `program_ids` and validate completed status. |
| `backend/comparator.py` | Refactored `compare_programs` to accept a list of program IDs and output a ranked category comparison matrix (`MarketMatrixOutput`). |
| `orchestrator/nodes.py` | Fixed critical bug: explicitly set `access_date` to parsed source fetch timestamp in `verify_node`. |
| `Dockerfile` & `docker-compose.yml` | Configured production Dockerfile and simplified single-replica Compose setup. |
| `tests/test_comparator.py` | Rewrote tests to assert correct rankings and structure for multi-program comparisons. |
| `tests/test_rag_upgrades.py` | Wrote unit tests for hybrid search prefetch, metadata filtering, semantic LLM judge gate, and verifier integration. |

### Design Decisions
1. **Append-Only History:** By removing unique constraints and adding `get_latest_only()` logic to Postgres queries, we track the evolution of loyalty schemes without bloating the current chat or brief contexts.
2. **DNS & Load Balancing Rejection:** Rejected multi-replica host port-range configuration in Docker Compose for development environment to preserve a clean single-port mapping (`8000:8000`), avoiding setup complexity.

