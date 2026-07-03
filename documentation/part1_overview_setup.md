# Part 1: InfoVac Platform Overview, Tech Stack, & Setup Guide

## 📌 1. Project Overview & Problem Statement

### 🔍 The Problem
In the loyalty program industry, competitor intelligence is a highly manual, slow, and error-prone process. Loyalty analysts must comb through hundred-page Terms & Conditions (T&Cs), FAQ pages, benefits guidelines, and press releases to understand, audit, and compare competitor offerings. 

Traditional generic LLM applications fail at this task for several reasons:
1. **Hallucinations**: LLMs frequently hallucinate exact values (e.g., earning multipliers, reward tiers, or App Store ratings).
2. **Lack of Grounded Citations**: General-purpose chatbots cannot prove *where* a statement was extracted from, making the outputs untrustworthy for consulting-grade reports.
3. **Context Limits & Web Noise**: Standard scrapers strip structures (like HTML tables), and naive document truncation chops out key clauses.
4. **API Rate-Limiting**: Parallel processing of multiple documents triggers provider rate-limits, crashing typical scripts.

### 💡 The Solution: InfoVac
**InfoVac** is an autonomous, high-performance, consulting-grade multi-agentic competitive intelligence platform. It scrapes, structures, verifies, analyzes, and compares loyalty program architectures. By combining a **FastAPI + LangGraph** backend with a custom **Next.js 15** frontend, it delivers validated, grounded insights with zero hallucinations.

---

## 🎯 2. System Objectives

InfoVac is engineered to achieve five primary objectives:
* **Autonomous Ingestion**: Crawl and scrape T&Cs, FAQs, and press releases dynamically using advanced retrieval grids.
* **Structured Parsing**: Map exactly 43 complex loyalty parameters (e.g., earn rates, burn rules, tier structures) into strict schemas.
* **Rigorous Verification**: Fuzzy-match every claim verbatim against crawled source segments. If verification criteria are not met, trigger fallback retry cycles or nullify claims.
* **Strategic Synthesis**: Compile verified claims into side-by-side matrices and consulting-grade executive briefs.
* **Consulting-Grade UX**: Present analysts with academic-style inline superscript citations linked directly to a sliding **Evidence Drawer** that highlights the exact matching sentence.

---

## 🛠️ 3. Technology Stack

InfoVac divides its workload between a robust processing backend and a highly interactive, responsive frontend.

### ⚙️ Backend Core
* **FastAPI**: Core API gateway managing Server-Sent Events (SSE) progress streams, chat channels, and program status hooks.
* **LangGraph**: Multi-agent orchestrator managing the pipeline state machine, retry paths, and failover branches.
* **SQLAlchemy & Alembic**: Object-Relational Mapping (ORM) and migrations framework to manage the PostgreSQL persistence layer.
* **Qdrant**: High-performance vector database used for storing crawled document chunks, supporting dense and sparse hybrid search via Reciprocal Rank Fusion (RRF).
* **RapidFuzz**: High-speed Levenshtein distance string matching algorithm used by the Verification Gate.
* **Instructor**: JSON schema parser that enforces structured Pydantic extractions on top of LLM outputs.

### 🎨 Frontend UI/UX
* **Next.js 15 (React 19)**: React framework with App Router, utilizing deferred rendering paths to prevent main-thread locks on heavy DOM trees.
* **Tailwind CSS**: Utility-first CSS framework for clean, high-density dashboard layouts.
* **Radix UI & Lucide React**: Premium primitive components and icons.
* **Sonner**: Toast notification system.
* **@react-pdf/renderer**: Client-side document PDF engine compiling comparison reports on-the-fly.

---

## 🏢 4. System Flow & Architecture

The multi-agent pipeline is orchestrated sequentially as a StateGraph in LangGraph:

```mermaid
graph TD
    A["Program Name / URL"] --> B["Scraper / Crawler (retriever.py)"]
    B --> C["Embeddings Ingestion (embeddings.py, qdrant_client.py)"]
    C --> D["LangGraph Orchestrator (graph.py, state.py)"]
    D --> E["LLM Structured Extraction (extractor.py, key_broker.py)"]
    E --> F["Verification Gate (gate.py using RapidFuzz)"]
    F -->|Verification Passed| H["Narrator Brief Generation (narrator.py)"]
    F -->|Verification Failed| G["Targeted Extraction Retry (nodes.py)"]
    G --> F
    H --> I["PostgreSQL Database (models.py)"]
    I --> J["Next.js Workspace (page.tsx, useSSE.ts)"]
```

---

## 🚀 5. Installation & Setup Guide

InfoVac includes a single-click script to orchestrate local infrastructure setup.

### 📋 Prerequisites
Ensure your local environment meets these requirements:
* **Python**: `3.10` or higher
* **Node.js**: `18.x` or higher
* **Docker**: Active daemon to boot the PostgreSQL and Qdrant containers

### 🛠️ Step 1: Environment Variables
Create a `.env` file in the project root:
```bash
cp .env.example .env
```
Fill in the credentials:
```env
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/infovac"
SYNC_DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/infovac"
GEMINI_API_KEY="your-gemini-key"
TAVILY_API_KEY="your-tavily-key"
FIRECRAWL_API_KEY="your-firecrawl-key"
```

### ⚡ Step 2: Automated Installation (Recommended)
Run the automated configuration script to boot containers, install dependencies, and build migrations:
```powershell
# Windows
.\setup.bat
```
This script automates:
1. Copying `.env.example` to `.env` (if missing).
2. Spawning a PostgreSQL container via Docker Compose.
3. Setting up a Python virtual environment (`venv_infovac`) and installing dependencies.
4. Installing npm modules inside the `frontend/` workspace.
5. Running database migrations via Alembic (`alembic upgrade head`).

### 🔧 Manual Installation (Alternative)
If you prefer running commands manually:

**1. Database Container**
```bash
docker-compose up -d
```

**2. Backend Setup**
```bash
python -m venv venv_infovac
# Windows
.\venv_infovac\Scripts\activate
# Linux/macOS
source venv_infovac/bin/activate

pip install -r requirements.txt
alembic upgrade head
```

**3. Frontend Setup**
```bash
cd frontend
npm install
```

---

## 📟 6. Running the Platform

InfoVac features a managed process launcher that monitors active services and ensures clean exits.

### 🟢 Single-Click Launcher
Execute the PowerShell runner script to spawn backend and frontend development servers:
```powershell
# Windows
.\start.bat
```
* **Process Traps (`start.ps1`)**: The runner saves system process handles (`-PassThru`) for the FastAPI backend, Next.js frontend, and Docker instances. When you hit `Ctrl+C`, a recursive shutdown sequence executes `taskkill /f /t /pid`, closing all child console windows instantly and leaving zero zombie background processes.

### 🔴 Manual Startup
If launching services individually:
```bash
# Terminal 1: Run Backend (from root)
uvicorn backend.main:app --reload --port 8000

# Terminal 2: Run Frontend (from /frontend)
cd frontend
npm run dev
```

The services will be active at:
* **Analyst Workspace**: `http://localhost:3000`
* **Admin Dashboard**: `http://localhost:3000/admin`
* **API Documentation**: `http://localhost:8000/docs`

---

## 🧪 7. Verification & Testing

InfoVac incorporates test suites to verify integration points and pipeline math.

### ⚡ Mock-Based Fast Test Suite
To verify the entire transaction flow without utilizing API tokens or spinning up local databases, run the 9-second mock test suite:
```bash
pytest tests/test_comprehensive_system.py -v -s
```

### 🧪 Full Integration Test Suite
To run all tests (including database ORM tests, fuzzy matching boundaries, and fallback router mocks):
```bash
# Activate your venv first
pytest tests/
```
