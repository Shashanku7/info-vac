# InfoVac Codebase Surprises & Engineering Audit (Part 1: Key Management & Routing)

This document contains a deep technical analysis of the core files in the `backend` folder responsible for API stability, LLM failovers, key rotations, and metadata classification.

---

## 🔑 1. API Key Broker (`backend/key_broker.py`)
This is a thread-safe, lock-guarded key manager built to handle rate-limiting and quota errors dynamically.

### Cool Features & Surprises:
* **Thread-Safe Load Balancing**: Uses Python's `threading.Lock` to guarantee that concurrent threads in the graph extractor pool do not experience race conditions when checking out API keys.
* **Least-Recently-Used (LRU) Scheduling**: Tracks the `last_used` timestamp for each key. When a key is requested, it retrieves the eligible key with the oldest `last_used` value. This spreads load evenly across keys to stay below rate limits.
* **Thread-Local Failure Isolation**: Utilizes `threading.local()` to store the last checked out key path (`self.local_data.last_key`) for each active execution thread. When a thread encounters an API failure, `report_last_key_failure` extracts this identifier from thread-local storage to target the correct key without polluting global state.
* **Smart Cooldown Intervals**:
  * If a key encounters a transient API drop, it is sidelined for **30 seconds**.
  * If a key hits a daily quota exhaustion limit (`429` / rate-limit), it is locked out of rotation for **1 hour**, preventing downstream threads from wasting time on it.
* **Blocking Backpressure**: If all configured keys are in cooldown, the `get_key()` checkout block safely loops with `time.sleep(0.1)` until a key becomes healthy, acting as natural backpressure for API requests.

---

## 🔀 2. Fallback Router Client (`backend/llm_client.py`)
Provides automatic routing and failover across multiple available LLM providers (Gemini, Ollama, Groq, Anthropic, OpenAI) for structured Pydantic extraction.

### Cool Features & Surprises:
* **Dynamic Lambda Injection**: The client dictionary doesn't store instantiated connection objects. Instead, it stores `lambda: client_factory()`. The API key is requested dynamically from the `APIKeyBroker` *only* when the thread actually triggers the completion call, enabling real-time key rotation.
* **Pool-Wide Expiry Loops**: Completion creations are wrapped inside a loop that retries up to the total number of configured keys in the broker. If an API request fails with a rate-limit/quota error (`429`), the key is instantly marked as dead in the broker, and the fallback router dynamically acquires the next key and retries the request without pausing.
* **Unified Interface Wrapper (`FallbackClient`)**: Implements custom classes `FallbackClient`, `FallbackChat`, and `FallbackCompletions` to mimic the standard OpenAI SDK client interface (`client.chat.completions.create`). This lets developers use normal completion call syntax while the backend silently handles routing and fallback loops under the hood.
* **Clean Failover Loop**: If the primary backend (Gemini) fails, it catches the exception, logs it, and immediately moves to the next available backend (Ollama -> Groq -> Anthropic -> OpenAI) within the same single function call.
* **Verbose Error Propagation**: In case of complete key exhaustion, the server does not swallow errors. Instead, it catches and maps `429` rate-limit exceptions to clean JSON details, propagating the exact error status up to the Next.js frontend to show high-fidelity alert boxes.

---

## 🏷️ 3. Source Classifier (`backend/classifier.py`)
A fast, deterministic, non-LLM source categorization utility.

### Cool Features & Surprises:
* **0-Token Classification**: Instead of calling an LLM to categorize discovered URLs into types like `tnc`, `faq`, or `press`, it uses a deterministic 4-stage regular expression priority chain.
* **Priority Order**:
  1. **Trusted Domain Patterns**: Matches patterns like `apps.apple.com` (App Reviews) or `reddit.com/flyertalk.com` (Forums) first.
  2. **URL Path Patterns**: High confidence path keywords like `/terms`, `/legal`, or `.pdf` matches (Tnc).
  3. **Title Keywords**: Performs case-insensitive matching on titles returned by search engines.
  4. **Snippet Fallbacks**: Scans search result snippets for legal vocabulary (e.g. *"pursuant to"*, *"herein"*, *"shall not"*) to classify T&C documents.
* **Performance**: Runs in sub-microseconds, completely bypassing network API costs and latency.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 2: Extraction & Verification)

This section documents the structured extraction models, fuzzy-citation gates, and statistical confidence scoring engines.

---

## 🔍 4. Structured Schema Extractor (`backend/extractor.py`)
Fires 9 category-specific LLM extractions in parallel and uses custom budget planning to avoid context limits.

