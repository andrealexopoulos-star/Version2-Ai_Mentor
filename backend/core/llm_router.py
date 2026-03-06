"""
BIQc LLM Router — Single provider routing layer for ALL AI calls.
Direct OpenAI by default. No emergentintegrations dependency.

Route table:
  soundboard_strategy → openai/gpt-4o (primary), timeout 60s
  voice_realtime      → openai/realtime, timeout 30s
  embedding           → openai/text-embedding-3-small, timeout 30s
  file_generation     → openai/gpt-4o, timeout 60s
  title_generation    → openai/gpt-4o-mini, timeout 15s
  relevance_scoring   → openai/gpt-4o-mini, timeout 30s

No parallel fan-out. Single-primary per route. Fallback is None unless explicitly configured.
"""
import os
import logging
import httpx

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# ═══ ROUTE TABLE (P2: deterministic per-task routing) ═══
ROUTE_TABLE = {
    "soundboard_strategy": {"provider": "openai", "model": "gpt-4o", "timeout": 60, "fallback": None, "max_tokens": 1500, "temperature": 0.7},
    "voice_realtime":      {"provider": "openai", "model": "gpt-4o-realtime-preview-2024-12-17", "timeout": 30, "fallback": None},
    "embedding":           {"provider": "openai", "model": "text-embedding-3-small", "timeout": 30, "fallback": None},
    "file_generation":     {"provider": "openai", "model": "gpt-4o", "timeout": 60, "fallback": None, "max_tokens": 4000, "temperature": 0.5},
    "title_generation":    {"provider": "openai", "model": "gpt-4o-mini", "timeout": 15, "fallback": None, "max_tokens": 30, "temperature": 0.3},
    "relevance_scoring":   {"provider": "openai", "model": "gpt-4o-mini", "timeout": 30, "fallback": None, "max_tokens": 200, "temperature": 0.0},
    "calibration":         {"provider": "openai", "model": "gpt-4o", "timeout": 60, "fallback": None, "max_tokens": 2000, "temperature": 0.5},
    "email_analysis":      {"provider": "openai", "model": "gpt-4o", "timeout": 45, "fallback": None, "max_tokens": 1500, "temperature": 0.3},
    "boardroom":           {"provider": "openai", "model": "gpt-4o", "timeout": 60, "fallback": None, "max_tokens": 2000, "temperature": 0.7},
    "default":             {"provider": "openai", "model": "gpt-4o", "timeout": 60, "fallback": None, "max_tokens": 1500, "temperature": 0.7},
}


def _get_route(route_name: str = None) -> dict:
    """Resolve route config. Falls back to 'default' if route not found."""
    return ROUTE_TABLE.get(route_name, ROUTE_TABLE["default"])


async def llm_chat(
    system_message: str,
    user_message: str,
    messages: list = None,
    model: str = None,
    temperature: float = None,
    max_tokens: int = None,
    api_key: str = None,
    route: str = None,
) -> str:
    """
    Single entry point for all LLM chat completions.
    If `route` is specified, uses the route table config.
    Otherwise uses explicit params or defaults.
    """
    key = api_key or OPENAI_API_KEY
    if not key:
        raise ValueError("OPENAI_API_KEY not configured")

    cfg = _get_route(route)
    model = model or cfg["model"]
    temperature = temperature if temperature is not None else cfg.get("temperature", 0.7)
    max_tokens = max_tokens or cfg.get("max_tokens", 1500)
    timeout = cfg.get("timeout", 60)

    formatted = [{"role": "system", "content": system_message}]
    for msg in (messages or []):
        role = msg.get("role", "user")
        content = msg.get("content", msg.get("text", ""))
        if content:
            formatted.append({"role": role, "content": content})
    formatted.append({"role": "user", "content": user_message})

    async with httpx.AsyncClient(timeout=float(timeout)) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "messages": formatted, "temperature": temperature, "max_tokens": max_tokens},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def llm_embed(text: str, model: str = None, api_key: str = None) -> list:
    """Generate embedding vector."""
    key = api_key or OPENAI_API_KEY
    if not key:
        raise ValueError("OPENAI_API_KEY not configured")

    cfg = _get_route("embedding")
    model = model or cfg["model"]

    async with httpx.AsyncClient(timeout=float(cfg["timeout"])) as client:
        resp = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "input": text},
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]


async def llm_realtime_session(voice: str = "verse", model: str = None, instructions: str = "", api_key: str = None) -> dict:
    """Create OpenAI Realtime API session for voice chat."""
    key = api_key or OPENAI_API_KEY
    cfg = _get_route("voice_realtime")
    model = model or cfg["model"]

    payload = {"model": model, "voice": voice}
    if instructions:
        payload["instructions"] = instructions

    async with httpx.AsyncClient(timeout=float(cfg["timeout"])) as client:
        resp = await client.post(
            "https://api.openai.com/v1/realtime/sessions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


async def llm_realtime_negotiate(sdp_offer: str, api_key: str = None) -> str:
    """Negotiate WebRTC connection."""
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
    """Return route table + provider state for health checks."""
    return {
        "provider": "openai_direct",
        "api_key_set": bool(OPENAI_API_KEY),
        "routes": {name: {"model": cfg["model"], "timeout": cfg["timeout"], "fallback": cfg.get("fallback")} for name, cfg in ROUTE_TABLE.items()},
    }
