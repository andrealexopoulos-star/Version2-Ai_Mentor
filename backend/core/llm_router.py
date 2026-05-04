"""BIQc LLM Router — direct multi-provider routing + Trinity orchestration."""
from __future__ import annotations  # enables `str | None` etc. on Python 3.9

import asyncio
import contextvars
import os
import logging
import time as _trace_time
import httpx

logger = logging.getLogger(__name__)


# ─── Provider trace bracket (P0 Marjo E2 / 2026-05-04) ───────────────────
# Each provider call below (_openai_chat / _anthropic_chat / _gemini_chat)
# is bracketed with begin_trace + complete_trace so a per-call row lands
# in public.enrichment_traces. Telemetry is fire-and-forget — never breaks
# the call. Resolved scan_id comes from the calibration ContextVar; outside
# the scan path the trace is a no-op. Cites BIQc_PLATFORM_CONTRACT_SECURE
# _NO_SILENT_FAILURE_v2 + zero-401.

async def _trace_llm_begin(provider: str, model: str, system_message: str, user_message: str) -> tuple:
    """Open a trace for an upcoming LLM call. Returns (trace_id, t_start) tuple
    or (None, t_start) if no active scan / tracer unavailable."""
    t0 = _trace_time.perf_counter()
    try:
        from core.enrichment_trace import (
            get_active_scan_id, get_active_user_id, abegin_trace,
        )
        sid = get_active_scan_id()
        if not sid:
            return (None, t0)
        trace_id = await abegin_trace(
            scan_id=sid,
            provider=provider,
            user_id=get_active_user_id(),
            request_summary={
                "model": str(model)[:80],
                "system_chars": len(system_message or ""),
                "user_chars": len(user_message or ""),
            },
        )
        return (trace_id, t0)
    except Exception as exc:
        logger.debug("[LLM Router] _trace_llm_begin failed: %s", exc)
        return (None, t0)


async def _trace_llm_complete(trace_id, t_start, http_status: int, content: str, usage: dict, error: str | None) -> None:
    """Close a trace opened by _trace_llm_begin. Always safe."""
    if not trace_id:
        return
    try:
        from core.enrichment_trace import acomplete_trace
        elapsed_ms = int((_trace_time.perf_counter() - t_start) * 1000)
        await acomplete_trace(
            trace_id,
            http_status=http_status,
            latency_ms=elapsed_ms,
            response_summary={
                "ok": http_status == 200 and not error,
                "completion_chars": len(content or ""),
                "prompt_tokens": (usage or {}).get("prompt_tokens", 0),
                "completion_tokens": (usage or {}).get("completion_tokens", 0),
                "total_tokens": (usage or {}).get("total_tokens", 0),
            },
            error=error,
            sanitiser_applied=True,
        )
    except Exception as exc:
        logger.debug("[LLM Router] _trace_llm_complete failed: %s", exc)

# Token metering — lazy import to avoid circular deps at module load
_token_metering = None
_budget_enforcer = None

# ── llm_global_pause kill-switch (migration 124, Sprint D #28c) ───────────
# When flag is OFF we short-circuit BEFORE hitting a provider. Flag value is
# cached per-request via a ContextVar so a single request never hammers the DB
# on multi-leg calls (e.g. Trinity fans out 3 providers + 1 synthesis). A None
# sentinel means "not yet resolved for this request".
#
# CRITICAL: fail-open. If the flag lookup itself errors (table missing, DB down,
# RPC missing), we proceed with the provider call. A DB hiccup must not cascade
# into a platform-wide LLM outage.
_LLM_PAUSE_LOGGED = False  # warn-once per process when paused
_llm_pause_cache: contextvars.ContextVar[bool | None] = contextvars.ContextVar(
    "llm_pause_cache", default=None
)

LLM_PAUSED_SENTINEL = {
    "content": "[LLM temporarily paused by administrator — cached responses unavailable for this query]",
    "model": "paused",
    "paused": True,
}


def _reset_llm_pause_cache() -> None:
    """Test helper — clear the per-request cache between pytest cases."""
    try:
        _llm_pause_cache.set(None)
    except Exception:
        pass


