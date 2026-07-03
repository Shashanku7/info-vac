# InfoVac: Hackathon Demo Script, Presentation Deck & Limitations Audit

This document contains the presentation deliverables, demo scripts, and future scope audits for the InfoVac submission.

---

## 📋 Table of Contents
1. **3-Minute Video Demo Script** (Visual actions + Speaker voiceover script)
2. **10-Slide Pitch Presentation Outline (PPT)** (Slide text + Speaker notes)
3. **Engineering Limitations & Future Scope Audit**

---

## 🎞️ 1. 3-Minute Video Demo Script

This script is timed for a **3-minute screen-recorded demo video** showing the working system.

| Time | Visual Action on Screen | Speaker Script |
| :--- | :--- | :--- |
| **0:00 - 0:30** | Show the Next.js Analyst Dashboard in dark mode. Type `Starbucks Rewards` and `https://www.starbucks.com/rewards` into the program input bar. Click the **"Run Audit"** button. | *"Hi everyone, this is InfoVac—an autonomous competitive intelligence agent designed to research, verify, and compare enterprise loyalty programs from the live web. Today, understanding a competitor's program takes hours of reading terms and conditions. InfoVac automates this. I've entered Starbucks Rewards, let's start the run."* |
| **0:30 - 1:00** | The input bar locks, and the **SSE Progress Tracker** circle spins. We see live status updates: `Ingesting web sources...`, `Classifying legal pages...`, `Extracting 43-field schema...`. | *"The backend FastAPI gateway accepts the request, dispatches it to a LangGraph multi-agent orchestrator, and streams real-time status events using PostgreSQL triggers. InfoVac doesn't just scrape the homepage—it runs 11 targeted queries to discover terms, FAQs, and app reviews. It filters out pages blocked by robots.txt and classifies legal documents automatically."* |
| **1:00 - 1:40** | The pipeline completes. A structured Markdown brief appears on screen. The presenter scrolls through the categorized tabs: *Earn Mechanics, Tiers, Sentiment*. The presenter hovers over a coral superscript citation badge `[1]` and clicks it. The **Evidence sliding drawer** opens from the right, highlighting a quote in yellow. | *"Once the run completes, InfoVac generates this structured brief. Every single factual claim has a citation badge. If we click this badge, a sliding Evidence Drawer opens. InfoVac uses a dynamic programming algorithm to match the LLM's claim with the exact character coordinates of the source text. This prevents hallucinations by proving every statement is grounded in real text."* |
| **1:40 - 2:20** | The presenter drags the **RAG Chat Widget** to the center, types: *"What's the qualification period for Gold tier?"*, and clicks send. The response returns in under a second with citations. | *"Analysts can ask follow-up questions using our draggable chat widget. The backend uses Qdrant hybrid search—fusing dense embeddings with sparse local TF-IDF vectors using Reciprocal Rank Fusion—reranking hits to answer questions with verifiable URLs. If the verifier flags contradictions, it clamps confidence scores."* |
| **2:20 - 2:45** | The presenter opens the **Multi-Program Picker**, selects `Starbucks Rewards` and `Marriott Bonvoy`, and clicks compare. A strategic advantage matrix appears on screen. Click "Export PDF". | *"We also support multi-brand comparisons. InfoVac builds comparative advantage grids and strategic gaps analyses. With one click, we can compile a polished PDF report, formatted with SVG headers repeating across page breaks, ready to go into a strategic client deck."* |
| **2:45 - 3:00** | Show slide of the 5-layer architecture. Conclude the video. | *"InfoVac represents a complete, robust, and optimized system designed for real-world competitive intelligence. Thank you!"* |

---

## 📊 2. 10-Slide Pitch Presentation Outline (PPT)

This slide deck content is designed to align with the Kobie brand aesthetic (Midnight, Ocean, Coral, and Lavender) and address the asymmetric evaluation rubric.

### 🛝 Slide 1: Title Slide
* **Visual**: Glowing neon orange logo `InfoVac` on a midnight carbon background.
* **Slide Text**: 
  * InfoVac: Autonomous Competitive Intelligence for Enterprise Loyalty Design
  * Built for Kobie Strategic Consultants
* **Speaker Notes**: *"Good morning. Today, we are presenting InfoVac—an autonomous research agent that crawls, extracts, verifies, and compares loyalty programs from the live web. It accelerates how Kobie advises clients on loyalty structures."*

