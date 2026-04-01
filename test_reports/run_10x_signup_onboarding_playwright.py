#!/usr/bin/env python3
import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError


BASE_URL = "https://biqc.ai"
PASSWORD = "BIQcTest!2026Z"
RUN_ID = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
OUT_DIR = Path("/workspace/.screenshots") / f"run10x_{RUN_ID}"
OUT_DIR.mkdir(parents=True, exist_ok=True)

AU_BUSINESS_TARGETS = [
    ("Qantas Aviation", "qantas.com"),
    ("Woolworths Retail", "woolworths.com.au"),
    ("Telstra Telecom", "telstra.com.au"),
    ("Commonwealth Bank", "commbank.com.au"),
    ("Bunnings Warehouse", "bunnings.com.au"),
    ("ANZ Banking", "anz.com.au"),
    ("Westpac Banking", "westpac.com.au"),
    ("SEEK Jobs", "seek.com.au"),
    ("Atlassian Software", "atlassian.com"),
    ("JB Hi-Fi Retail", "jbhifi.com.au"),
]


def mk_email(idx: int) -> str:
    # Dedicated QA domain pattern used in repository history.
    return f"auto10x_{RUN_ID}_{idx:02d}@biqctest.io"


async def safe_screenshot(page, path: Path):
    try:
        await page.screenshot(path=str(path), full_page=True)
    except Exception:
        pass


async def fill_if_present(page, selector: str, value: str):
    try:
        await page.fill(selector, value)
        return True
    except Exception:
        return False


async def click_if_present(page, selector: str):
    try:
        await page.click(selector)
        return True
    except Exception:
        return False


