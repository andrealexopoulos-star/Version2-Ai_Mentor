"""
BIQc LLM Router — Single provider routing layer for ALL AI calls.
Replaces emergentintegrations dependency entirely for AI inference.

Default provider: openai_direct (no emergentintegrations dependency)
Supported providers: openai, claude, perplexity, gemini (future)

ENV:
  LLM_PROVIDER=openai (default)
  OPENAI_API_KEY=sk-...

Usage:
  from core.llm_router import llm_chat, llm_embed, get_router_config
  response = await llm_chat(system_message=..., user_message=..., model="gpt-4o")
  embedding = await llm_embed(text=..., model="text-embedding-3-small")
"""
import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openai")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


async def llm_chat(
    system_message: str,
    user_message: str,
    messages: list = None,
    model: str = "gpt-4o",
    temperature: float = 0.7,
    max_tokens: int = 1500,
    api_key: str = None,
) -> str:
    """
    Single entry point for all LLM chat completions.
    Returns assistant response as string.
    """
    key = api_key or OPENAI_API_KEY
    if not key:
        raise ValueError("OPENAI_API_KEY not configured")

    formatted = [{"role": "system", "content": system_message}]
    for msg in (messages or []):
        role = msg.get("role", "user")
        content = msg.get("content", msg.get("text", ""))
        if content:
            formatted.append({"role": role, "content": content})
    formatted.append({"role": "user", "content": user_message})

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "messages": formatted, "temperature": temperature, "max_tokens": max_tokens},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def llm_embed(text: str, model: str = "text-embedding-3-small", api_key: str = None) -> list:
    """Generate embedding vector. Returns list of floats."""
    key = api_key or OPENAI_API_KEY
    if not key:
        raise ValueError("OPENAI_API_KEY not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "input": text},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["data"][0]["embedding"]


async def llm_realtime_session(voice: str = "verse", model: str = "gpt-4o-realtime-preview-2024-12-17",
                                instructions: str = "", api_key: str = None) -> dict:
    """Create OpenAI Realtime API session for voice chat."""
    key = api_key or OPENAI_API_KEY
    if not key:
        raise ValueError("OPENAI_API_KEY not configured")

    payload = {"model": model, "voice": voice}
    if instructions:
        payload["instructions"] = instructions

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/realtime/sessions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


async def llm_realtime_negotiate(sdp_offer: str, api_key: str = None) -> str:
    """Negotiate WebRTC connection with OpenAI Realtime API."""
    key = api_key or OPENAI_API_KEY
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/realtime",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/sdp"},
            content=sdp_offer,
        )
        resp.raise_for_status()
        return resp.text


def get_router_config() -> dict:
    """Return current router configuration for health checks."""
    return {
        "provider": LLM_PROVIDER,
        "model_default": "gpt-4o",
        "embed_model": "text-embedding-3-small",
        "realtime_model": "gpt-4o-realtime-preview-2024-12-17",
        "api_key_set": bool(OPENAI_API_KEY),
        "routing_table": {
            "soundboard_strategy": {"primary": "openai/gpt-4o", "fallback": None, "timeout": 60},
            "voice_realtime": {"primary": "openai/realtime", "fallback": None, "timeout": 30},
            "embedding": {"primary": "openai/text-embedding-3-small", "fallback": None, "timeout": 30},
            "file_generation": {"primary": "openai/gpt-4o", "fallback": None, "timeout": 60},
            "title_generation": {"primary": "openai/gpt-4o", "fallback": None, "timeout": 15},
        },
    }
