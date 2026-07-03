# Part 2: Complete & Authoritative Feature Documentation

This document compiles the authoritative feature list of the InfoVac platform. It serves as a detailed technical reference mapping each capability to its design rationale, implementation mechanics, and source files.

---

## 🔑 1. API Reliability, Key Management & Routing

Designed to support uninterrupted high-throughput processing by mitigating API failures, rate-limiting, and quota restrictions.

### 🔄 Thread-Safe API Key Broker
* **File Reference**: [key_broker.py](file:///d:/Coding/KOBIE_hackathon/backend/key_broker.py)
* **Mechanics**: Implements a thread-safe load balancer using `threading.Lock` to coordinate parallel checkouts without race conditions.
* **LRU Scheduling**: Dynamically tracks the `last_used` timestamp of each key and issues the oldest eligible key to balance API loads.
* **Thread-Local Isolation**: Uses `threading.local()` to register active key usage per thread. If a thread encounters a failure, it isolates and reports that specific key, leaving other threads unaffected.
* **Tiered Cooldown Lockouts**: Automatically locks failed keys for **30 seconds** on transient errors and **1 hour** on rate-limits/exhausted daily quotas (`429` errors).
* **Backpressure Control**: If all keys are in cooldown, the checkout loop uses `time.sleep(0.1)` to block the caller, preventing thread crashes.

### 🔀 Fallback Router Client
* **File Reference**: [llm_client.py](file:///d:/Coding/KOBIE_hackathon/backend/llm_client.py)
* **Mechanics**: Implements the `FallbackClient` wrapper (exposing a standard OpenAI-like `.chat.completions.create` signature).
* **Dynamic Lambda Injection**: Stores connections as `lambda: client_factory()`, checking out active keys from the key broker only when the completion is executed.
* **Pool-Wide Expiry Loops**: Wraps completions in retry loops spanning all configured keys. If a key fails with a quota limit, it is sidelined, and the router checks out the next key instantly.
* **Cross-Provider Failover**: Automatically transitions requests across provider backends if the primary model fails (Gemini ➔ Ollama ➔ Groq ➔ Anthropic ➔ OpenAI).
* **High-Fidelity Error Bubbling**: Catches global key exhaustion states and bubbles mapped JSON errors directly to the Next.js frontend to show alert banners.

---

## 🌐 2. Web Crawling, Ingestion & Classification

Handles the crawling, sanitization, and organization of unstructured web pages.

### 🕷️ Multi-Query Web Scraper Grid
* **File Reference**: [retriever.py](file:///d:/Coding/KOBIE_hackathon/backend/retriever.py)
* **Targeted Ingestion**: Spawns **11 targeted queries** mapped to specific loyalty program aspects (e.g., FAQs, partner lists, T&C documents) instead of running a single generic search query.
* **Robots.txt Parser Integration**: Checks target websites' `robots.txt` before crawling. If a check times out, it marks the source as `robots_unverified` and continues, avoiding blocks or script failures.
* **Mojibake Ingestion Cleanup**: Automatically resolves double-decoding artifacts (e.g., converting `â€™` back to `’` and `Ã©` to `é`), improving verbatim quotation checks.

### 🏷️ Zero-Token Source Classifier
* **File Reference**: [classifier.py](file:///d:/Coding/KOBIE_hackathon/backend/classifier.py)
* **Deterministic Classification**: Categorizes crawled URLs into types (e.g., `tnc`, `faq`, `press`, `forum`) without incurring LLM token costs.
* **4-Stage Regex Priority Chain**:
  1. *Trusted Domains*: Identifies specific sites (e.g., app stores, forums).
  2. *URL Paths*: Searches for keywords (e.g., `/terms`, `/legal`, `.pdf`).
  3. *Title Keywords*: Scans search engine headers.
  4. *Snippet Fallbacks*: Parses text snippets for legal keywords (e.g., *"shall not"*, *"pursuant to"*).

---

## ⚙️ 3. Structured Extraction & Retry Loop

Extracts loyalty attributes and refines them via retry mechanisms.

### 📊 Structured Schema Extractor
* **File Reference**: [extractor.py](file:///d:/Coding/KOBIE_hackathon/backend/extractor.py)
* **HTML Table Reconstruction**: Runs a regex table parser to convert `<table>` structures into clean, pipe-delimited text (` | `), preserving tier layouts for LLM context processing.
* **Authority-Weighted Source Budgeting**: Assigns weight factors to source categories (e.g., `tnc: 1.8`, `press: 1.5`, `forum: 0.7`) to apportion a `200,000` character cap, giving legal documents more context space.
* **Strict Uncertainty Guarding**: Prompts LLMs to return `null` if any parameter is ambiguous, preventing hallucinations.
* **Staggered Thread Starts**: Delays parallel threads using `0.6s * index` to prevent rate-limit spikes.

### 🕸️ LangGraph Pipeline & Retry Nodes
* **File References**: [graph.py](file:///d:/Coding/KOBIE_hackathon/orchestrator/graph.py), [nodes.py](file:///d:/Coding/KOBIE_hackathon/orchestrator/nodes.py), [state.py](file:///d:/Coding/KOBIE_hackathon/orchestrator/state.py)
* **LangSmith Integration**: Wraps graph execution in a LangChain `collect_runs()` context, automatically sharing the trace via `client.share_run(run_id)` and registering the link in PostgreSQL.
* **Two-Phase Extraction Retry**: If fields fail the Verification Gate, the pipeline identifies the failing fields and launches a second extraction pass (`retry_failed_fields`) targeting only those specific values.
* **Character Offset Indexing**: Computes and indexes the start and end coordinates of verified source quotes to enable highlighting in the frontend.
* **Shared State Validation**: Restricts state storage to a serializable `PipelineState` TypedDict to avoid memory corruption across tasks.

---

## 🛡️ 4. Verification Gate & Confidence Engine

Ensures that every generated fact is anchored to a source document.

### 🔬 Verification Gate
* **File Reference**: [gate.py](file:///d:/Coding/KOBIE_hackathon/backend/gate.py)
* **Composite Quote Splitting**: Handles composite quotes (e.g., divided by ellipses `...` or brackets `[]`) by splitting and validating each segment independently.
* **Weakest-Link Match Principle**: Applies the minimum score among all segments as the final match score, blocking partial hallucinations.
* **Attribution Recovery**: Scans all crawled documents if the LLM attributes a fact to the wrong source, re-assigning it to the correct URL and source ID.
* **Majority-Vote Attribution**: Selects the source page containing the highest count of verified segments for composite quotes.

### 📊 Confidence & Contradiction Resolution
* **File Reference**: [verifier.py](file:///d:/Coding/KOBIE_hackathon/backend/verifier.py)
* **Credibility Formula**: Computes a deterministic score:
  $$\text{Confidence} = 0.5 \times \text{Corroboration} + 0.3 \times \text{Authority} + 0.2 \times \text{Recency}$$
* **Recency Sigmoid Decay**: Applies a decay curve to the source timestamp. Fresh sources (<30 days) receive a `1.0` multiplier; old sources decay down to a `0.3` floor.
* **Contradiction Capping**: Performs pairwise similarity checks across all gate-verified values for a single parameter. If disagreement is detected (similarity <65%), it flags a contradiction and caps the confidence score at `0.4` to signal a manual review.

---

## 💾 5. Database, Vector Store & Sessions

Manages physical and semantic persistence layers.

### 🗄️ Database Schemas & Session Management
* **File References**: [models.py](file:///d:/Coding/KOBIE_hackathon/backend/models.py), [db.py](file:///d:/Coding/KOBIE_hackathon/backend/db.py), [extraction_schemas.py](file:///d:/Coding/KOBIE_hackathon/backend/extraction_schemas.py)
* **Three-Way Boolean State**: Uses `EvidenceState` (`TRUE`, `FALSE`, `NOT_MENTIONED`) to avoid binary assumptions.
* **JSONB Diff Storage**: Stores comparative analyses directly in PostgreSQL `JSONB` columns for quick retrieval.
* **Cascading Purges**: Uses `ondelete="CASCADE"` constraints to clean up dependent tables when removing programs.
* **Thread-Safe DB Session Factory**: Spawns background database sessions using a NullPool engine to avoid connection leaks in background threads.

### 🧠 Vector Database Config & Embeddings
* **File References**: [embeddings.py](file:///d:/Coding/KOBIE_hackathon/backend/embeddings.py), [qdrant_client.py](file:///d:/Coding/KOBIE_hackathon/backend/qdrant_client.py)
* **Key Rotation for Embeddings**: Incorporates the Key Broker to rotate API keys when generating vectors.
* **Zero-Crash Embeddings Fallback**: Returns zero-filled dummy vectors (3072 dimensions) if all API keys fail, preventing pipeline crashes.
* **Auto-Reconciliation Scheme**: Inspects collection schemas on launch. If configuration dimensions differ, it drops and recreates the Qdrant collection automatically.

---

## 🖥️ 6. Next.js Analyst Workspace & UI/UX

Delivers an interactive, high-density dashboard built for analysts.

### ⚡ Performance & UX Optimizations
* **File References**: [BriefView.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/BriefView.tsx), [narrative.ts](file:///d:/Coding/KOBIE_hackathon/frontend/lib/narrative.ts)
* **Tab-Switching Deferment**: Prevents UI freeze by rendering instantly with a spinner, scheduling a `50ms` background timeout to defer heavy Markdown parsing until after the browser paint.
* **LCS Optimization**: Replaced naive sliding-window text searches with a **Dynamic Programming Longest Common Substring (LCS)** algorithm, reducing comparison latency from 3 seconds to under 15ms.
* **Fuzzy Cache Lookup**: Runs case-insensitive database queries on program inputs to load completed records instantly (~10ms), bypassing the LangGraph pipeline unless forced.

### 📊 Comparative Workspace & Data Exporters
* **File References**: [ExportBar.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/ExportBar.tsx), [MultiFlowWorkspace.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/MultiFlowWorkspace.tsx)
* **Simulated Matrix Progress Hook**: Uses a simulated interval progress loop to maintain user engagement during matrix generation before the backend returns the payload.
* **Consolidated PDF Exporter**: Spawns clean multi-page document PDFs with:
  * *Unified Styling*: A shared stylesheet constructor to align elements.
  * *Repeat Headers*: Renders the Kobie brand logo with the `fixed` attribute to ensure it repeats on page breaks.
  * *Split Page Architecture*: Isolates narratives and reference logs onto independent pages to eliminate empty pages.
  * *End-Only Watermark*: Renders the centered horizontal rules watermark only once at the end of the final page.
  * *Formatted Citation Links*: Removes underlines and adds padding around superscript link bounds.

### 💬 Workspace Widgets & Streams
* **File References**: [useSSE.ts](file:///d:/Coding/KOBIE_hackathon/frontend/hooks/useSSE.ts), [EvidenceDrawer.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/EvidenceDrawer.tsx)
* **PostgreSQL Notification Bridge (SSE)**: Streams pipeline updates in real-time by linking database triggers to FastAPI SSE channels.
* **Dual-Mode SSE Fallback**: Automatically degrades to a **10-second HTTP polling loop** if the SSE connection is blocked, reconstructing synthetic log streams locally.
* **Evidence Highlight Injector**: Uses database character offset coordinates to split text and inject a styled `<mark>` tag, highlighting quotes in the sliding drawer.
