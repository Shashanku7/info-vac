# Part 8: Infrastructure, Deployment & Environment Configurations

This document details the containerization, environment configuration templates, and deploy-time optimizations of the InfoVac platform.

---

## 🏗️ 1. Infrastructure Architecture Overview

InfoVac’s local and production hosting setup utilizes a multi-container deployment model orchestrated via Docker Compose:

```mermaid
graph TD
    A[Client Web Browser] -->|Port 3000| B[Next.js Frontend Container / Vercel]
    B -->|Port 8000| C[FastAPI Backend Container (Dockerfile)]
    C -->|Port 5432| D[PostgreSQL Alpine Database Container]
    C -->|Port 6333| E[Qdrant Cloud / Local Vector Container]
```

* **Next.js Frontend**: Serves UI layouts and routes API calls. Can be deployed on Vercel or packaged locally.
* **FastAPI Backend (Uvicorn)**: Houses the Python LangGraph orchestrator, structured Instructor parsers, verifiers, and RAG engines.
* **PostgreSQL (15-alpine)**: Main persistent relational store with `pg_notify` database triggers.
* **Qdrant Vector Database**: Vector store for hybrid sparse/dense semantic searches.

---

## 🐳 2. Containerization Specification

### A. FastAPI Backend (`Dockerfile`)
* **File Reference**: [Dockerfile](file:///d:/Coding/KOBIE_hackathon/Dockerfile)
* **Optimization (Two-Stage Builds)**:
  * **Stage 1: Builder (`python:3.11-slim`)**: Installs compilation prerequisites (`build-essential`, `libpq-dev`), creates a virtual environment at `/opt/venv`, and pre-installs dependencies from `requirements-deploy.txt`.
  * **Stage 2: Runner (`python:3.11-slim`)**: Copies the virtual environment (`/opt/venv`), installs basic utility tools (`curl`, `libpq-dev`), exposes port 8000, and initializes using Uvicorn.
  * **Image Footprint reduction**: Keeps final production runner images slim by excluding build tools.
  * **Health Check Guard**: Configures a container health check polling the backend port every 10 seconds:
    ```dockerfile
    HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
      CMD curl -f http://localhost:8000/health || exit 1
    ```

### B. Service Orchestrations (`docker-compose.yml`)
* **File Reference**: [docker-compose.yml](file:///d:/Coding/KOBIE_hackathon/docker-compose.yml)
* **Key Mechanisms**:
  * **Database Health Constraints**: The FastAPI `app` service is configured with a health check dependency. It waits to boot until the PostgreSQL instance reports healthy via `pg_isready`:
    ```yaml
    depends_on:
      postgres:
        condition: service_healthy
    ```
  * **Volume Persistence**: PostgreSQL databases write to a named Docker volume (`postgres_data`) to prevent data loss when container states are reset.
  * **Restart Safeguards**: Services use `restart: unless-stopped` to auto-recover if exceptions occur or containers reboot.

---

## 📦 3. Dependency Tuning & Packaging

InfoVac divides package requirements into local development packages and deployment-optimized packages.

### A. Local Requirements (`requirements.txt`)
* **File Reference**: [requirements.txt](file:///d:/Coding/KOBIE_hackathon/requirements.txt)
* **Groups**:
  * *API Server*: `fastapi`, `uvicorn[standard]`, `sse-starlette`.
  * *Validation*: `pydantic`, `pydantic-settings`.
  * *Database*: `sqlalchemy`, `asyncpg`, `alembic`, `psycopg[binary]`.
  * *Agent Framework*: `langgraph`, `langchain`, `langchain-core`, `instructor`.
  * *APIs*: `google-generativeai`, `anthropic`, `tavily-python`, `firecrawl-py`.
  * *Testing*: `pytest`, `pytest-asyncio`.
  * *RAG*: `qdrant-client`, `sentence-transformers`, `rapidfuzz`, `langchain-text-splitters`.

### B. Deployment-Optimized Requirements (`requirements-deploy.txt`)
* **File Reference**: [requirements-deploy.txt](file:///d:/Coding/KOBIE_hackathon/requirements-deploy.txt)
* **PyTorch CPU-Only Index Optimization**: Installing the standard PyTorch library inside docker images pulls GPU CUDA compiler binaries, adding gigabytes of bloat. InfoVac overrides this by specifying the CPU-only wheel repository:
  ```txt
  --extra-index-url https://download.pytorch.org/whl/cpu
  torch
  sentence-transformers
  ```
  This reduces the final container size by **~800MB**, accelerating download times, container boots, and Kubernetes deployments.

---

## ⚙️ 4. Environment Variables Configuration

* **File Reference**: [.env.example](file:///d:/Coding/KOBIE_hackathon/.env.example)

The application pulls credentials from local environments. The template structures keys into four functional categories:

| Key Name | Sample / Type | Role | Requirement |
| :--- | :--- | :--- | :--- |
| **`DATABASE_URL`** | `postgresql+asyncpg://...` | Asynchronous database connection | Required |
| **`SYNC_DATABASE_URL`** | `postgresql://...` | Synchronous database connection | Required for Alembic |
| **`ANTHROPIC_API_KEY`** | `sk-ant-YOUR_KEY_HERE` | Anthropic Claude API credential | Required for extraction |
| **`GEMINI_API_KEY`** | `your-gemini-key` | Google Gemini API credential | Optional (rotates keys) |
| **`TAVILY_API_KEY`** | `tvly-...` | Tavily Web Search API key | Required for Discovery |
| **`FIRECRAWL_API_KEY`** | `fc-...` | Firecrawl Web Crawler API key | Required for Discovery |
| **`LANGCHAIN_TRACING_V2`** | `true` or `false` | Enables trace capture | Optional (LangSmith tool) |
| **`LANGCHAIN_API_KEY`** | `ls__...` | LangSmith API credential | Optional |
| **`LANGCHAIN_PROJECT`** | `infovac` | Trace project grouping | Optional |