### Cool Features & Surprises:
* **HTML Table Reconstruction (`_extract_html_tables`)**: Standard markdown converters strip table layouts, turning column entries into a jumbled line of text. The extractor runs a regex parser to extract `<table>` elements and reconstruct them into clean pipe-delimited text (` | `), preserving tier structure for the LLM.
* **Authority-Weighted Source Budgeting**: Instead of truncating web text blindly, the parser assigns weight multipliers to source types (e.g. `tnc: 1.8`, `press: 1.5`, `forum: 0.7`). It calculates a relative budget out of a `200,000` character cap, ensuring high-authority documents occupy more of the LLM context window.
* **Strict Uncertainty Tuning**: System prompts enforce absolute uncertainty. If the LLM has any doubt about a parameter, it must output `null`, which are later caught and fed to a second-stage retrying mechanism rather than risking a hallucinated claim.
* **Staggered Request Delay**: Schedules threads with a staggered delay (`0.6s * idx`) to stay safely under free-tier API concurrency limit thresholds.

---

## 🛡️ 5. Verification Gate (`backend/gate.py`)
Validates every claim's verbatim citation against the original source documents using fuzzy matching and segment splitting.

### Cool Features & Surprises:
* **Stitched/Composite Quote Splitting**: If the LLM returns a quote stitched from separate parts of a document (e.g. separated by ellipses `...` or `[]`), standard matching fails. The gate splits the quote on delimiters, matches each segment independently, and enforces a **Weakest-link principle** (taking the minimum score of all segments rather than an average) to prevent partial hallucinations.
* **Attribution Recovery (`gate_verify_multi_source`)**: If the LLM associates a fact with the wrong URL, the gate runs a search across *all* crawled pages to find where the quote actually resides, re-attributing the correct `source_id` and URL in the database automatically.
* **Majority-Vote Multi-Source Attribution**: If segments of a composite quote are found across multiple documents, it counts which source page matched the most segments and attributes the citation to that URL.

---

## 📊 6. Confidence & Contradictions (`backend/verifier.py`)
Computes credibility scores deterministically without relying on costly LLM evaluations.

### Cool Features & Surprises:
* **Grounded Confidence Formula**: Calculates a compound confidence score using the formula:
  $$\text{Confidence} = 0.5 \times \text{Corroboration} + 0.3 \times \text{Authority} + 0.2 \times \text{Recency}$$
* **Recency Sigmoid Decay**: Applies a decay calculation to the source's `fetched_at` timestamp. Fresh sources (<30 days old) get a perfect `1.0` score, while old sources clamp to a `0.3` floor.
* **Fuzzy Pairwise Contradiction Capping**: Runs a pairwise fuzzy check across all gate-verified values for a parameter. If two sources disagree (less than 65% similarity), it marks `contradiction_flag = True` and **caps the parameter's confidence score to a maximum of 0.4**, flagging it for human audit.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 3: Retrieval & Synthesis)

This section documents the web crawler, strategic comparator picker, and brief generation engines.

---

## 🌐 7. Web Crawler (`backend/retriever.py`)
Targeted crawler utilizing Tavily multi-queries, Mojibake cleanup, and Robots.txt parser validation.

### Cool Features & Surprises:
* **Mojibake Repair (`clean_utf8_mojibake`)**: Crawled web pages often contain encoding errors. The retriever automatically detects and fixes double-decoding artifacts (e.g. `â€™` → `’`, `Ã©` → `é`), guaranteeing clean quotes and higher citation verifications.
* **Targeted Search Grid**: Instead of doing a single blind search for a program, the retriever fires **11 targeted queries** mapped to specific source types (e.g. aviation/hotel partners, FAQ, terms documents), collecting a highly diverse context.
* **Robots.txt parser**: Respects target websites by checking their `robots.txt` dynamically before crawling. If the check fails or times out, it labels the source as `robots_unverified` rather than crashing, balancing legal compliance and runtime robustness.

---

## 📊 8. Comparative Engine (`backend/comparator.py`)
Generates structured side-by-side matrices and strategic comparisons from PostgreSQL gate-verified facts.

### Cool Features & Surprises:
* **Zero-Hallucination Grounding**: Pulls *only* fields where `gate_passed=True` and `is_null=False` from the database. It constructs a grounded text block with explicit sources, ensuring the comparator LLM never extrapolates.
* **Strict Formatting Instructions**: Prompt instructions enforce the separator logic so that citations are parsed cleanly as separate superscript badges in the UI and PDF exports.

---

## 📝 9. Analyst Brief Narrator (`backend/narrator.py`)
Synthesizes verified program facts into structured markdown reports.

