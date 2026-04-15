"""Unit tests for the reCAPTCHA signup gate (Step 13 / P1-8).

Why this suite exists:
  Without a server-side captcha check on the signup path, a scripted
  attacker can POST /api/auth/supabase/signup directly and skip the
  browser-side /auth/recaptcha/verify step entirely. That path spins up
  a Supabase auth.users row (quota spend) and triggers a confirmation
  email (Resend spend) per attempt.

  backend.auth_supabase._enforce_signup_recaptcha closes that hole by
  verifying the client's token BEFORE touching Supabase. This test
  locks in the behaviour matrix:

    configured | token       | prod     -> 400 "Captcha token required"
    configured | token       | non-prod -> allow + log warning
    configured | present/ok  | any      -> allow
    configured | present/bad | any      -> 400 "Captcha verification failed"
    configured | present/503 | prod     -> 503 fail-closed
    configured | present/503 | non-prod -> allow + log warning
    not-config | anything    | any      -> no-op (gate disabled)
    verify_recaptcha_token   | skipped  -> allow (dev-bypass flag honoured)

  Plus the two helpers in routes.auth (recaptcha_is_configured and the
  verify_recaptcha_token wrapper) get direct coverage so we catch
  env-lookup regressions cheaply.

Note: we use asyncio.run() inside sync tests rather than depending on
pytest-asyncio (not pinned in requirements.txt).
"""
from __future__ import annotations

import asyncio
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Module import scaffolding ────────────────────────────────────────
#
# auth_supabase.py imports supabase_client at module load time, and the
# real supabase_client pulls in network config. Stub it out before any
# of our targets are imported so these tests never hit a real Supabase.

@pytest.fixture(autouse=True)
def _stub_supabase_imports(monkeypatch):
    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: None
    sb_stub.get_supabase_client = lambda: None
    sb_stub.safe_query_single = lambda *a, **k: types.SimpleNamespace(data=None)
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)
    yield


# ─── Helpers ──────────────────────────────────────────────────────────

def _clear_recaptcha_env(monkeypatch):
    """Drop every env var the reCAPTCHA helpers read. Tests opt-in to
    the ones they want so behaviour is deterministic regardless of the
    outer shell's state."""
    for name in (
        # Standard reCAPTCHA
        "RECAPTCHA_SECRET_KEY",
        "RECAPTCHA_SECRET",
        "GOOGLE_RECAPTCHA_SECRET_KEY",
        "GOOGLE_RECAPTCHA_SECRET",
        "CAPTCHA_SECRET_KEY",
        # Enterprise
        "RECAPTCHA_ENTERPRISE_PROJECT_ID",
        "GOOGLE_CLOUD_PROJECT",
        "GOOGLE_CLOUD_PROJECT_ID",
        "GOOGLE_PROJECT_ID",
        "RECAPTCHA_ENTERPRISE_API_KEY",
        "GOOGLE_API_KEY",
        "GOOGLE_CLOUD_API_KEY",
        "RECAPTCHA_API_KEY",
        # Env flags
        "ENVIRONMENT",
        "PRODUCTION",
    ):
        monkeypatch.delenv(name, raising=False)


def _make_signup_request(token=None):
    """Build a SignUpRequest; we only care about recaptcha_token here."""
    from auth_supabase import SignUpRequest

    return SignUpRequest(
        email="test@example.com",
        password="password123",
        full_name="Test",
        recaptcha_token=token,
    )


def _run(coro):
    """Thin shim so tests stay sync functions.

    Using asyncio.run directly avoids pulling in pytest-asyncio, which
    isn't pinned in requirements.txt. Creates a fresh event loop per
    call so stale state never leaks between assertions.
    """
    return asyncio.run(coro)


# ─── recaptcha_is_configured ──────────────────────────────────────────

def test_recaptcha_is_configured_false_without_env(monkeypatch):
    _clear_recaptcha_env(monkeypatch)
    from routes.auth import recaptcha_is_configured

    assert recaptcha_is_configured() is False


