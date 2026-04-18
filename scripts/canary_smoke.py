#!/usr/bin/env python3
"""
Canary smoke — post-deploy verification that critical public surfaces
actually render without the AppErrorBoundary / RouteErrorBoundary
fatal pages.

Added 2026-04-19 after the StripeCardField P1 incident. The old smoke
gate only checked backend endpoint HTTP status codes (200/401), so a
React render crash that left the Express server returning 200 but the
browser rendering a fatal page went undetected for 9.5 hours. This
script uses Playwright to actually RENDER the page and assert key DOM
markers exist (or that the error boundary text doesn't).

Run locally:
    python scripts/canary_smoke.py

CI: `.github/workflows/canary-smoke.yml` runs this after every deploy
and on a 10-minute schedule.

Environment:
    BASE_URL             — defaults to https://biqc.ai
    PLAYWRIGHT_TIMEOUT   — per-page ms, default 20000

Exit codes:
    0 = all checks passed
    1 = one or more assertions failed (CI should fail loudly)
    2 = setup / browser launch failed (flaky runner, not a prod issue)
"""
from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

BASE_URL = (os.environ.get("BASE_URL") or "https://biqc.ai").rstrip("/")
PLAYWRIGHT_TIMEOUT = int(os.environ.get("PLAYWRIGHT_TIMEOUT", "20000"))

# Strings that indicate one of our error boundaries has caught a crash.
# If any of these appear on a critical page, it's a production-breaking
# regression (exactly what PR #335 fixed).
ERROR_MARKERS = [
    "encountered an error",
    "Something went wrong",
    "FATAL-",
    "This section hit a problem",
    "Refresh Page",  # button text on AppErrorBoundary
]


@dataclass
class Check:
    name: str
    url: str
    # DOM markers that MUST be present (data-testid selectors or visible text).
    # Each entry is a (kind, value) tuple: ("testid", "plan-picker") or ("text", "Try for free").
    must_exist: List = field(default_factory=list)
    # Also verify we SPA-navigate here from the homepage without crashing
    # (catches the exact pattern of the PR #335 bug).
    spa_navigate_from: str = ""  # e.g. "/" — leave empty to skip


CHECKS: List[Check] = [
    Check(
        name="homepage renders",
        url="/",
        must_exist=[("text", "BIQc")],
    ),
    Check(
        name="pricing renders + has a paid plan",
        url="/pricing",
        must_exist=[("text", "Growth")],
    ),
    Check(
        name="register-supabase renders plan picker + Stripe card field",
        url="/register-supabase",
        must_exist=[
            ("testid", "plan-picker"),
            ("testid", "stripe-card-field"),
            ("testid", "register-submit-btn"),
        ],
        # Today's P1 only manifested on SPA nav — direct load worked.
        spa_navigate_from="/",
    ),
    Check(
        name="login-supabase renders",
        url="/login-supabase",
        must_exist=[("testid", "login-submit-btn")],
    ),
    Check(
        name="subscribe renders",
        url="/subscribe",
        must_exist=[("text", "Growth")],
    ),
]


def _has_error_marker(page_text: str) -> str | None:
    for marker in ERROR_MARKERS:
        if marker in page_text:
            return marker
    return None


def _assert_markers_present(page, must_exist: list) -> list:
    """Returns list of missing markers (empty list = all passed)."""
    missing = []
    for kind, value in must_exist:
        if kind == "testid":
            selector = f'[data-testid="{value}"]'
        elif kind == "text":
            # Case-insensitive contains — Playwright's text= selector
            selector = f'text=/{value}/i'
        else:
            raise ValueError(f"unknown marker kind: {kind}")
        try:
            el = page.query_selector(selector)
            if not el:
                missing.append((kind, value))
        except Exception as e:
            missing.append((kind, value, f"selector error: {e}"))
    return missing


def run() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("ERROR: playwright not installed. Run: pip install playwright && playwright install chromium", file=sys.stderr)
        return 2

    failures: list = []
    started_at = time.time()

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        except Exception as e:
            print(f"ERROR: browser launch failed — {e}", file=sys.stderr)
            return 2

        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent="BIQc-Canary-Smoke/1.0 (+canary_smoke.py)",
        )
        page = context.new_page()
        page.set_default_timeout(PLAYWRIGHT_TIMEOUT)

        # Collect console errors so we surface them even if the page
        # appears visually OK. Filter out benign third-party noise.
        console_errors: list = []
        def _on_console(msg):
            if msg.type == "error":
                text = msg.text[:500]
                # Benign noise we explicitly tolerate
                noisy = (
                    "googletagmanager",
                    "doubleclick",
                    "google-analytics",
                    "ResizeObserver loop",
                )
                if not any(n in text.lower() for n in noisy):
                    console_errors.append(text)
        page.on("console", _on_console)

        for check in CHECKS:
            full_url = f"{BASE_URL}{check.url}"
            try:
                page.goto(full_url, wait_until="networkidle")
                time.sleep(1.5)  # let React hydrate + Stripe Elements mount
                body_text = page.inner_text("body")
                marker = _has_error_marker(body_text)
                if marker:
                    failures.append({
                        "check": check.name,
                        "url": full_url,
                        "reason": f"error boundary text present: '{marker}'",
                    })
                    continue
                missing = _assert_markers_present(page, check.must_exist)
                if missing:
                    failures.append({
                        "check": check.name,
                        "url": full_url,
                        "reason": f"missing markers: {missing}",
                    })
                    continue

                if check.spa_navigate_from:
                    # Reproduce the PR #335 scenario — SPA-route into this
                    # page from elsewhere. Client-side transitions exercise
                    # a different code path than direct loads.
                    page.goto(f"{BASE_URL}{check.spa_navigate_from}", wait_until="networkidle")
                    time.sleep(1.0)
                    page.evaluate(
                        "(target) => { window.history.pushState({}, '', target); "
                        "window.dispatchEvent(new PopStateEvent('popstate')); }",
                        check.url,
                    )
                    time.sleep(3.0)
                    spa_body = page.inner_text("body")
                    spa_marker = _has_error_marker(spa_body)
                    if spa_marker:
                        failures.append({
                            "check": check.name + " [SPA nav]",
                            "url": f"{check.spa_navigate_from} → {check.url}",
                            "reason": f"error boundary on SPA nav: '{spa_marker}'",
                        })
                        continue
                    # Re-assert markers on SPA-nav path
                    spa_missing = _assert_markers_present(page, check.must_exist)
                    if spa_missing:
                        failures.append({
                            "check": check.name + " [SPA nav]",
                            "url": f"{check.spa_navigate_from} → {check.url}",
                            "reason": f"missing markers on SPA nav: {spa_missing}",
                        })
                        continue
            except Exception as e:
                failures.append({
                    "check": check.name,
                    "url": full_url,
                    "reason": f"exception: {e}",
                })

        browser.close()

    elapsed_ms = int((time.time() - started_at) * 1000)

    report = {
        "passed": not failures,
        "base_url": BASE_URL,
        "checks_run": len(CHECKS),
        "failures": failures,
        "console_errors": console_errors[:20],
        "elapsed_ms": elapsed_ms,
    }
    reports_dir = Path(__file__).resolve().parent.parent / "test_reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    out = reports_dir / f"canary_smoke_{time.strftime('%Y%m%d_%H%M%S', time.gmtime())}.json"
    out.write_text(json.dumps(report, indent=2))

    print(json.dumps({
        "passed": report["passed"],
        "failures": failures,
        "console_errors": console_errors[:5],
        "elapsed_ms": elapsed_ms,
        "artifact": str(out),
    }, indent=2))

    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(run())
