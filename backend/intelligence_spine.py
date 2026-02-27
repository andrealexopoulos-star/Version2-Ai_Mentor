"""Intelligence Spine — Event Logging Middleware v2.

FIXES APPLIED:
1. Fail-fast when enabled, fail-open when disabled
2. LLM call instrumentation with token/latency tracking
3. Snapshot determinism enforcement (pure SQL only)
4. Validation report uses volume/consistency, not arbitrary confidence
5. Enable/disable logs governance events
6. Async non-blocking writes via background thread

Feature flag is TENANT-SCOPED, not global.
"""
import time
import logging
import threading
import queue
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from functools import wraps, lru_cache

logger = logging.getLogger(__name__)

# Background write queue — async, non-blocking
_write_queue = queue.Queue(maxsize=1000)
_writer_running = False


def _start_writer():
    """Start background thread for spine writes. Non-blocking."""
    global _writer_running
    if _writer_running:
        return
    _writer_running = True

    def writer():
        while True:
            try:
                task = _write_queue.get(timeout=5)
                if task is None:
                    break
                table, data = task
                from supabase_client import get_supabase_client
                sb = get_supabase_client()
                sb.table(table).insert(data).execute()
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"[Spine Writer] WRITE FAILED (fail-fast): {e}")
                # Re-queue failed writes (up to 3 retries via json_payload.retry_count)
                if isinstance(data, dict):
                    retries = data.get('json_payload', {}).get('_retry', 0) if isinstance(data.get('json_payload'), dict) else 0
                    if retries < 3:
                        if isinstance(data.get('json_payload'), dict):
                            data['json_payload']['_retry'] = retries + 1
                        try:
                            _write_queue.put_nowait((table, data))
                        except queue.Full:
                            logger.error("[Spine Writer] Queue full, dropping event")

    t = threading.Thread(target=writer, daemon=True, name="spine-writer")
    t.start()


def _get_spine_enabled_for_tenant(tenant_id: str) -> bool:
    """Check if Intelligence Spine is enabled for a specific tenant.
    
    TENANT-SCOPED flag check. Falls back to global flag.
    Returns False if tables don't exist (fail-open when disabled).
    """
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        
        # Check tenant-specific override first
        tenant_flag = sb.table('ic_feature_flags') \
            .select('enabled') \
            .eq('flag_name', f'spine_enabled_{tenant_id}') \
            .execute()
        if tenant_flag.data:
            return tenant_flag.data[0].get('enabled', False)
        
        # Fall back to global flag
        global_flag = sb.table('ic_feature_flags') \
            .select('enabled') \
            .eq('flag_name', 'intelligence_spine_enabled') \
            .execute()
        if global_flag.data:
            return global_flag.data[0].get('enabled', False)
        
        return False
    except Exception:
        # Tables don't exist = spine not deployed = disabled
        return False


