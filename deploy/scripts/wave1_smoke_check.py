#!/usr/bin/env python3
"""
Wave 1 hardening smoke checks.

Usage:
  python deploy/scripts/wave1_smoke_check.py

Environment variables:
  BACKEND_URL   (default: http://localhost:8000)
  FRONTEND_URL  (optional, for trust redirect checks)
  AUTH_TOKEN    (optional, for /api/auth/supabase/me check)
  SUPPORT_AUTH_TOKEN (optional, for super-admin support endpoint checks)
"""

import os
import sys
import requests


BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
FRONTEND_URL = os.getenv("FRONTEND_URL", "").rstrip("/")
AUTH_TOKEN = os.getenv("AUTH_TOKEN", "").strip()
SUPPORT_AUTH_TOKEN = os.getenv("SUPPORT_AUTH_TOKEN", "").strip()


def check(name: str, ok: bool, detail: str) -> bool:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")
    return ok


def main() -> int:
    overall_ok = True

    # 1) API health
    try:
        r = requests.get(f"{BACKEND_URL}/api/health", timeout=20)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        ok = r.status_code == 200 and body.get("status") == "healthy"
        overall_ok &= check("API health", ok, f"status={r.status_code}, body_status={body.get('status')}")
    except Exception as exc:
        overall_ok &= check("API health", False, f"error={exc}")

    # 2) Public contact request should succeed without auth
    payload = {
        "name": "Wave1 Smoke",
        "business_name": "BIQc Test",
        "email": "smoke-test@example.com",
        "phone": "+61000000000",
        "callback_date": "2026-03-24",
        "callback_time": "10:00",
        "description": "Wave 1 deployment smoke check",
        "feature_requested": "Smoke Check",
        "current_tier": "contact",
    }
    try:
        r = requests.post(f"{BACKEND_URL}/api/enterprise/contact-request", json=payload, timeout=20)
        ok = r.status_code == 200
        overall_ok &= check("Public contact submit", ok, f"status={r.status_code}")
    except Exception as exc:
        overall_ok &= check("Public contact submit", False, f"error={exc}")

    # 3) Optional auth check
    if AUTH_TOKEN:
        try:
            r = requests.get(
                f"{BACKEND_URL}/api/auth/supabase/me",
                headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
                timeout=20,
            )
            ok = r.status_code == 200
            overall_ok &= check("Auth me endpoint", ok, f"status={r.status_code}")
        except Exception as exc:
            overall_ok &= check("Auth me endpoint", False, f"error={exc}")
    else:
        print("[SKIP] Auth me endpoint: AUTH_TOKEN not provided")

    # 4) Stripe webhook hardening checks
    try:
        r = requests.post(f"{BACKEND_URL}/api/webhook/stripe", json={}, timeout=20)
        ok = r.status_code in (400, 503)
        overall_ok &= check("Stripe webhook missing signature", ok, f"status={r.status_code}")
    except Exception as exc:
        overall_ok &= check("Stripe webhook missing signature", False, f"error={exc}")

    try:
        r = requests.post(
            f"{BACKEND_URL}/api/webhook/stripe",
            json={},
            headers={"Stripe-Signature": "t=0,v1=invalid"},
            timeout=20,
        )
        ok = r.status_code in (400, 503)
        overall_ok &= check("Stripe webhook invalid signature", ok, f"status={r.status_code}")
    except Exception as exc:
        overall_ok &= check("Stripe webhook invalid signature", False, f"error={exc}")

    # 5) Optional frontend trust pages + legacy redirects
    if FRONTEND_URL:
        try:
            trust_pages = ["/trust/terms", "/trust/privacy", "/trust/dpa", "/trust/security", "/trust/centre"]
            for path in trust_pages:
                r = requests.get(f"{FRONTEND_URL}{path}", timeout=20)
                overall_ok &= check(f"Trust page {path}", r.status_code == 200, f"status={r.status_code}")

            legacy_redirects = {
                "/site/trust/terms": "/trust/terms",
                "/site/trust/privacy": "/trust/privacy",
                "/site/trust/dpa": "/trust/dpa",
                "/site/trust/security": "/trust/security",
                "/site/trust/centre": "/trust/centre",
                "/site/trust": "/trust",
            }
            for legacy, target in legacy_redirects.items():
                r = requests.get(f"{FRONTEND_URL}{legacy}", allow_redirects=False, timeout=20)
                location = r.headers.get("location", "")
                ok = r.status_code in (301, 302) and target in location
                overall_ok &= check(f"Legacy redirect {legacy}", ok, f"status={r.status_code}, location={location}")
        except Exception as exc:
            overall_ok &= check("Trust page and redirect checks", False, f"error={exc}")
    else:
        print("[SKIP] Trust page and redirect checks: FRONTEND_URL not provided")

    # 6) Optional super-admin support endpoint checks
    if SUPPORT_AUTH_TOKEN:
        headers = {"Authorization": f"Bearer {SUPPORT_AUTH_TOKEN}"}
        try:
            r = requests.get(f"{BACKEND_URL}/api/support/users", headers=headers, timeout=20)
            ok = r.status_code == 200
            overall_ok &= check("Support users endpoint", ok, f"status={r.status_code}")
        except Exception as exc:
            overall_ok &= check("Support users endpoint", False, f"error={exc}")

        try:
            r = requests.get(f"{BACKEND_URL}/api/super-admin/verify", headers=headers, timeout=20)
            ok = r.status_code == 200
            overall_ok &= check("Super admin verify endpoint", ok, f"status={r.status_code}")
        except Exception as exc:
            overall_ok &= check("Super admin verify endpoint", False, f"error={exc}")
    else:
        print("[SKIP] Super-admin support checks: SUPPORT_AUTH_TOKEN not provided")

    return 0 if overall_ok else 1


if __name__ == "__main__":
    sys.exit(main())