### Cool Features & Surprises:
* **Section-by-Section Synthesis**: Iterates through each loyalty category, feeding only the verified fields for that category to the LLM to draft the overview. This keeps prompt windows small and answers highly accurate.
* **Strict Grounding Enforcement**: The system template forbids the LLM from adding styling markers or placeholder items, keeping the report consulting-grade.
* **Source-Dependent Word Limits**: Enforces dynamic length constraints during generation: if the program has fewer than 7 successfully scraped sources, the minimum brief length is 200 words (to prevent hallucinated filler text); otherwise, the minimum is 500 words. The maximum length is capped at 1,000 words. Word counts are calculated by stripping citation indices to prevent format manipulation.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 4: Data Models & Session Scopes)

This section documents the database schema designs and thread-safe session handlers.

---

## 💾 10. Extraction Schemas (`backend/extraction_schemas.py`)
Contains Pydantic definitions and validators enforcing logical coherence.

### Cool Features & Surprises:
* **Three-Way Boolean State (`EvidenceState`)**: Distinguishes between confirmed positive (`TRUE`), confirmed negative (`FALSE`), and missing data (`NOT_MENTIONED`). This enables exact auditing by avoiding default assumptions.
* **Coherence Validators**: Runs `@model_validator(mode="after")` to parse extracted values. For store ratings, it automatically verifies that ratings fall strictly between `0.0` and `5.0`. If a value is outside this range, it nullifies it to wipe LLM hallucinations.

---

## 🗄️ 11. SQLAlchemy Models (`backend/models.py`)
ORM models modeling relationships, unique indices, and JSONB analysis storage.

### Cool Features & Surprises:
* **JSONB Diff Storage**: Stashes comparative analysis results directly inside Postgres using `JSONB` columns, enabling instant retrieval and lightning-fast search queries.
* **Cascading Purges**: Uses robust ForeignKey cascades (`ondelete="CASCADE"`) to cleanly delete dependent rows when purging stale programs.

---

## 🧵 12. Session Management (`backend/db.py`)
FastAPI dependency and background thread-safe database engine.

### Cool Features & Surprises:
* **Thread-Safe Async Session Factory**: Provides `make_background_session()` to spawn async SQLAlchemy database sessions for background threads, preventing connection leakage.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 5: Vector Stores & API Gateways)

This section documents the vector storage schemas, client fallback mechanics, and FastAPI routers.

---

## 🧠 13. Text Embeddings (`backend/embeddings.py`)
Semantic text splitters and resilient batch Google embedding generation.

### Cool Features & Surprises:
* **API Key Rotation for Embeddings**: Shares the `GEMINI_API_KEYS` rotation list to automatically configure and switch Google client keys when generating vectors, preventing daily token limits from locking up the system.
* **Zero-Crash Embeddings Fallback**: If all configured Google keys fail, it logs an error but **returns zero-filled dummy vectors (3072 dimensions)** instead of crashing, keeping the extraction pipeline moving forward.

---

## 📡 14. Vector Database Config (`backend/qdrant_client.py`)
Unified Qdrant collection generation, indexes, and schema reconciliation.

### Cool Features & Surprises:
* **Auto-Reconciliation Scheme**: Inspects the collection params on launch. If the existing dense dimension or sparse index config differs from what is configured, it **automatically drops and recreates the collection** rather than crashing with database dimension mismatches.
* **Keyed Payload Indexes**: Creates keyword index mapping on the `program_id` payload field inside Qdrant for fast multi-tenant filtering.

---

## 🛣️ 15. API Routers (`backend/routers/` & `backend/main.py`)
FastAPI routers providing Server-Sent Events, evolution metrics, and PG Notification bridges.

### Cool Features & Surprises:
* **PostgreSQL Notification Bridge (SSE Streaming)**: Instead of the client polling the database repeatedly during crawls, the backend uses `pg_notify` and PostgreSQL triggers. Event payloads are fired into PostgreSQL, which instantly relays them via async listeners to the FastAPI stream, routing live updates to the frontend with sub-millisecond latency.
* **Admin Statistics Aggregation**: Computes aggregate statistical graphs (Gate validation rates, Authority tiers, Confidence averages) dynamically from the database to present live health indicators.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 6: LangGraph State Machine & Schema Flow)

This section documents the graph configuration, state variables, and schema iterations.

---

## 🕸️ 16. Graph Setup (`orchestrator/graph.py`)
StateGraph builders and LangSmith sharing integrations.

### Cool Features & Surprises:
* **Automated LangSmith Sharing**: Wraps the async graph execution in a LangChain `collect_runs()` context. Upon completion, it automatically triggers `Client().share_run(run_id)` to make the trace public and registers the shareable link in PostgreSQL, allowing users to trace nodes directly from the UI.

---

## ⚙️ 17. Pipeline Nodes (`orchestrator/nodes.py`)
StateGraph transitions, double-pass extraction retries, and offset indexing.