### 🛝 Slide 2: The Challenge
* **Visual**: Split slide. Left: Hourglass graphic (representing hours of manual Terms & Conditions auditing). Right: Warning sign (representing hallucinated data from generic chatbots).
* **Slide Text**:
  * Manual competitor audits take hours of strategic analyst time.
  * Generic LLM wrappers fabricate rules and lack verifiable grounding.
  * Layout structure loss: Simple crawlers strip HTML tables, losing key tier metrics.
* **Speaker Notes**: *"Analyzing a competitor’s program requires reading hundred-page legal terms. General AI chatbots hallucinate because they lack strict grounding. InfoVac solves this by combining web crawler grids, fuzzy citation verifiers, and structured database models."*

### 🛝 Slide 3: The System Architecture
* **Visual**: System Architecture Diagram (`system_architecture_diagram.png` in dark glassmorphism).
* **Slide Text**:
  * 5-Layer Stack: Frontend ➔ Backend ➔ Databases ➔ AI Services ➔ External APIs.
  * Core Components: LangGraph Orchestrator, PostgreSQL pg_notify streams, Qdrant Hybrid Search, Instructor Pydantic parser.
* **Speaker Notes**: *"We built a 5-layer system. A Next.js frontend connects to a FastAPI backend. FastAPI manages a 5-node LangGraph agent state machine. All data is persisted in Postgres and indexed in Qdrant, using Tavily and Firecrawl for web ingestion."*

### 🛝 Slide 4: Strategic Feature Set
* **Visual**: Bento-grid layout highlighting: Scraper Grid, Analyst Brief, Chat widget, PDF Exporter.
* **Slide Text**:
  * Multi-Query Scraper: Crawls 11 distinct areas (FAQs, reviews, terms).
  * Evidence Highlight: Character coordinate index mapping for exact UI source overlays.
  * Draggable Chat: Dual-vector hybrid search RAG with Cross-Encoder rerankers.
* **Speaker Notes**: *"Key capabilities include a 11-query search grid, dynamic programming LCS algorithms to map source text offsets to characters in PostgreSQL, draggable chat overlays, and multi-page vector-based PDF exporters."*

### 🛝 Slide 5: Asymmetric Risk Mitigation (The Verifier Gate)
* **Visual**: Visual flow showing: LLM Claim ➔ RapidFuzz Check ➔ Borderline Judge (LLM) ➔ Pass/Fail.
* **Slide Text**:
  * Asymmetric Scoring: Hallucinations cost -3x the penalty of honest unknown nulls.
  * Verbatim Verification: Fuzzy-matches evidence quotes using segment-based ratios.
  * Borderline Judge: Triggers semantic LLM checks when matching scores land in $[0.70, 0.94]$.
  * Contradiction Capping: Clamps confidence to $\leq 0.4$ on source conflicts.
* **Speaker Notes**: *"To win the hackathon, precision beats recall. Hallucinations are penalized at -3 points, while honest nulls earn +0.5 points. We built a Verification Gate that fuzzy-matches quotes. If verification fails, it triggers a second extraction retry or nullifies the parameter, securing the +0.5 point reward instead of risking a -3.0 penalty."*

### 🛝 Slide 6: Database & Migration Schema
* **Visual**: Database ER Diagram (`database_er_diagram.png`).
* **Slide Text**:
  * Relational Schema: 8 linked tables in PostgreSQL with cascade deletes.
  * Append-Only parameters: Enables historical diffs tracking for Program Evolution checking.
  * Alembic Migration Lifecycle: 7 database schema versions, managed using Sync NullPool connections.
* **Speaker Notes**: *"Our database schema uses 8 structured tables. Since revision 0005, we drop unique constraints to make field extractions append-only, preserving historical program runs. We manage schema updates via Alembic, utilizing database triggers to stream SSE updates."*

### 🛝 Slide 7: AI Agent State Machine
* **Visual**: AI Agent Workflow Diagram (`agent_workflow_diagram.png`).
* **Slide Text**:
  * LangGraph StateGraph: Linear pipeline nodes with catch-all retry loops.
  * Short-Circuiting: Ingestion exceptions trigger status updates and halt runs, saving API costs.
  * Multi-Source gate: Re-attributes quotes to their correct source page on LLM reference errors.
* **Speaker Notes**: *"Our AI services layer uses a LangGraph state machine. Ingestion failures short-circuit the execution to avoid wasting API token costs. If the extractor quotes the right text but cites the wrong URL, the gate automatically crawls all documents to re-attribute the correct source URL."*

