"""Tests for core.env_validator.

These tests mutate os.environ via monkeypatch and never hit the network
or Supabase. They cover:
  - production: missing HARD-required var raises (JWT/Supabase/OpenAI only)
  - production: missing warn-only var (Stripe/Resend/Redis) warns, never raises
  - production: sk_test_ Stripe key warns (not fatal — platform still boots)
  - production: placeholder Stripe price ID warns (not fatal)
  - dev: missing required var only warns
  - happy path: all vars present → ok

Background: we previously hard-required Stripe + Resend + admin email +
Redis + webhook secret. That caused the 2026-04-15 production outage because
those vars weren't set in Azure App Service. The platform doesn't need
Stripe/Resend/Redis to serve /health, /advisor, /soundboard, etc. — it only
needs them when a user actually tries to check out / send email / enqueue a
job. Those features now surface a 503 at request time rather than dragging
down the whole service.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core import env_validator  # noqa: E402
from core.env_validator import (  # noqa: E402
    EnvValidationError,
    PROD_REQUIRED,
    STRIPE_PRICE_ID_ENV_KEYS,
    validate_env_or_raise,
)


def _set_minimum_prod_env(monkeypatch):
    """Populate env with sane values so we can mutate one thing at a time."""
    defaults = {
        "ENVIRONMENT": "production",
        "PRODUCTION": "1",
        "JWT_SECRET_KEY": "x" * 32,
        "SUPABASE_URL": "https://project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "svc-role-key",
        "STRIPE_API_KEY": "sk_live_example",
        "STRIPE_WEBHOOK_SECRET": "whsec_example",
        "OPENAI_API_KEY": "sk-openai-example",
        "RESEND_API_KEY": "re_example",
        "RESEND_FROM_EMAIL": "noreply@biqc.ai",
        "BIQC_ADMIN_NOTIFICATION_EMAIL": "ops@biqc.ai",
        "REDIS_URL": "rediss://host:6380",
        # Valid price IDs (not placeholders)
        "REACT_APP_STRIPE_STARTER_PRICE_ID": "price_1AbC...",
        "REACT_APP_STRIPE_PRO_PRICE_ID": "price_1DeF...",
        "REACT_APP_STRIPE_BUSINESS_PRICE_ID": "price_1GhI...",
        "REACT_APP_STRIPE_ENTERPRISE_PRICE_ID": "price_1JkL...",
    }
    # Wipe anything that might leak from the outer shell first.
    for key in list(PROD_REQUIRED) + ["ENVIRONMENT", "PRODUCTION", "REDIS_URL"] + list(STRIPE_PRICE_ID_ENV_KEYS):
        monkeypatch.delenv(key, raising=False)
    # Also clear warn-only ones to keep a predictable report.
    for key in ("REACT_APP_RECAPTCHA_SITE_KEY", "GOOGLE_API_KEY", "ANTHROPIC_API_KEY", "FRONTEND_URL"):
        monkeypatch.delenv(key, raising=False)
    for k, v in defaults.items():
        monkeypatch.setenv(k, v)


# ─── Positive path ─────────────────────────────────────────────────

def test_prod_happy_path_ok(monkeypatch):
    _set_minimum_prod_env(monkeypatch)
    report = validate_env_or_raise()
    assert report["ok"] is True
    assert report["production"] is True
    assert report["errors"] == []


# ─── Missing required vars ─────────────────────────────────────────

@pytest.mark.parametrize("missing_var", list(PROD_REQUIRED))
def test_prod_missing_required_var_raises(monkeypatch, missing_var):
    _set_minimum_prod_env(monkeypatch)
    monkeypatch.delenv(missing_var, raising=False)
    with pytest.raises(EnvValidationError) as exc:
        validate_env_or_raise()
    assert missing_var in str(exc.value)


def test_prod_missing_redis_does_not_raise(monkeypatch):
    """Redis is warn-only — absence falls back to in-memory worker + rate limits."""
    _set_minimum_prod_env(monkeypatch)
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.delenv("AZURE_REDIS_HOST", raising=False)
    report = validate_env_or_raise()
    assert report["ok"] is True
    assert any("REDIS_URL" in w for w in report["warnings"])


def test_prod_missing_stripe_warns_does_not_raise(monkeypatch):
    """Stripe is warn-only — checkout endpoints will 503 at request time
    rather than blocking the whole service from booting."""
    _set_minimum_prod_env(monkeypatch)
    monkeypatch.delenv("STRIPE_API_KEY", raising=False)
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    report = validate_env_or_raise()
    assert report["ok"] is True
    assert any("STRIPE_API_KEY" in w for w in report["warnings"])


def test_prod_missing_resend_warns_does_not_raise(monkeypatch):
    """Resend is warn-only — contact form degrades to log-only rather than
    blocking the whole service from booting."""
    _set_minimum_prod_env(monkeypatch)
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("RESEND_FROM_EMAIL", raising=False)
    monkeypatch.delenv("BIQC_ADMIN_NOTIFICATION_EMAIL", raising=False)
    report = validate_env_or_raise()
    assert report["ok"] is True


# ─── Stripe warnings (non-fatal) ───────────────────────────────────

def test_prod_sk_test_stripe_key_warns(monkeypatch):
    """sk_test_ in production is a warning, not a hard fail — the service
    still boots so /health, /advisor, /soundboard all work while the key
    gets rotated."""
    _set_minimum_prod_env(monkeypatch)
    monkeypatch.setenv("STRIPE_API_KEY", "sk_test_123")
    report = validate_env_or_raise()
    assert report["ok"] is True
    assert any("TEST key" in w for w in report["warnings"])


def test_prod_placeholder_price_id_warns(monkeypatch):
    """Placeholder price IDs in production are a warning — Stripe checkout
    will surface the real error at request time when the price lookup fails."""
    _set_minimum_prod_env(monkeypatch)
    monkeypatch.setenv(
        "REACT_APP_STRIPE_STARTER_PRICE_ID", "price_biqc_growth_69",
    )
    report = validate_env_or_raise()
    assert report["ok"] is True
    assert any("placeholders" in w for w in report["warnings"])


def test_prod_multiple_placeholder_price_ids_warns(monkeypatch):
    _set_minimum_prod_env(monkeypatch)
    monkeypatch.setenv(
        "REACT_APP_STRIPE_PRO_PRICE_ID", "price_biqc_professional_199",
    )
    monkeypatch.setenv(
        "REACT_APP_STRIPE_BUSINESS_PRICE_ID", "price_placeholder_business",
    )
    report = validate_env_or_raise()
    assert report["ok"] is True
    all_warnings = " ".join(report["warnings"])
    assert "REACT_APP_STRIPE_PRO_PRICE_ID" in all_warnings
    assert "REACT_APP_STRIPE_BUSINESS_PRICE_ID" in all_warnings


# ─── Non-production behaviour ──────────────────────────────────────

def test_dev_env_does_not_raise_on_missing(monkeypatch, caplog):
    # Clear all critical env to simulate a fresh dev machine.
    for key in list(PROD_REQUIRED) + ["ENVIRONMENT", "PRODUCTION", "REDIS_URL", "AZURE_REDIS_HOST"]:
        monkeypatch.delenv(key, raising=False)
    # Explicitly NOT production.
    monkeypatch.setenv("ENVIRONMENT", "local")
    report = validate_env_or_raise()
    assert report["production"] is False
    # Validator returns a report with errors recorded but doesn't raise in dev.
    assert report["ok"] is False
    assert any("Missing required env vars" in e for e in report["errors"])


def test_dev_env_sk_test_is_allowed(monkeypatch):
    for key in list(PROD_REQUIRED) + ["ENVIRONMENT", "PRODUCTION", "REDIS_URL", "AZURE_REDIS_HOST"]:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("ENVIRONMENT", "local")
    # Only set what we need to test: a test-mode key should not itself raise
    # in dev because the surrounding required-var errors are also non-fatal.
    monkeypatch.setenv("STRIPE_API_KEY", "sk_test_123")
    report = validate_env_or_raise()
    assert report["production"] is False
    # Non-production paths never raise.
