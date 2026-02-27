"""Intelligence Spine — Event Logging Middleware + Engine Instrumentation.

Instruments ALL existing engines to emit events to ic_intelligence_events.
Only emits when spine is enabled (feature flag check).
Non-destructive: wraps existing logic, doesn't replace it.
"""
import time
import logging
from datetime import datetime, timezone
from typing import Optional
from functools import wraps

logger = logging.getLogger(__name__)


def _get_spine_enabled() -> bool:
    """Check if Intelligence Spine is enabled."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('ic_feature_flags').select('enabled').eq('flag_name', 'intelligence_spine_enabled').single().execute()
        return result.data.get('enabled', False) if result.data else False
    except Exception:
        return False


def emit_spine_event(
    tenant_id: str,
    event_type: str,
    object_id: Optional[str] = None,
    model_name: Optional[str] = None,
    numeric_payload: Optional[float] = None,
    json_payload: Optional[dict] = None,
    confidence_score: Optional[float] = None,
) -> Optional[str]:
    """Emit an event to the Intelligence Spine. Returns event ID or None."""
    if not _get_spine_enabled():
        return None
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
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
        result = sb.table('ic_intelligence_events').insert(data).execute()
        return result.data[0]['id'] if result.data else None
    except Exception as e:
        logger.debug(f"Spine event emission failed (non-blocking): {e}")
        return None


def log_model_execution(
    tenant_id: str,
    model_name: str,
    model_version: str,
    execution_time_ms: int,
    confidence_score: float,
    output_summary: dict,
) -> None:
    """Log a model execution to the governance layer."""
    if not _get_spine_enabled():
        return
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        sb.table('ic_model_executions').insert({
            'model_name': model_name,
            'model_version': model_version,
            'tenant_id': tenant_id,
            'execution_time_ms': execution_time_ms,
            'confidence_score': confidence_score,
            'output_summary': output_summary,
        }).execute()
    except Exception as e:
        logger.debug(f"Model execution log failed: {e}")


def spine_instrument(event_type: str, model_name: Optional[str] = None):
    """Decorator to instrument any async endpoint with spine event logging."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.time()
            result = await func(*args, **kwargs)
            elapsed = int((time.time() - start) * 1000)

            # Extract tenant_id from current_user if available
            tenant_id = None
            for arg in args:
                if isinstance(arg, dict) and 'id' in arg:
                    tenant_id = arg['id']
                    break
            for k, v in kwargs.items():
                if k == 'current_user' and isinstance(v, dict):
                    tenant_id = v.get('id')

            if tenant_id:
                # Emit event
                emit_spine_event(
                    tenant_id=tenant_id,
                    event_type=event_type,
                    model_name=model_name,
                    numeric_payload=elapsed,
                    json_payload={'execution_time_ms': elapsed, 'status': 'success'},
                    confidence_score=1.0,
                )
                # Log model execution if model specified
                if model_name:
                    log_model_execution(
                        tenant_id=tenant_id,
                        model_name=model_name,
                        model_version='1.0',
                        execution_time_ms=elapsed,
                        confidence_score=1.0,
                        output_summary={'event_type': event_type, 'status': 'success'},
                    )

            return result
        return wrapper
    return decorator