### 🛝 Slide 8: Optimization & Deployment Rigor
* **Visual**: Docker logo beside a 2-stage build flow.
* **Slide Text**:
  * Concurrency: Thread-local DSN checkouts and locking prevent connection leakage.
  * CPU-only PyTorch optimization: Shaves **800MB** off Docker backend image size.
  * Dynamic Programming LCS: Optimizes frontend citation matches from 3s to 15ms.
* **Speaker Notes**: *"For performance, we optimized the Docker container by using CPU-only PyTorch wheels, reducing image weight by 800MB. On the frontend, a TypeScript dynamic programming LCS algorithm prevents browser thread lock, executing in under 15ms."*

### 🛝 Slide 9: Project Evaluation & QA Validation
* **Visual**: Faithfulness/Relevancy scores bar chart.
* **Slide Text**:
  * Automated testing: Over 15 pytest suites covering models, Key Brokers, and fuzzy gates.
  * No-Label Golden dataset: Auto-compiled from gate-passed database entries.
  * RAGAS QA evaluation: Faithfulness, Answer Relevancy, Context Precision, and Context Recall.
* **Speaker Notes**: *"We validate the system using over 15 automated pytest scripts. To test our RAG chat, we built a RAGAS evaluation suite that auto-generates QA pairs from verified database entries, scoring faithfulness and relevancy automatically."*

### 🛝 Slide 10: Conclusion & Future Scope
* **Visual**: Summary checklist.
* **Slide Text**:
  * Complete, functional, and optimized multi-agent competitive agent.
  * Shifting to native async clients to remove thread context switches.
  * Migrating TF-IDF vocabularies to Qdrant native SPLADE sparse vector indexing.
* **Speaker Notes**: *"InfoVac provides a robust, optimized system for competitive intelligence. In the future, we plan to transition to native async LLM clients and utilize Qdrant native sparse vector indexes to scale queries. Thank you."*

---

## 🛠️ 3. Engineering Limitations & Future Scope Audit

Every engineering system makes trade-offs. Here is the technical audit of InfoVac’s current limitations and planned upgrades:

### 1. Dynamic TF-IDF recalculations (`chat.py`)
* **Limitation**: During hybrid searches, the system fits an `sklearn` `TfidfVectorizer` dynamically on program document chunks in memory. If a program has thousands of pages, this recalculation spikes search latency.
* **Upgrade**: Pre-compute sparse TF-IDF vectors during the embedding phase (`embed_node`) and save them in Qdrant metadata, or switch to Qdrant native SPLADE/FastEmbed sparse vector indexes.

### 2. Synchronous Instructor Calls (`nodes.py` & `evolution.py`)
* **Limitation**: The code wraps synchronous OpenAI/Gemini completions inside thread executors (`loop.run_in_executor`) to prevent Event Loop freezing, which adds thread management overhead.
* **Upgrade**: Refactor extraction calls to use Instructor's native async client framework (`client.chat.completions.create` with `AsyncOpenAI` or `AsyncGemini` clients) to run extraction tasks natively asynchronously.

### 3. Cross-Encoder Model Import Lag (`chat.py`)
* **Limitation**: The reranking model `sentence_transformers.CrossEncoder("BAAI/bge-reranker-base")` is lazy-loaded on the first user query. This causes the first chat message to experience a 5-10 second loading delay.
* **Upgrade**: Pre-warm the CrossEncoder reranker during the FastAPI `@app.on_event("startup")` lifecycle hook so the model weights are loaded in RAM before the first user request.

### 4. Client-side PDF Layout bounds (`ExportBar.tsx`)
* **Limitation**: Client-side PDF generation using `@react-pdf/renderer` runs a custom yoga-layout engine. It is prone to layout exceptions if text content contains unexpected control characters.
* **Upgrade**: Move PDF generation to a server-side route using a headless browser (Puppeteer or Weasyprint) to ensure robust layout rendering.

### 5. Dependency on Tavily / Firecrawl API Quotas (`retriever.py`)
* **Limitation**: If external API quotas are exhausted, the retrieval node fails, short-circuiting the pipeline run.
* **Upgrade**: Add a local fallback scraper using standard HTTP requests and parsing libraries (BeautifulSoup/playwright) to collect basic homepage text when keys are exhausted.
