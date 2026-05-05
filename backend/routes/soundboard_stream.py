"""
soundboard_stream.py — Real token-level streaming generators for Ask BIQc.

Per OPS Manual entry 01 principle P1 (every LLM token spent MUST be recorded):
each streamer captures usage data from the provider's final chunk and calls
core.llm_router._record_usage after the stream is exhausted. This is the
soundboard chat-path piece of the Track A.1 metering fix (2026-05-05 13041978).

NOTE on lint-allowlist: this file is in scripts/check-no-orphan-llm-calls.sh's
ALLOWED_PY_FILES list. It directly imports openai/httpx because llm_router does
not yet expose streaming primitives — the lint exemption is conditional on this
file calling _record_usage on every successful stream.
"""

import json
import logging
from typing import AsyncGenerator, Dict, List, Optional

import httpx as _httpx
import openai as _openai

logger = logging.getLogger(__name__)

SOUNDBOARD_CONTEXT_MESSAGES_LIMIT = 24


def _format_history_for_stream(messages_history, limit=8):
    lines = []
    for msg in (messages_history or [])[-limit:]:
        role = "Assistant" if str(msg.get("role", "")).lower() == "assistant" else "User"
        content = str(msg.get("content", "")).strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


async def _record_stream_usage(
    *,
    user_id: Optional[str],
    tier: Optional[str],
    feature: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    request_id: Optional[str] = None,
    cached_input_tokens: int = 0,
):
    """Fire-and-forget post-stream metering. Never raises.

    Routes through llm_router._record_usage so the same legacy + usage_ledger
    write paths used by non-streaming chat are exercised. If user_id is missing,
    the underlying recorder short-circuits silently — caller is responsible for
    wiring user_id (see soundboard.py:4636+).
    """
    if not user_id or (input_tokens <= 0 and output_tokens <= 0):
        return
    try:
        from core.llm_router import _record_usage
        await _record_usage(
            user_id=user_id,
            model=model,
            input_tokens=int(input_tokens or 0),
            output_tokens=int(output_tokens or 0),
            feature=feature,
            tier=tier,
            cached_input_tokens=int(cached_input_tokens or 0),
            request_id=request_id,
            action="stream",
        )
    except Exception as exc:
        # Non-fatal — streaming text already delivered, only metering missed.
        logger.warning("[soundboard_stream] _record_usage failed (non-fatal): %s", exc)


