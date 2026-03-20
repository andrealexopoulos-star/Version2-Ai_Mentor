import asyncio
import json
import time
from pathlib import Path

from playwright.async_api import async_playwright


BASE_URL = "https://biqc.thestrategysquad.com"
EMAIL = "andre@thestrategysquad.com.au"
PASSWORD = "MasterMind2025*"
OUT_DIR = Path(".screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def shot(name: str) -> str:
    return str(OUT_DIR / f"qa-live-{int(time.time())}-{name}.png")


async def click_if_exists(page, selector: str) -> bool:
    loc = page.locator(selector)
    if await loc.count() == 0:
        return False
    await loc.first.click()
    return True


async def run():
    screenshots = []
    notes = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1536, "height": 864})
        page = await ctx.new_page()

        # Login
        await page.goto(f"{BASE_URL}/login-supabase", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        if await page.locator('[data-testid="login-email-input"]').count() > 0:
            await page.fill('[data-testid="login-email-input"]', EMAIL)
            await page.fill('[data-testid="login-password-input"]', PASSWORD)
            await page.click('[data-testid="login-submit-btn"]')
            await page.wait_for_timeout(5000)
        else:
            notes.append("Login form not detected; continuing with existing authenticated session if available.")

        path = shot("10-authenticated-session")
        await page.screenshot(path=path, full_page=True)
        screenshots.append(path)

        # Open calibration and progress to agent calibration stage
        await page.goto(f"{BASE_URL}/calibration", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        await click_if_exists(page, '[data-testid="welcome-continue-btn"]')
        await page.wait_for_timeout(800)

        if await page.locator('[data-testid="website-url-input"]').count() > 0:
            # Fast-path to manual summary to avoid long website scan delays.
            clicked_manual = await click_if_exists(page, '[data-testid="no-website-btn"]')
            await page.wait_for_timeout(800)
            if not clicked_manual:
                await page.fill('[data-testid="website-url-input"]', "thestrategysquad.com")
                await page.click('[data-testid="begin-audit-btn"]')
                await page.wait_for_timeout(10000)

        if await page.locator('[data-testid="manual-summary-input"]').count() > 0:
            await page.fill('[data-testid="manual-summary-input"]', "We provide strategic business advisory services for founders and growth-stage operators in Australia.")
            await page.click('[data-testid="submit-summary-btn"]')
            await page.wait_for_timeout(5000)

        # Identity verification
        if await page.locator('[data-testid="identity-confirm-btn"]').count() > 0:
            await page.click('[data-testid="identity-confirm-btn"]')
            await page.wait_for_timeout(1200)
            await click_if_exists(page, '[data-testid="low-confirm-yes-btn"]')
            await page.wait_for_timeout(2500)

        # CMO summary -> continue
        if await page.locator('[data-testid="cms-continue-btn"]').count() > 0:
            await page.click('[data-testid="cms-continue-btn"]')
            await page.wait_for_timeout(4500)

        # Agent calibration screen
        await click_if_exists(page, '[data-testid="agent-calibration-start"]')
        await page.wait_for_timeout(5000)

        path = shot("11-agent-calibration-question")
        await page.screenshot(path=path, full_page=True)
        screenshots.append(path)

        # Answer one psychometric question and capture next step
        clicked_choice = await click_if_exists(page, '[data-testid="choice-0"]')
        if clicked_choice:
            await page.wait_for_timeout(5000)
            path = shot("12-agent-calibration-next-step")
            await page.screenshot(path=path, full_page=True)
            screenshots.append(path)
        else:
            notes.append("Could not select calibration choice chip in agent calibration chat.")

        # Back/forward in calibration
        await page.go_back(wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        path = shot("13-calibration-back-button")
        await page.screenshot(path=path, full_page=True)
        screenshots.append(path)

        await page.go_forward(wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        path = shot("14-calibration-forward-button")
        await page.screenshot(path=path, full_page=True)
        screenshots.append(path)

        await browser.close()

    print(json.dumps({"screenshots": screenshots, "notes": notes}, indent=2))


if __name__ == "__main__":
    asyncio.run(run())
