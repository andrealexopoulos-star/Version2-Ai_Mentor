#!/usr/bin/env python3
import asyncio
import json
from datetime import datetime
from pathlib import Path

import requests
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError


BASE_URL = "https://biqc.thestrategysquad.com"
PASSWORD = "BIQcTest!2026Z"
RUN_ID = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
OUT_DIR = Path("/workspace/.screenshots") / f"deep_calibration_probe_{RUN_ID}"
OUT_DIR.mkdir(parents=True, exist_ok=True)

ACCOUNTS = [
    ("auto10x_20260320_093459_01@biqctest.io", "qantas.com"),
    ("auto10x_20260320_093459_02@biqctest.io", "woolworths.com.au"),
    ("auto10x_20260320_093459_03@biqctest.io", "telstra.com.au"),
]


def api_probe(email: str):
    result = {"email": email}
    try:
        login = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": email, "password": PASSWORD},
            timeout=30,
        )
        result["login_status"] = login.status_code
        if login.status_code != 200:
            result["error"] = login.text[:300]
            return result
        data = login.json()
        token = (
            data.get("access_token")
            or data.get("token")
            or data.get("session", {}).get("access_token")
        )
        h = {"Authorization": f"Bearer {token}"}
        checks = {}
        for ep, method, payload in [
            ("/api/marketing/benchmark/latest", "GET", None),
            ("/api/marketing/benchmark", "POST", {"competitors": ["woolworths.com.au"]}),
            ("/api/competitive-benchmark/scores", "GET", None),
            ("/api/competitive-benchmark/refresh", "POST", None),
        ]:
            if method == "GET":
                r = requests.get(f"{BASE_URL}{ep}", headers=h, timeout=60)
            else:
                r = requests.post(f"{BASE_URL}{ep}", headers=h, json=payload, timeout=60)
            checks[ep] = {"status": r.status_code, "body": r.text[:400]}
        result["endpoint_checks"] = checks
    except Exception as exc:
        result["exception"] = str(exc)
    return result


async def safe_click(page, selector: str):
    try:
        await page.click(selector)
        return True
    except Exception:
        return False


async def safe_fill(page, selector: str, value: str):
    try:
        await page.fill(selector, value)
        return True
    except Exception:
        return False


async def screenshot(page, path: Path):
    try:
        await page.screenshot(path=str(path), full_page=True)
    except Exception:
        pass


async def text_or_empty(page, selector: str, limit=800):
    try:
        txt = await page.inner_text(selector)
        return (txt or "")[:limit]
    except Exception:
        return ""


async def dismiss_tutorial_if_any(page):
    await page.wait_for_timeout(800)
    if await page.locator('[data-testid="tutorial-overlay"]').count():
        await safe_click(page, '[data-testid="tutorial-dismiss-btn"]')
        await page.wait_for_timeout(600)


