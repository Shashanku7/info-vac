# InfoVac: System Flows, User Journeys & Database ER Diagrams

This document contains the structural flows, user journeys, data pipelines, and relationship schemas of the InfoVac platform.

---

## 📋 Table of Contents
1. **Data Flow Diagram (DFD)** (How data moves: User ➔ UI ➔ API ➔ AI ➔ DB ➔ Response)
2. **User Flow Diagram** (User journey: Onboard ➔ Workspace ➔ Audits ➔ Results)
3. **Database Entity Relationship Diagram (ERD)** (Table entities & relations)
4. **AI Agent Workflow** (Orchestration: Request ➔ Orchestrator ➔ Agent ➔ Verification ➔ Response)

---

## 🔄 1. Data Flow Diagram (DFD)

This DFD maps how a search query or a program extraction request propagates through the layers and returns processed results.

![Data Flow Diagram](data_flow_diagram.png)

```mermaid
graph TD
    User["👤 User (Analyst)"] -->|1. Triggers Audit (Brand Name / URLs)| FE["💻 Next.js Frontend"]
    FE -->|2. HTTP POST /api/v1/programs| BE["⚙️ FastAPI Backend (main.py)"]
    BE -->|3. Dispatches Task to LangGraph| Graph["🕸️ LangGraph Orchestration"]
    
    Graph -->|4. Search queries grid| Crawler["🕷️ Scraper Grid (retriever.py)"]
    Crawler -->|5. Raw Web Markdown / HTML| Graph
    
    Graph -->|6. Dense/Sparse Vector upsert| Qdrant[("🔍 Qdrant Vector Store")]
    Graph -->|7. Structured Extraction prompts| LLM["🤖 LLM Services (Instructor / LLM Client)"]
    LLM -->|8. Parsed structured dictionary| Graph
    
    Graph -->|9. Fuzzy Quote Check| Verifier["🛡️ Verifier & Gate (gate.py / verifier.py)"]
    Verifier -->|10. Verified facts & confidence scores| Graph
    
    Graph -->|11. SQL commits (append-only parameters)| DB[("🗄️ PostgreSQL Database")]
    DB -->|12. Triggers pg_notify| Notification["📢 pg_notify trigger event"]
    Notification -->|13. Server-Sent Events (SSE stream)| FE
    FE -->|14. Renders live progress and visual highlights| User
```

---

## 🗺️ 2. User Flow Diagram (User Journey)

Maps the steps an analyst takes to onboard, discover programs, audit details, ask chat queries, and generate comparisons.

![User Flow Diagram](user_flow_diagram.png)

```mermaid
graph TD
    Start([🚀 Enter Application]) --> Login["🔑 Onboarding Screen"]
    Login --> Dashboard["📊 Workspace Dashboard"]
    
    %% Option A: Audit Program
    Dashboard --> Action1["🔍 Program Input Bar (Enter brand URL)"]
    Action1 --> Tracker["⏳ Live SSE Progress Tracker"]
    Tracker --> BriefView["📄 Program Analyst Brief (Narrative)"]
    
    %% Brief details
    BriefView --> Detail1["💬 Click Citation Badge (superscript)"]
    Detail1 --> Drawer["🚪 Evidence Drawer (yellow text overlays)"]
    BriefView --> Detail2["💬 Draggable Chat Widget (RAG Q&A)"]
    
    %% Option B: Comparison
    Dashboard --> Action2["⚖️ Multi-Program Picker"]
    Action2 --> CompView["📊 Comparison Bento Matrix"]
    
    %% Results
    BriefView --> Export1["📄 Export PDF / CSV Brief"]
    CompView --> Export2["📄 Export Comparative CSV"]
    Export1 --> End([🏆 Done])
    Export2 --> End
```

---

## 🗄️ 3. Database Entity Relationship Diagram (ERD)

