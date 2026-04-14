"""BIQc Redis-backed async job runtime.

Additive-only background queue layer for Azure Redis Cache.
Never blocks API responses and never hard-depends on Redis at startup.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from datetime import datetime, timezone
from contextlib import suppress
from typing import Any, Awaitable, Callable, Dict, Optional
from urllib.parse import urlparse

from redis.asyncio import Redis
from redis.backoff import ExponentialBackoff
from redis.credentials import CredentialProvider
from redis.exceptions import RedisError
from redis.retry import Retry

logger = logging.getLogger(__name__)

REDIS_AAD_SCOPE = "https://redis.azure.com/.default"


def _redis_aad_username_from_token(access_token: str) -> Optional[str]:
    """Extract Azure AD object id for Redis username (Microsoft Entra Redis auth)."""
    try:
        import jwt

        decoded = jwt.decode(
            access_token,
            algorithms=["RS256"],
            options={"verify_signature": False},
        )
        return decoded.get("oid") or decoded.get("sub")
    except Exception:
        return None


class _AzureManagedIdentityRedisCredentialProvider(CredentialProvider):
    """Azure Cache for Redis / Entra ID using Managed Identity only (never DefaultAzureCredential).

    User-assigned MI client id must be set via REDIS_MANAGED_IDENTITY_CLIENT_ID — not AZURE_CLIENT_ID,
    so local service-principal env vars do not override App Service managed identity for Redis.
    """

    def __init__(self) -> None:
        from azure.identity.aio import ManagedIdentityCredential

        mi_client_id = (os.environ.get("REDIS_MANAGED_IDENTITY_CLIENT_ID") or "").strip() or None
        if mi_client_id:
            self._credential = ManagedIdentityCredential(client_id=mi_client_id)
        else:
            self._credential = ManagedIdentityCredential()
        self._explicit_username = (os.environ.get("REDIS_AAD_USERNAME") or "").strip() or None

    async def aclose(self) -> None:
        await self._credential.close()

    async def get_credentials_async(self) -> tuple[str, str]:
        token = await self._credential.get_token(REDIS_AAD_SCOPE)
        username = self._explicit_username or _redis_aad_username_from_token(token.token)
        if not username:
            raise ValueError(
                "Redis Entra auth: set REDIS_AAD_USERNAME to the identity object id, "
                "or use a token that includes an oid claim."
            )
        return username, token.token

    def get_credentials(self) -> tuple[str, str]:
        raise NotImplementedError("use get_credentials_async for async Redis client")

QUEUE_NAMESPACE = "biqc-jobs"
QUEUE_KEY = f"{QUEUE_NAMESPACE}:queue"
DELAYED_KEY = f"{QUEUE_NAMESPACE}:delayed"
DLQ_KEY = f"{QUEUE_NAMESPACE}:dead-letter"
LOG_BUFFER_KEY = f"{QUEUE_NAMESPACE}:logging-buffer"
DEDUPE_KEY_PREFIX = f"{QUEUE_NAMESPACE}:dedupe"

JOB_TYPES = {
    "watchtower-analysis",
    "advisor-analysis",
    "market-intelligence-scan",
    "crm-ingestion",
    "ai-reasoning-log",
    "email-analysis",
    "drive-sync",
    "website-ingestion",
    "market-research",
    "file-generation",
    "integration-count-sync",
    "merge-webhook-sync",
    "data-export",
    "cognitive-refresh",
}

JobHandler = Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]


class BIQcRedisJobs:
    def __init__(self) -> None:
        self.redis_url = os.environ.get("REDIS_URL")
        self.redis: Optional[Redis] = None
        self._redis_mi_provider: Optional[_AzureManagedIdentityRedisCredentialProvider] = None
        self.redis_connected = False
        self.last_error: Optional[str] = None
        self.worker_task: Optional[asyncio.Task] = None
        self.handlers: Dict[str, JobHandler] = {
            "watchtower-analysis": self._handle_watchtower_analysis,
            "advisor-analysis": self._handle_advisor_analysis,
            "market-intelligence-scan": self._handle_market_intelligence_scan,
            "crm-ingestion": self._handle_crm_ingestion,
            "ai-reasoning-log": self._handle_ai_reasoning_log,
            "email-analysis": self._handle_email_analysis,
            "drive-sync": self._handle_drive_sync,
            "website-ingestion": self._handle_website_ingestion,
            "market-research": self._handle_market_research,
            "file-generation": self._handle_file_generation,
            "integration-count-sync": self._handle_integration_count_sync,
            "merge-webhook-sync": self._handle_merge_webhook_sync,
            "data-export": self._handle_data_export,
            "cognitive-refresh": self._handle_cognitive_refresh,
        }

    async def initialize(self) -> bool:
        await self._close_mi_provider_if_any()
        if not self.redis_url:
            self.redis_connected = False
            self.last_error = "REDIS_URL not configured"
            logger.warning("Redis unavailable – continuing without queue.")
            return False

        try:
            self.redis = self._build_redis_client(self.redis_url)
            await self.redis.ping()
            self.redis_connected = True
            self.last_error = None
            logger.info("Redis connection established")
            return True
        except Exception as exc:  # pragma: no cover - defensive startup path
            self.redis_connected = False
            self.last_error = str(exc)
            self.redis = None
            await self._close_mi_provider_if_any()
            logger.warning("Redis unavailable – continuing without queue.")
            logger.debug("Redis initialization failure detail: %s", exc)
            return False

    async def _close_mi_provider_if_any(self) -> None:
        if self._redis_mi_provider is not None:
            await self._redis_mi_provider.aclose()
            self._redis_mi_provider = None

    def _common_redis_kwargs(self) -> Dict[str, Any]:
        retry = Retry(ExponentialBackoff(base=1, cap=8), 3)
        return {
            "decode_responses": True,
            "max_connections": 25,
            "socket_timeout": 5,
            "socket_connect_timeout": 5,
            "retry": retry,
            "retry_on_timeout": True,
            "health_check_interval": 30,
        }

    def _managed_identity_env_enabled(self) -> bool:
        flag = os.environ.get("REDIS_USE_MANAGED_IDENTITY", "").strip().lower()
        return flag in ("1", "true", "yes")

    def _has_explicit_redis_password(self, value: str) -> bool:
        """True if URL or connection string includes an access key / password (prefer key auth)."""
        v = str(value or "").strip()
        if v.startswith(("redis://", "rediss://")):
            parsed = urlparse(v)
            return bool(parsed.password)
        parts = [part.strip() for part in v.split(",") if part.strip()]
        for part in parts:
            if "=" not in part:
                continue
            key, raw_val = part.split("=", 1)
            key = key.strip().lower()
            raw_val = raw_val.strip()
            if key in {"password", "accesskey"} and raw_val:
                return True
        return False

    def _build_redis_client_managed_identity(self, value: str, common_kwargs: Dict[str, Any]) -> Redis:
        provider = _AzureManagedIdentityRedisCredentialProvider()
        self._redis_mi_provider = provider

        v = str(value or "").strip().strip('"').strip("'")
        if v.startswith(("redis://", "rediss://")):
            parsed = urlparse(v)
            if parsed.scheme not in {"redis", "rediss"}:
                raise ValueError("Unsupported REDIS_URL scheme for managed identity")
            host = parsed.hostname
            if not host:
                raise ValueError("REDIS_URL must include a host for managed identity")
            port = parsed.port or (6380 if parsed.scheme == "rediss" else 6379)
            ssl_enabled = parsed.scheme == "rediss"
            db = 0
            if parsed.path and parsed.path != "/":
                try:
                    db = int(parsed.path.lstrip("/"))
                except ValueError:
                    db = 0
            return Redis(
                host=host,
                port=port,
                db=db,
                ssl=ssl_enabled,
                credential_provider=provider,
                **common_kwargs,
            )

        parts = [part.strip() for part in v.split(",") if part.strip()]
        host = None
        port = 6380
        ssl_enabled = True
        db = 0

        for index, part in enumerate(parts):
            if index == 0 and "=" not in part and ":" in part:
                host_part, port_part = part.rsplit(":", 1)
                host = host_part.strip()
                try:
                    port = int(port_part.strip())
                except ValueError:
                    port = 6380
                continue

            if "=" not in part:
                continue
            key, raw_val = part.split("=", 1)
            key = key.strip().lower()
            raw_val = raw_val.strip()
            if key in {"host", "hostname"}:
                host = raw_val
            elif key == "ssl":
                ssl_enabled = raw_val.lower() == "true"
            elif key in {"port"}:
                try:
                    port = int(raw_val)
                except ValueError:
                    pass
            elif key in {"db", "database"}:
                try:
                    db = int(raw_val)
                except ValueError:
                    pass

        if not host:
            raise ValueError("Redis managed identity requires a host in REDIS_URL")

        return Redis(
            host=host,
            port=port,
            db=db,
            ssl=ssl_enabled,
            credential_provider=provider,
            **common_kwargs,
        )

    def _build_redis_client(self, redis_value: str) -> Redis:
        value = str(redis_value or '').strip().strip('"').strip("'")
        common_kwargs = self._common_redis_kwargs()

        if self._managed_identity_env_enabled() and not self._has_explicit_redis_password(value):
            return self._build_redis_client_managed_identity(value, common_kwargs)

        self._redis_mi_provider = None

        if value.startswith('redis://') or value.startswith('rediss://'):
            parsed = urlparse(value)
            if parsed.scheme in {'redis', 'rediss'}:
                return Redis.from_url(value, **common_kwargs)

        # Azure classic connection string support:
        # host:6380,password=KEY,ssl=True,abortConnect=False
        parts = [part.strip() for part in value.split(',') if part.strip()]
        host = None
        port = 6380
        password = None
        ssl_enabled = True
        db = 0

        for index, part in enumerate(parts):
            if index == 0 and '=' not in part and ':' in part:
                host_part, port_part = part.rsplit(':', 1)
                host = host_part.strip()
                try:
                    port = int(port_part.strip())
                except ValueError:
                    port = 6380
                continue

            if '=' not in part:
                continue
            key, raw_val = part.split('=', 1)
            key = key.strip().lower()
            raw_val = raw_val.strip()
            if key in {'password', 'accesskey'}:
                password = raw_val
            elif key == 'ssl':
                ssl_enabled = raw_val.lower() == 'true'
            elif key in {'host', 'hostname'}:
                host = raw_val
            elif key in {'port'}:
                try:
                    port = int(raw_val)
                except ValueError:
                    pass
            elif key in {'db', 'database'}:
                try:
                    db = int(raw_val)
                except ValueError:
                    pass

        if host and password:
            return Redis(host=host, port=port, password=password, ssl=ssl_enabled, db=db, **common_kwargs)

        raise ValueError('Unsupported REDIS_URL / Redis connection string format')

    async def shutdown(self) -> None:
        if self.worker_task:
            self.worker_task.cancel()
            with suppress(asyncio.CancelledError):
                await self.worker_task
            self.worker_task = None

        if self.redis is not None:
            await self.redis.aclose()
            self.redis = None
        await self._close_mi_provider_if_any()
        self.redis_connected = False

    async def start_worker(self) -> None:
        if not self.redis_connected or self.redis is None or self.worker_task:
            return
        self.worker_task = asyncio.create_task(self._worker_loop(), name="biqc-redis-worker")

    def health(self) -> Dict[str, Any]:
        queue_depth = 0
        delayed_depth = 0
        buffer_depth = 0
        dlq_depth = 0

        if self.redis_connected and self.redis is not None:
            queue_depth = -1
            delayed_depth = -1
            buffer_depth = -1
            dlq_depth = -1

        return {
            "redis_connected": self.redis_connected,
            "queue_namespace": QUEUE_NAMESPACE,
            "worker_running": bool(self.worker_task and not self.worker_task.done()),
            "last_error": self.last_error,
            "queue_depth": queue_depth,
            "delayed_depth": delayed_depth,
            "dead_letter_depth": dlq_depth,
            "logging_buffer_depth": buffer_depth,
        }

    async def health_async(self) -> Dict[str, Any]:
        state = self.health()
        if not self.redis_connected or self.redis is None:
            return state

        try:
            state["queue_depth"] = await self.redis.llen(QUEUE_KEY)
            state["delayed_depth"] = await self.redis.zcard(DELAYED_KEY)
            state["dead_letter_depth"] = await self.redis.zcard(DLQ_KEY)
            state["logging_buffer_depth"] = await self.redis.llen(LOG_BUFFER_KEY)
        except Exception as exc:  # pragma: no cover - health fallback
            state["last_error"] = str(exc)
            state["redis_connected"] = False
        return state

    async def get_dead_letter_jobs(self, limit: int = 50) -> list:
        """Retrieve failed jobs from the dead-letter queue for admin inspection."""
        if not self.redis_connected or self.redis is None:
            return []
        try:
            raw_entries = await self.redis.zrevrange(DLQ_KEY, 0, limit - 1, withscores=True)
            results = []
            for raw_job, score in raw_entries:
                try:
                    job = json.loads(raw_job)
                    job["dlq_timestamp"] = int(score)
                    results.append(job)
                except (json.JSONDecodeError, TypeError):
                    continue
            return results
        except Exception as exc:
            logger.error("Failed to read DLQ: %s", exc)
            return []

    def build_job_id(self, company_id: str, job_type: str, timestamp_window: int) -> str:
        base = f"{company_id}:{job_type}:{timestamp_window}"
        return hashlib.sha256(base.encode("utf-8")).hexdigest()

    async def enqueue_job(
        self,
        *,
        company_id: str,
        job_type: str,
        payload: Dict[str, Any],
        window_seconds: int = 300,
    ) -> Dict[str, Any]:
        if job_type not in JOB_TYPES:
            raise ValueError(f"Unsupported BIQc job type: {job_type}")

        if not self.redis_connected or self.redis is None:
            return {"queued": False, "duplicate": False, "job_id": None, "reason": "redis_unavailable"}

        timestamp_window = int(time.time() // max(1, window_seconds))
        job_id = self.build_job_id(company_id, job_type, timestamp_window)
        dedupe_key = f"{DEDUPE_KEY_PREFIX}:{job_id}"
        accepted = await self.redis.set(dedupe_key, "1", ex=max(900, window_seconds * 3), nx=True)

        if not accepted:
            return {"queued": False, "duplicate": True, "job_id": job_id, "reason": "duplicate_ignored"}

        envelope = {
            "job_id": job_id,
            "company_id": company_id,
            "job_type": job_type,
            "payload": payload,
            "attempts": 0,
            "enqueued_at": int(time.time()),
            "timestamp_window": timestamp_window,
        }
        await self.redis.rpush(QUEUE_KEY, json.dumps(envelope, sort_keys=True, default=str))
        return {"queued": True, "duplicate": False, "job_id": job_id, "namespace": QUEUE_NAMESPACE}

    async def buffer_log(self, *, company_id: str, payload: Dict[str, Any], window_seconds: int = 60) -> Dict[str, Any]:
        return await self.enqueue_job(
            company_id=company_id,
            job_type="ai-reasoning-log",
            payload=payload,
            window_seconds=window_seconds,
        )

    async def _worker_loop(self) -> None:
        logger.info("BIQc Redis worker started for namespace %s", QUEUE_NAMESPACE)
        assert self.redis is not None
        last_flush = time.time()

        while True:
            try:
                await self._promote_delayed_jobs()

                # Periodic log buffer flush to Supabase (every 5 minutes)
                if time.time() - last_flush >= 300:
                    await self._flush_log_buffer()
                    last_flush = time.time()

                entry = await self.redis.blpop(QUEUE_KEY, timeout=2)
                if not entry:
                    continue

                _, raw_job = entry
                job = json.loads(raw_job)
                await self._process_job(job)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # pragma: no cover - long-running loop safety
                logger.error("BIQc Redis worker loop error: %s", exc)
                await asyncio.sleep(1)

    async def _promote_delayed_jobs(self) -> None:
        assert self.redis is not None
        now = int(time.time())
        ready_jobs = await self.redis.zrangebyscore(DELAYED_KEY, min=0, max=now, start=0, num=20)
        if not ready_jobs:
            return

        pipeline = self.redis.pipeline()
        for raw_job in ready_jobs:
            pipeline.zrem(DELAYED_KEY, raw_job)
            pipeline.rpush(QUEUE_KEY, raw_job)
        await pipeline.execute()

    async def _flush_log_buffer(self) -> None:
        """Flush up to 100 log entries from Redis buffer to Supabase for permanent storage."""
        if not self.redis_connected or self.redis is None:
            return

        try:
            buffer_len = await self.redis.llen(LOG_BUFFER_KEY)
            if buffer_len == 0:
                return

            batch_size = min(100, buffer_len)
            entries = []
            for _ in range(batch_size):
                raw = await self.redis.lpop(LOG_BUFFER_KEY)
                if raw is None:
                    break
                try:
                    entries.append(json.loads(raw))
                except (json.JSONDecodeError, TypeError):
                    continue

            if not entries:
                return

            try:
                from supabase_client import get_supabase_client
                sb = get_supabase_client()
                rows = [
                    {
                        "job_id": e.get("job_id"),
                        "job_type": e.get("job_type"),
                        "company_id": e.get("company_id"),
                        "status": e.get("status", "success"),
                        "result_summary": json.dumps(e.get("result", {}), default=str)[:2000],
                        "processed_at": datetime.fromtimestamp(
                            e.get("processed_at", time.time()), tz=timezone.utc
                        ).isoformat(),
                    }
                    for e in entries
                ]
                sb.table("job_execution_log").upsert(rows, on_conflict="job_id").execute()
                logger.info("Flushed %d log entries from Redis buffer to Supabase", len(rows))
            except Exception as flush_exc:
                # Push entries back to buffer on failure
                logger.warning("Log buffer flush to Supabase failed, re-queuing %d entries: %s", len(entries), flush_exc)
                for e in entries:
                    try:
                        await self.redis.rpush(LOG_BUFFER_KEY, json.dumps(e, sort_keys=True, default=str))
                    except Exception:
                        pass
        except Exception as exc:
            logger.warning("Log buffer flush error: %s", exc)

    async def _process_job(self, job: Dict[str, Any]) -> None:
        job_type = job.get("job_type")
        handler = self.handlers.get(job_type)
        if not handler:
            logger.warning("Unknown BIQc Redis job type %s", job_type)
            return

        try:
            result = await handler(job)
            logger.info("BIQc Redis job succeeded: %s (%s)", job.get("job_id"), job_type)
            if result is not None and self.redis is not None and job_type != "ai-reasoning-log":
                await self.redis.lpush(LOG_BUFFER_KEY, json.dumps({
                    "job_id": job.get("job_id"),
                    "job_type": job_type,
                    "status": "success",
                    "result": result,
                    "processed_at": int(time.time()),
                }, sort_keys=True, default=str))
                await self.redis.ltrim(LOG_BUFFER_KEY, 0, 999)
        except Exception as exc:
            attempts = int(job.get("attempts", 0)) + 1
            logger.error("BIQc Redis job failed: %s (%s) attempt %s/3 — %s", job.get("job_id"), job_type, attempts, exc)

            if attempts >= 3:
                # Move to dead-letter queue instead of silently discarding
                if self.redis is not None:
                    dlq_entry = json.dumps({
                        **job,
                        "failed_at": int(time.time()),
                        "last_error": str(exc),
                        "attempts": attempts,
                    }, sort_keys=True, default=str)
                    await self.redis.zadd(DLQ_KEY, {dlq_entry: int(time.time())})
                    await self.redis.zremrangebyrank(DLQ_KEY, 0, -501)  # keep last 500
                logger.error("Job moved to DLQ: %s (%s) after %s attempts", job.get("job_id"), job_type, attempts)
                return

            if self.redis is None:
                return

            job["attempts"] = attempts
            delay_seconds = min(60, 2 ** attempts)
            available_at = int(time.time()) + delay_seconds
            await self.redis.zadd(DELAYED_KEY, {json.dumps(job, sort_keys=True, default=str): available_at})

    async def _handle_watchtower_analysis(self, job: Dict[str, Any]) -> Dict[str, Any]:
        user_id = job.get("payload", {}).get("user_id")
        if not user_id:
            return {"status": "skipped", "reason": "missing_user_id"}

        from watchtower_engine import get_watchtower_engine

        result = await get_watchtower_engine().run_analysis(user_id)
        return {"status": "processed", "result": result}

    async def _handle_advisor_analysis(self, job: Dict[str, Any]) -> Dict[str, Any]:
        user_id = job.get("payload", {}).get("user_id")
        if not user_id:
            return {"status": "skipped", "reason": "missing_user_id"}

        from snapshot_agent import get_snapshot_agent

        snapshot = await get_snapshot_agent().generate_snapshot(user_id, snapshot_type="queued_refresh")
        return {"status": "processed", "snapshot_generated": bool(snapshot)}

    async def _handle_market_intelligence_scan(self, job: Dict[str, Any]) -> Dict[str, Any]:
        user_id = job.get("payload", {}).get("user_id")
        if not user_id:
            return {"status": "skipped", "reason": "missing_user_id"}

        from snapshot_agent import get_snapshot_agent

        snapshot = await get_snapshot_agent().generate_snapshot(user_id, snapshot_type="market_scan")
        return {"status": "processed", "market_context_refreshed": bool(snapshot)}

    async def _handle_crm_ingestion(self, job: Dict[str, Any]) -> Dict[str, Any]:
        payload = job.get("payload", {})
        user_id = payload.get("user_id")
        account_id = payload.get("account_id")
        if not user_id or not account_id:
            return {"status": "skipped", "reason": "missing_user_or_account"}

        from merge_emission_layer import get_emission_layer

        result = await get_emission_layer().run_emission(user_id, account_id)
        return {"status": "processed", "result": result}

    async def _handle_ai_reasoning_log(self, job: Dict[str, Any]) -> Dict[str, Any]:
        if self.redis is None:
            return {"status": "skipped", "reason": "redis_unavailable"}

        payload = {
            "job_id": job.get("job_id"),
            "company_id": job.get("company_id"),
            "job_type": job.get("job_type"),
            "payload": job.get("payload", {}),
            "processed_at": int(time.time()),
        }
        await self.redis.lpush(LOG_BUFFER_KEY, json.dumps(payload, sort_keys=True, default=str))
        await self.redis.ltrim(LOG_BUFFER_KEY, 0, 1999)
        return {"status": "buffered"}

    async def _handle_email_analysis(self, job: Dict[str, Any]) -> Dict[str, Any]:
        payload = job.get("payload", {})
        user_id = payload.get("user_id")
        job_id = payload.get("job_id")
        if not user_id or not job_id:
            return {"status": "skipped", "reason": "missing_user_or_job"}

        from routes.email import run_comprehensive_email_analysis

        await run_comprehensive_email_analysis(user_id, job_id)
        return {"status": "processed", "job_id": job_id}

    async def _handle_drive_sync(self, job: Dict[str, Any]) -> Dict[str, Any]:
        payload = job.get("payload", {})
        user_id = payload.get("user_id")
        account_id = payload.get("account_id")
        account_token = payload.get("account_token")
        if not user_id or not account_id or not account_token:
            return {"status": "skipped", "reason": "missing_drive_payload"}

        from routes.integrations import sync_google_drive_files

        await sync_google_drive_files(user_id, account_id, account_token)
        return {"status": "processed", "account_id": account_id}

    async def _handle_website_ingestion(self, job: Dict[str, Any]) -> Dict[str, Any]:
        payload = job.get("payload", {})
        mode = payload.get("mode", "standard")

        if mode == "hybrid":
            from routes.hybrid_ingestion import execute_hybrid_ingestion_job

            result = await execute_hybrid_ingestion_job(payload)
        else:
            from routes.ingestion_engine import execute_ingestion_job

            result = await execute_ingestion_job(payload)
        return {"status": "processed", "result": result}

    async def _handle_market_research(self, job: Dict[str, Any]) -> Dict[str, Any]:
        payload = job.get("payload", {})
        task = payload.get("task", "research-analyze-website")

        if task == "marketing-benchmark":
            from routes.marketing_intel import execute_marketing_benchmark_job

            result = await execute_marketing_benchmark_job(payload)
        else:
            from routes.research import execute_website_research_job

            result = await execute_website_research_job(payload)
        return {"status": "processed", "task": task, "result": result}

    async def _handle_file_generation(self, job: Dict[str, Any]) -> Dict[str, Any]:
        from routes.file_service import execute_file_generation_job

        result = await execute_file_generation_job(job.get("payload", {}))
        return {"status": "processed", "result": result}

    async def _handle_integration_count_sync(self, job: Dict[str, Any]) -> Dict[str, Any]:
        payload = job.get("payload", {})
        user_id = payload.get("user_id")
        category = payload.get("category")
        if not user_id or not category:
            return {"status": "skipped", "reason": "missing_count_sync_payload"}

        from supabase_client import get_supabase_client
        from routes.integrations import _sync_category_counts

        await _sync_category_counts(get_supabase_client(), user_id, category)
        return {"status": "processed", "category": category}

    async def _handle_merge_webhook_sync(self, job: Dict[str, Any]) -> Dict[str, Any]:
        payload = job.get("payload", {})
        tenant_id = payload.get("tenant_id")
        categories = payload.get("categories") or []
        if not tenant_id:
            return {"status": "skipped", "reason": "missing_tenant_id"}

        import httpx

        supabase_url = os.environ.get("SUPABASE_URL")
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not service_key:
            return {"status": "skipped", "reason": "missing_supabase_env"}

        ingest_url = f"{supabase_url.rstrip('/')}/functions/v1/business-brain-merge-ingest"
        body = {
            "tenant_id": tenant_id,
            "categories": categories,
            "trigger_source": "merge_webhook_queue",
            "dry_run": False,
        }
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                ingest_url,
                json=body,
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code >= 400:
                raise RuntimeError(f"merge webhook sync failed ({resp.status_code}): {resp.text[:300]}")
            ingest_result = resp.json()

        try:
            from supabase_client import get_supabase_admin
            sb_admin = get_supabase_admin()
            if categories:
                sb_admin.schema("business_core").table("webhook_events").update({
                    "status": "processed",
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "last_error": None,
                }).eq("tenant_id", tenant_id).in_("category", categories).in_("status", ["queued", "validated", "failed"]).execute()
        except Exception as exc:
            logger.warning("Webhook event status update after sync failed: %s", exc)

        # Trigger fast surface refresh after ingestion settles.
        await self.enqueue_job(
            company_id=str(tenant_id),
            job_type="advisor-analysis",
            payload={"user_id": tenant_id, "trigger_source": "merge_webhook_sync"},
            window_seconds=60,
        )
        await self.enqueue_job(
            company_id=str(tenant_id),
            job_type="watchtower-analysis",
            payload={"user_id": tenant_id, "trigger_source": "merge_webhook_sync"},
            window_seconds=60,
        )

        return {
            "status": "processed",
            "tenant_id": tenant_id,
            "categories": categories,
            "ingest_result": ingest_result,
        }


    async def _handle_data_export(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """Export all user data as a ZIP archive for GDPR/self-service download."""
        payload = job.get("payload", {})
        user_id = payload.get("user_id")
        if not user_id:
            return {"status": "skipped", "reason": "missing_user_id"}

        try:
            from routes.deps import get_sb
            sb = get_sb()

            # Collect data from all user tables
            tables = [
                "business_profiles", "chat_history", "documents", "sops",
                "intelligence_actions", "strategy_profiles", "cognitive_profiles",
                "onboarding", "email_intelligence", "calendar_intelligence",
            ]
            export_data = {}
            for table in tables:
                try:
                    result = sb.table(table).select("*").eq("user_id", user_id).execute()
                    export_data[table] = result.data or []
                except Exception as e:
                    export_data[table] = {"error": str(e)}

            # Update data_exports status
            try:
                sb.table("data_exports").update({
                    "status": "ready",
                    "file_path": f"exports/{user_id}/export.json",
                }).eq("user_id", user_id).eq("status", "queued").execute()
            except Exception:
                pass

            return {"status": "completed", "user_id": user_id, "tables_exported": len(export_data)}
        except Exception as e:
            logger.error(f"[data-export] Failed for user {user_id}: {e}", exc_info=True)
            return {"status": "failed", "error": str(e)}

    async def _handle_cognitive_refresh(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """Refresh cognitive profile layers from latest user data."""
        payload = job.get("payload", {})
        user_id = payload.get("user_id")
        if not user_id:
            return {"status": "skipped", "reason": "missing_user_id"}

        supabase_url = os.environ.get("SUPABASE_URL")
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not service_key:
            return {"status": "skipped", "reason": "missing_supabase_env"}

        try:
            import httpx
            cognitive_url = f"{supabase_url.rstrip('/')}/functions/v1/biqc-insights-cognitive"
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    cognitive_url,
                    json={"user_id": user_id, "trigger_source": "cognitive_refresh_queue"},
                    headers={
                        "Authorization": f"Bearer {service_key}",
                        "Content-Type": "application/json",
                    },
                )
                if resp.status_code >= 400:
                    raise RuntimeError(f"Cognitive refresh failed ({resp.status_code}): {resp.text[:300]}")
                return {"status": "completed", "user_id": user_id, "result": resp.json()}
        except Exception as e:
            logger.error(f"[cognitive-refresh] Failed for user {user_id}: {e}", exc_info=True)
            return {"status": "failed", "error": str(e)}


biqc_jobs = BIQcRedisJobs()


def get_redis() -> Optional[Redis]:
    """Return the shared Redis client if connected, else None.

    Used by scan_cache and other modules that need Redis access
    without duplicating connection logic.
    """
    if biqc_jobs.redis_connected and biqc_jobs.redis is not None:
        return biqc_jobs.redis
    return None


async def enqueue_job(job_type: str, payload: Dict[str, Any], *, company_id: Optional[str] = None, window_seconds: int = 300) -> Dict[str, Any]:
    resolved_company_id = (
        company_id
        or payload.get("company_id")
        or payload.get("workspace_id")
        or payload.get("user_id")
        or payload.get("tenant_id")
        or payload.get("account_id")
        or "global"
    )
    return await biqc_jobs.enqueue_job(
        company_id=str(resolved_company_id),
        job_type=job_type,
        payload=payload,
        window_seconds=window_seconds,
    )