async def run_account(browser, email: str, website: str):
    account_dir = OUT_DIR / email.replace("@", "_at_")
    account_dir.mkdir(parents=True, exist_ok=True)
    out = {
        "email": email,
        "website": website,
        "screenshots": [],
        "calibration": {},
        "cmo_report": {},
        "cmo_snapshot": {},
        "competitor_page": {},
    }

    context = await browser.new_context(viewport={"width": 1536, "height": 960})
    page = await context.new_page()
    try:
        await page.goto(f"{BASE_URL}/login-supabase", wait_until="domcontentloaded")
        await safe_fill(page, '[data-testid="login-email-input"]', email)
        await safe_fill(page, '[data-testid="login-password-input"]', PASSWORD)
        await safe_click(page, '[data-testid="login-submit-btn"]')
        try:
            await page.wait_for_url("**/*", timeout=45000)
        except PlaywrightTimeoutError:
            pass
        await page.wait_for_timeout(1500)
        p = account_dir / "01_after_login.png"
        await screenshot(page, p)
        out["screenshots"].append(str(p))

        await page.goto(f"{BASE_URL}/calibration", wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        await dismiss_tutorial_if_any(page)
        p = account_dir / "02_calibration_landing.png"
        await screenshot(page, p)
        out["screenshots"].append(str(p))

        out["calibration"]["entry_url"] = page.url
        out["calibration"]["has_welcome_website_input"] = bool(
            await page.locator('[data-testid="website-url-input"]').count()
        )
        out["calibration"]["has_analyzing_state"] = bool(
            await page.locator('[data-testid="analyzing-state"]').count()
        )

        # If welcome stage is visible, trigger website audit.
        if out["calibration"]["has_welcome_website_input"]:
            await safe_fill(page, '[data-testid="website-url-input"]', website)
            await safe_click(page, '[data-testid="begin-audit-btn"]')
            await page.wait_for_timeout(2000)
            p = account_dir / "03_after_begin_audit.png"
            await screenshot(page, p)
            out["screenshots"].append(str(p))

        # Identity stage
        try:
            await page.wait_for_selector('[data-testid="forensic-identity-card"]', timeout=180000)
            out["calibration"]["identity_stage_reached"] = True
            out["calibration"]["identity_card_text"] = await text_or_empty(
                page, '[data-testid="forensic-identity-card"]', 1200
            )
            p = account_dir / "04_identity_stage.png"
            await screenshot(page, p)
            out["screenshots"].append(str(p))
            await safe_click(page, '[data-testid="identity-confirm-btn"]')
            await page.wait_for_timeout(1200)
            if await page.locator('[data-testid="low-confidence-warning"]').count():
                out["calibration"]["low_confidence_warning"] = True
                await safe_click(page, '[data-testid="low-confirm-yes-btn"]')
                await page.wait_for_timeout(900)
            else:
                out["calibration"]["low_confidence_warning"] = False
        except PlaywrightTimeoutError:
            out["calibration"]["identity_stage_reached"] = False

        # CMO report stage
        try:
            await page.wait_for_selector('[data-testid="chief-marketing-summary"]', timeout=140000)
            out["cmo_report"]["reached"] = True
            p = account_dir / "05_cmo_report.png"
            await screenshot(page, p)
            out["screenshots"].append(str(p))
            section_ids = [
                "business-summary",
                "presence-score",
                "communication-audit",
                "geographic-presence",
                "competitor-intelligence",
                "recommendations",
            ]
            for sid in section_ids:
                sel = f'[data-testid="{sid}"]'
                exists = bool(await page.locator(sel).count())
                out["cmo_report"][sid] = {
                    "present": exists,
                    "text": await text_or_empty(page, sel, 1200) if exists else "",
                }

            comp_txt = out["cmo_report"].get("competitor-intelligence", {}).get("text", "").lower()
            out["cmo_report"]["competitor_intel_mode"] = (
                "no_competitor_data_message"
                if "no competitor data detected" in comp_txt
                else "has_competitor_data"
            )
            await safe_click(page, '[data-testid="cms-continue-btn"]')
            await page.wait_for_timeout(1500)
        except PlaywrightTimeoutError:
            out["cmo_report"]["reached"] = False

        # Post CMO overlay
        if await page.locator('[data-testid="post-cmo-integration-overlay"]').count():
            out["cmo_report"]["post_overlay_reached"] = True
            p = account_dir / "06_post_cmo_overlay.png"
            await screenshot(page, p)
            out["screenshots"].append(str(p))
            # Continue without connecting to reach next intelligence stage.
            await safe_click(page, 'button:has-text("See What BIQc Found")')
            await page.wait_for_timeout(1500)
        else:
            out["cmo_report"]["post_overlay_reached"] = False

        # Executive CMO snapshot phase
        try:
            await page.wait_for_selector('[data-testid="cmo-snapshot"]', timeout=120000)
            out["cmo_snapshot"]["reached"] = True
            p = account_dir / "07_cmo_snapshot.png"
            await screenshot(page, p)
            out["screenshots"].append(str(p))
            for sid in [
                "snapshot-system-state",
                "snapshot-trajectory",
                "snapshot-moves",
                "snapshot-blindside",
                "snapshot-lever",
                "snapshot-data-gaps",
                "snapshot-confidence",
                "snapshot-analyzing-state",
                "cmo-continue-btn",
            ]:
                sel = f'[data-testid="{sid}"]'
                out["cmo_snapshot"][sid] = bool(await page.locator(sel).count())
            out["cmo_snapshot"]["system_state_text"] = await text_or_empty(
                page, '[data-testid="snapshot-system-state"]', 900
            )
        except PlaywrightTimeoutError:
            out["cmo_snapshot"]["reached"] = False

        # Competitor intelligence page
        await page.goto(f"{BASE_URL}/competitive-benchmark", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        await dismiss_tutorial_if_any(page)
        p = account_dir / "08_competitive_benchmark_page.png"
        await screenshot(page, p)
        out["screenshots"].append(str(p))

        out["competitor_page"]["has_page"] = bool(
            await page.locator('[data-testid="competitive-benchmark-page"]').count()
        )
        out["competitor_page"]["body_preview"] = await text_or_empty(page, "body", 2200)

        # Try competitor analysis in UI.
        await safe_fill(page, '[data-testid="competitor-input-0"]', "woolworths.com.au")
        await safe_click(page, '[data-testid="analyze-competitor-0"]')
        await page.wait_for_timeout(6000)
        p = account_dir / "09_competitor_analyze_result.png"
        await screenshot(page, p)
        out["screenshots"].append(str(p))
        out["competitor_page"]["after_analyze_preview"] = await text_or_empty(page, "body", 3000)
        lower = out["competitor_page"]["after_analyze_preview"].lower()
        out["competitor_page"]["queued_message_seen"] = "benchmark queued" in lower
        out["competitor_page"]["insufficient_data_seen"] = "insufficient data" in lower
        out["competitor_page"]["analysis_failed_seen"] = "analysis failed" in lower
    finally:
        await context.close()

    out["api_probe"] = api_probe(email)
    return out


async def main():
    report = {
        "run_id": RUN_ID,
        "base_url": BASE_URL,
        "started_at_utc": datetime.utcnow().isoformat() + "Z",
        "accounts": [],
    }
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for email, website in ACCOUNTS:
            report["accounts"].append(await run_account(browser, email, website))
        await browser.close()
    report["finished_at_utc"] = datetime.utcnow().isoformat() + "Z"
    out_file = OUT_DIR / "deep_probe_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(str(out_file))
    print(json.dumps(
        {
            "accounts_tested": len(report["accounts"]),
            "cmo_report_reached": sum(1 for a in report["accounts"] if a.get("cmo_report", {}).get("reached")),
            "cmo_snapshot_reached": sum(1 for a in report["accounts"] if a.get("cmo_snapshot", {}).get("reached")),
        },
        indent=2,
    ))


if __name__ == "__main__":
    asyncio.run(main())
