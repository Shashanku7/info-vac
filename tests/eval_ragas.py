"""
InfoVac — RAGAS Evaluation Suite

Evaluates the RAG chat pipeline quality using RAGAS metrics:
  - Faithfulness:      Does the answer stick to what's in the retrieved context?
  - Answer Relevancy: Is the answer actually relevant to the question?
  - Context Precision: Are the retrieved chunks useful for answering?
  - Context Recall:   Did retrieval find what was needed to answer correctly?

Usage:
  # Run against a real program in the DB (must be 'complete' status):
  PROGRAM_ID=<uuid> pytest tests/eval_ragas.py -v -s

  # Or run as a standalone script:
  python tests/eval_ragas.py --program-id <uuid>

Requirements:
  pip install ragas datasets langchain-openai langchain-google-genai

Notes:
  - RAGAS needs an LLM judge. Set GOOGLE_API_KEY (Gemini, no extra cost)
    or OPENAI_API_KEY (GPT-4o-mini).
  - The golden QA set is auto-generated from gate-passed extracted fields —
    no manual labelling required.
  - Target: faithfulness >= 0.70, others >= 0.60 for a production-ready system.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from typing import Any

import pytest
import structlog
from dotenv import load_dotenv

load_dotenv()

log = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# RAGAS imports (optional dep — skip gracefully if not installed)
# ---------------------------------------------------------------------------
try:
    from ragas import evaluate
    from ragas.metrics import (
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall,
    )
    from ragas.dataset_schema import SingleTurnSample, EvaluationDataset
    RAGAS_AVAILABLE = True
except ImportError:
    RAGAS_AVAILABLE = False

# ---------------------------------------------------------------------------
# Golden QA templates keyed on field_name
# ---------------------------------------------------------------------------
FIELD_QUESTION_TEMPLATES: dict[str, str] = {
    "base_earn_rate":              "What is the base earn rate for this loyalty program?",
    "redemption_options":          "What can members redeem their points for?",
    "expiry_policy":               "When do points expire in this loyalty program?",
    "tier_names":                  "What are the tier levels in this loyalty program?",
    "top_tier_benefits":           "What benefits do top-tier members receive?",
    "partner_names":               "Who are the key partners of this loyalty program?",
    "overall_rating":              "What is the overall member satisfaction rating?",
    "key_differentiators":         "What makes this loyalty program stand out from competitors?",
    "mobile_app_available":        "Does this loyalty program have a mobile app?",
    "membership_count":            "How many members does this loyalty program have?",
    "point_value_cents":           "What is the value of one point in cents?",
    "minimum_redemption":          "What is the minimum redemption threshold?",
    "blackout_dates":              "Are there blackout dates for redemptions?",
    "transfer_options":            "Can points be transferred to other programs?",
    "non_transactional_earn":      "Can members earn points without making a purchase?",
    "notable_unstructured_details":"What are some notable standout features of this program?",
    "closest_competitors":         "Who are the closest competitors to this program?",
    "app_store_rating":            "What is the App Store rating of the program's app?",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _fetch_program_data(program_id: str) -> dict[str, Any]:
    """Load extracted fields and narrative from the DB."""
    from backend.db import AsyncSessionLocal
    from backend.models import ExtractedField, Narrative, Source
    from sqlalchemy import select

    pid = uuid.UUID(program_id)
    async with AsyncSessionLocal() as session:
        fields_res = await session.execute(
            select(ExtractedField).where(
                ExtractedField.program_id == pid,
                ExtractedField.gate_passed == True,   # noqa: E712
                ExtractedField.is_null == False,       # noqa: E712
            )
        )
        fields = ExtractedField.get_latest_only(fields_res.scalars().all())

        nar_res = await session.execute(
            select(Narrative).where(Narrative.program_id == pid)
            .order_by(Narrative.created_at.desc())
        )
        narrative = nar_res.scalars().first()

    return {"fields": fields, "narrative": narrative}


def _build_golden_qa(data: dict[str, Any], max_pairs: int = 10) -> list[dict[str, str]]:
    """Auto-generate up to max_pairs QA pairs from gate-passed fields."""
    field_map = {f.field_name: f for f in data["fields"]}
    pairs = []
    for field_name, question in FIELD_QUESTION_TEMPLATES.items():
        if field_name in field_map:
            value = str(field_map[field_name].field_value or "").strip()
            if value:
                pairs.append({"question": question, "ground_truth": value})
        if len(pairs) >= max_pairs:
            break
    return pairs


def _retrieve_context(program_id: str, question: str) -> list[str]:
    """Qdrant dense search for the question — returns top 5 text chunks."""
    try:
        from backend.qdrant_client import get_qdrant_client
        from backend.embeddings import embed_texts
        from qdrant_client.http import models

        vec = embed_texts([question])[0]
        client = get_qdrant_client()
        filt = models.Filter(must=[
            models.FieldCondition(key="program_id", match=models.MatchValue(value=program_id))
        ])
        resp = client.query_points(
            collection_name="sources",
            query=vec,
            query_filter=filt,
            limit=5,
        )
        return [hit.payload.get("text", "") for hit in resp.points]
    except Exception as exc:
        log.warning("ragas_retrieval_failed", error=str(exc))
        return []


def _call_llm(question: str, context_chunks: list[str]) -> str:
    """Call the project's LLM backend and return an answer."""
    try:
        from backend.extractor import _make_client
        client, model_name = _make_client()
        ctx = "\n\n".join(context_chunks) if context_chunks else "No context available."
        kwargs: dict = {
            "messages": [
                {"role": "system", "content": (
                    "You are an expert loyalty program analyst. "
                    "Answer the question using ONLY the context below.\n\n"
                    f"=== CONTEXT ===\n{ctx}\n"
                )},
                {"role": "user", "content": question},
            ],
            "temperature": 0.0,
        }
        if model_name and not model_name.startswith("gemini"):
            kwargs["model"] = model_name
        res = client.client.chat.completions.create(**kwargs)
        return res.choices[0].message.content.strip()
    except Exception as exc:
        log.warning("ragas_llm_call_failed", error=str(exc))
        return ""


