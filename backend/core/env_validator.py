"""Startup env-var validator.

Fails fast in production if critical env vars are missing or look like
placeholders. In dev/local it logs warnings but never raises.

Called from server.py's startup event after config load, before Redis /
Supabase initialisation.
"""
from __future__ import annotations

import logging
import os
from typing import Iterable

logger = logging.getLogger(__name__)

# ─── Env-var groups ────────────────────────────────────────────────
# HARD-required in production — missing these = the service cannot function
# at all (can't sign JWTs, can't reach Supabase, can't call OpenAI). Absence
# raises EnvValidationError and halts startup.
PROD_REQUIRED: tuple[str, ...] = (
    "JWT_SECRET_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
)

# Required-in-production env vars where EITHER form is acceptable.
# Currently none are hard-required at boot. Redis is resilient — absence
# degrades to in-memory rate limits + local worker and is warned on.
PROD_REQUIRED_GROUPS: tuple[tuple[str, ...], ...] = ()

# Warn-only in production (non-fatal). Absence degrades UX but the service
# still boots and serves requests.
#
# NOTE: STRIPE_*, RESEND_*, and BIQC_ADMIN_NOTIFICATION_EMAIL are warn-only
# because:
#   • Stripe: /healthz, /advisor, /boardroom, /soundboard, /api/auth all work
#     without Stripe. Checkout endpoints will error with a clear message at
#     request-time rather than taking down the whole service.
#   • Resend + admin email: contact form gracefully logs instead of emailing
#     when unset. Not worth blocking the whole platform for.
#   • Redis: worker + rate-limit fall back to in-memory behaviour.
PROD_WARN_ONLY: tuple[str, ...] = (
    "STRIPE_API_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "BIQC_ADMIN_NOTIFICATION_EMAIL",
    "REDIS_URL",
    "AZURE_REDIS_HOST",
    "REACT_APP_RECAPTCHA_SITE_KEY",
    "GOOGLE_API_KEY",
    "ANTHROPIC_API_KEY",
    "FRONTEND_URL",
)

# Stripe placeholder price IDs — anything starting with these prefixes
# is the dev default that ships in frontend/src/config/tiers.js.
STRIPE_PLACEHOLDER_PRICE_PREFIXES: tuple[str, ...] = (
    "price_biqc_",
    "price_placeholder",
    "price_test_",
    "price_TEST_",
    "price_example",
)

# Env-var names that hold Stripe price IDs, checked for placeholders.
# 2026-05-04: Lite price ID env keys added per code 13041978.
STRIPE_PRICE_ID_ENV_KEYS: tuple[str, ...] = (
    "REACT_APP_STRIPE_LITE_PRICE_ID",
    "REACT_APP_STRIPE_STARTER_PRICE_ID",
    "REACT_APP_STRIPE_PRO_PRICE_ID",
    "REACT_APP_STRIPE_BUSINESS_PRICE_ID",
    "REACT_APP_STRIPE_ENTERPRISE_PRICE_ID",
    "STRIPE_LITE_PRICE_ID",
    "STRIPE_STARTER_PRICE_ID",
    "STRIPE_PRO_PRICE_ID",
    "STRIPE_BUSINESS_PRICE_ID",
    "STRIPE_ENTERPRISE_PRICE_ID",
)


class EnvValidationError(RuntimeError):
    """Raised when production env validation fails hard."""


# ─── Public helpers ────────────────────────────────────────────────

def is_production() -> bool:
    """Match the rest of the codebase's production-detection signal."""
    env = (os.environ.get("ENVIRONMENT") or "").strip().lower()
    prod_flag = (os.environ.get("PRODUCTION") or "").strip().lower()
    return env == "production" or prod_flag in {"1", "true", "yes"}


def _missing(name: str) -> bool:
    return not (os.environ.get(name) or "").strip()


def _collect_missing(keys: Iterable[str]) -> list[str]:
    return [k for k in keys if _missing(k)]


def _collect_missing_groups(groups: Iterable[tuple[str, ...]]) -> list[str]:
    out: list[str] = []
    for group in groups:
        if all(_missing(k) for k in group):
            out.append(" OR ".join(group))
    return out


def _stripe_api_key_issue() -> str | None:
    """Return a warning string if the Stripe API key looks wrong in prod.

    This is WARN-only — the service still boots with a test or missing key.
    Stripe endpoints will surface request-level errors at checkout time
    rather than dragging the whole platform down.
    """
    key = (os.environ.get("STRIPE_API_KEY") or "").strip()
    if not key:
        return None  # covered by missing-var warning
    if is_production() and key.startswith("sk_test_"):
        return (
            "STRIPE_API_KEY is a TEST key (sk_test_…) but ENVIRONMENT=production. "
            "Set a live key (sk_live_…) before accepting real payments."
        )
    if is_production() and not key.startswith(("sk_live_", "rk_live_")):
        return (
            "STRIPE_API_KEY does not look like a live Stripe secret key in production "
            "(expected sk_live_… or rk_live_…)."
        )
    return None


def _stripe_price_placeholders() -> list[str]:
    """Return list of env keys whose value looks like a placeholder price ID."""
    bad: list[str] = []
    for key in STRIPE_PRICE_ID_ENV_KEYS:
        val = (os.environ.get(key) or "").strip()
        if not val:
            continue
        if any(val.startswith(pref) for pref in STRIPE_PLACEHOLDER_PRICE_PREFIXES):
            bad.append(f"{key}={val!r}")
    return bad


def validate_env_or_raise() -> dict:
    """Validate all critical env vars.

    Behaviour:
      - In production: any failure → raise EnvValidationError.
      - In dev/local: log warnings but do not raise.

    Returns a structured report dict regardless of outcome (used by the
    /health endpoint and in tests).
    """
    errors: list[str] = []
    warnings: list[str] = []

    missing_required = _collect_missing(PROD_REQUIRED)
    missing_groups = _collect_missing_groups(PROD_REQUIRED_GROUPS)
    missing_warn = _collect_missing(PROD_WARN_ONLY)

    stripe_issue = _stripe_api_key_issue()
    placeholder_price_ids = _stripe_price_placeholders()

    # HARD errors — boot-critical vars only. Everything else becomes a warning.
    if missing_required:
        errors.append(f"Missing required env vars: {missing_required}")
    if missing_groups:
        errors.append(f"Missing env var (one of each group required): {missing_groups}")

    # Warnings — non-boot-critical. Platform runs but certain features degraded.
    if stripe_issue:
        warnings.append(stripe_issue)
    if placeholder_price_ids:
        warnings.append(
            "Stripe price IDs look like placeholders and must be replaced with "
            "real Stripe price IDs before accepting payments: "
            + ", ".join(placeholder_price_ids)
        )
    if missing_warn:
        warnings.append(f"Missing optional env vars: {missing_warn}")

    report = {
        "ok": not errors,
        "production": is_production(),
        "errors": errors,
        "warnings": warnings,
    }

    if errors:
        if is_production():
            for err in errors:
                logger.error("[EnvValidator] %s", err)
            raise EnvValidationError(
                "Env validation failed in production: "
                + " | ".join(errors)
            )
        # dev/local: surface loudly but do not block startup.
        for err in errors:
            logger.warning("[EnvValidator] (dev) %s", err)

    for warn in warnings:
        logger.warning("[EnvValidator] %s", warn)

    if report["ok"]:
        logger.info(
            "[EnvValidator] all required env vars present (production=%s)",
            report["production"],
        )
    return report