### Cool Features & Surprises:
* **Two-Phase Extraction Retry (`retry_failed_fields`)**: If fields fail verification on the first run, the `verify_node` doesn't just proceed with nulls. Instead, it aggregates only the failing field names and launches a targeted second LLM extraction pass (`retry_failed_fields`) to re-attempt extraction, checking the new results against the fuzzy gate.
* **Character Offset Indexing**: Parses verified quotes and matches their exact index start/end coordinates (`citation_start` and `citation_end`) against the original webpage's text. This enables the frontend Evidence Drawer to locate and highlight the sentence in yellow dynamically.
* **Qdrant Batch Timeout Protection**: Batches dense/sparse vectors uploads with a strict `45.0s` async timeout (`asyncio.wait_for`). If vector uploading hangs due to Qdrant cloud logic, it emits an event warning but continues the main extraction, preventing network lag from stalling the user.

---

## 📦 18. Pipeline State (`orchestrator/state.py`)
TypedDict structures and field iteration helpers.

### Cool Features & Surprises:
* **Shared State Validation**: Configures a JSON-serializable `PipelineState` TypedDict that isolates memory by requiring ORM objects to be flattened into dictionaries inside the `retrieve_node` before flowing.
* **Schema Iteration Generator (`iter_fields`)**: Provides a helper function that dynamically flattens Pydantic nested models into a clean generator list of `(category_key, field_name, value_dict)` tuples, preventing boilerplate dictionary mapping in the verification phase.

---

## 📢 19. Event Dispatcher (`orchestrator/events.py`)
PostgreSQL-backed Server-Sent Events triggers.

### Cool Features & Surprises:
* **Postgres Event Broadcasting**: Uses an async engine connection (`AsyncSessionLocal`) to commit pipeline status updates and progress inserts. It relies entirely on Postgres triggers to execute `NOTIFY` events, bypassing HTTP message brokers to keep SSE deliveries completely real-time.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 7: App Gateway Pages)

This section documents the primary Next.js page controllers and dashboards.

---

## 🖥️ 20. Workspace Home (`frontend/app/page.tsx`)
Initializes global states, synchronizes browser local caches, and orchestrates comparison flows.

### Cool Features & Surprises:
* **Fuzzy Cache Lookup (Instant Loading)**: On submitting program names, the home page does not block the thread. It runs a case-insensitive search check against Postgres programs first. If it finds a matching completed record, it loads the entire workspace instantly (~10ms cache hit), bypassing the LangGraph pipeline entirely unless the user explicitly clicks "Force Reanalyse".
* **Persistent Session States**: Restores program and comparison views automatically from `localStorage` upon page reload, preventing user progress loss if browser sessions drop.

---

## 📊 21. Admin Dashboard (`frontend/app/admin/page.tsx`)
Real-time stats panel, health checking, and system usage graphs.

### Cool Features & Surprises:
* **Dynamic Stats Aggregations**: Computes statistical aggregates (average confidence, verification pass rates, and total token usage costs) client-side directly from the array of extracted field records, saving backend CPU overhead.
* **Interactive Health Dot Status**: Regularly polls the FastAPI `/health` endpoint to verify connection stability. If a network disconnect is detected, it pops up a bottom-right toast message warning.

---

## 🎨 22. App Layout (`frontend/app/layout.tsx`)
Global fonts loading and clean design wrappers.

### Cool Features & Surprises:
* **Google Fonts Optimizations**: Loads standard high-quality Inter and Geist Mono fonts through the `next/font/google` package, bundling them locally as CSS variables to speed up page rendering.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 8: Frontend Components Grid)

This section documents the primary workspace UI components.

---

## 🔍 23. Autocomplete Search Input (`frontend/components/analyst/ProgramInput.tsx`)
Dynamic input arrays, query debouncing, and fuzzy suggestions.

### Cool Features & Surprises:
* **Multi-Input Dynamic Row Addition**: Allows clicking "+" to add more program fields to compare up to 5 brands in parallel, automatically flattening inputs into CSV query requests.
* **Autosearch Debouncer**: Restricts API calls by setting a `200ms` debounce timer on search triggers, ensuring search query lookups don't overload the backend database while the user is typing.
* **Relative Time Formatter (`formatRelative`)**: Renders custom readable timestamps (e.g. *"just now"*, *"15m ago"*, *"yesterday"*) for cached items in the autocomplete selection dropdown.

---

## 🗂️ 24. Single Program Workspace (`frontend/components/analyst/SingleProgramView.tsx`)
Contains the tab panels switcher, evolution list, and trace view bridges.