def _build_ragas_llm():
    """Return (llm, embeddings) for RAGAS judging, preferring Gemini over OpenAI."""
    gemini_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
            llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=gemini_key)
            emb = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=gemini_key)
            return llm, emb
        except ImportError:
            pass

    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            from langchain_openai import ChatOpenAI, OpenAIEmbeddings
            llm = ChatOpenAI(model="gpt-4o-mini", api_key=openai_key)
            emb = OpenAIEmbeddings(api_key=openai_key)
            return llm, emb
        except ImportError:
            pass

    return None, None


# ---------------------------------------------------------------------------
# Main evaluation runner
# ---------------------------------------------------------------------------

async def run_ragas_eval(program_id: str) -> dict[str, float] | None:
    """Execute RAGAS evaluation for the given program ID.

    Returns metric_name → score dict, or None on failure.
    """
    if not RAGAS_AVAILABLE:
        print("RAGAS not installed. Run: pip install ragas datasets langchain-google-genai")
        return None

    print(f"\n{'='*60}")
    print(f"InfoVac RAGAS Evaluation  |  Program: {program_id}")
    print(f"{'='*60}")

    data = await _fetch_program_data(program_id)
    qa_pairs = _build_golden_qa(data)
    if not qa_pairs:
        print("No gate-passed fields found — cannot build QA set.")
        return None

    print(f"Golden QA set: {len(qa_pairs)} question(s)\n")

    samples = []
    for i, qa in enumerate(qa_pairs, 1):
        q, gt = qa["question"], qa["ground_truth"]
        ctx = _retrieve_context(program_id, q)
        ans = _call_llm(q, ctx)
        print(f"  Q{i}: {q[:65]}…")
        print(f"   A: {ans[:100]}…\n")
        samples.append(SingleTurnSample(
            user_input=q,
            retrieved_contexts=ctx,
            response=ans,
            reference=gt,
        ))

    dataset = EvaluationDataset(samples=samples)

    ragas_llm, ragas_emb = _build_ragas_llm()
    if ragas_llm is None:
        print("No RAGAS judge LLM available. Set GOOGLE_API_KEY or OPENAI_API_KEY.")
        return None

    print("Running RAGAS metrics (may take ~1 min)…\n")
    try:
        result = evaluate(
            dataset=dataset,
            metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
            llm=ragas_llm,
            embeddings=ragas_emb,
        )
    except Exception as exc:
        print(f"RAGAS evaluation failed: {exc}")
        return None

    scores: dict[str, float] = result.to_pandas().mean(numeric_only=True).to_dict()

    print("=" * 60)
    print("Results:")
    print("-" * 40)
    for metric, score in sorted(scores.items()):
        flag = "✅" if score >= 0.70 else ("⚠️ " if score >= 0.50 else "❌")
        print(f"  {flag}  {metric:<35} {score:.3f}")
    print("=" * 60)
    print("Thresholds: ✅ ≥0.70  ⚠️ 0.50–0.69  ❌ <0.50\n")

    return scores


# ---------------------------------------------------------------------------
# pytest entry point
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.skipif(not RAGAS_AVAILABLE, reason="ragas package not installed")
async def test_ragas_faithfulness_and_relevancy():
    """
    RAGAS evaluation against a completed InfoVac program.

    Prerequisites:
      - A completed program in the DB (set PROGRAM_ID env var)
      - Qdrant running with embeddings for that program
      - GOOGLE_API_KEY or OPENAI_API_KEY set for the RAGAS judge LLM
    """
    program_id = os.getenv("PROGRAM_ID")
    if not program_id:
        pytest.skip(
            "Set PROGRAM_ID=<uuid> env var to a completed program to run RAGAS eval."
        )

    scores = await run_ragas_eval(program_id)
    assert scores is not None, "RAGAS returned no scores — check logs."

    # Hard floor: faithfulness must be >=0.50 (RAG must not hallucinate)
    assert scores.get("faithfulness", 0.0) >= 0.50, (
        f"Faithfulness {scores['faithfulness']:.3f} below minimum 0.50 — "
        "the pipeline is hallucinating. Check extractor prompts and gate thresholds."
    )

    # Soft check: log warnings for low scores
    for metric, score in scores.items():
        if score < 0.60:
            print(f"WARNING: {metric} score {score:.3f} is below recommended 0.60")


# ---------------------------------------------------------------------------
# Standalone CLI runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="InfoVac RAGAS Evaluation")
    parser.add_argument("--program-id", required=True, help="UUID of a completed program")
    args = parser.parse_args()

    result = asyncio.run(run_ragas_eval(args.program_id))
    if result is None:
        sys.exit(1)