The relational schema defined in [models.py](file:///d:/Coding/KOBIE_hackathon/backend/models.py). It models the cascade deletes and data types.

![Database ER Diagram](database_er_diagram.png)

```mermaid
erDiagram
    PROGRAMS ||--o{ SOURCES : "1:N (CASCADE)"
    PROGRAMS ||--o{ EXTRACTED_FIELDS : "1:N (CASCADE)"
    PROGRAMS ||--o{ NARRATIVES : "1:N (CASCADE)"
    PROGRAMS ||--o{ CONVERSATIONS : "1:N (CASCADE)"
    PROGRAMS ||--o{ EVAL_GROUND_TRUTH : "1:N (CASCADE)"
    
    SOURCES ||--o{ EXTRACTED_FIELDS : "1:N (SET NULL)"
    
    CONVERSATIONS ||--o{ MESSAGES : "1:N (CASCADE)"
    
    PROGRAMS {
        uuid id PK
        string name
        string status "pending|retrieving|extracting|verifying|narrating|complete|failed"
        string llm_used
        string schema_version
        numeric total_cost "USD cost bookkeeping"
        text trace_url "LangSmith public trace link"
        timestamp created_at
        timestamp completed_at
        text error_message
    }
    
    SOURCES {
        uuid id PK
        uuid program_id FK
        text url "Unique index per program"
        string source_type "tnc|faq|homepage|press|news|forum"
        text title
        text raw_content "Markdown up to 50K chars"
        text raw_html "HTML up to 30K chars"
        string content_hash "SHA-256 validation"
        string fetch_method "firecrawl|tavily"
        string fetch_status "success|failed|blocked"
        timestamp fetched_at
    }
    
    EXTRACTED_FIELDS {
        uuid id PK
        uuid program_id FK
        uuid source_id FK
        string category
        string field_name "Multiple runs append new rows"
        jsonb field_value "JSONB parameter values"
        boolean is_null
        text claimed_snippet "LLM quoted quote text"
        boolean gate_passed
        numeric match_score "RapidFuzz similarity ratio"
        integer citation_start "Start character coordinate"
        integer citation_end "End character coordinate"
        numeric corroboration_score
        numeric authority_score
        numeric recency_score
        numeric confidence "Overall verifier score"
        boolean contradiction_flag
        text contradiction_note
        timestamp created_at
    }
    
    NARRATIVES {
        uuid id PK
        uuid program_id FK
        text narrative_text "Markdown consulting brief"
        integer word_count
        timestamp created_at
    }
    
    COMPARISONS {
        uuid id PK
        jsonb program_ids "Supports 3+ comparison list"
        jsonb analysis_json "Strategic advantages grid"
        timestamp created_at
    }
```

---

## 🤖 4. AI Agent Workflow Diagram

InfoVac's LangGraph multi-agent flow. It maps the state boundaries, validation loops, and LLM-as-a-judge override thresholds.

![AI Agent Workflow Diagram](agent_workflow_diagram.png)

```mermaid
graph TD
    Req([1. User Program Request]) --> Planner["🕸️ LangGraph Planner (graph.py)"]
    
    %% Discovery Node
    Planner --> RetrieveNode["🕷️ Discovery Agent (retrieve_node)"]
    RetrieveNode -->|Scrape 11 queries / clean text| IngestDoc["Raw Markdown Content Corpus"]
    
    %% Embedding Node
    IngestDoc --> EmbedNode["🔍 Embedding Ingest Agent (embed_node)"]
    EmbedNode -->|Dense/Sparse text indexing| QdrantStore[("Qdrant collection DB")]
    
    %% Extraction Node
    QdrantStore --> ExtractNode["🤖 Extraction Agent (extract_node)"]
    ExtractNode -->|Instructor Pydantic schema parsing| ParseSchema["Extracted Pydantic Schema"]
    
    %% Validation & Verification Gate Node
    ParseSchema --> VerifyNode["🛡️ Verification Agent (verify_node)"]
    VerifyNode -->|Run gate_verify_multi_source| GateCheck{"Fuzzy Match Score Check"}
    
    %% Verify gate logic split
    GateCheck -->|Score >= 0.95| Pass[("Pass & Coordinate Index")]
    GateCheck -->|Score in 0.70-0.94| Borderline{"Borderline Judge (LLM)"}
    GateCheck -->|Score < 0.70| Fail["Verification Fail"]
    
    Borderline -->|LLM Judge YES| Pass
    Borderline -->|LLM Judge NO| Fail
    
    %% Fail loop
    Fail --> RetryCheck{"Retry Count < 1?"}
    RetryCheck -->|Yes| RetryGate["Targeted Extraction Retry Node"]
    RetryGate --> ExtractNode
    RetryCheck -->|No| Nullify["Nullify value (Honest Null +0.5)"]
    
    %% Complete
    Pass --> NarrateNode["✍️ Narrator Agent (narrate_node)"]
    Nullify --> NarrateNode
    NarrateNode -->|Compile 500-1000 word brief| Response([🏆 Output UI Response])
```

---

## 🧩 5. Component Diagram

Maps the logical components of the platform and their package-level boundaries.

![Component Diagram](component_diagram.png)

```mermaid
graph TD
    subgraph Client Application [React / Next.js]
        C1[Workspace Workspace] --> C2[LCS Citation Matcher]
        C1 --> C3[PDF Export Pipeline]
        C1 --> C4[EventSource SSE Client]
    end

    subgraph API Router [FastAPI App]
        S1[main.py Gateway] --> S2[endpoints.py Controller]
        S2 --> S3[SSE Stream Router]
    end

    subgraph Agent Core [LangGraph Core]
        A1[graph.py Wireframe] --> A2[state.py PipelineState]
        A1 --> A3[nodes.py Execution Nodes]
    end

    subgraph AI Service Adapter
        AI1[Instructor Client Schema] --> AI2[Fallback Router Client]
        AI2 --> AI3[Thread-Safe Key Broker]
    end

    subgraph Database Engines
        DB1[SQLAlchemy Async Engine]
        DB2[Qdrant Semantic Client]
    end

    %% Dependencies
    C1 -->|REST Actions| S1
    S3 -->|Event Broadcast| C4
    S2 -->|ainvoke Graph| A1
    A3 -->|DB Transact| DB1
    A3 -->|Hybrid Query| DB2
    A3 -->|Instruct Extract| AI1
    AI2 -->|Coordinating Keys| AI3
```

---

## 📡 6. Deployment Diagram

Maps the containerization host networks and runtime volumes mapping.

![Deployment Diagram](deployment_diagram.png)

```mermaid
graph TD
    subgraph Vercel Hosting [Next.js Static build]
        FE[Static Frontend UI Server]
    end

    subgraph Docker Bridge Network [Host Port 8000 & 5432]
        BE[FastAPI App Service Container]
        DB[PostgreSQL Database Service Container]
        QD[Qdrant Vector Service Container]
    end

    %% Persistent Volumes Binds
    DB_VOL[("postgres_data volume")] === DB
    QD_VOL[("qdrant_data volume")] === QD

    %% Connectors
    FE -->|HTTP API calls port 8000| BE
    BE -->|SQL queries port 5432| DB
    BE -->|Vector search port 6333| QD
```

---

## 📡 7. Sequence Diagram

Illustrates the chronologically ordered lifecycle of a loyalty program audit task run.

![Sequence Diagram](sequence_diagram.png)

```mermaid
sequenceDiagram
    actor Analyst as User (Analyst)
    participant UI as Next.js Frontend
    participant API as FastAPI Backend
    participant Graph as LangGraph Orchestrator
    participant DB as Postgres Database
    participant LLM as LLM Provider / Scraper

    Analyst->>UI: Enter program name & URL
    UI->>API: HTTP POST /api/v1/programs (Run Audit)
    API->>DB: Insert Program (status="pending")
    API->>UI: Return program_id (202 Accepted)
    UI->>API: Initialize EventSource (SSE listen)
    
    Note over API,Graph: Spawn background thread run_pipeline()
    API->>Graph: Compile & Exec StateGraph
    
    loop Dynamic Ingest Node
        Graph->>LLM: Crawl & scrape 11 targeted queries
        LLM-->>Graph: Return pages markdown
    end
    
    Graph->>DB: Insert pipeline_event (stage="retrieving")
    DB-->>UI: pg_notify broadcast (SSE Event)
    
    Graph->>LLM: Pydantic structured extraction
    LLM-->>Graph: Return Pydantic schema dictionary
    
    Graph->>DB: Insert pipeline_event (stage="extracting")
    DB-->>UI: pg_notify broadcast (SSE Event)
    
    Note over Graph: Run verification gate & math confidence scores
    Graph->>DB: Write verified extracted_fields
    Graph->>DB: Insert narrative analyst brief
    Graph->>DB: Update Program status="complete"
    DB-->>UI: pg_notify broadcast (status="complete" SSE Event)
    
    UI->>DB: Fetch completed narratives & fields
    DB-->>UI: Return data
    UI->>Analyst: Render workspace and highlight citations