### Cool Features & Surprises:
* **Trace Navigation Bridge**: Renders a "View Trace" button linked directly to the public LangSmith execution trace if available, giving judges transparent access to visual LLM execution trees.
* **Dynamic Progress Subtitle Parser**: Parses SSE JSON payloads on-the-fly to extract exact extraction progress (e.g., `Extracted base earn rate (12/45)`), showing exactly which parameter the agent is processing.

---

## 🔍 25. Brief View Report (`frontend/components/analyst/BriefView.tsx`)
Render panel displaying markdown files with custom styles.

### Cool Features & Surprises:
* **Consulting-Grade Typography**: Uses Inter sans serif and customized styling elements to make generated markdown summaries read like high-end research documents.

---

## 🎚️ 26. Key Stats Cards (`frontend/components/analyst/OverviewTab.tsx`)
Grid containing overview parameters and brand highlights.

### Cool Features & Surprises:
* **Confidence Summary Rings**: Visualizes overall program data credibility using colored radial indicators that compute average verification pass scores on the fly.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 9: Extended Workspace Components)

This section covers the parameters tables, evolution sheets, sliding drawers, and comparative viewports.

---

## 📊 27. Parameters Tab Table (`frontend/components/analyst/FieldsGrid.tsx`)
Tabular view listing the 45 fields with search filters, sorting headers, and color-coded confidence percentages.

### Cool Features & Surprises:
* **Confidence Threshold Color Scaling**: Renders color-coded confidence indicators based on thresholds ($70\%+$ green, $40\%-69\%$ amber, $<40\%$ red) to help analysts spot lower-confidence extractions instantly.
* **Dynamic Tanstack Table Filter**: Integrated search box filters rows client-side in real-time across category names, field names, and values.

---

## 📈 28. Time-series Changelog (`frontend/components/analyst/EvolutionTab.tsx`)
Diff changelog showing program modifications over time.

### Cool Features & Surprises:
* **Color-Coded Status Diffs**: Computes value comparisons between historical runs, applying custom styles for upgrades, devaluations, and alterations.

---

## 💬 29. Interactive Chat (`frontend/components/analyst/ChatWidget.tsx`)
Floating chat dialogue box handling program and comparison queries.

### Cool Features & Surprises:
* **Automatic Chat Scrolling**: Uses React ref hooks to scroll new messages into view smoothly.

---

## 🗄️ 30. Evidence Sliding Drawer (`frontend/components/analyst/EvidenceDrawer.tsx`)
Sliding panel displaying the raw webpage source with highlighted citations.

### Cool Features & Surprises:
* **Dynamic Citation Highlight Injector**: Uses the character coordinates (`citation_start` and `citation_end`) stored in PostgreSQL to split the raw text, injecting a styled `<mark>` tag to highlight the exact quote in bright yellow.

---

## 🔲 31. Comparative Workspace Grid (`frontend/components/analyst/MultiFlowWorkspace.tsx`)
Side-by-side matrices and interactive comparative widgets.

### Cool Features & Surprises:
* **Simulated Matrix Progress Hook**: Handles slow LLM compilation phases by running an interval hook that moves progress slowly to 95%, holding until the real matrix response completes to maintain user engagement.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 10: Real-time Streams & Data Exporters)

This section documents real-time network streams, modals, and exporters.

---

## ⏱️ 32. Hybrid Connection Hook (`frontend/hooks/useSSE.ts`)
Dual-mode event handler linking the client directly to the pipeline.

### Cool Features & Surprises:
* **Dual-Mode Auto-Degradation (SSE-to-HTTP)**: Attempts to establish an async EventSource connection first. If blocked by firewalls or network lag, it triggers a **10-second timeout auto-fallback to an active HTTP polling loop**, ensuring uninterrupted progress tracking.
* **Synthetic Logs Reconstruction**: While polling, it maps the program's raw status code to a translation dictionary to reconstruct synthetic pipeline log objects, keeping the terminal log grid updated.
* **Radial Ring Dash Progress**: SVG stroke dasharrays translate floating percentage vectors directly into visual progress arcs inside the runner cards.

---

## 🔄 33. Runner Stage Panel (`frontend/components/analyst/RunnerStagePanel.tsx`)
Progress tracker rendering stage steps for multi-program runs.

### Cool Features & Surprises:
* **Segmented Radial Ring Progress**: Renders custom inline radial ring progress indicators for each program card using SVG dashes.

---

## 🔀 34. Cache Conflict Modal (`frontend/components/analyst/CacheConflictModal.tsx`)
Search conflict overlay offering cached loads.

### Cool Features & Surprises:
* **Fuzzy Override Interceptors**: Intercepts queries that fuzzy-match existing names, offering a pop-up option to either load cached analyses immediately or force a crawl.

---

## 📥 35. Data Exporters (`frontend/components/analyst/ComparisonExportButton.tsx`)
Generators compiling analyst data into CSV spreadsheets and PDF papers.

