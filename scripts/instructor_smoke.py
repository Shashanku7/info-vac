"""Instructor + Gemini smoke test — Phase 0.

Demonstrates that:
  1. Instructor wraps the Google Gemini client correctly.
  2. A structured Pydantic model is returned, not raw text.
  3. The GOOGLE_API_KEY in .env is valid and working.

Usage:
    python scripts/instructor_smoke.py

Expected output (example):
    Parsed result: name='Starbucks Rewards'
    Type: <class '__main__.ProgramName'>
    ✓ Instructor+Gemini returned a valid Pydantic model.

Note: instructor 1.15.x still uses the google-generativeai GenerativeModel API
internally. The google.generativeai FutureWarning is suppressed — the package
still works; we will migrate to google-genai in Phase 1.
"""
import os
import sys
import warnings

# Suppress the google-generativeai deprecation warning — the package still works
# and instructor 1.15.x hasn't dropped it yet. We'll migrate in Phase 1.
warnings.filterwarnings("ignore", category=FutureWarning, module="google")

# Allow running from project root without installing as a package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import instructor
from instructor import Mode
import google.generativeai as genai
from pydantic import BaseModel


class ProgramName(BaseModel):
    """Single-field model — simplest possible extraction target."""
    name: str


def run_smoke_test() -> ProgramName:
    api_key = os.getenv("GOOGLE_API_KEY", "")
    if not api_key or "YOUR_KEY" in api_key:
        raise EnvironmentError(
            "GOOGLE_API_KEY is not set or is still the placeholder value. "
            "Get a free key at https://ai.google.dev and put it in .env."
        )

    genai.configure(api_key=api_key)

    # instructor.from_gemini requires a GenerativeModel instance (not the new genai.Client)
    # gemini-2.5-flash confirmed available on this key via list_models()
    client = instructor.from_gemini(
        client=genai.GenerativeModel(model_name="gemini-2.5-flash"),
        mode=Mode.GEMINI_JSON,
    )

    result: ProgramName = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": (
                    "Extract the loyalty program name from this text: "
                    "'Starbucks Rewards is a loyalty program by Starbucks.' "
                    "Return only the program name."
                ),
            }
        ],
        response_model=ProgramName,
    )
    return result


if __name__ == "__main__":
    result = run_smoke_test()
    print(f"Parsed result: name='{result.name}'")
    print(f"Type: {type(result)}")
    assert isinstance(result, ProgramName), "Expected a ProgramName instance"
    print("✓ Instructor+Gemini returned a valid Pydantic model.")
