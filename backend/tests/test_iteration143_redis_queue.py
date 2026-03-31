import logging
import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from biqc_jobs import BIQcRedisJobs, QUEUE_NAMESPACE


class FakeRedis:
    def __init__(self, duplicate=False):
        self.duplicate = duplicate
        self.rpush_calls = []
        self.lpush_calls = []

    async def ping(self):
        return True

    async def aclose(self):
        return None

    async def set(self, *args, **kwargs):
        return None if self.duplicate else True

    async def rpush(self, key, value):
        self.rpush_calls.append((key, value))
        return 1

    async def lpush(self, key, value):
        self.lpush_calls.append((key, value))
        return 1

    async def ltrim(self, *args, **kwargs):
        return True

    async def llen(self, *args, **kwargs):
        return 0

    async def zcard(self, *args, **kwargs):
        return 0


class FakeRedisCtor(FakeRedis):
    def __init__(self, *args, **kwargs):
        super().__init__()
        self.kwargs = kwargs


def test_redis_initialize_success(monkeypatch, caplog):
    fake_redis = FakeRedis()
    monkeypatch.setenv("REDIS_URL", "rediss://:secret@example.redis.cache.windows.net:6380")
    monkeypatch.setattr("biqc_jobs.Redis.from_url", lambda *args, **kwargs: fake_redis)

    runtime = BIQcRedisJobs()
    async def runner():
        with caplog.at_level(logging.INFO):
            ok = await runtime.initialize()
        assert ok is True
        assert runtime.redis_connected is True
        assert "Redis connection established" in caplog.text
        await runtime.shutdown()

    asyncio.run(runner())


def test_redis_initialize_failure(monkeypatch, caplog):
    monkeypatch.setenv("REDIS_URL", "rediss://:secret@example.redis.cache.windows.net:6380")

    def raise_error(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr("biqc_jobs.Redis.from_url", raise_error)

    runtime = BIQcRedisJobs()
    async def runner():
        with caplog.at_level(logging.WARNING):
            ok = await runtime.initialize()
        assert ok is False
        assert runtime.redis_connected is False
        assert "Redis unavailable – continuing without queue." in caplog.text

    asyncio.run(runner())


def test_queue_namespace_and_health(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setenv("REDIS_URL", "rediss://:secret@example.redis.cache.windows.net:6380")
    monkeypatch.setattr("biqc_jobs.Redis.from_url", lambda *args, **kwargs: fake_redis)

    runtime = BIQcRedisJobs()
    async def runner():
        await runtime.initialize()
        health = await runtime.health_async()

        assert health["queue_namespace"] == QUEUE_NAMESPACE
        assert health["redis_connected"] is True
        await runtime.shutdown()

    asyncio.run(runner())


def test_deterministic_job_id_and_duplicate_protection(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setenv("REDIS_URL", "rediss://:secret@example.redis.cache.windows.net:6380")
    monkeypatch.setattr("biqc_jobs.Redis.from_url", lambda *args, **kwargs: fake_redis)

    runtime = BIQcRedisJobs()
    async def runner():
        await runtime.initialize()

        job_id_1 = runtime.build_job_id("company-1", "watchtower-analysis", 123)
        job_id_2 = runtime.build_job_id("company-1", "watchtower-analysis", 123)
        assert job_id_1 == job_id_2

        queued = await runtime.enqueue_job(
            company_id="company-1",
            job_type="watchtower-analysis",
            payload={"user_id": "user-1"},
            window_seconds=300,
        )
        assert queued["queued"] is True
        assert queued["namespace"] == QUEUE_NAMESPACE
        assert fake_redis.rpush_calls, "job should be pushed to queue"

        runtime.redis = FakeRedis(duplicate=True)
        duplicate = await runtime.enqueue_job(
            company_id="company-1",
            job_type="watchtower-analysis",
            payload={"user_id": "user-1"},
            window_seconds=300,
        )
        assert duplicate["duplicate"] is True
        assert duplicate["queued"] is False
        await runtime.shutdown()

    asyncio.run(runner())


def test_azure_connection_string_supported(monkeypatch, caplog):
    fake_instance = FakeRedisCtor()

    class FakeRedisFactory:
        @staticmethod
        def from_url(*args, **kwargs):
            raise AssertionError('from_url should not be used for Azure classic connection string')

        def __call__(self, *args, **kwargs):
            fake_instance.kwargs = kwargs
            return fake_instance

    monkeypatch.setenv(
        'REDIS_URL',
        'biqc-redis.redis.cache.windows.net:6380,password=secret-key,ssl=True,abortConnect=False'
    )
    monkeypatch.setattr('biqc_jobs.Redis', FakeRedisFactory())

    runtime = BIQcRedisJobs()

    async def runner():
        with caplog.at_level(logging.INFO):
            ok = await runtime.initialize()
        assert ok is True
        assert runtime.redis_connected is True
        assert fake_instance.kwargs['host'] == 'biqc-redis.redis.cache.windows.net'
        assert fake_instance.kwargs['port'] == 6380
        assert fake_instance.kwargs['password'] == 'secret-key'
        assert fake_instance.kwargs['ssl'] is True
        await runtime.shutdown()

    asyncio.run(runner())


def test_managed_identity_redis_uses_credential_provider(monkeypatch):
    monkeypatch.setenv("REDIS_USE_MANAGED_IDENTITY", "true")
    monkeypatch.setenv("REDIS_URL", "rediss://example.redis.cache.windows.net:6380")
    monkeypatch.setenv("REDIS_AAD_USERNAME", "00000000-0000-0000-0000-000000000001")

    class FakeMI:
        def __init__(self, client_id=None):
            self.client_id = client_id

        async def get_token(self, scope):
            from azure.core.credentials import AccessToken

            return AccessToken("x", 9999999999)

        async def close(self):
            return None

    monkeypatch.setattr("azure.identity.aio.ManagedIdentityCredential", FakeMI)

    fake_instance = FakeRedisCtor()

    class FakeRedisFactory:
        @staticmethod
        def from_url(*args, **kwargs):
            raise AssertionError("from_url should not be used for MI URL without password")

        def __call__(self, *args, **kwargs):
            fake_instance.kwargs = kwargs
            return fake_instance

    monkeypatch.setattr("biqc_jobs.Redis", FakeRedisFactory())

    runtime = BIQcRedisJobs()

    async def runner():
        ok = await runtime.initialize()
        assert ok is True
        assert fake_instance.kwargs.get("credential_provider") is not None
        assert fake_instance.kwargs["host"] == "example.redis.cache.windows.net"
        assert fake_instance.kwargs["ssl"] is True
        await runtime.shutdown()

    asyncio.run(runner())


def test_managed_identity_with_password_prefers_access_key_path(monkeypatch):
    """REDIS_USE_MANAGED_IDENTITY must not override an explicit Redis access key."""
    monkeypatch.setenv("REDIS_USE_MANAGED_IDENTITY", "true")
    monkeypatch.setenv("REDIS_URL", "rediss://:secret@example.redis.cache.windows.net:6380")
    fake_redis = FakeRedis()
    monkeypatch.setattr("biqc_jobs.Redis.from_url", lambda *args, **kwargs: fake_redis)

    runtime = BIQcRedisJobs()

    async def runner():
        ok = await runtime.initialize()
        assert ok is True
        assert runtime._redis_mi_provider is None
        await runtime.shutdown()

    asyncio.run(runner())