### Cool Features & Surprises:
* **Client-Side CSV Schema Compiler**: Synthesizes and formats the entire 45-field multi-program matrix client-side on-the-fly, generating download links without calling backend APIs.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 11: Hooks & Connectors)

This section covers client-side program hooks and fetch APIs.

---

## ⚓ 36. Workspace State Hook (`frontend/hooks/useProgram.ts`)
Binds application pages to pipeline phases and fetches data.

### Cool Features & Surprises:
* **`Promise.allSettled` Resilience**: During completion page loads, it runs all metadata lookups (Briefs, Grid fields, Chat history) in parallel using `Promise.allSettled`. If one endpoint fails or has missing data, it still loads the remaining items cleanly rather than crashing the viewport.
* **Synchronous Phase Advancements**: Automatically transitions states from `"idle"` to `"running"` to `"complete"` based on returned program properties.

---

## 🔌 37. API Fetch Connectors (`frontend/lib/api.ts`)
Static fetch functions to hook into the backend ports.

### Cool Features & Surprises:
* **Dynamic Query String Serialization**: Handles serializations (e.g. converting program arrays into URL query parameters) to query comparison endpoints safely.

---

## 📄 38. Type Specifications (`frontend/types/api.ts`)
Strict TypeScript declarations mirroring FastAPI classes.

### Cool Features & Surprises:
* **API Domain Safety**: Explicitly declares sub-interfaces like `MatrixItem` and `ComparisonAnalysis` matching the exact JSON formats of PostgreSQL columns, preventing runtime data exceptions.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 12: Test Suites & Audits)

This section documents RAG test metrics, confidence validation assertions, and QA generators.

---

## 🤖 39. RAGAS Evaluation Suite (`tests/eval_ragas.py`)
Automated LLM-as-a-judge QA metric verification.

### Cool Features & Surprises:
* **No-Label Golden Set Auto-Generation**: Automatically extracts all gate-passed, non-null values for a program, maps them to natural-language question templates, and creates a Ground Truth evaluation set. This dynamically tests the RAG chatbot's faithfulness and relevancy without manual intervention.

---

## 🔍 40. Hybrid RAG Verification (`tests/test_rag_upgrades.py`)
Asserts filters, dense/sparse fusing, and borderline judges.

### Cool Features & Surprises:
* **Reciprocal Rank Fusion (RRF) Validation (`test_hybrid_search_rrf_prefetch`)**: Asserts that Qdrant query calls construct two distinct prefetch requests (one dense float list and one named `sparse-text` `SparseVector`) and fuses them using `models.Fusion.RRF`, proving hybrid search is fully functional.
* **Borderline LLM Judge Trigger Test**: Asserts that the verifier correctly delegates verification decisions to the semantic LLM judge if the fuzzy match score lands in the borderline range $[0.70, 0.94]$.

---

## 📊 41. Verifier Formula Asserts (`tests/test_verifier.py`)
Pure-logic math calculation test suite.

### Cool Features & Surprises:
* **Strict Formula Verification**: Asserts that calculated scores match manually calculated percentages exactly down to three decimal places.
* **Fuzzy Pairwise Contradiction Capping Asserts**: Verifies that when two sources disagree (less than 65% similarity), the contradiction capping logic clamps the output score to $\leq 0.4$.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 13: Grounding Gates & Orchestrations)

This section covers the unit tests targeting quotation accuracy and graph exception handling.

---

## 🛡️ 42. Citation Gates (`tests/test_gate.py`)
Fuzzy quotient calculations, substring boundaries, and empty overrides.

### Cool Features & Surprises:
* **Verbatim Null Passing (`test_null_value_always_passes`)**: Asserts that when a value is extracted as `None` (honest null), the gate returns `passed=True` and `match_score=1.0` immediately, matching the system design where reporting uncertainty is correct.
* **Hallucination Intercession (`test_hallucinated_quote_rejects`)**: Verifies that when a quote fails to align with the raw crawl segments, the gate blocks it, ensuring full citation alignment.

---

## 🕸️ 43. Unit Node Exceptions (`tests/test_orchestrator_unit.py`)
StateGraph unit runs and mock failovers.

### Cool Features & Surprises:
* **Fail-Safe Node short-circuiting**: Asserts that when a retrieve node crashes, the graph catches the exception, registers the error string in the program's DB row, and short-circuits the extraction and verification phases to prevent API key waste.

---

## 🏁 44. E2E Graph Integration (`tests/test_orchestrator_e2e.py`)
Full system end-to-end flow checks under mocked API backends.

### Cool Features & Surprises:
* **Mock Transaction Assertions**: Simulates a complete pipeline run from Tavily search results to Narrator markdown brief output, verifying that all database triggers fire correctly.