def test_recaptcha_is_configured_true_with_secret(monkeypatch):
    _clear_recaptcha_env(monkeypatch)
    monkeypatch.setenv("RECAPTCHA_SECRET_KEY", "6Lc_test_secret")
    from routes.auth import recaptcha_is_configured

    assert recaptcha_is_configured() is True


def test_recaptcha_is_configured_true_with_enterprise_trio(monkeypatch):
    _clear_recaptcha_env(monkeypatch)
    monkeypatch.setenv("RECAPTCHA_ENTERPRISE_PROJECT_ID", "biqc-prod")
    monkeypatch.setenv("RECAPTCHA_ENTERPRISE_API_KEY", "AIza-example")
    from routes.auth import recaptcha_is_configured

    assert recaptcha_is_configured() is True


def test_recaptcha_is_configured_false_with_enterprise_half(monkeypatch):
    """Enterprise needs BOTH project-id and api-key. Just one shouldn't trip."""
    _clear_recaptcha_env(monkeypatch)
    monkeypatch.setenv("RECAPTCHA_ENTERPRISE_PROJECT_ID", "biqc-prod")
    from routes.auth import recaptcha_is_configured

    assert recaptcha_is_configured() is False


# ─── _enforce_signup_recaptcha ────────────────────────────────────────

def test_gate_noop_when_not_configured_and_no_token(monkeypatch):
    """The common dev case: no RECAPTCHA_* env, no client token -> allow."""
    _clear_recaptcha_env(monkeypatch)

    from auth_supabase import _enforce_signup_recaptcha

    # Must NOT raise.
    _run(_enforce_signup_recaptcha(_make_signup_request(token=None)))


def test_gate_rejects_missing_token_in_production(monkeypatch):
    """Configured captcha + no token + production == 400, hard fail."""
    _clear_recaptcha_env(monkeypatch)
    monkeypatch.setenv("RECAPTCHA_SECRET_KEY", "6Lc_test_secret")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("PRODUCTION", "1")

    from auth_supabase import _enforce_signup_recaptcha

    with pytest.raises(HTTPException) as exc:
        _run(_enforce_signup_recaptcha(_make_signup_request(token=None)))
    assert exc.value.status_code == 400
    assert "Captcha token required" in exc.value.detail


def test_gate_allows_missing_token_in_dev(monkeypatch):
    """Configured captcha + no token + non-prod -> allow so local dev
    doesn't break when a developer forgets the site-key."""
    _clear_recaptcha_env(monkeypatch)
    monkeypatch.setenv("RECAPTCHA_SECRET_KEY", "6Lc_test_secret")
    monkeypatch.setenv("ENVIRONMENT", "local")

    from auth_supabase import _enforce_signup_recaptcha

    _run(_enforce_signup_recaptcha(_make_signup_request(token=None)))


def test_gate_passes_when_verify_returns_ok(monkeypatch):
    _clear_recaptcha_env(monkeypatch)
    monkeypatch.setenv("RECAPTCHA_SECRET_KEY", "6Lc_test_secret")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("PRODUCTION", "1")

    import routes.auth as routes_auth
    fake_verify = AsyncMock(return_value={"ok": True, "score": 0.9, "action": "register"})
    monkeypatch.setattr(routes_auth, "verify_recaptcha_token", fake_verify)

    from auth_supabase import _enforce_signup_recaptcha

    _run(_enforce_signup_recaptcha(_make_signup_request(token="valid-token")))
    fake_verify.assert_awaited_once()


def test_gate_rejects_when_verify_fails(monkeypatch):
    _clear_recaptcha_env(monkeypatch)
    monkeypatch.setenv("RECAPTCHA_SECRET_KEY", "6Lc_test_secret")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("PRODUCTION", "1")

    import routes.auth as routes_auth
    fake_verify = AsyncMock(return_value={"ok": False})
    monkeypatch.setattr(routes_auth, "verify_recaptcha_token", fake_verify)

    from auth_supabase import _enforce_signup_recaptcha

    with pytest.raises(HTTPException) as exc:
        _run(_enforce_signup_recaptcha(_make_signup_request(token="bad-token")))
    assert exc.value.status_code == 400
    assert "Captcha verification failed" in exc.value.detail