async def _is_llm_paused(sb) -> bool:
    """Return True when `llm_global_pause` flag is OFF (i.e. LLM calls paused).

    Reads via the SECURITY DEFINER helper `public.is_feature_flag_enabled`
    (migration 124) with default=TRUE → helper returns TRUE when the row is
    missing, which means "LLM enabled", which means we return False (not paused).

    Failure modes (table missing, RPC missing, DB down, network error) all log
    at DEBUG and return False — fail-OPEN so a flag subsystem outage cannot
    knock the entire LLM platform offline.
    """
    cached = _llm_pause_cache.get()
    if cached is not None:
        return cached

    if sb is None:
        _llm_pause_cache.set(False)
        return False

    enabled = True  # default-open
    try:
        result = sb.rpc(
            "is_feature_flag_enabled",
            {"flag": "llm_global_pause", "default_value": True},
        ).execute()
        raw = getattr(result, "data", None)
        # supabase-py returns either a bool directly or a list of dicts for
        # scalar-returning RPCs depending on version. Handle both.
        if isinstance(raw, bool):
            enabled = raw
        elif isinstance(raw, list) and raw:
            first = raw[0]
            if isinstance(first, dict):
                enabled = bool(next(iter(first.values()), True))
            else:
                enabled = bool(first)
        elif isinstance(raw, dict):
            enabled = bool(next(iter(raw.values()), True))
        else:
            enabled = True  # unknown shape → assume enabled
    except Exception as exc:
        logger.debug(
            "[LLM Router] llm_global_pause flag lookup failed (fail-open): %s",
            exc,
        )
        enabled = True

    paused = not enabled
    _llm_pause_cache.set(paused)

    if paused:
        global _LLM_PAUSE_LOGGED
        if not _LLM_PAUSE_LOGGED:
            logger.warning(
                "[LLM Router] llm_global_pause is OFF — returning sentinel for LLM calls"
            )
            _LLM_PAUSE_LOGGED = True
    return paused


async def _check_llm_pause_and_maybe_sentinel() -> dict | None:
    """If paused, return a fresh sentinel dict. Else return None.

    Kept as its own helper so every public entry point can do:
        sentinel = await _check_llm_pause_and_maybe_sentinel()
        if sentinel is not None:
            return sentinel["content"]   # or the shape the caller wants
    """
    try:
        from routes.deps import get_sb
        sb = get_sb()
    except Exception as exc:
        logger.debug("[LLM Router] pause-check skipped (sb unavailable): %s", exc)
        return None

    if await _is_llm_paused(sb):
        # Return a FRESH copy so callers that mutate won't poison the constant.
        return dict(LLM_PAUSED_SENTINEL)
    return None

def _get_metering():
    global _token_metering
    if _token_metering is None:
        try:
            from middleware.token_metering import record_token_usage
            _token_metering = record_token_usage
        except Exception as exc:
            logger.debug("[LLM Router] token_metering not available: %s", exc)
            _token_metering = False  # sentinel: tried and failed
    return _token_metering if _token_metering else None


def _get_budget_enforcer():
    """Lazy-load the free-tier 402 hard-stop (Step 9 / P1-6).

    Kept separate from _get_metering so unit tests can patch one without
    the other, and so a failure to import the enforcer never cascades to
    the recorder (and vice versa).
    """
    global _budget_enforcer
    if _budget_enforcer is None:
        try:
            from middleware.token_metering import enforce_free_tier_budget
            _budget_enforcer = enforce_free_tier_budget
        except Exception as exc:
            logger.debug("[LLM Router] budget enforcer not available: %s", exc)
            _budget_enforcer = False  # sentinel: tried and failed
    return _budget_enforcer if _budget_enforcer else None


