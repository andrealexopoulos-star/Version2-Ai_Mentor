"""
soundboard_stream.py — Real token-level streaming generators for Ask BIQc.
"""

import json
from typing import AsyncGenerator, List, Dict

import httpx as _httpx
import openai as _openai

SOUNDBOARD_CONTEXT_MESSAGES_LIMIT = 24


def _format_history_for_stream(messages_history, limit=8):
    lines = []
    for msg in (messages_history or [])[-limit:]:
        role = "Assistant" if str(msg.get("role", "")).lower() == "assistant" else "User"
        content = str(msg.get("content", "")).strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


async def stream_openai_tokens(
    *,
    api_key: str,
    system_message: str,
    clean_message: str,
    messages_history: List[Dict],
    model: str,
) -> AsyncGenerator[str, None]:
    client = _openai.AsyncOpenAI(api_key=api_key)
    formatted = [{"role": "system", "content": system_message}]
    for msg in (messages_history or [])[-SOUNDBOARD_CONTEXT_MESSAGES_LIMIT:]:
        formatted.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    formatted.append({"role": "user", "content": clean_message})
    kwargs = {"model": model, "messages": formatted, "max_tokens": 2000, "stream": True}
    if not any(model.startswith(prefix) for prefix in ("o1", "o3", "o4")):
        kwargs["temperature"] = 0.7
    stream = await client.chat.completions.create(**kwargs)
    async for chunk in stream:
        text = (chunk.choices[0].delta.content or "") if chunk.choices else ""
        if text:
            yield text


async def stream_gemini_tokens(
    *,
    api_key: str,
    system_message: str,
    clean_message: str,
    messages_history: List[Dict],
    model: str,
) -> AsyncGenerator[str, None]:
    history = _format_history_for_stream(messages_history)
    prompt = f"{system_message}\n\n"
    if history:
        prompt += f"[RECENT CONVERSATION]\n{history}\n\n"
    prompt += f"[CURRENT USER MESSAGE]\n{clean_message}"
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
                    except Exception:
                        continue


async def stream_anthropic_tokens(
    *,
    api_key: str,
    system_message: str,
    clean_message: str,
    messages_history: List[Dict],
    model: str,
) -> AsyncGenerator[str, None]:
    history = _format_history_for_stream(messages_history)
    user_content = clean_message if not history else f"[RECENT CONVERSATION]\n{history}\n\n[CURRENT USER MESSAGE]\n{clean_message}"
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
                        if chunk.get("type") == "content_block_delta":
                            text = chunk.get("delta", {}).get("text", "")
                            if text:
                                yield text
                    except Exception:
                        continue