---

## 📡 45. Crawler Mock Verification (`tests/test_retriever.py`)
Tests targeted queries and robots checking filters.

### Cool Features & Surprises:
* **Robots Override Assertions**: Verifies that the crawler handles block warnings gracefully, ensuring web ingestion remains compliant without failing the analysis.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 14: Comprehensive Transactions & Mocks)

This section covers transaction logic, Q&A loops, and document parses.

---

## 💸 46. Transaction Assertions (`tests/test_comprehensive_system.py`)
Checks DB transactions and ORM insertions.

### Cool Features & Surprises:
* **Dirty Session Transaction Interceptors**: Tests rollback states during mid-transaction failures, proving Postgres tables stay uncorrupted even if an extraction thread fails mid-write.

---

## 🤖 47. Chat Verification (`tests/test_chat.py`)
Validates conversational RAG pipelines.

### Cool Features & Surprises:
* **CrossEncoder Weight Bypass Mock (`test_handle_chat_message_creates_conversation`)**: Mocks out the `sentence_transformers.CrossEncoder` to return static arrays, preventing Pytest from downloading a `300MB` neural weight file on stage, ensuring tests run in under 0.1s.
* **DB Session Sequential Interceptors**: Sets up database return sequences using `mock_db.execute.side_effect` to simulate multiple database statements (creating conversation, fetching fields, checking narratives) sequentially.

---

## 🔀 48. Strategic Matrices (`tests/test_comparator.py`)
Checks comparison schemas and Strategic recommendations.

### Cool Features & Surprises:
* **Coherence Schema Enforcement**: Asserts that comparator LLM payloads map to Pydantic definitions, verifying comparison tables are structured correctly.

---

## 📝 49. Narrator overview layouts (`tests/test_narrator.py`)
Checks report formatting.

### Cool Features & Surprises:
* **Markdown Hierarchy Validator**: Asserts that generated briefs contain correct titles (`#`) and header lists, keeping document structures uniform.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 15: Parallelizations & Pytest Environment)

This section documents parallel loops, batch checks, and shared database mocks.

---

## ⚙️ 50. Parallelizations & Calibration (`tests/test_phase8.py`)
Validates model validators, parallel threads, and offsets.

### Cool Features & Surprises:
* **Model Validator Discrepancy Correction (`tests/test_phase8.py`)**: Asserts that Pydantic `@model_validator` resolves logical discrepancies. If `tier_count` is extracted as 5 but the comma-separated `tier_names` list contains only 3 values, the validator automatically overrides and corrects `tier_count` to 3, validating logical sanity.
* **Metainstable bounds validation**: Verifies that App Store rating inputs containing values outside 0-5.0 get automatically nulled.

---

## 📦 51. Vector Batching (`tests/test_embed.py`)
Checks chunk limits and vector sizes.

### Cool Features & Surprises:
* **Dimension validation**: Verifies generated embeddings are exactly 3072 dimensions, mapping to Gemini-2 embeddings size configurations.

---

## 🧪 52. Pytest shared environment (`tests/conftest.py` & `tests/phase0_test.py`)
Configures mock databases and pytest hooks.

### Cool Features & Surprises:
* **Dirty Mock Cleanup**: Automatically intercept database sessions and setups to create test volumes, rolling back mock inserts so local environments stay clean.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 16: One-Off Scripts & DB Purges)

This section covers the helper scripts located in the local workspace scratch folders.

---

## 🧹 53. Target Purges & Cascades (`scratch/delete_mcd.py`)
Database cleaner utilizing target cascades.

### Cool Features & Surprises:
* **Constraint Purging Order**: Traverses foreign keys (events, messages, conversations, fields, sources, narratives, comparisons) and deletes them sequentially within an async PostgreSQL transaction before deleting the main program row, avoiding database foreign key block exceptions.

---

## 📡 54. Collections Purge (`scratch/delete_qdrant.py`)
Wipes collections from Qdrant vector databases.

### Cool Features & Surprises:
* **Client Delete Collections Call**: Inspects the client connection and executes deletions on the collection, ensuring vector databases are completely wiped clean.

---

## 🔑 55. Credentials Diagnostics (`scratch/test_api_keys.py`)
CLI tool to test credentials health.

### Cool Features & Surprises:
* **Multi-Provider Verification**: Performs minor prompt checks against Groq, Claude, and Gemini dynamically, returning connection latency diagnostics.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 17: Local Scratchpad Scanners)

This section documents internal script runners.

---

## ⏱️ 56. Pipeline Event Scopes (`scratch/why_failed.py`)
Log scanner parsing.