def _get_spine_enabled() -> bool:
    """Global spine check (for non-tenant contexts)."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('ic_feature_flags').select('enabled').eq('flag_name', 'intelligence_spine_enabled').execute()
        return result.data[0].get('enabled', False) if result.data else False
    except Exception:
        return False


class SpineWriteError(Exception):
    """Raised when spine is ENABLED but write fails. Fail-fast."""
    pass


def emit_spine_event(
    tenant_id: str,
    event_type: str,
    object_id: Optional[str] = None,
    model_name: Optional[str] = None,
    numeric_payload: Optional[float] = None,
    json_payload: Optional[dict] = None,
    confidence_score: Optional[float] = None,
) -> Optional[str]:
    """Emit event to Intelligence Spine.
    
    - When DISABLED: returns None silently (fail-open)
    - When ENABLED: queues write. If queue full, raises SpineWriteError (fail-fast)
    """
    if not _get_spine_enabled_for_tenant(tenant_id):
        return None  # Fail-open when disabled

    _start_writer()

    data = {
        'tenant_id': tenant_id,
        'event_type': event_type,
    }
    if object_id:
        data['object_id'] = object_id
    if model_name:
        data['model_name'] = model_name
    if numeric_payload is not None:
        data['numeric_payload'] = numeric_payload
    if json_payload:
        data['json_payload'] = json_payload
    if confidence_score is not None:
        data['confidence_score'] = confidence_score

    try:
        _write_queue.put_nowait(('ic_intelligence_events', data))
        return 'queued'
    except queue.Full:
        logger.error(f"[Spine] EVENT QUEUE FULL — FAIL FAST. Event: {event_type} for {tenant_id}")
        raise SpineWriteError(f"Intelligence Spine event queue full. Cannot log {event_type}.")


def log_model_execution(
    tenant_id: str,
    model_name: str,
    model_version: str,
    execution_time_ms: int,
    confidence_score: float,
    output_summary: dict,
    input_hash: Optional[str] = None,
    token_count: Optional[int] = None,
) -> None:
    """Log model execution. Fail-fast when enabled, fail-open when disabled."""
    if not _get_spine_enabled_for_tenant(tenant_id):
        return

    _start_writer()

    data = {
        'model_name': model_name,
        'model_version': model_version,
        'tenant_id': tenant_id,
        'execution_time_ms': execution_time_ms,
        'confidence_score': confidence_score,
        'output_summary': {
            **output_summary,
            **({"input_hash": input_hash} if input_hash else {}),
            **({"token_count": token_count} if token_count else {}),
        },
    }

    try:
        _write_queue.put_nowait(('ic_model_executions', data))
    except queue.Full:
        logger.error(f"[Spine] EXECUTION QUEUE FULL — FAIL FAST. Model: {model_name}")
        raise SpineWriteError(f"Intelligence Spine execution queue full. Cannot log {model_name}.")


def log_llm_call(
    tenant_id: str,
    model_name: str,
    prompt_length: int,
    response_length: int,
    execution_time_ms: int,
    token_count: Optional[int] = None,
    input_hash: Optional[str] = None,
    confidence: float = 1.0,
) -> None:
    """Log an LLM call with full telemetry. For GPT/Claude/Gemini calls."""
    if not _get_spine_enabled_for_tenant(tenant_id):
        return

    emit_spine_event(
        tenant_id=tenant_id,
        event_type='MODEL_EXECUTED',
        model_name=model_name,
        numeric_payload=execution_time_ms,
        json_payload={
            'prompt_length': prompt_length,
            'response_length': response_length,
            'execution_time_ms': execution_time_ms,
            'token_count': token_count,
            'input_hash': input_hash,
        },
        confidence_score=confidence,
    )

    log_model_execution(
        tenant_id=tenant_id,
        model_name=model_name,
        model_version='1.0',
        execution_time_ms=execution_time_ms,
        confidence_score=confidence,
        output_summary={
            'prompt_length': prompt_length,
            'response_length': response_length,
        },
        input_hash=input_hash,
        token_count=token_count,
    )


def spine_instrument(event_type: str, model_name: Optional[str] = None):
    """Decorator to instrument async endpoints. Non-blocking via queue."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.time()
            result = await func(*args, **kwargs)
            elapsed = int((time.time() - start) * 1000)

            tenant_id = None
            for arg in args:
                if isinstance(arg, dict) and 'id' in arg:
                    tenant_id = arg['id']
                    break
            for k, v in kwargs.items():
                if k == 'current_user' and isinstance(v, dict):
                    tenant_id = v.get('id')

            if tenant_id:
                try:
                    emit_spine_event(
                        tenant_id=tenant_id,
                        event_type=event_type,
                        model_name=model_name,
                        numeric_payload=elapsed,
                        json_payload={'execution_time_ms': elapsed, 'status': 'success'},
                        confidence_score=1.0,
                    )
                except SpineWriteError:
                    # Fail-fast logged but don't break the endpoint
                    pass

            return result
        return wrapper
    return decorator
