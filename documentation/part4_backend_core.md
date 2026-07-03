# Part 4: Backend Core Logic File-by-File Technical Audit

This document catalog-audits the core backend components located in the root of the [backend/](file:///d:/Coding/KOBIE_hackathon/backend/) directory. It details the internal structures, state rules, algorithms, and failover boundaries for every module.

---

## 🔑 1. API Credentials & Key Management

### 🔄 API Key Broker (`key_broker.py`)
* **File Reference**: [key_broker.py](file:///d:/Coding/KOBIE_hackathon/backend/key_broker.py)
* **Mechanics**: Implements a lock-guarded key manager (`APIKeyBroker`) to balance API usage across multiple keys.
* **Core Logic**:
  * Thread checkout using `threading.Lock()` to prevent race conditions during concurrent crawls.
  * Thread-Local tracking with `threading.local()` to store the last checked-out key (`self.local_data.last_key`), isolating failures per thread.
  * **Cooldowns**: Standard drops trigger a **30-second** cooldown. Daily quota errors (`429`) sideline the key for **1 hour**.
  * **Backpressure**: Blocks callers via `time.sleep(0.1)` if all keys are temporarily sidelined.

### 🔀 Fallback Router Client (`llm_client.py`)
* **File Reference**: [llm_client.py](file:///d:/Coding/KOBIE_hackathon/backend/llm_client.py)
* **Mechanics**: Wraps LLM SDKs inside custom wrappers (`FallbackClient`, `FallbackChat`, `FallbackCompletions`) to mimic the OpenAI interface.
* **Core Logic**:
  * Dynamically checks out API keys via lambda injection (`lambda: client_factory()`) at completion time rather than instantiation.
  * Runs checkouts in a loop matching the total key count. If a request throws a quota error, it marks the key dead and retries with the next key.
  * Automatically switches provider backends if the primary model fails (Gemini ➔ Ollama ➔ Groq ➔ Anthropic ➔ OpenAI).
  * Propagates detail maps on total key exhaustion to let the frontend show error banners.

---

## 🌐 2. Web Crawling, Ingestion & Vectorization

### 🕸️ Web Scraper Crawler (`retriever.py`)
* **File Reference**: [retriever.py](file:///d:/Coding/KOBIE_hackathon/backend/retriever.py)
* **Core Logic**:
  * Fires **11 distinct Tavily searches** mapped to specific loyalty program aspects (FAQs, terms, etc.) to compile a diverse context.
  * Performs active robots.txt dynamic validation. If a check times out, it flags the source as `robots_unverified` and continues.
  * **Mojibake Repair**: Scans crawled text blocks using `.replace()` rules to correct common double-decoding errors (e.g., `â€™` ➔ `’`, `Ã©` ➔ `é`), improving verbatim citation verification.

### 🏷️ Source Classifier (`classifier.py`)
* **File Reference**: [classifier.py](file:///d:/Coding/KOBIE_hackathon/backend/classifier.py)
* **Core Logic**:
  * Runs in sub-microseconds without LLM tokens by using a **4-stage Regex Priority Chain**:
    1. *Trusted Domains*: Checks for patterns like `apps.apple.com` (App Reviews) or `reddit.com` (Forums).
    2. *URL Paths*: Searches for keywords (e.g., `/terms`, `/legal`, `.pdf`).
    3. *Title Keywords*: Case-insensitive search on page headers.
    4. *Snippet Fallbacks*: Parses text snippets for legal keywords (e.g., *"pursuant to"*, *"herein"*).

### 🧠 Text Embeddings (`embeddings.py`)
* **File Reference**: [embeddings.py](file:///d:/Coding/KOBIE_hackathon/backend/embeddings.py)
* **Core Logic**:
  * Chunking utility splits source texts into semantic nodes for vector searches.
  * Key rotation integration uses `APIKeyBroker` to fetch Google embedding keys.
  * **Zero-Crash Fallback**: Returns a zero-filled dummy vector (3072 dimensions) if all Google keys fail, preventing pipeline crashes.

### 📡 Qdrant Vector Client (`qdrant_client.py`)
* **File Reference**: [qdrant_client.py](file:///d:/Coding/KOBIE_hackathon/backend/qdrant_client.py)
* **Core Logic**:
  * Initializes connection pools.
  * **Auto-Reconciliation**: Compares dense dimension and sparse index settings on startup. If configuration dimensions differ, it drops and recreates the Qdrant collection automatically.
  * Creates keyword payload indices on the `program_id` field to enable multi-tenant filtering.

---

## ⚙️ 3. Structured Extraction & Citation Verification

### 📋 Extraction Schemas (`extraction_schemas.py`)
* **File Reference**: [extraction_schemas.py](file:///d:/Coding/KOBIE_hackathon/backend/extraction_schemas.py)
* **Core Logic**:
  * Defines the 9 loyalty program categories in Pydantic.
  * **EvidenceState**: Uses a three-way enum (`TRUE`, `FALSE`, `NOT_MENTIONED`) to avoid binary assumptions.
  * **Coherence Validators**: Runs `@model_validator(mode="after")` to clean values. If App Store ratings fall outside `[0.0, 5.0]`, it nullifies them. If a program claims 5 tiers but only lists 3 names, it corrects the tier count to 3.

### 📊 Structured Schema Extractor (`extractor.py`)
* **File Reference**: [extractor.py](file:///d:/Coding/KOBIE_hackathon/backend/extractor.py)
* **Core Logic**:
  * Runs the 9 category extractions in parallel threads.
  * Reconstructs HTML `<table>` elements into clean pipe-delimited text (` | `) to preserve structured tables.
  * **Context Budgeting**: Multiplies character weightings by source type (e.g., `tnc: 1.8`, `forum: 0.7`) within a `200,000` limit, giving legal documents more context space.
  * Employs staggered thread delays (`0.6s * index`) to prevent concurrency rate-limit spikes.

### 🔬 Verification Gate (`gate.py`)
* **File Reference**: [gate.py](file:///d:/Coding/KOBIE_hackathon/backend/gate.py)
* **Core Logic**:
  * **Composite Quote Splitting**: Handles quotes divided by ellipses (`...` or `[]`) by splitting and validating each segment independently.
  * **Weakest-Link Match Principle**: Applies the minimum score among all segments as the final match score, blocking partial hallucinations.
  * **Attribution Recovery**: Scans all crawled documents if the LLM attributes a fact to the wrong source, re-assigning it to the correct URL and source ID.
  * **Majority-Vote Attribution**: Selects the source page containing the highest count of verified segments for composite quotes.

### 📊 Confidence & Contradiction Resolution (`verifier.py`)
* **File Reference**: [verifier.py](file:///d:/Coding/KOBIE_hackathon/backend/verifier.py)
* **Core Logic**:
  * Computes a deterministic credibility score:
    $$\text{Confidence} = 0.5 \times \text{Corroboration} + 0.3 \times \text{Authority} + 0.2 \times \text{Recency}$$
  * **Recency Sigmoid Decay**: Applies a decay curve to the source timestamp. Fresh sources (<30 days) receive a `1.0` multiplier; old sources decay down to a `0.3` floor.
  * **Contradiction Capping**: Performs pairwise similarity checks across all gate-verified values for a single parameter. If disagreement is detected (similarity <65%), it flags a contradiction and caps the confidence score at `0.4` to signal a manual review.

---

## 📝 4. Synthesis, Chat RAG & API Orchestrations

### 📝 Analyst Brief Narrator (`narrator.py`)
* **File Reference**: [narrator.py](file:///d:/Coding/KOBIE_hackathon/backend/narrator.py)
* **Core Logic**:
  * Generates Markdown briefs by processing loyalty categories sequentially, keeping prompt context windows small.
  * Prompts forbid the model from adding styling markers or placeholder items.
  * **Source-Dependent Word Limits**: Enforces dynamic length constraints:
    * *<7 scraped sources*: Minimum brief length is 200 words (prevents hallucinated filler).
    * *7+ scraped sources*: Minimum brief length is 500 words.
    * *Global limit*: Capped at 1,000 words.

### 🔲 Comparative Matrix Engine (`comparator.py`)
* **File Reference**: [comparator.py](file:///d:/Coding/KOBIE_hackathon/backend/comparator.py)
* **Core Logic**:
  * Queries database records where `gate_passed=True` and `is_null=False` to fetch only verified facts, preventing hallucinations.
  * Formats comparison matrices with superscript citation numbers.

### 💬 RAG Chatbot Engine (`chat.py`)
* **File Reference**: [chat.py](file:///d:/Coding/KOBIE_hackathon/backend/chat.py)
* **Core Logic**:
  * Instantiates a global `sentence_transformers.CrossEncoder("BAAI/bge-reranker-base")` to rerank search results.
  * **Hybrid search**: Generates dense vectors using Google and sparse vectors by fitting an `sklearn` `TfidfVectorizer` on program chunks. Queries Qdrant using Reciprocal Rank Fusion (RRF), falling back to dense-only if needed.
  * Wipes chat sessions on program switches and validates inputs against an unknown response list.

### 🧵 DB Sessions & ORM Models (`db.py`, `models.py`)
* **File References**: [db.py](file:///d:/Coding/KOBIE_hackathon/backend/db.py), [models.py](file:///d:/Coding/KOBIE_hackathon/backend/models.py)
* **Core Logic**:
  * Defines DB models (`Program`, `Source`, `ExtractedField`, `Narrative`, `Comparison`, etc.).
  * Uses `make_background_session()` with a NullPool engine to manage DB connections on background threads, preventing connection leaks.
  * Stores comparative analyses in PostgreSQL `JSONB` columns and configures `ondelete="CASCADE"` to purge dependent tables.

### 🛣️ API Gateway & Real-Time Streams (`main.py`)
* **File Reference**: [main.py](file:///d:/Coding/KOBIE_hackathon/backend/main.py)
* **Core Logic**:
  * Initializes the FastAPI application, CORS middleware, and route handlers.
  * **PostgreSQL Notification Bridge**: Connects pg_notify channels to SSE event generators, streaming database events directly to the frontend.
  * Aggregates telemetry stats (average confidence, gate validation rates) from database records.
