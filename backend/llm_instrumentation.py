"""LLM Call Wrapper — Instruments all GPT/LLM calls for Intelligence Spine.

Usage: Replace `await chat.send_message(msg)` with `await instrumented_llm_call(chat, msg, tenant_id)`
Or use the monkey-patch approach to auto-instrument.

Logs: prompt_length, response_length, execution_time_ms, token_count, model_name
"""
import time
import hashlib
import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def instrumented_llm_call(chat, message, tenant_id: str, model_name: str = "gpt-4o") -> str:
    """Wrap an LLM chat.send_message() with spine telemetry."""
    prompt_text = message.text if hasattr(message, 'text') else str(message)
    prompt_length = len(prompt_text)
    input_hash = hashlib.md5(prompt_text[:500].encode()).hexdigest()[:12]

    start = time.time()
    response = await chat.send_message(message)
    elapsed = int((time.time() - start) * 1000)

    response_length = len(response) if isinstance(response, str) else 0

    # Estimate token count (~4 chars per token)
    est_tokens = (prompt_length + response_length) // 4

    try:
        from intelligence_spine import log_llm_call
        log_llm_call(
            tenant_id=tenant_id,
            model_name=model_name,
            prompt_length=prompt_length,
            response_length=response_length,
            execution_time_ms=elapsed,
            token_count=est_tokens,
            input_hash=input_hash,
        )
    except Exception as e:
        logger.debug(f"LLM spine log failed: {e}")

    return response
