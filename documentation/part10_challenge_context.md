# Part 10: Hackathon Challenge Context, Rubrics, & Alignment

This document outlines the alignment of the InfoVac platform with the original hackathon challenge parameters, business contexts, scoring rubrics, and engineering strategies defined in the competitive intelligence problem statement [infovac_ps.md](file:///d:/Coding/KOBIE_hackathon/docs/infovac_ps.md).

---

## 🏢 1. Business Context & Strategic Impact

### 💼 The Kobie Enterprise Context
Kobie advises enterprise loyalty clients across Quick Service Restaurants (QSR), retail, hospitality, and financial services. Program design and positioning require deep competitor analysis. 

InfoVac directly addresses this strategic need by transforming the slow, manual process of competitor research into an automated, high-fidelity pipeline. It allows consulting teams to quickly generate accurate program comparisons and briefs for client-facing decks.

---

## 🎯 2. Challenge Capabilities Mapping

The challenge specifies **6 core system capabilities**. Here is how InfoVac implements each:

* **1. Discover (Source Ingestion)**:
  InfoVac’s scraper grid ([retriever.py](file:///d:/Coding/KOBIE_hackathon/backend/retriever.py)) avoids homepages-only summaries by firing **11 targeted queries** (T&Cs, FAQs, App reviews, press releases, etc.) to fetch high-density source context.
* **2. Extract (Structured Parsing)**:
  Instead of generic prompts, InfoVac maps content into a strict, validated **43-field Pydantic schema** (across 9 categories, exceeding the required 35+ fields across 8 categories).
* **3. Verify (Fact Checking)**:
  Uses the `rapidfuzz` Verification Gate ([gate.py](file:///d:/Coding/KOBIE_hackathon/backend/gate.py)) and a deterministic confidence formula ([verifier.py](file:///d:/Coding/KOBIE_hackathon/backend/verifier.py)) to cross-check all LLM claims, re-attributing URLs and flagging contradictions.
* **4. Narrate (Brief Generation)**:
  Generates a Markdown executive brief using category-by-category synthesis loops ([narrator.py](file:///d:/Coding/KOBIE_hackathon/backend/narrator.py)) to enforce word counts (500–1,000 words) and prevent hallucinated filler.
* **5. Compare (Strategic Advantage Matrix)**:
  Generates side-by-side matrices and strategic gap recommendations ([comparator.py](file:///d:/Coding/KOBIE_hackathon/backend/comparator.py)) using only verified, non-null data.
* **6. Converse (Contextual RAG Chat)**:
  Embeds source chunks in Qdrant ([qdrant_client.py](file:///d:/Coding/KOBIE_hackathon/backend/qdrant_client.py)) to support conversational RAG ([chat.py](file:///d:/Coding/KOBIE_hackathon/backend/chat.py)) using dense/sparse RRF hybrid search and rerankers.

---

## 🏆 3. Asymmetric Evaluation & Scoring Alignment

The hackathon guidelines state that **scoring is highly asymmetric**:
* **Correct Match**: `+1.0` points.
* **Honest Null (Unknown)**: `+0.5` points.
* **Miss**: `0.0` points.
* **Hallucination**: `-3.0` points.

> [!IMPORTANT]
> **Precision over recall**: Honest uncertainty beats confident fabrication. Hallucinated claims are penalized at **3x the rate** of honest unknown responses.

### 🛡️ InfoVac Asymmetric Risk Mitigation Strategies

#### 1. Verbatim Grounding Guard
Every field extraction requires the LLM to supply a verbatim `evidence_quote` and the exact `source_url`. The Verification Gate ([gate.py](file:///d:/Coding/KOBIE_hackathon/backend/gate.py)) fuzzy-matches the quote against the raw crawled webpage content. If matching fails (score `< 0.80` and borderline LLM judge rejects), the gate nullifies the value.

#### 2. Strict Uncertainty Tuning
Prompt templates explicitly instruct the LLM: *"If the document does not mention the value or if there is any ambiguity, output null."*

#### 3. Honest Null Reward
An extracted `null` value automatically bypasses gate rejection, returning `passed=True` and `match_score=1.0` (verbatim null passing). This rewards the system with `+0.5` points for reporting honest uncertainty rather than risk a `-3.0` hallucination penalty.

#### 4. Contradiction Capping
If two verified sources return disagreeing values (similarity `< 65%`), the system marks `contradiction_flag = True` and **clamps the parameter's confidence score to a maximum of 0.4**, flagging it for human audit.

---

## 🛡️ 4. Handling Adversarial Cases & Graceful Degradation

InfoVac is designed to remain robust when processing challenging edge cases:

* **Limited Web Presence / Empty Crawls**:
  If the crawler retrieves no sources or extraction results in zero nodes, the system throws an immediate `SystemExit(1)` error (*"Graph is empty"*), preventing empty data updates. If the program has fewer than 7 sources, the Narrator limits briefs to 200 words to avoid generating hallucinated filler text.
* **API Key Exhaustion & Quota Caps**:
  If external API keys encounter transient rate limits or quota drops, the thread-local **Key Broker** ([key_broker.py](file:///d:/Coding/KOBIE_hackathon/backend/key_broker.py)) cooldown-locks keys (30s for transient drops, 1 hour for 429 quota exhaustion) and fallback routers dynamically retry across the pool.
* **Vector Store Failures**:
  If the Qdrant connection hangs or vector generation fails, `embed_node` writes an `embed_warning` log and continues the main pipeline, ensuring the core brief generation remains functional.
* **Network & SSE degradation**:
  If firewalls block Server-Sent Events, the frontend EventSource client degrades to a **10-second HTTP polling interval** to maintain tracking.
