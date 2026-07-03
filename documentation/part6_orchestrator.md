# Part 6: LangGraph Orchestrator Spec & Pipeline Audit

This document catalog-audits the multi-agent orchestration layer located in the [orchestrator/](file:///d:/Coding/KOBIE_hackathon/orchestrator/) directory. It details the LangGraph state machine, data flows, node functions, and event broadcasting triggers.

---

## 🕸️ 1. Pipeline State & Schema Definitions

### 📦 Pipeline State (`orchestrator/state.py`)
* **File Reference**: [state.py](file:///d:/Coding/KOBIE_hackathon/orchestrator/state.py)
* **Role**: Defines the shared state flowing through the LangGraph StateGraph nodes.
* **Typing Constraint**: Employs a strict `TypedDict` to enforce JSON-serializable keys (preventing connection memory leaks by forbidding raw SQLAlchemy ORM objects):
  ```python
  class PipelineState(TypedDict):
      program_id: str            # UUID string representation
      program_name: str          # Name of loyalty program
      source_dicts: list[dict]   # Serialised crawled source properties
      extracted_schema: Optional[dict]  # Extracted values schema dictionary
      error: Optional[str]       # Error message string
      retry_count: int           # Current retry attempts
  ```
* **Iterators**: Provides `iter_fields(schema_dict)` to flatten nested Pydantic models into dynamic generators returning `(category_key, field_name, value_dict)`.

---

## 🕸️ 2. LangGraph Wiring & LangSmith Sharing

### 🕸️ Graph Wireframe (`orchestrator/graph.py`)
* **File Reference**: [graph.py](file:///d:/Coding/KOBIE_hackathon/orchestrator/graph.py)
* **Role**: Defines nodes, sets entry boundaries, registers connections, and compiles the workflow.
* **Nodes & Edges**:
  * Nodes: `retrieve` ➔ `embed` ➔ `extract` ➔ `verify` ➔ `narrate` ➔ `END`.
  * Wires all transitions as simple linear dependencies.
* **LangSmith trace sharing**:
  * Uses `collect_runs()` context managers to intercept the pipeline run ID.
  * Dynamically creates a shareable link via `Client().share_run(run_id)`.
  * Triggers database updates to persist the trace link (`programs.trace_url`) for the Next.js frontend workspace view.

---

## ⚙️ 3. Node Execution Details

Each node in [nodes.py](file:///d:/Coding/KOBIE_hackathon/orchestrator/nodes.py) handles its own exceptions, logs diagnostic traces, updates status rows in PostgreSQL, and emits frontend events.

### A. Ingestion: `retrieve_node`
* **Workflow**: Dispatches crawler pipelines.
* **Resilience**: Employs `tenacity.AsyncRetrying` with **3 attempts** and exponential backoffs ($1 \text{s} \rightarrow 8 \text{s}$) to absorb transient timeouts from search engines or scraping tools.
* **State Updates**: Maps crawled ORM models to `source_dicts` containing truncated contents (`raw_content` capped at 50,000 chars, `raw_html` capped at 30,000 chars).

### B. Vector Ingestion: `embed_node`
* **Workflow**: Groups raw contents into chunks, compiles Google dense vector embeddings, fits local TF-IDF matrices for Qdrant sparse vectors, and upserts them into Qdrant using hybrid models.
* **Timeout Protections**: Upserts vectors in batches of 100 with a **45-second execution timeout** (`asyncio.wait_for`). If vector database uploads hang, it emits a warning but continues execution to prevent pipeline freezes.

### C. Extraction: `extract_node`
* **Workflow**: Feeds crawled sources into Pydantic structured schemas.
* **Execution**: Wraps the blocking Instructor extraction pipeline in a thread-pool executor (`loop.run_in_executor`) to prevent blocking the main asyncio event loop.

### D. Citation Check & Retry: `verify_node`
This is a critical node in the platform:
1. **Verbatim Gate**: Validates quotes via `gate_verify_multi_source` across all crawled sources.
2. **Attribution Recovery**: Re-allocates facts to the correct source URL if the LLM quoted correct text but cited the wrong URL.
3. **LLM Judge Borderline Verification**: If matching scores land in the borderline range $[0.70, 0.94]$, it triggers `_call_llm_judge` to determine if semantic/formatting variances are acceptable.
4. **Targeted Failover Retries**: Gathers all fields that failed verification and executes a second extraction pass (`retry_failed_fields`) targeting only those values.
5. **Coordinate Indexing**: Performs text index lookups (`src_content.find(quote)`) to register exact character coordinates (`citation_start` and `citation_end`) in PostgreSQL.
6. **Financial Bookkeeping**: Calculates LLM token costs (`extraction_cost` + `retry_cost`) and saves them in `program.total_cost`.

### E. Executive Narrative: `narrate_node`
* **Workflow**: Generates Markdown consulting briefs based on verified database fields, appending the narrative to the database.

---

## 📢 4. Notification & Status Dispatcher

### 📢 Event Dispatcher (`orchestrator/events.py`)
* **File Reference**: [events.py](file:///d:/Coding/KOBIE_hackathon/orchestrator/events.py)
* **Role**: Database updates and Server-Sent Events notifications.
* **Core Functions**:
  * `emit_event(program_id, stage, progress, detail)`: Writes logs to the `pipeline_events` table. A PostgreSQL trigger catches inserts and executes `pg_notify`, streaming updates to the frontend with low latency.
  * `set_status(program_id, status, error)`: Updates status flags (`pending`, `retrieving`, etc.) and timestamps (`completed_at`).
  * `set_trace_url(program_id, url)`: Safely writes public LangSmith tracing links to the database.
