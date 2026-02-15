"""
Prompt Registry — Fetches AI system prompts from Supabase `system_prompts` table.

Usage:
    prompt = await get_prompt("myadvisor_general_v1")
    formatted = prompt.format(user_context=ctx, knowledge_context=kc)

Falls back to hardcoded defaults if DB is unreachable.
"""
import logging
from typing import Optional, Dict

logger = logging.getLogger("server")

# In-memory cache (prompt_key -> raw_content)
_cache: Dict[str, str] = {}
_sb = None


def init_prompt_registry(supabase_admin):
    global _sb
    _sb = supabase_admin


async def get_prompt(prompt_key: str, fallback: Optional[str] = None) -> Optional[str]:
    """
    Fetch a prompt by key from Supabase system_prompts table.
    Returns raw_content string (with {variable} placeholders).
    Uses in-memory cache after first fetch.
    """
    # Check cache first
    if prompt_key in _cache:
        return _cache[prompt_key]

    if _sb is None:
        logger.warning(f"[PromptRegistry] Not initialized, returning fallback for {prompt_key}")
        return fallback

    try:
        result = _sb.table("system_prompts").select(
            "raw_content"
        ).eq("prompt_key", prompt_key).eq(
            "is_active", True
        ).maybe_single().execute()

        if result and result.data:
            content = result.data.get("raw_content")
            if content:
                _cache[prompt_key] = content
                logger.info(f"[PromptRegistry] Loaded prompt: {prompt_key}")
                return content

        logger.warning(f"[PromptRegistry] Prompt '{prompt_key}' not found in DB, using fallback")
        return fallback

    except Exception as e:
        logger.warning(f"[PromptRegistry] DB fetch failed for '{prompt_key}': {e}")
        return fallback


def invalidate_cache(prompt_key: Optional[str] = None):
    """Clear cache for a specific key or all keys."""
    if prompt_key:
        _cache.pop(prompt_key, None)
    else:
        _cache.clear()