async def _check_budget_or_raise(user_id: str | None, tier: str | None):
    """Free-tier hard-stop before any LLM round-trip (Step 9 / P1-6).

    Invoked from the top of every public llm_chat / llm_trinity_chat /
    llm_chat_with_usage call so the 402 fires BEFORE we pay OpenAI /
    Anthropic / Google for a request whose result the user has no quota
    left to receive.

    Propagates HTTPException from enforce_free_tier_budget unchanged so
    the FastAPI handler returns the 402 with the upgrade-CTA payload.
    Anonymous calls and missing enforcer short-circuit. DB/service errors
    inside the enforcer fail open (enforcer handles its own try/except).
    """
    if not user_id:
        return
    enforcer = _get_budget_enforcer()
    if enforcer is None:
        return
    try:
        from routes.deps import get_sb
        sb = get_sb()
    except Exception as exc:
        logger.debug("[LLM Router] budget check skipped (sb unavailable): %s", exc)
        return
    # No try/except around the enforcer — HTTPException MUST propagate.
    enforcer(sb, user_id, tier)


async def _record_usage(
    user_id: str | None,
    model: str,
    input_tokens: int,
    output_tokens: int,
    feature: str = "llm_call",
    tier: str | None = None,
    *,
    cached_input_tokens: int = 0,
    request_id: str | None = None,
    cache_hit: bool | None = None,
    action: str | None = None,
    tier_at_event: str | None = None,
):
    """Fire-and-forget token recording. Never blocks or raises.

    H4: during PR1, LEGACY (ai_usage_log + token_allocations) is SOT.
    usage_ledger is a SHADOW write — consumer migration to the ledger
    happens in PR B4/B5. Divergence (one succeeds, one fails) is logged
    at ERROR so we can observe before PR B4/B5 promotes the ledger.
    """
    if not user_id or (input_tokens <= 0 and output_tokens <= 0):
        return

    try:
        from routes.deps import get_sb
        sb = get_sb()
    except Exception as exc:
        logger.debug("[LLM Router] sb unavailable, skipping usage emit: %s", exc)
        return

    account_id = None
    try:
        row = (
            sb.table("users")
            .select("account_id")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        account_id = (row.data or {}).get("account_id") if row is not None else None
    except Exception as exc:
        logger.debug("[LLM Router] account scope lookup failed for %s: %s", str(user_id)[:8], exc)

    # 1) Legacy metering (SOT during PR1, sync)
    legacy_ok = False
    metering_fn = _get_metering()
    if metering_fn is not None:
        try:
            metering_fn(
                sb,
                user_id,
                model,
                input_tokens,
                output_tokens,
                feature=feature,
                tier=tier,
                account_id=account_id,
            )
            legacy_ok = True
        except Exception as exc:
            logger.debug("[LLM Router] legacy metering failed (non-fatal): %s", exc)

    # 2) New usage_ledger emit (SHADOW during PR1, async fire-and-forget)
    try:
        from core.token_meter import emit_consume
        await emit_consume(
            sb,
            user_id=user_id,
            account_id=account_id,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cached_input_tokens=cached_input_tokens,
            feature=feature,
            action=action,
            tier_at_event=tier_at_event or tier,
            cache_hit=cache_hit,
            request_id=request_id,
        )
    except Exception as exc:
        logger.debug("[LLM Router] usage_ledger emit failed (non-fatal): %s", exc)
        if legacy_ok:
            # H4: observable divergence — legacy succeeded, ledger failed
            logger.error("[LLM Router] SOT divergence: legacy=OK ledger=FAIL user=%s", str(user_id)[:8])

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

    # P0 Marjo E2 / 2026-05-04: per-scan trace.
    trace_id, t_start = await _trace_llm_begin("openai", model, system_message, user_message)
    try:
        async with httpx.AsyncClient(timeout=float(timeout)) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": formatted, "temperature": temperature, "max_tokens": max_tokens},
            )
            http_status = resp.status_code
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            await _trace_llm_complete(trace_id, t_start, http_status, content, usage, None)
            return content, usage
    except httpx.HTTPStatusError as exc:
        await _trace_llm_complete(trace_id, t_start, exc.response.status_code, "", {},
                                  f"PROVIDER_HTTP_{exc.response.status_code} : openai upstream error")
        raise
    except Exception as exc:
        await _trace_llm_complete(trace_id, t_start, 502, "", {},
                                  f"PROVIDER_NETWORK_ERROR : {str(exc)[:200]}")
        raise


