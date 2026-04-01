import asyncio
import json
import secrets
import time
from pathlib import Path

from playwright.async_api import async_playwright


BASE_URL = "https://biqc.ai"
FALLBACK_EMAIL = "andre@thestrategysquad.com.au"
FALLBACK_PASSWORD = "MasterMind2025*"
OUT_DIR = Path(".screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def stamp(name: str) -> str:
    ts = int(time.time())
    return str(OUT_DIR / f"qa-live-{ts}-{name}.png")


async def maybe_click(page, selector: str) -> bool:
    el = page.locator(selector)
    if await el.count() == 0:
        return False
    await el.first.click()
    return True


async def close_tutorial_if_open(page) -> None:
    if await page.locator('[data-testid="tutorial-overlay"]').count() == 0:
        return
    for selector in ['[data-testid="tutorial-done-btn"]', '[data-testid="tutorial-next-btn"]', '[data-testid="tutorial-close-btn"]', '[data-testid="tutorial-dismiss-btn"]']:
        if await page.locator(selector).count() > 0:
            await page.locator(selector).first.click()
            await page.wait_for_timeout(400)
            if await page.locator('[data-testid="tutorial-overlay"]').count() == 0:
                return


async def run():
    suffix = secrets.token_hex(3)
    email = f"qa.calibration.{suffix}@example.com"
    password = f"QATest!{suffix}2026"
    shots = []
    notes = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1536, "height": 864})
        page = await context.new_page()

        # 1) Sign-up
        await page.goto(f"{BASE_URL}/register-supabase", wait_until="domcontentloaded")
        path = stamp("01-signup-page")
        await page.screenshot(path=path, full_page=True)
        shots.append(path)

        await page.fill('[data-testid="register-name-input"]', "QA Calibration")
        await page.fill('[data-testid="register-email-input"]', email)
        await page.fill('[data-testid="register-company-input"]', "QA Trust Test Pty Ltd")
        await page.fill('[data-testid="register-industry-input"]', "Professional Services")
        await page.fill('[data-testid="register-password-input"]', password)
        await page.fill('[data-testid="register-confirm-password-input"]', password)
        await page.click('[data-testid="register-submit-btn"]')
        await page.wait_for_timeout(2500)

        path = stamp("02-post-signup-state")
        await page.screenshot(path=path, full_page=True)
        shots.append(path)

        # 2) Ensure authenticated state
        body_now = (await page.inner_text("body")).lower()
        if "signed in as" in body_now:
            notes.append("Session authenticated immediately after signup.")
            path = stamp("03-authenticated-after-signup")
            await page.screenshot(path=path, full_page=True)
            shots.append(path)
        else:
            await page.goto(f"{BASE_URL}/login-supabase", wait_until="domcontentloaded")
            await page.wait_for_timeout(1500)
            path = stamp("03-login-page")
            await page.screenshot(path=path, full_page=True)
            shots.append(path)
            if await page.locator('[data-testid="login-email-input"]').count() > 0:
                await page.fill('[data-testid="login-email-input"]', email)
                await page.fill('[data-testid="login-password-input"]', password)
                await page.click('[data-testid="login-submit-btn"]')
            else:
                await page.fill('input[type="email"]', email)
                await page.fill('input[type="password"]', password)
                await page.click('button[type="submit"]')
            await page.wait_for_timeout(5000)

        path = stamp("04-post-login-authenticated")
        await page.screenshot(path=path, full_page=True)
        shots.append(path)

        # 3) Calibration flow (progress all pre-steps to agent calibration chat)
        if "/calibration" not in page.url:
            await page.goto(f"{BASE_URL}/calibration", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        await close_tutorial_if_open(page)

        await maybe_click(page, '[data-testid="ignition-cta"]')
        await page.wait_for_timeout(1200)
        await close_tutorial_if_open(page)
        await maybe_click(page, '[data-testid="welcome-continue-btn"]')
        await page.wait_for_timeout(800)

        if await page.locator('[data-testid="website-url-input"]').count() > 0:
            used_manual = await maybe_click(page, '[data-testid="no-website-btn"]')
            await page.wait_for_timeout(1000)
            if not used_manual:
                await page.fill('[data-testid="website-url-input"]', "thestrategysquad.com")
                await page.click('[data-testid="begin-audit-btn"]')
                await page.wait_for_timeout(10000)

        if await page.locator('[data-testid="manual-summary-input"]').count() > 0:
            await page.fill('[data-testid="manual-summary-input"]', "We provide strategic advisory services to founders and growth-stage businesses in Australia.")
            await page.click('[data-testid="submit-summary-btn"]')
            await page.wait_for_timeout(5000)

        if await page.locator('[data-testid="identity-confirm-btn"]').count() > 0:
            await close_tutorial_if_open(page)
            await page.click('[data-testid="identity-confirm-btn"]')
            await page.wait_for_timeout(1000)
            await maybe_click(page, '[data-testid="low-confirm-yes-btn"]')
            await page.wait_for_timeout(2500)

        if await page.locator('[data-testid="cms-continue-btn"]').count() > 0:
            await close_tutorial_if_open(page)
            await page.click('[data-testid="cms-continue-btn"]')
            await page.wait_for_timeout(4500)

        await close_tutorial_if_open(page)
        await maybe_click(page, '[data-testid="agent-calibration-start"]')
        await page.wait_for_timeout(4500)
        path = stamp("05-calibration-psychometric-q1")
        await page.screenshot(path=path, full_page=True)
        shots.append(path)

        # Answer first step using suggestion chip
        await close_tutorial_if_open(page)
        clicked = await maybe_click(page, '[data-testid="choice-0"]')
        if clicked:
            await page.wait_for_timeout(5000)
            path = stamp("06-calibration-contextual-next-question")
            await page.screenshot(path=path, full_page=True)
            shots.append(path)
            body = await page.inner_text("body")
            generic_markers = ["moving to next step", "got it. moving to the next step", "thanks for sharing"]
            if any(m in body.lower() for m in generic_markers):
                notes.append("Generic transition copy still detected in calibration chat.")
            else:
                notes.append("Calibration chat shows contextual acknowledgement + psychometric next question.")
        else:
            notes.append("Could not click calibration choice chip; selector missing.")

        # 4) Back / forward trust check
        await page.go_back(wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        path = stamp("07-back-button-state")
        await page.screenshot(path=path, full_page=True)
        shots.append(path)

        await page.go_forward(wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        path = stamp("08-forward-return-state")
        await page.screenshot(path=path, full_page=True)
        shots.append(path)

        # 5) Dashboard/market placeholder check
        await page.goto(f"{BASE_URL}/market", wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)
        await maybe_click(page, '[data-testid="gaps-section"] button')
        await page.wait_for_timeout(1200)
        path = stamp("09-market-dashboard-after-back-test")
        await page.screenshot(path=path, full_page=True)
        shots.append(path)

        body = await page.inner_text("body")
        if "soon" in body.lower() or "connect marketing tools" in body.lower():
            notes.append("Dashboard still contains placeholder-style states in market view.")
        else:
            notes.append("Dashboard market view appears to avoid placeholder-style labels.")

        await browser.close()

    print(json.dumps({
        "email": email,
        "password": password,
        "screenshots": shots,
        "notes": notes,
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(run())
