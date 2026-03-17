"""BIQc LLM Router — direct multi-provider routing + Trinity orchestration."""
import asyncio
import os
import logging
import httpx

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

OPENAI_MODEL_NORMAL = os.environ.get("OPENAI_MODEL_NORMAL", "gpt-5.3")
OPENAI_MODEL_DEEP = os.environ.get("OPENAI_MODEL_DEEP", "gpt-5.4")
GEMINI_MODEL_PRO = os.environ.get("GEMINI_MODEL_PRO", "gemini-3-pro-preview")
ANTHROPIC_MODEL_OPUS = os.environ.get("ANTHROPIC_MODEL_OPUS", "claude-opus-4-6")
ANTHROPIC_MODEL_SONNET = os.environ.get("ANTHROPIC_MODEL_SONNET", "claude-sonnet-4-6")

ROUTE_TABLE = {
    "soundboard_strategy": {"provider": "openai", "model": OPENAI_MODEL_DEEP, "timeout": 60, "max_tokens": 1700, "temperature": 0.6},
    "voice_realtime":      {"provider": "openai", "model": "gpt-4o-realtime-preview-2024-12-17", "timeout": 30},
    "embedding":           {"provider": "openai", "model": "text-embedding-3-small", "timeout": 30},
    "file_generation":     {"provider": "openai", "model": OPENAI_MODEL_DEEP, "timeout": 70, "max_tokens": 4000, "temperature": 0.4},
    "title_generation":    {"provider": "openai", "model": OPENAI_MODEL_NORMAL, "timeout": 18, "max_tokens": 40, "temperature": 0.3},
    "relevance_scoring":   {"provider": "openai", "model": OPENAI_MODEL_NORMAL, "timeout": 30, "max_tokens": 240, "temperature": 0.0},
    "calibration":         {"provider": "openai", "model": OPENAI_MODEL_DEEP, "timeout": 70, "max_tokens": 2200, "temperature": 0.5},
    "email_analysis":      {"provider": "openai", "model": OPENAI_MODEL_DEEP, "timeout": 60, "max_tokens": 1600, "temperature": 0.3},
    "boardroom":           {"provider": "anthropic", "model": ANTHROPIC_MODEL_OPUS, "timeout": 75, "max_tokens": 2500, "temperature": 0.5},
    "default":             {"provider": "openai", "model": OPENAI_MODEL_NORMAL, "timeout": 60, "max_tokens": 1700, "temperature": 0.6},
}


def _get_route(route_name: str = None) -> dict:
    return ROUTE_TABLE.get(route_name, ROUTE_TABLE["default"])


def _provider_for_model(model: str) -> str:
    m = str(model or "").lower()
    if m.startswith("claude"):
        return "anthropic"
    if m.startswith("gemini"):
        return "google"
    return "openai"


def _compose_prompt(system_message: str, user_message: str, messages: list | None = None) -> str:
    lines = [f"SYSTEM:\n{system_message.strip()}\n"]
    for msg in (messages or []):
        role = (msg.get("role") or "user").upper()
        content = msg.get("content", msg.get("text", ""))
        if content:
            lines.append(f"{role}:\n{content}\n")
    lines.append(f"USER:\n{user_message.strip()}")
    return "\n".join(lines)


async def _openai_chat(*, model: str, system_message: str, user_message: str, messages: list | None, temperature: float, max_tokens: int, timeout: float, api_key: str) -> tuple[str, dict]:
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
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": formatted, "temperature": temperature, "max_tokens": max_tokens},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"], data.get("usage", {})


async def _gemini_chat(*, model: str, system_message: str, user_message: str, messages: list | None, temperature: float, max_tokens: int, timeout: float, api_key: str) -> str:
    model_id = str(model or GEMINI_MODEL_PRO)
    if model_id.startswith("models/"):
        model_id = model_id.split("/", 1)[1]
    prompt = _compose_prompt(system_message, user_message, messages)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": float(temperature), "maxOutputTokens": int(max_tokens)},
    }
    async with httpx.AsyncClient(timeout=float(timeout)) as client:
        resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        resp.raise_for_status()
        data = resp.json()
        return (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [{}])[0].get("text", "")


async def _anthropic_chat(*, model: str, system_message: str, user_message: str, messages: list | None, temperature: float, max_tokens: int, timeout: float, api_key: str) -> str:
    conversation = []
    for msg in (messages or []):
        role = msg.get("role", "user")
        if role not in {"user", "assistant"}:
            role = "user"
        content = msg.get("content", msg.get("text", ""))
        if content:
            conversation.append({"role": role, "content": content})
    conversation.append({"role": "user", "content": user_message})

    payload = {
        "model": model,
        "max_tokens": int(max_tokens),
        "temperature": float(temperature),
        "system": system_message,
        "messages": conversation,
    }
    async with httpx.AsyncClient(timeout=float(timeout)) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data.get("content") or []
        if content and isinstance(content[0], dict):
            return content[0].get("text", "")
        return ""


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
    cfg = _get_route(route)
    model = model or cfg["model"]
    temperature = temperature if temperature is not None else cfg.get("temperature", 0.6)
    max_tokens = max_tokens or cfg.get("max_tokens", 1700)
    timeout = cfg.get("timeout", 60)
    provider = cfg.get("provider") or _provider_for_model(model)

    if provider == "anthropic" or _provider_for_model(model) == "anthropic":
        key = os.environ.get("ANTHROPIC_API_KEY") or ANTHROPIC_API_KEY
        if not key:
            logger.warning("ANTHROPIC_API_KEY missing; falling back to OpenAI for llm_chat")
        else:
            return await _anthropic_chat(
                model=model,
                system_message=system_message,
                user_message=user_message,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
                api_key=key,
            )

    if provider == "google" or _provider_for_model(model) == "google":
        key = os.environ.get("GOOGLE_API_KEY") or GOOGLE_API_KEY
        if not key:
            logger.warning("GOOGLE_API_KEY missing; falling back to OpenAI for llm_chat")
        else:
            return await _gemini_chat(
                model=model,
                system_message=system_message,
                user_message=user_message,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
                api_key=key,
            )

    key = api_key or os.environ.get("OPENAI_API_KEY") or OPENAI_API_KEY
    if not key:
        raise ValueError("OPENAI_API_KEY not configured")
    content, _usage = await _openai_chat(
        model=model,
        system_message=system_message,
        user_message=user_message,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
        api_key=key,
    )
    return content


