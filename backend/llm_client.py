"""LLM Fallback Client.

Robust LLM client that provides automatic routing and failover across multiple
available providers (Gemini, Ollama, Groq, Anthropic, OpenAI) for structured extraction.
"""
from __future__ import annotations

import os
from typing import Any, Optional
import instructor
import structlog

log = structlog.get_logger(__name__)

from backend.key_broker import APIKeyBroker
from backend.embeddings import _get_gemini_keys

# Instantiate global brokers
gemini_keys = _get_gemini_keys()
gemini_broker = APIKeyBroker(gemini_keys, rate_limit_window=0.6)

groq_key = os.environ.get("GROQ_API_KEY", "")
groq_keys = [groq_key] if groq_key else []
groq_broker = APIKeyBroker(groq_keys, rate_limit_window=0.6)

def _get_available_backends() -> list[dict[str, Any]]:
    """Return a list of available LLM configurations based on environment keys.
    
    Priority order:
    1. Gemini (primary — rotating key broker)
    2. Ollama cloud
    3. Groq (fast free-tier fallback broker)
    4. Anthropic Claude
    5. OpenAI
    """
    backends = []
    ollama_key = os.environ.get("OLLAMA_API_KEY", "")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "") or os.environ.get("CLAUDE_API_KEY", "")
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    groq_key = os.environ.get("GROQ_API_KEY", "")
    groq_model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    # 1. Gemini broker (primary)
    if gemini_keys:
        from openai import OpenAI
        backends.append({
            "provider": "gemini-broker",
            "model": "gemini-2.5-flash",
            "client": lambda: instructor.from_openai(
                OpenAI(
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                    api_key=gemini_broker.get_key(),
                    timeout=60.0,
                ),
                mode=instructor.Mode.JSON,
            )
        })

    # 2. Ollama cloud
    if ollama_key:
        from openai import OpenAI
        backends.append({
            "provider": "ollama-cloud",
            "model": "gemma4:31b-cloud",
            "client": lambda: instructor.from_openai(
                OpenAI(
                    base_url="https://ollama.com/v1",
                    api_key=ollama_key,
                    timeout=60.0,
                ),
                mode=instructor.Mode.JSON,
            )
        })

    # 3. Groq broker (fallback)
    if groq_key:
        from openai import OpenAI
        backends.append({
            "provider": "groq-broker",
            "model": groq_model,
            "client": lambda: instructor.from_openai(
                OpenAI(
                    base_url="https://api.groq.com/openai/v1",
                    api_key=groq_broker.get_key(),
                    timeout=60.0,
                ),
                mode=instructor.Mode.JSON,
            )
        })

    # 4. Anthropic Claude
    if anthropic_key and not anthropic_key.startswith("sk-ant-YOUR_KEY_HERE"):
        import anthropic
        backends.append({
            "provider": "anthropic",
            "model": "claude-3-5-haiku-20241022",
            "client": lambda: instructor.from_anthropic(
                anthropic.Anthropic(api_key=anthropic_key, timeout=60.0)
            )
        })

    # 5. OpenAI
    if openai_key:
        from openai import OpenAI
        backends.append({
            "provider": "openai",
            "model": "gpt-4o-mini",
            "client": lambda: instructor.from_openai(
                OpenAI(api_key=openai_key, timeout=60.0),
                mode=instructor.Mode.JSON,
            )
        })

    if not backends:
        raise ValueError(
            "No LLM key found. Please set GEMINI_API_KEY, GROQ_API_KEY, "
            "ANTHROPIC_API_KEY, or OPENAI_API_KEY in .env"
        )

    return backends


class FallbackCompletions:
    def __init__(self, make_backends_fn):
        self.make_backends_fn = make_backends_fn

    def create(self, **kwargs):
        backends = self.make_backends_fn()
        if not backends:
            raise ValueError("No LLM key found.")
        
        last_exc = None
        for backend in backends:
            provider = backend["provider"]
            # Determine maximum attempts based on how many keys are in the broker
            max_attempts = 1
            if provider == "gemini-broker":
                max_attempts = len(gemini_keys)
            elif provider == "groq-broker":
                max_attempts = len(groq_keys)

            for attempt in range(max_attempts):
                try:
                    client = backend["client"]()
                    model_name = backend["model"]
                    
                    current_kwargs = dict(kwargs)
                    current_kwargs["model"] = model_name
                    
                    if "response_model" in current_kwargs:
                        if hasattr(client, "chat") and hasattr(client.chat, "completions"):
                            return client.chat.completions.create(**current_kwargs)
                        elif hasattr(client, "completions"):
                            return client.completions.create(**current_kwargs)
                        else:
                            return client.client.chat.completions.create(**current_kwargs)
                    else:
                        raw_client = getattr(client, "client", client)
                        if hasattr(raw_client, "chat") and hasattr(raw_client.chat, "completions"):
                            return raw_client.chat.completions.create(**current_kwargs)
                        elif hasattr(raw_client, "completions"):
                            return raw_client.completions.create(**current_kwargs)
                        else:
                            return raw_client.chat.completions.create(**current_kwargs)
                except Exception as exc:
                    log.warning(
                        "llm_routing_failover", 
                        provider=provider, 
                        model=backend["model"], 
                        attempt=attempt + 1,
                        max_attempts=max_attempts,
                        error=str(exc)
                    )
                    last_exc = exc
                    
                    # Identify if failure was due to rate-limiting / quota
                    is_quota = False
                    exc_str = str(exc).lower()
                    if "429" in exc_str or "quota" in exc_str or "rate limit" in exc_str or "limit exceeded" in exc_str:
                        is_quota = True

                    # Catch transient network/timeout/gateway errors as well to trigger key rotation
                    is_transient = False
                    if any(x in exc_str for x in ["timeout", "timed out", "connection", "connect", "500", "502", "503", "504", "gateway", "service unavailable"]):
                        is_transient = True

                    # Report failure to appropriate key broker
                    if provider == "gemini-broker":
                        gemini_broker.report_last_key_failure(is_quota_exhausted=is_quota)
                    elif provider == "groq-broker":
                        groq_broker.report_last_key_failure(is_quota_exhausted=is_quota)
                    
                    # If it's neither a rate-limit/quota issue nor a transient error, try next provider directly
                    if not (is_quota or is_transient):
                        break
        if last_exc:
            raise last_exc
        raise ValueError("All LLM backends in the failover chain failed.")


class FallbackChat:
    def __init__(self, make_backends_fn):
        self.completions = FallbackCompletions(make_backends_fn)


class FallbackClient:
    def __init__(self, make_backends_fn):
        self.chat = FallbackChat(make_backends_fn)
        self.client = self


def _make_client() -> tuple[Any, str]:
    """Compatibility helper. Returns a routing fallback client that transparently fails-over between backends."""
    backends = _get_available_backends()
    if not backends:
        raise ValueError("No LLM key found.")
    return FallbackClient(_get_available_backends), "fallback-chain"
