"""BIQc Guardrails — Input sanitisation + output validation + LLM call logging.

Prevents: prompt injection, sensitive data leakage, schema-invalid outputs.
Logs: token usage, latency, model version per LLM call.
Feature-flagged: guardrails_enabled, observability_full_enabled.
"""
import re
import time
import hashlib
import logging
from typing import Optional, Dict, Any
from functools import wraps

logger = logging.getLogger(__name__)

# ═══ INPUT SANITISATION (OWASP LLM guidelines) ═══

INJECTION_PATTERNS = [
    r'ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions?',
    r'disregard\s+(?:all\s+)?(?:previous|your)\s+instructions?',
    r'you\s+are\s+now\s+(?:a|an)\s+',
    r'pretend\s+(?:you\s+are|to\s+be)',
    r'act\s+as\s+(?:if|though)',
    r'forget\s+(?:everything|all|your)',
    r'new\s+instructions?\s*:',
    r'system\s*:\s*',
    r'<\s*(?:script|img|iframe)',
    r'\{\{.*\}\}',
    r'(?:exec|eval|import)\s*\(',
]

SENSITIVE_PATTERNS = [
    r'\b(?:sk-[a-zA-Z0-9]{20,})\b',  # OpenAI keys
    r'\b(?:sk_test_[a-zA-Z0-9]+)\b',  # Stripe keys
    r'\beyJ[a-zA-Z0-9_-]{20,}\b',     # JWT tokens
    r'\b(?:password|passwd|secret)\s*[:=]\s*\S+',
]


def sanitise_input(text: str) -> Dict[str, Any]:
    """Sanitise user input before sending to LLM."""
    if not text or not isinstance(text, str):
        return {'clean': True, 'text': text or '', 'flags': []}

    flags = []
    clean_text = text

    # Check for injection patterns
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            flags.append({'type': 'injection_attempt', 'pattern': pattern[:30]})

    # Remove sensitive data
    for pattern in SENSITIVE_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            clean_text = clean_text.replace(match, '[REDACTED]')
            flags.append({'type': 'sensitive_data', 'pattern': pattern[:30]})

    # Strip HTML/script tags
    clean_text = re.sub(r'<[^>]+>', '', clean_text)

    # Limit length (prevent context stuffing)
    if len(clean_text) > 4000:
        clean_text = clean_text[:4000]
        flags.append({'type': 'truncated', 'original_length': len(text)})

    return {
        'clean': len(flags) == 0,
        'text': clean_text,
        'flags': flags,
        'blocked': any(f['type'] == 'injection_attempt' for f in flags),
    }


def sanitise_output(text: str) -> str:
    """Filter sensitive data from LLM output before returning to user."""
    if not text:
        return text
    result = text
    for pattern in SENSITIVE_PATTERNS:
        result = re.sub(pattern, '[REDACTED]', result, flags=re.IGNORECASE)
    return result


# ═══ OUTPUT SCHEMA VALIDATION ═══

def validate_json_output(output: Any, required_fields: list = None) -> Dict:
    """Validate LLM JSON output against expected schema."""
    if output is None:
        return {'valid': False, 'errors': ['Output is None']}

    errors = []
    if not isinstance(output, dict):
        return {'valid': False, 'errors': ['Output is not a dict']}

    if required_fields:
        for field in required_fields:
            if field not in output:
                errors.append(f'Missing required field: {field}')
            elif output[field] is None:
                errors.append(f'Field is null: {field}')

    return {'valid': len(errors) == 0, 'errors': errors}


# ═══ LLM CALL LOGGING (Observability) ═══

def log_llm_call_to_db(
    tenant_id: Optional[str],
    model_name: str,
    model_version: str = '',
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    latency_ms: int = 0,
    temperature: float = 0,
    max_tokens: int = 0,
    input_hash: str = '',
    output_valid: bool = True,
    validation_errors: list = None,
    feature_flag: str = '',
    endpoint: str = '',
) -> None:
    """Log LLM call metrics to llm_call_log table."""
    try:
        from intelligence_spine import _get_cached_flag
        if not _get_cached_flag('observability_full_enabled'):
            return

        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        sb.table('llm_call_log').insert({
            'tenant_id': tenant_id,
            'model_name': model_name,
            'model_version': model_version,
            'prompt_tokens': prompt_tokens,
            'completion_tokens': completion_tokens,
            'total_tokens': total_tokens,
            'latency_ms': latency_ms,
            'temperature': temperature,
            'max_tokens': max_tokens,
            'input_hash': input_hash,
            'output_valid': output_valid,
            'validation_errors': validation_errors or [],
            'feature_flag': feature_flag,
            'endpoint': endpoint,
        }).execute()
    except Exception as e:
        logger.debug(f'LLM call log failed: {e}')


def guarded_llm_call(endpoint: str = '', feature_flag: str = ''):
    """Decorator: sanitise input, validate output, log metrics."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user message and tenant_id
            tenant_id = None
            user_message = None
            for k, v in kwargs.items():
                if k == 'current_user' and isinstance(v, dict):
                    tenant_id = v.get('id')
                if k in ('message', 'text', 'query') and isinstance(v, str):
                    user_message = v

            # Input sanitisation
            if user_message:
                sanitised = sanitise_input(user_message)
                if sanitised['blocked']:
                    logger.warning(f'[Guardrails] Blocked injection attempt from {tenant_id}')
                    return {'error': 'Input rejected by safety filter', 'blocked': True}
                kwargs[next(k for k in kwargs if k in ('message', 'text', 'query'))] = sanitised['text']

            # Execute
            start = time.time()
            result = await func(*args, **kwargs)
            elapsed = int((time.time() - start) * 1000)

            # Output sanitisation
            if isinstance(result, dict) and 'response' in result:
                result['response'] = sanitise_output(result['response'])
            elif isinstance(result, str):
                result = sanitise_output(result)

            # Log
            input_hash = hashlib.md5((user_message or '')[:200].encode()).hexdigest()[:12] if user_message else ''
            est_tokens = (len(user_message or '') + len(str(result)[:500])) // 4
            log_llm_call_to_db(
                tenant_id=tenant_id, model_name='gpt-4o', endpoint=endpoint,
                total_tokens=est_tokens, latency_ms=elapsed,
                input_hash=input_hash, feature_flag=feature_flag,
            )

            return result
        return wrapper
    return decorator