async def stream_openai_tokens(
    *,
    api_key: str,
    system_message: str,
    clean_message: str,
    messages_history: List[Dict],
    model: str,
    user_id: Optional[str] = None,
    tier: Optional[str] = None,
    feature: str = "soundboard_stream",
    request_id: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    client = _openai.AsyncOpenAI(api_key=api_key)
    formatted = [{"role": "system", "content": system_message}]
    for msg in (messages_history or [])[-SOUNDBOARD_CONTEXT_MESSAGES_LIMIT:]:
        formatted.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    formatted.append({"role": "user", "content": clean_message})
    kwargs = {
        "model": model,
        "messages": formatted,
        "max_tokens": 2000,
        "stream": True,
        # Required for usage to appear in the final chunk.
        "stream_options": {"include_usage": True},
    }
    if not any(model.startswith(prefix) for prefix in ("o1", "o3", "o4")):
        kwargs["temperature"] = 0.7

    captured_usage = None
    cached_tokens = 0

    stream = await client.chat.completions.create(**kwargs)
    async for chunk in stream:
        # Final chunk carries usage but no choices.
        usage_obj = getattr(chunk, "usage", None)
        if usage_obj is not None:
            captured_usage = usage_obj
            try:
                ptd = getattr(usage_obj, "prompt_tokens_details", None)
                if ptd is not None:
                    cached_tokens = int(getattr(ptd, "cached_tokens", 0) or 0)
            except Exception:
                cached_tokens = 0
            # don't yield — usage chunks have no text
            continue
        text = (chunk.choices[0].delta.content or "") if chunk.choices else ""
        if text:
            yield text

    if captured_usage is not None:
        await _record_stream_usage(
            user_id=user_id,
            tier=tier,
            feature=feature,
            model=model,
            input_tokens=int(getattr(captured_usage, "prompt_tokens", 0) or 0),
            output_tokens=int(getattr(captured_usage, "completion_tokens", 0) or 0),
            request_id=request_id,
            cached_input_tokens=cached_tokens,
        )


async def stream_gemini_tokens(
    *,
    api_key: str,
    system_message: str,
    clean_message: str,
    messages_history: List[Dict],
    model: str,
    user_id: Optional[str] = None,
    tier: Optional[str] = None,
    feature: str = "soundboard_stream",
    request_id: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    history = _format_history_for_stream(messages_history)
    prompt = f"{system_message}\n\n"
    if history:
        prompt += f"[RECENT CONVERSATION]\n{history}\n\n"
    prompt += f"[CURRENT USER MESSAGE]\n{clean_message}"

    captured_input = 0
    captured_output = 0

    async with _httpx.AsyncClient(timeout=90) as client:
        async with client.stream(
            "POST",
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent",
            params={"key": api_key, "alt": "sse"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 2000, "temperature": 0.7},
            },
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    try:
                        chunk = json.loads(line[6:])
                        text = (
                            chunk.get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")
                        )
                        if text:
                            yield text
                        # Final chunks include usageMetadata — keep the latest seen.
                        usage_meta = chunk.get("usageMetadata") or {}
                        if usage_meta:
                            try:
                                captured_input = int(usage_meta.get("promptTokenCount", captured_input) or captured_input)
                                captured_output = int(usage_meta.get("candidatesTokenCount", captured_output) or captured_output)
                            except Exception:
                                pass
                    except Exception:
                        continue

    if captured_input or captured_output:
        await _record_stream_usage(
            user_id=user_id,
            tier=tier,
            feature=feature,
            model=model,
            input_tokens=captured_input,
            output_tokens=captured_output,
            request_id=request_id,
        )


async def stream_anthropic_tokens(
    *,
    api_key: str,
    system_message: str,
    clean_message: str,
    messages_history: List[Dict],
    model: str,
    user_id: Optional[str] = None,
    tier: Optional[str] = None,
    feature: str = "soundboard_stream",
    request_id: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    history = _format_history_for_stream(messages_history)
    user_content = (
        clean_message
        if not history
        else f"[RECENT CONVERSATION]\n{history}\n\n[CURRENT USER MESSAGE]\n{clean_message}"
    )

    captured_input = 0
    captured_output = 0

    async with _httpx.AsyncClient(timeout=90) as client:
        async with client.stream(
            "POST",
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 2000,
                "temperature": 0.45,
                "system": system_message,
                "messages": [{"role": "user", "content": user_content}],
                "stream": True,
            },
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    try:
                        chunk = json.loads(line[6:])
                        ctype = chunk.get("type")
                        if ctype == "content_block_delta":
                            text = chunk.get("delta", {}).get("text", "")
                            if text:
                                yield text
                        elif ctype == "message_start":
                            # initial usage (input_tokens) lands here
                            try:
                                usage = (chunk.get("message") or {}).get("usage") or {}
                                captured_input = int(usage.get("input_tokens", captured_input) or captured_input)
                                captured_output = int(usage.get("output_tokens", captured_output) or captured_output)
                            except Exception:
                                pass
                        elif ctype == "message_delta":
                            # final usage (output_tokens cumulative) lands here
                            try:
                                usage = chunk.get("usage") or {}
                                if "input_tokens" in usage:
                                    captured_input = int(usage["input_tokens"] or captured_input)
                                if "output_tokens" in usage:
                                    captured_output = int(usage["output_tokens"] or captured_output)
                            except Exception:
                                pass
                    except Exception:
                        continue

    if captured_input or captured_output:
        await _record_stream_usage(
            user_id=user_id,
            tier=tier,
            feature=feature,
            model=model,
            input_tokens=captured_input,
            output_tokens=captured_output,
            request_id=request_id,
        )