async def llm_trinity_chat(
    system_message: str,
    user_message: str,
    messages: list = None,
    temperature: float = 0.45,
    max_tokens: int = 1800,
    timeout: float = 75,
) -> str:
    """Parallel OpenAI + Gemini + Anthropic analysis with synthesis."""
    tasks = []
    labels = []

    if OPENAI_API_KEY:
        labels.append("openai")
        tasks.append(_openai_chat(
            model=OPENAI_MODEL_DEEP,
            system_message=system_message,
            user_message=user_message,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            api_key=OPENAI_API_KEY,
        ))
    if GOOGLE_API_KEY:
        labels.append("google")
        tasks.append(_gemini_chat(
            model=GEMINI_MODEL_PRO,
            system_message=system_message,
            user_message=user_message,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            api_key=GOOGLE_API_KEY,
        ))
    if ANTHROPIC_API_KEY:
        labels.append("anthropic")
        tasks.append(_anthropic_chat(
            model=ANTHROPIC_MODEL_OPUS,
            system_message=system_message,
            user_message=user_message,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            api_key=ANTHROPIC_API_KEY,
        ))

    if not tasks:
        raise ValueError("No LLM provider keys configured for Trinity")

    raw_results = await asyncio.gather(*tasks, return_exceptions=True)
    candidates = []
    for label, result in zip(labels, raw_results):
        if isinstance(result, Exception):
            logger.warning(f"[Trinity] {label} candidate failed: {result}")
            continue
        text = result[0] if label == "openai" and isinstance(result, tuple) else result
        if text:
            candidates.append((label, str(text).strip()))

    if not candidates:
        raise RuntimeError("Trinity failed across all providers")
    if len(candidates) == 1:
        return candidates[0][1]

    synthesis_system = (
        "You are BIQc Trinity Fusion. Merge candidate analyses into one executive-grade response. "
        "Include: 1) core diagnosis 2) why now 3) immediate actions with owners/deadlines 4) if ignored. "
        "Do not mention model names or provider details."
    )
    synthesis_user = "\n\n".join([f"[{label}]\n{text[:2600]}" for label, text in candidates])

    if OPENAI_API_KEY:
        fused, _ = await _openai_chat(
            model=OPENAI_MODEL_NORMAL,
            system_message=synthesis_system,
            user_message=synthesis_user,
            messages=None,
            temperature=0.35,
            max_tokens=max_tokens,
            timeout=timeout,
            api_key=OPENAI_API_KEY,
        )
        return fused

    if ANTHROPIC_API_KEY:
        return await _anthropic_chat(
            model=ANTHROPIC_MODEL_SONNET,
            system_message=synthesis_system,
            user_message=synthesis_user,
            messages=None,
            temperature=0.35,
            max_tokens=max_tokens,
            timeout=timeout,
            api_key=ANTHROPIC_API_KEY,
        )

    return await _gemini_chat(
        model=GEMINI_MODEL_PRO,
        system_message=synthesis_system,
        user_message=synthesis_user,
        messages=None,
        temperature=0.35,
        max_tokens=max_tokens,
        timeout=timeout,
        api_key=GOOGLE_API_KEY,
    )


async def llm_chat_with_usage(
    system_message: str,
    user_message: str,
    messages: list = None,
    model: str = None,
    temperature: float = None,
    max_tokens: int = None,
    api_key: str = None,
    route: str = None,
) -> tuple:
    cfg = _get_route(route)
    model = model or cfg["model"]
    temperature = temperature if temperature is not None else cfg.get("temperature", 0.6)
    max_tokens = max_tokens or cfg.get("max_tokens", 1700)
    timeout = cfg.get("timeout", 60)

    provider = _provider_for_model(model)
    if provider == "openai":
        key = api_key or OPENAI_API_KEY
        if not key:
            raise ValueError("OPENAI_API_KEY not configured")
        content, usage = await _openai_chat(
            model=model,
            system_message=system_message,
            user_message=user_message,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            api_key=key,
        )
        return content, usage

    content = await llm_chat(
        system_message=system_message,
        user_message=user_message,
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        api_key=api_key,
        route=route,
    )
    return content, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}


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
        "providers": {
            "openai": bool(OPENAI_API_KEY),
            "google": bool(GOOGLE_API_KEY),
            "anthropic": bool(ANTHROPIC_API_KEY),
        },
        "routes": {name: {"model": cfg["model"], "timeout": cfg["timeout"]} for name, cfg in ROUTE_TABLE.items()},
    }