async def _gemini_chat(*, model: str, system_message: str, user_message: str, messages: list | None, temperature: float, max_tokens: int, timeout: float, api_key: str) -> tuple[str, dict]:
    model_id = str(model or GEMINI_MODEL_PRO)
    if model_id.startswith("models/"):
        model_id = model_id.split("/", 1)[1]
    prompt = _compose_prompt(system_message, user_message, messages)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": float(temperature), "maxOutputTokens": int(max_tokens)},
    }
    # P0 Marjo E2 / 2026-05-04: per-scan trace.
    trace_id, t_start = await _trace_llm_begin("gemini", model, system_message, user_message)
    try:
        async with httpx.AsyncClient(timeout=float(timeout)) as client:
            resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
            http_status = resp.status_code
            resp.raise_for_status()
            data = resp.json()
            text = (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [{}])[0].get("text", "")
            # Extract usage metadata from Gemini response
            usage_meta = data.get("usageMetadata") or {}
            usage = {
                "prompt_tokens": usage_meta.get("promptTokenCount", 0),
                "completion_tokens": usage_meta.get("candidatesTokenCount", 0),
                "total_tokens": usage_meta.get("totalTokenCount", 0),
            }
            await _trace_llm_complete(trace_id, t_start, http_status, text, usage, None)
            return text, usage
    except httpx.HTTPStatusError as exc:
        await _trace_llm_complete(trace_id, t_start, exc.response.status_code, "", {},
                                  f"PROVIDER_HTTP_{exc.response.status_code} : gemini upstream error")
        raise
    except Exception as exc:
        await _trace_llm_complete(trace_id, t_start, 502, "", {},
                                  f"PROVIDER_NETWORK_ERROR : {str(exc)[:200]}")
        raise


async def _anthropic_chat(*, model: str, system_message: str, user_message: str, messages: list | None, temperature: float, max_tokens: int, timeout: float, api_key: str) -> tuple[str, dict]:
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
    # P0 Marjo E2 / 2026-05-04: per-scan trace.
    trace_id, t_start = await _trace_llm_begin("anthropic", model, system_message, user_message)
    try:
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
            http_status = resp.status_code
            resp.raise_for_status()
            data = resp.json()
            content = data.get("content") or []
            text = ""
            if content and isinstance(content[0], dict):
                text = content[0].get("text", "")
            # Extract usage from Anthropic response
            usage_raw = data.get("usage") or {}
            usage = {
                "prompt_tokens": usage_raw.get("input_tokens", 0),
                "completion_tokens": usage_raw.get("output_tokens", 0),
                "total_tokens": usage_raw.get("input_tokens", 0) + usage_raw.get("output_tokens", 0),
            }
            await _trace_llm_complete(trace_id, t_start, http_status, text, usage, None)
            return text, usage
    except httpx.HTTPStatusError as exc:
        await _trace_llm_complete(trace_id, t_start, exc.response.status_code, "", {},
                                  f"PROVIDER_HTTP_{exc.response.status_code} : anthropic upstream error")
        raise
    except Exception as exc:
        await _trace_llm_complete(trace_id, t_start, 502, "", {},
                                  f"PROVIDER_NETWORK_ERROR : {str(exc)[:200]}")
        raise