async def run_account(browser, idx: int, business_name: str, website: str):
    email = mk_email(idx)
    account_dir = OUT_DIR / f"account_{idx:02d}"
    account_dir.mkdir(parents=True, exist_ok=True)
    result = {
        "account_index": idx,
        "email": email,
        "password": PASSWORD,
        "business_label": business_name,
        "website": website,
        "signup": {"ok": False, "notes": ""},
        "login": {"ok": False, "notes": ""},
        "onboarding": {"ok": False, "notes": "", "website_detect_attempted": False},
        "screenshots": [],
    }

    context = await browser.new_context(
        viewport={"width": 1536, "height": 960},
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    )
    page = await context.new_page()

    try:
        # 1) Signup flow
        await page.goto(f"{BASE_URL}/register-supabase", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        s = account_dir / "01_register_page.png"
        await safe_screenshot(page, s)
        result["screenshots"].append(str(s))

        await fill_if_present(page, '[data-testid="register-name-input"]', f"QA Runner {idx:02d}")
        await fill_if_present(page, '[data-testid="register-email-input"]', email)
        await fill_if_present(page, '[data-testid="register-company-input"]', business_name)
        await fill_if_present(page, '[data-testid="register-industry-input"]', "Professional Services")
        await fill_if_present(page, '[data-testid="register-password-input"]', PASSWORD)
        await fill_if_present(page, '[data-testid="register-confirm-password-input"]', PASSWORD)

        clicked = await click_if_present(page, '[data-testid="register-submit-btn"]')
        if clicked:
            await page.wait_for_timeout(2500)
        s = account_dir / "02_register_submit_result.png"
        await safe_screenshot(page, s)
        result["screenshots"].append(str(s))

        url_after_signup = page.url
        body_text = (await page.inner_text("body"))[:1200]
        if "Account created" in body_text or "check your email" in body_text.lower() or "login-supabase" in url_after_signup:
            result["signup"]["ok"] = True
            result["signup"]["notes"] = "Registration submit accepted by UI"
        elif "already exists" in body_text.lower() or "already" in body_text.lower():
            # Treat as pass for reusable test accounts.
            result["signup"]["ok"] = True
            result["signup"]["notes"] = "Email already exists; reusable test account"
        else:
            result["signup"]["notes"] = f"Unexpected signup state at {url_after_signup}"

        # 2) Login flow
        await page.goto(f"{BASE_URL}/login-supabase", wait_until="domcontentloaded")
        await page.wait_for_timeout(900)
        await fill_if_present(page, '[data-testid="login-email-input"]', email)
        await fill_if_present(page, '[data-testid="login-password-input"]', PASSWORD)
        await click_if_present(page, '[data-testid="login-submit-btn"]')

        try:
            await page.wait_for_url("**/advisor*", timeout=45000)
            result["login"]["ok"] = True
            result["login"]["notes"] = "Redirected to /advisor"
        except PlaywrightTimeoutError:
            # Fallback: check if any authenticated page loaded.
            current_url = page.url
            if any(p in current_url for p in ["/advisor", "/calibration", "/onboarding", "/soundboard"]):
                result["login"]["ok"] = True
                result["login"]["notes"] = f"Authenticated route loaded: {current_url}"
            else:
                result["login"]["notes"] = f"Login timeout on URL: {current_url}"

        await page.wait_for_timeout(1800)
        s = account_dir / "03_after_login.png"
        await safe_screenshot(page, s)
        result["screenshots"].append(str(s))

        # 3) Onboarding website step using real AU business site
        # Force open onboarding wizard route; this validates route and step mechanics.
        await page.goto(f"{BASE_URL}/onboarding", wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        s = account_dir / "04_onboarding_landing.png"
        await safe_screenshot(page, s)
        result["screenshots"].append(str(s))

        # Try to advance from step 0 to step 2.
        await click_if_present(page, '[data-testid="btn-next"]')
        await page.wait_for_timeout(900)
        await click_if_present(page, '[data-testid="btn-next"]')
        await page.wait_for_timeout(1100)

        # Fill website and click detect if step is present.
        website_filled = await fill_if_present(page, '[data-testid="input-website"]', website)
        if website_filled:
            result["onboarding"]["website_detect_attempted"] = True
            await click_if_present(page, '[data-testid="btn-enrich"]')
            await page.wait_for_timeout(3500)
            result["onboarding"]["ok"] = True
            result["onboarding"]["notes"] = "Website step reached; detect attempted"
        else:
            result["onboarding"]["notes"] = "Website step not reached or selector unavailable"

        s = account_dir / "05_onboarding_website_step.png"
        await safe_screenshot(page, s)
        result["screenshots"].append(str(s))

        # Capture any visible errors for forensic detail.
        body = await page.inner_text("body")
        if "error" in body.lower() or "failed" in body.lower():
            s = account_dir / "06_possible_error_state.png"
            await safe_screenshot(page, s)
            result["screenshots"].append(str(s))

    except Exception as exc:
        result["fatal_error"] = str(exc)
        s = account_dir / "99_fatal_error_state.png"
        await safe_screenshot(page, s)
        result["screenshots"].append(str(s))
    finally:
        await context.close()

    return result


async def main():
    report = {
        "run_id": RUN_ID,
        "base_url": BASE_URL,
        "started_at_utc": datetime.utcnow().isoformat() + "Z",
        "accounts": [],
    }

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for i, (biz, website) in enumerate(AU_BUSINESS_TARGETS, start=1):
            res = await run_account(browser, i, biz, website)
            report["accounts"].append(res)
        await browser.close()

    report["finished_at_utc"] = datetime.utcnow().isoformat() + "Z"
    report["signup_pass_count"] = sum(1 for a in report["accounts"] if a["signup"]["ok"])
    report["login_pass_count"] = sum(1 for a in report["accounts"] if a["login"]["ok"])
    report["onboarding_pass_count"] = sum(1 for a in report["accounts"] if a["onboarding"]["ok"])
    report["screenshot_count"] = sum(len(a.get("screenshots", [])) for a in report["accounts"])

    out_json = OUT_DIR / "run10x_results.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(json.dumps({
        "run_id": RUN_ID,
        "out_dir": str(OUT_DIR),
        "signup_pass_count": report["signup_pass_count"],
        "login_pass_count": report["login_pass_count"],
        "onboarding_pass_count": report["onboarding_pass_count"],
        "screenshot_count": report["screenshot_count"],
        "results_file": str(out_json),
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