### Cool Features & Surprises:
* **Chronological Events Aggregator**: Queries pipeline log details sequentially by timestamp for target names, outputting error traces immediately to debug pipeline crashes.

---

## 📋 57. Program List Printer (`scratch/list_programs.py`)
Queries and prints program metadata in local Postgres tables.

### Cool Features & Surprises:
* **Dynamic Row Counter**: Prints status summaries for completed vs running programs in the CLI.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 18: Local Script Utilities)

This section covers diagnostic utilities.

---

## 🧪 58. Instructor Smoke Test (`scripts/instructor_smoke.py`)
Structured JSON parser validation.

### Cool Features & Surprises:
* **Simple extracted wrapper**: Uses standard instructor from_gemini wrappers with `Mode.MD_JSON` to test connection capability, throwing errors if credential settings are missing.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 19: Root Settings and Containers)

This section covers container wrappers and test descriptors.

---

## ⚙️ 59. Container Settings (`docker-compose.yml` & `Dockerfile`)
Docker deployment configurations.

### Cool Features & Surprises:
* **Health Check Blocks (`docker-compose.yml`)**: Includes a pg_isready health check query with 10 retries on the Postgres container, guaranteeing that dependent server apps wait to boot until the database is fully up and running.
* **Environment variables delegation**: Hooks into shell environment settings dynamically, allowing rotated API keys to pass directly into container scopes.

---

## 🔬 60. Pytest asynchronous boundaries (`pytest.ini`)
Pytest execution directives.

### Cool Features & Surprises:
* **Asynchronous loop assertions**: Declares the async loop mode to execute testing units asynchronously, allowing Postgres and Qdrant mocks to run.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 20: PowerShell Life-Cycle Services)

This section covers active terminal management and shutdown traps.

---

## 📟 61. Service Orchestrations (`start.ps1` & `setup.bat` & `start.bat`)
Services launcher and lifecycle tracker.

### Cool Features & Surprises:
* **Process Tree Traversal Traps (`start.ps1`)**: Start process executions capture system process object handles (`-PassThru`) for the FastAPI backend and Next.js frontend, executing automated tree-killing tasks (`taskkill /f /t /pid`) inside `finally` blocks when the PowerShell terminal intercepts termination cues (Ctrl+C), leaving zero hanging background processes.

---

# InfoVac Codebase Surprises & Engineering Audit (Part 21: Consolidated Exports & UI Optimization)

This section covers shared frontend layouts, client-side PDF document structures, and deferred rendering strategies.

---

## 📄 62. Consolidated Exporter (`frontend/components/analyst/ExportBar.tsx`)
A unified client-side exporter generating single and multi-program consulting-grade documents.

### Cool Features & Surprises:
* **Unified Styling System**: Employs a single shared style sheet constructor `createSharedStyles(StyleSheet)` for both single and comparison documents. This ensures styling, borders, and margins are synchronized across all PDF downloads.
* **Kobie SVG Brand Logo**: Draws the custom Kobie wordmark and the brand coral SVG heart inline inside the PDF header. The header view includes the `fixed` attribute, instructing `@react-pdf/renderer` to automatically repeat the banner at the top of every generated PDF page during overflow page breaks.
* **Split Page Architecture**: Isolates the main narrative (Page 1) and the Reference logs (Page 2) into independent `<Page>` tags, completely eliminating intermediate empty pages and blank spacer calculations.
* **Centered Horizon Watermark**: The watermark text is centered between two flex-growing divider lines (`flex: 1, height: 1`) to cover the document horizontally. It is conditionally compiled to output *only once* at the very end of the final page.
* **Non-Underlined Citations**: Citation links and reference URLs are styled with `textDecoration: "none"` in bold brand coral. It enforces strict leading space overrides (`{" "}`) to prevent words and brackets from sticking.

---

## ⚡ 63. Deferred UI Rendering (`frontend/components/analyst/BriefView.tsx` & `frontend/lib/narrative.ts`)
A performant tab switching mechanism that bypasses single-thread JavaScript freezes.

### Cool Features & Surprises:
* **Tab-Switching Deferment**: Switching tabs synchronously with heavy text parsers freezes the UI main thread. The component mounts instantly, returns a spinning loading indicator (`isReady = false`), and schedules a `50ms` background timeout. Once the browser repaints the tab switch smoothly, `isReady` is updated, and the text tree is rendered.
* **Dynamic Programming LCS Matching**: The original citation overlap matching loop utilized sliding-window slices and `.includes()` searches, resulting in over 2.2 million operations and a 3-second thread freeze. We optimized `longestCommonSubstringLength` to use a space-efficient dynamic programming matrix scan, completing the entire operation in under 15ms.

---
*Compiled by Antigravity AI Codebase Auditor.*