async def llm_chat(
    system_message: str,
    user_message: str,
    messages: list = None,
    model: str = None,
    temperature: float = None,
    max_tokens: int = None,
    api_key: str = None,
    route: str = None,
    user_id: str = None,
    tier: str = None,
) -> str:
    # Sprint D #28c — llm_global_pause kill-switch. Fires BEFORE budget + provider
    # so a superadmin pause stops all spend immediately. Fails open on flag errors.
    sentinel = await _check_llm_pause_and_maybe_sentinel()
    if sentinel is not None:
        return sentinel["content"]

    # Step 9 / P1-6 — free-tier 402 hard-stop fires BEFORE the provider call
    # so we don't pay for a response the caller has no quota to receive.
    await _check_budget_or_raise(user_id, tier)

    cfg = _get_route(route)
    model = model or cfg["model"]
    temperature = temperature if temperature is not None else cfg.get("temperature", 0.6)
    max_tokens = max_tokens or cfg.get("max_tokens", 1700)
    timeout = cfg.get("timeout", 60)
    provider = cfg.get("provider") or _provider_for_model(model)
    feature = route or "llm_call"

    if provider == "anthropic" or _provider_for_model(model) == "anthropic":
        key = os.environ.get("ANTHROPIC_API_KEY") or ANTHROPIC_API_KEY
        if not key:
            logger.warning("ANTHROPIC_API_KEY missing; falling back to OpenAI for llm_chat")
        else:
            content, usage = await _anthropic_chat(
                model=model,
                system_message=system_message,
                user_message=user_message,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
                api_key=key,
            )
            await _record_usage(user_id, model, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), feature=feature, tier=tier, action=feature, tier_at_event=tier)
            return content

    if provider == "google" or _provider_for_model(model) == "google":
        key = os.environ.get("GOOGLE_API_KEY") or GOOGLE_API_KEY
        if not key:
            logger.warning("GOOGLE_API_KEY missing; falling back to OpenAI for llm_chat")
        else:
            content, usage = await _gemini_chat(
                model=model,
                system_message=system_message,
                user_message=user_message,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
                api_key=key,
            )
            await _record_usage(user_id, model, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), feature=feature, tier=tier, action=feature, tier_at_event=tier)
            return content

    key = api_key or os.environ.get("OPENAI_API_KEY") or OPENAI_API_KEY
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
    await _record_usage(user_id, model, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), feature=feature, tier=tier, action=feature, tier_at_event=tier)
    return content


async def llm_trinity_chat(
    system_message: str,
    user_message: str,
    messages: list = None,
    temperature: float = 0.45,
    max_tokens: int = 1800,
    timeout: float = 75,
    user_id: str = None,
    tier: str = None,
) -> str:
    """Parallel OpenAI + Gemini + Anthropic analysis with synthesis."""
    # Sprint D #28c — llm_global_pause kill-switch. Trinity is the single most
    # expensive path in the system; pause check short-circuits before we fan
    # out 3 providers + a synthesis leg. Fails open on flag errors.
    sentinel = await _check_llm_pause_and_maybe_sentinel()
    if sentinel is not None:
        return sentinel["content"]

    # Step 9 / P1-6 — Trinity is the most expensive call path (3 providers
    # in parallel + a synthesis pass). If the free-tier enforcer fires
    # anywhere it should fire here first.
    await _check_budget_or_raise(user_id, tier)

    tasks = []
    labels = []
    models_used = []

    if OPENAI_API_KEY:
        labels.append("openai")
        models_used.append(OPENAI_MODEL_DEEP)
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
        models_used.append(GEMINI_MODEL_PRO)
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
        models_used.append(ANTHROPIC_MODEL_OPUS)
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
    for label, model_name, result in zip(labels, models_used, raw_results):
        if isinstance(result, Exception):
            logger.warning(f"[Trinity] {label} candidate failed: {result}")
            continue
        # All providers now return (text, usage) tuples
        if isinstance(result, tuple):
            text, usage = result
            await _record_usage(user_id, model_name, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), feature="trinity_candidate", tier=tier, action="trinity_candidate", tier_at_event=tier)
        else:
            text = result
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

    # 2026-04-22 Andreas directive: Trinity synthesis routes to flagship Opus
    # (most powerful model). Cost tracked via usage_ledger.cost_aud_micros
    # with feature='trinity_synthesis'. Do NOT fallback to Sonnet or any
    # non-flagship model for this leg — Trinity is our premium reasoning feature.
    # Fallbacks to OpenAI/Gemini only engage if ANTHROPIC_API_KEY is absent or
    # the Opus call itself errors at the transport layer (network/5xx) — in
    # that degraded case we prefer a response over a hard failure.
    if ANTHROPIC_API_KEY:
        try:
            content, usage = await _anthropic_chat(
                model=ANTHROPIC_MODEL_OPUS,
                system_message=synthesis_system,
                user_message=synthesis_user,
                messages=None,
                temperature=0.35,
                max_tokens=max_tokens,
                timeout=timeout,
                api_key=ANTHROPIC_API_KEY,
            )
            await _record_usage(user_id, ANTHROPIC_MODEL_OPUS, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), feature="trinity_synthesis", tier=tier, action="trinity_synthesis", tier_at_event=tier)
            return content
        except Exception as exc:
            logger.warning(f"[Trinity] flagship Opus synthesis failed, falling back: {exc}")

    if OPENAI_API_KEY:
        fused, usage = await _openai_chat(
            model=OPENAI_MODEL_DEEP,
            system_message=synthesis_system,
            user_message=synthesis_user,
            messages=None,
            temperature=0.35,
            max_tokens=max_tokens,
            timeout=timeout,
            api_key=OPENAI_API_KEY,
        )
        await _record_usage(user_id, OPENAI_MODEL_DEEP, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), feature="trinity_synthesis", tier=tier, action="trinity_synthesis", tier_at_event=tier)
        return fused

    content, usage = await _gemini_chat(
        model=GEMINI_MODEL_PRO,
        system_message=synthesis_system,
        user_message=synthesis_user,
        messages=None,
        temperature=0.35,
        max_tokens=max_tokens,
        timeout=timeout,
        api_key=GOOGLE_API_KEY,
    )
    await _record_usage(user_id, GEMINI_MODEL_PRO, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), feature="trinity_synthesis", tier=tier, action="trinity_synthesis", tier_at_event=tier)
    return content


