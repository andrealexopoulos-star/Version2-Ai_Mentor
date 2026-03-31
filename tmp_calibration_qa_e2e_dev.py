import asyncio
import json
import os
import time
from pathlib import Path

from playwright.async_api import async_playwright


BASE_URL = "https://biqc-web-dev.azurewebsites.net"
OUT_DIR = Path(".screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def shot(name: str) -> str:
    return str(OUT_DIR / f"dev-cal-qa-e2e-{int(time.time())}-{name}.png")


async def click_if_exists(page, selector: str) -> bool:
    loc = page.locator(selector)
    if await loc.count() == 0:
        return False
    await loc.first.click()
    return True


async def close_tutorial_if_open(page) -> None:
    if await page.locator('[data-testid="tutorial-overlay"]').count() == 0:
        return
    for selector in [
        '[data-testid="tutorial-done-btn"]',
        '[data-testid="tutorial-next-btn"]',
        '[data-testid="tutorial-close-btn"]',
        '[data-testid="tutorial-dismiss-btn"]',
    ]:
        if await page.locator(selector).count() > 0:
            await page.locator(selector).first.click()
            await page.wait_for_timeout(300)
            if await page.locator('[data-testid="tutorial-overlay"]').count() == 0:
                return


async def run():
    qa_key = os.environ.get("QA_KEY", "").strip()
    if not qa_key:
        raise RuntimeError("QA_KEY environment variable is required")

    screenshots = []
    notes = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        await page.goto(f"{BASE_URL}/calibration-qa", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        screenshots.append(shot("01-qa-gate"))
        await page.screenshot(path=screenshots[-1], full_page=True)

        # Unlock QA gate
        if await page.locator('input[placeholder="QA key"]').count() > 0:
            await page.fill('input[placeholder="QA key"]', qa_key)
            await page.click('button:has-text("Unlock Calibration QA")')
            await page.wait_for_timeout(2500)

        screenshots.append(shot("02-after-qa-unlock"))
        await page.screenshot(path=screenshots[-1], full_page=True)

        # Start calibration flow
        await close_tutorial_if_open(page)
        await click_if_exists(page, '[data-testid="ignition-cta"]')
        await page.wait_for_timeout(1200)
        await close_tutorial_if_open(page)
        await click_if_exists(page, '[data-testid="welcome-continue-btn"]')
        await page.wait_for_timeout(1000)

        # Fast path manual summary
        if await page.locator('[data-testid="website-url-input"]').count() > 0:
            used_manual = await click_if_exists(page, '[data-testid="no-website-btn"]')
            await page.wait_for_timeout(900)
            if not used_manual:
                await page.fill('[data-testid="website-url-input"]', "thestrategysquad.com")
                await page.click('[data-testid="begin-audit-btn"]')
                await page.wait_for_timeout(12000)

        if await page.locator('[data-testid="manual-summary-input"]').count() > 0:
            await page.fill(
                '[data-testid="manual-summary-input"]',
                "We provide strategic advisory services to founders and growth-stage businesses in Australia.",
            )
            await page.click('[data-testid="submit-summary-btn"]')
            await page.wait_for_timeout(5500)

        # Identity confirmation
        if await page.locator('[data-testid="identity-confirm-btn"]').count() > 0:
            await page.click('[data-testid="identity-confirm-btn"]')
            await page.wait_for_timeout(1200)
            await click_if_exists(page, '[data-testid="low-confirm-yes-btn"]')
            await page.wait_for_timeout(2500)

        # CMO continue
        if await page.locator('[data-testid="cms-continue-btn"]').count() > 0:
            await page.click('[data-testid="cms-continue-btn"]')
            await page.wait_for_timeout(5500)

        # Agent calibration
        await close_tutorial_if_open(page)
        started = await click_if_exists(page, '[data-testid="agent-calibration-start"]')
        await page.wait_for_timeout(4500)
        screenshots.append(shot("03-agent-chat-start"))
        await page.screenshot(path=screenshots[-1], full_page=True)

        answered = 0
        for _ in range(15):
            if await page.locator('[data-testid="choice-0"]').count() > 0:
                await page.click('[data-testid="choice-0"]')
                answered += 1
                await page.wait_for_timeout(2600)
            elif await page.locator('[data-testid="agent-calibration-input"]').count() > 0:
                await page.fill('[data-testid="agent-calibration-input"]', "Balanced and data-driven.")
                await page.click('[data-testid="agent-calibration-send"]')
                answered += 1
                await page.wait_for_timeout(2600)
            else:
                await page.wait_for_timeout(1200)

            if "/market" in page.url:
                break

        screenshots.append(shot("04-post-agent"))
        await page.screenshot(path=screenshots[-1], full_page=True)

        # Move through overlays to final state if present
        await click_if_exists(page, '[data-testid="post-cmo-skip-btn"]')
        await page.wait_for_timeout(1200)
        await click_if_exists(page, '[data-testid="executive-snapshot-continue-btn"]')
        await page.wait_for_timeout(1500)

        screenshots.append(shot("05-final-state"))
        await page.screenshot(path=screenshots[-1], full_page=True)

        body = (await page.inner_text("body")).lower()
        reached_market = "/market" in page.url or "market intelligence" in body
        reached_agent = started or "agent calibration" in body

        notes.append(f"final_url={page.url}")
        notes.append(f"answered_count={answered}")
        notes.append(f"reached_agent_calibration={reached_agent}")
        notes.append(f"reached_market_or_post_calibration={reached_market}")

        await browser.close()

    print(json.dumps({"screenshots": screenshots, "notes": notes}, indent=2))


if __name__ == "__main__":
    asyncio.run(run())
