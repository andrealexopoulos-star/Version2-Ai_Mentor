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
from contextlib import suppress
from typing import Any, Awaitable, Callable, Dict, Optional

from redis.asyncio import Redis
from redis.backoff import ExponentialBackoff
from redis.exceptions import RedisError
from redis.retry import Retry

logger = logging.getLogger(__name__)

QUEUE_NAMESPACE = "biqc-jobs"
QUEUE_KEY = f"{QUEUE_NAMESPACE}:queue"
DELAYED_KEY = f"{QUEUE_NAMESPACE}:delayed"
LOG_BUFFER_KEY = f"{QUEUE_NAMESPACE}:logging-buffer"
DEDUPE_KEY_PREFIX = f"{QUEUE_NAMESPACE}:dedupe"

JOB_TYPES = {
    "watchtower-analysis",
    "advisor-analysis",
    "market-intelligence-scan",
    "crm-ingestion",
    "ai-reasoning-log",
}

JobHandler = Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]


class BIQcRedisJobs:
    def __init__(self) -> None:
        self.redis_url = os.environ.get("REDIS_URL")
        self.redis: Optional[Redis] = None
        self.redis_connected = False
        self.last_error: Optional[str] = None
        self.worker_task: Optional[asyncio.Task] = None
        self.handlers: Dict[str, JobHandler] = {
            "watchtower-analysis": self._handle_watchtower_analysis,
            "advisor-analysis": self._handle_advisor_analysis,
            "market-intelligence-scan": self._handle_market_intelligence_scan,
            "crm-ingestion": self._handle_crm_ingestion,
            "ai-reasoning-log": self._handle_ai_reasoning_log,
        }

    async def initialize(self) -> bool:
        if not self.redis_url:
            self.redis_connected = False
            self.last_error = "REDIS_URL not configured"
            logger.warning("Redis unavailable – continuing without queue.")
            return False

        try:
            retry = Retry(ExponentialBackoff(base=1, cap=8), 3)
            self.redis = Redis.from_url(
                self.redis_url,
                decode_responses=True,
                max_connections=12,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry=retry,
                retry_on_timeout=True,
                health_check_interval=30,
            )
            await self.redis.ping()
            self.redis_connected = True
            self.last_error = None
            logger.info("Redis connection established")
            return True
        except Exception as exc:  # pragma: no cover - defensive startup path
            self.redis_connected = False
            self.last_error = str(exc)
            self.redis = None
            logger.warning("Redis unavailable – continuing without queue.")
            logger.debug("Redis initialization failure detail: %s", exc)
            return False

    async def shutdown(self) -> None:
        if self.worker_task:
            self.worker_task.cancel()
            with suppress(asyncio.CancelledError):
                await self.worker_task
            self.worker_task = None

        if self.redis is not None:
            await self.redis.aclose()
            self.redis = None
        self.redis_connected = False

    async def start_worker(self) -> None:
        if not self.redis_connected or self.redis is None or self.worker_task:
            return
        self.worker_task = asyncio.create_task(self._worker_loop(), name="biqc-redis-worker")

    def health(self) -> Dict[str, Any]:
        queue_depth = 0
        delayed_depth = 0
        buffer_depth = 0

        if self.redis_connected and self.redis is not None:
            queue_depth = -1
            delayed_depth = -1
            buffer_depth = -1

        return {
            "redis_connected": self.redis_connected,
            "queue_namespace": QUEUE_NAMESPACE,
            "worker_running": bool(self.worker_task and not self.worker_task.done()),
            "last_error": self.last_error,
            "queue_depth": queue_depth,
            "delayed_depth": delayed_depth,
            "logging_buffer_depth": buffer_depth,
        }

    async def health_async(self) -> Dict[str, Any]:
        state = self.health()
        if not self.redis_connected or self.redis is None:
            return state

        try:
            state["queue_depth"] = await self.redis.llen(QUEUE_KEY)
            state["delayed_depth"] = await self.redis.zcard(DELAYED_KEY)
            state["logging_buffer_depth"] = await self.redis.llen(LOG_BUFFER_KEY)
        except Exception as exc:  # pragma: no cover - health fallback
            state["last_error"] = str(exc)
            state["redis_connected"] = False
        return state

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

        while True:
            try:
                await self._promote_delayed_jobs()
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

            if attempts >= 3 or self.redis is None:
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


biqc_jobs = BIQcRedisJobs()
