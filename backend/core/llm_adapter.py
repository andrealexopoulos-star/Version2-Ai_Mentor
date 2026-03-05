"""
BIQc LLM Adapter — Provider-agnostic chat interface.
Default: Emergent integrations path (current behavior).
Toggle: Direct OpenAI path via LLM_PROVIDER env var.

Usage:
  LLM_PROVIDER=emergent (default) → uses emergentintegrations LlmChat
  LLM_PROVIDER=openai_direct → uses openai SDK directly

Rollback: Set LLM_PROVIDER=emergent or remove the env var.
"""
import os
import logging

logger = logging.getLogger(__name__)

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "emergent")


async def chat_completion(api_key: str, system_message: str, messages: list, user_message: str,
                          model: str = "gpt-4o", temperature: float = 0.7, max_tokens: int = 1500,
                          session_id: str = "default") -> str:
    """
    Provider-agnostic chat completion.
    Returns the assistant's response as a string.
    """
    if LLM_PROVIDER == "openai_direct":
        return await _openai_direct(api_key, system_message, messages, user_message, model, temperature, max_tokens)
    else:
        return await _emergent_path(api_key, system_message, messages, user_message, model, temperature, max_tokens, session_id)


async def _emergent_path(api_key, system_message, messages, user_message, model, temperature, max_tokens, session_id):
    """Current production path — emergentintegrations LlmChat."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    chat = LlmChat(api_key=api_key, session_id=session_id, system_message=system_message)
    chat.with_model("openai", model)
    chat.with_params(temperature=temperature, max_tokens=max_tokens)

    for msg in messages:
        if msg.get("role") == "user":
            chat.add_message(UserMessage(text=msg["content"]))

    response = await chat.send_message(UserMessage(text=user_message))
    return response


async def _openai_direct(api_key, system_message, messages, user_message, model, temperature, max_tokens):
    """Direct OpenAI SDK path — no emergentintegrations dependency."""
    import httpx

    formatted_messages = [{"role": "system", "content": system_message}]
    for msg in messages:
        formatted_messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    formatted_messages.append({"role": "user", "content": user_message})

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": formatted_messages, "temperature": temperature, "max_tokens": max_tokens},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


def get_provider_info():
    """Return current provider configuration for health checks."""
    return {
        "provider": LLM_PROVIDER,
        "default": "emergent",
        "toggle_env": "LLM_PROVIDER",
        "options": ["emergent", "openai_direct"],
        "rollback": "Set LLM_PROVIDER=emergent or remove the env var",
    }
