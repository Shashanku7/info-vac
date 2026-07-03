# Part 9: Testing Strategy, Coverage & Validation Harness

This document outlines the testing and validation architecture of InfoVac. It details the mock strategies, unit tests, integration sweeps, and the automated LLM-as-a-judge evaluation suite.

---

## 🧪 1. Testing Strategy Overview

InfoVac implements a layered testing strategy to verify the pipeline's deterministic mathematics, async database states, and LLM integrations.

```mermaid
graph TD
    A[Test Execution Trigger] --> B[Unit Logic Tests (mocked, <1s)]
    A --> C[Comprehensive System Integration Mock (9s)]
    A --> D[End-to-End Orchestrator Mock (alembic DB / loop checks)]
    A --> E[Automated RAGAS Evaluation Suite (LLM-as-a-judge / Golden Set)]
```

* **Unit Tests**: Target isolated functions (fuzzy string ratios, confidence equations, and URL regex checks).
* **Mock-Based Integration Suite**: Simulates the full system execution path in 9 seconds without database connections or live LLM tokens.
* **Database & Loop Isolation**: Prevents async loop crashes by using a fresh, pool-free database engine (`NullPool`) for every test function.
* **Automated Evaluation Harness**: Auto-generates evaluation datasets and measures chatbot faithfulness and precision using RAGAS metrics.

---

## 🏗️ 2. Database Test Fixtures (`tests/conftest.py`)

