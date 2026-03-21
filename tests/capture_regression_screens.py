import asyncio
import json
import os
import time
from pathlib import Path

from playwright.async_api import async_playwright


BASE_URL = os.getenv("BIQC_BASE_URL", "http://127.0.0.1:3001")
EMAIL = os.getenv("BIQC_LOGIN_EMAIL", "andre@thestrategysquad.com.au")
PASSWORD = os.getenv("BIQC_LOGIN_PASSWORD", "test1234***")
OUT_DIR = Path(".screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def shot(name: str) -> str:
    return str(OUT_DIR / f"regression-{int(time.time())}-{name}.png")


async def login(page):
    await page.goto(f"{BASE_URL}/login-supabase", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)

    if await page.locator('[data-testid="login-email-input"]').count() > 0:
        await page.fill('[data-testid="login-email-input"]', EMAIL)
        await page.fill('[data-testid="login-password-input"]', PASSWORD)
        await page.click('[data-testid="login-submit-btn"]')
    else:
        await page.fill('input[type="email"]', EMAIL)
        await page.fill('input[type="password"]', PASSWORD)
        await page.click('button[type="submit"]')

    await page.wait_for_url("**/advisor*", timeout=60000)
    await page.wait_for_timeout(2500)


async def run():
    result = {
        "checks": {},
        "screenshots": {},
    }
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        await login(page)

        sidebar_path = shot("01-sidebar")
        await page.screenshot(path=sidebar_path, full_page=True)
        sidebar_text = (await page.inner_text("body")).lower()
        result["checks"]["sidebar_priority_inbox_removed"] = "priority inbox" not in sidebar_text
        result["screenshots"]["sidebar"] = sidebar_path

        await page.goto(f"{BASE_URL}/soundboard", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        soundboard_path = shot("02-soundboard")
        await page.screenshot(path=soundboard_path, full_page=True)
        soundboard_text = (await page.inner_text("body")).lower()
        has_explainability_cards = all(
            token in soundboard_text
            for token in ["why you are seeing this", "why this matters now", "what to do next", "if ignored"]
        )
        result["checks"]["soundboard_explainability_cards_removed"] = not has_explainability_cards
        result["screenshots"]["soundboard"] = soundboard_path

        await page.goto(f"{BASE_URL}/integrations", wait_until="domcontentloaded")
        try:
            await page.wait_for_selector('[data-testid="integration-centre-section"]', timeout=20000)
        except Exception:
            await page.wait_for_timeout(3500)
        integrations_path = shot("03-integrations")
        await page.screenshot(path=integrations_path, full_page=True)
        has_centre = await page.locator('[data-testid="integration-centre-section"]').count() > 0
        has_old_upgrade_card = await page.locator('[data-testid="integrations-paid-upgrade-card"]').count() > 0
        result["checks"]["connectors_new_cards_visible"] = has_centre
        result["checks"]["connectors_old_upgrade_card_removed"] = not has_old_upgrade_card
        result["screenshots"]["integrations"] = integrations_path

        await browser.close()

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(run())