def test_gate_fail_closed_when_verifier_unavailable_in_prod(monkeypatch):
    """Google siteverify down or enterprise API 5xx -> 503 in production.
    We'd rather lose signups for a few minutes than admit bots."""
    _clear_recaptcha_env(monkeypatch)
    monkeypatch.setenv("RECAPTCHA_SECRET_KEY", "6Lc_test_secret")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("PRODUCTION", "1")

    import routes.auth as routes_auth
    fake_verify = AsyncMock(return_value={
        "ok": False, "unavailable": True, "reason": "captcha_verification_unavailable"
    })
    monkeypatch.setattr(routes_auth, "verify_recaptcha_token", fake_verify)

    from auth_supabase import _enforce_signup_recaptcha

    with pytest.raises(HTTPException) as exc:
        _run(_enforce_signup_recaptcha(_make_signup_request(token="any-token")))
    assert exc.value.status_code == 503
    assert "unavailable" in exc.value.detail.lower()


def test_gate_fail_open_when_verifier_unavailable_in_dev(monkeypatch):
    """Non-production: verifier unavailable is logged but not fatal."""
    _clear_recaptcha_env(monkeypatch)
    monkeypatch.setenv("RECAPTCHA_SECRET_KEY", "6Lc_test_secret")
    monkeypatch.setenv("ENVIRONMENT", "local")

    import routes.auth as routes_auth
    fake_verify = AsyncMock(return_value={
        "ok": False, "unavailable": True, "reason": "captcha_verification_unavailable"
    })
    monkeypatch.setattr(routes_auth, "verify_recaptcha_token", fake_verify)

    from auth_supabase import _enforce_signup_recaptcha

    # Must NOT raise — dev fail-open.
    _run(_enforce_signup_recaptcha(_make_signup_request(token="any-token")))


def test_gate_honours_skipped_flag(monkeypatch):
    """verify_recaptcha returns {ok:True, skipped:True} when the
    dev-bypass flag is set or when the secret isn't configured in a
    non-prod env. Gate must treat that as a clean pass."""
    _clear_recaptcha_env(monkeypatch)

    import routes.auth as routes_auth
    fake_verify = AsyncMock(return_value={"ok": True, "skipped": True})
    monkeypatch.setattr(routes_auth, "verify_recaptcha_token", fake_verify)

    from auth_supabase import _enforce_signup_recaptcha

    _run(_enforce_signup_recaptcha(_make_signup_request(token="dev-bypass")))


def test_gate_propagates_httpexception_from_verifier(monkeypatch):
    """If the verifier itself raises HTTPException (e.g. score-too-low),
    the gate must surface that exact status + detail to the user."""
    _clear_recaptcha_env(monkeypatch)
    monkeypatch.setenv("RECAPTCHA_SECRET_KEY", "6Lc_test_secret")

    import routes.auth as routes_auth
    fake_verify = AsyncMock(side_effect=HTTPException(status_code=400, detail="Captcha score too low"))
    monkeypatch.setattr(routes_auth, "verify_recaptcha_token", fake_verify)

    from auth_supabase import _enforce_signup_recaptcha

    with pytest.raises(HTTPException) as exc:
        _run(_enforce_signup_recaptcha(_make_signup_request(token="low-score-token")))
    assert exc.value.status_code == 400
    assert "score too low" in exc.value.detail.lower()


# ─── SignUpRequest model ──────────────────────────────────────────────

def test_signup_request_accepts_recaptcha_token():
    """Regression: don't break pydantic on the new optional field."""
    from auth_supabase import SignUpRequest

    req = SignUpRequest(
        email="a@b.com",
        password="password123",
        recaptcha_token="03AGdBq25...",
    )
    assert req.recaptcha_token == "03AGdBq25..."


def test_signup_request_recaptcha_token_optional():
    """Existing callers that don't send the field must still work."""
    from auth_supabase import SignUpRequest

    req = SignUpRequest(email="a@b.com", password="password123")
    assert req.recaptcha_token is None