* **File Reference**: [conftest.py](file:///d:/Coding/KOBIE_hackathon/tests/conftest.py)
* **The NullPool Pattern**: Standard connection pools keep connections open. In async tests, `pytest-asyncio` generates a new event loop per test function. Reusing a connection bound to a defunct event loop causes immediate driver crashes. InfoVac resolves this by overriding the test engine config:
  ```python
  engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
  ```
  `NullPool` opens a fresh TCP socket per test, preventing cross-loop connection leakage.
* **Lifecycle Cascades**: The `temp_program` fixture inserts a test program row and uses `Cascade` rules on teardown to clean up dependent sources, fields, and chat messages.

---

## 🛠️ 3. Integration & Node Audits

### A. Fast Integration Stack (`test_comprehensive_system.py`)
* **File Reference**: [test_comprehensive_system.py](file:///d:/Coding/KOBIE_hackathon/tests/test_comprehensive_system.py)
* **Goal**: Runs the entire multi-agent pipeline from Tavily search results to Narrator Markdown outputs under mocked APIs, completing execution in **9 seconds**.
* **Scopes Verified**:
  * Sequential execution of all five StateGraph nodes.
  * Validation rates and fuzzy coordinate boundaries.
  * API routes mapping.
  * LangSmith project trace URL database insertion.

### B. Orchestrator Node-Level Audits (`test_orchestrator_unit.py` & `test_orchestrator_e2e.py`)
* **Files**: [test_orchestrator_unit.py](file:///d:/Coding/KOBIE_hackathon/tests/test_orchestrator_unit.py), [test_orchestrator_e2e.py](file:///d:/Coding/KOBIE_hackathon/tests/test_orchestrator_e2e.py)
* **Goal**: Verifies StateGraph transitions, failover branches, and status checks.
* **Key Scenarios Tested**:
  * *Retrieve Failures*: Asserts that if a retrieval task fails, the orchestrator catches the exception, registers the error string in the program's DB row, and short-circuits the downstream extraction/verification nodes to save API tokens.
  * *SSE Event Ordering*: Asserts that pipeline events are emitted in the correct chronological order.

### C. Web Crawler & Parser Validation (`test_retriever.py`)
* **File Reference**: [test_retriever.py](file:///d:/Coding/KOBIE_hackathon/tests/test_retriever.py)
* **Key Scenarios Tested**:
  * *Robots.txt Blocks*: Verifies that the crawler handles robots.txt block warnings gracefully, labeling them `robots_unverified` instead of crashing.
  * *Mojibake Repair*: Asserts that encoding corruption is successfully resolved during ingestion.

---

## 🔬 4. Algorithmic Unit Tests

### A. Verifier Calculations (`test_verifier.py`)
* **File Reference**: [test_verifier.py](file:///d:/Coding/KOBIE_hackathon/tests/test_verifier.py)
* **Goal**: Asserts that credibility scores match the mathematical confidence formula down to three decimal places.
* **Key Scenario Tested**:
  * *Contradiction Capping*: Asserts that when two sources disagree on a field (similarity <65%), the contradiction capping logic clamps the output confidence score to $\leq 0.4$.

### B. Fuzzy Citation Matching (`test_gate.py`)
* **File Reference**: [test_gate.py](file:///d:/Coding/KOBIE_hackathon/tests/test_gate.py)
* **Key Scenarios Tested**:
  * *Fuzzy Thresholds*: Verifies that candidate quotes matching below the confidence threshold are rejected.
  * *Verbatim Null Passing*: Asserts that when a value is extracted as `None` (honest null), the gate returns `passed=True` and `match_score=1.0` immediately, matching the system design where reporting uncertainty is correct.

### C. Model Calibration (`test_phase8.py`)
* **File Reference**: [test_phase8.py](file:///d:/Coding/KOBIE_hackathon/tests/test_phase8.py)
* **Key Scenarios Tested**:
  * *App Store Scores*: Asserts that App Store rating inputs containing values outside `[0.0, 5.0]` are automatically set to null.
  * *Discrepancy Corrections*: Asserts that if the model extracts `tier_count = 5` but only lists 3 names in `tier_names`, the validator overrides the count to 3.

---

## 🧠 5. Hybrid RAG Upgrades (`test_rag_upgrades.py` & `test_chat.py`)

### A. Vector Hybrid search (`test_rag_upgrades.py`)
* **File Reference**: [test_rag_upgrades.py](file:///d:/Coding/KOBIE_hackathon/tests/test_rag_upgrades.py)
* **Key Scenarios Tested**:
  * *Metadata Filtering*: Asserts that Qdrant query filters are constructed correctly when a `source_type` is specified.
  * *RRF Hybrid search*: Asserts that search queries build two distinct prefetch requests (dense vectors and sparse TF-IDF vectors) and fuse them using Reciprocal Rank Fusion (`models.Fusion.RRF`).
  * *Borderline LLM Judge*: Asserts that the verifier delegates verification decisions to the semantic LLM judge if the fuzzy match score falls in the borderline range $[0.70, 0.94]$.

### B. RAG Chat Client Mocks (`test_chat.py`)
* **File Reference**: [test_chat.py](file:///d:/Coding/KOBIE_hackathon/tests/test_chat.py)
* **Key Optimization Tested**:
  * *Encoder Weight Bypass*: Mocks out the `sentence_transformers.CrossEncoder` to return static arrays, preventing Pytest from downloading a `300MB` model file during test runs. This keeps test execution times under 0.1 seconds.

---

## 📊 6. Automated RAGAS Evaluation Suite (`tests/eval_ragas.py`)

* **File Reference**: [eval_ragas.py](file:///d:/Coding/KOBIE_hackathon/tests/eval_ragas.py)
* **Methodology**: Evaluates chatbot quality against RAGAS metrics (Faithfulness, Answer Relevancy, Context Precision, and Context Recall).
* **No-Label Golden Set Generation**: Generates evaluation datasets dynamically from the database:
  1. Retrieves all gate-passed, non-null fields for a program.
  2. Maps them to natural-language question templates (e.g., `expiry_policy` ➔ *"When do points expire in this loyalty program?"*).
  3. Uses the gate-verified value and evidence quote as the Ground Truth.
  4. Generates chatbot answers and collects retrieved contexts.
  5. Evaluates using Gemini or GPT-4o-mini as a judge.
* **Target Thresholds**: RAG evaluation thresholds are set to a minimum score of **0.70 for Faithfulness** and **0.60 for other metrics** to prove production readiness.