async def llm_chat_with_usage(
    system_message: str,
    user_message: str,
    messages: list = None,
    model: str = None,
    temperature: float = None,
    max_tokens: int = None,
    api_key: str = None,
    route: str = None,
    user_id: str = None,
    tier: str = None,
) -> tuple:
    # Sprint D #28c — llm_global_pause kill-switch. llm_chat_with_usage shares
    # the same short-circuit policy as llm_chat. Returns a zero-usage tuple so
    # callers that unpack (content, usage) don't crash. Fails open on flag errors.
    sentinel = await _check_llm_pause_and_maybe_sentinel()
    if sentinel is not None:
        return sentinel["content"], {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    # Step 9 / P1-6 — mirror of the llm_chat guard. llm_chat_with_usage is
    # used by callers that need raw token counts for post-processing (e.g.
    # calibration scoring); same cost-containment applies.
    await _check_budget_or_raise(user_id, tier)

    cfg = _get_route(route)
    model = model or cfg["model"]
    temperature = temperature if temperature is not None else cfg.get("temperature", 0.6)
    max_tokens = max_tokens or cfg.get("max_tokens", 1700)
    timeout = cfg.get("timeout", 60)
    feature = route or "llm_call"

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
        await _record_usage(user_id, model, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), feature=feature, tier=tier, action=feature, tier_at_event=tier)
        return content, usage

    if provider == "anthropic":
        key = api_key or ANTHROPIC_API_KEY
        if key:
            content, usage = await _anthropic_chat(
                model=model,
                system_message=system_message,
                user_message=user_message,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
                api_key=key,
            )
            await _record_usage(user_id, model, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), feature=feature, tier=tier, action=feature, tier_at_event=tier)
            return content, usage

    if provider == "google":
        key = api_key or GOOGLE_API_KEY
        if key:
            content, usage = await _gemini_chat(
                model=model,
                system_message=system_message,
                user_message=user_message,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
                api_key=key,
            )
            await _record_usage(user_id, model, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), feature=feature, tier=tier, action=feature, tier_at_event=tier)
            return content, usage

    # Fallback via llm_chat (metering handled inside llm_chat)
    content = await llm_chat(
        system_message=system_message,
        user_message=user_message,
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        api_key=api_key,
        route=route,
        user_id=user_id,
        tier=tier,
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
