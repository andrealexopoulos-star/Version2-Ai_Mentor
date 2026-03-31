import asyncio
import json
import secrets
import time
import re
from pathlib import Path

from playwright.async_api import async_playwright


BASE_URL = "https://biqc-web-dev.azurewebsites.net"
OUT_DIR = Path(".screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def shot(name: str) -> str:
    return str(OUT_DIR / f"dev-cal-e2e-{int(time.time())}-{name}.png")


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
    suffix = secrets.token_hex(4)
    email = f"qa.dev.cal.{suffix}@example.com"
    password = f"QATest!{suffix}2026"
    screenshots = []
    notes = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        # Register
        await page.goto(f"{BASE_URL}/register-supabase", wait_until="domcontentloaded")
        screenshots.append(shot("01-register"))
        await page.screenshot(path=screenshots[-1], full_page=True)

        await page.fill('[data-testid="register-name-input"]', "QA Dev Calibration")
        await page.fill('[data-testid="register-email-input"]', email)
        await page.fill('[data-testid="register-company-input"]', "QA Dev Pty Ltd")
        await page.fill('[data-testid="register-industry-input"]', "Professional Services")
        await page.fill('[data-testid="register-password-input"]', password)
        await page.fill('[data-testid="register-confirm-password-input"]', password)
        await page.click('[data-testid="register-submit-btn"]')
        await page.wait_for_timeout(3500)

        # Solve fallback captcha on registration if present, then submit again.
        if await page.locator('[data-testid="register-fallback-captcha"]').count() > 0:
            challenge_text = await page.locator('[data-testid="register-fallback-captcha"]').inner_text()
            m = re.search(r"solve\s+(\d+)\s*\+\s*(\d+)", challenge_text, re.IGNORECASE)
            if m:
                answer = str(int(m.group(1)) + int(m.group(2)))
                await page.fill('[data-testid="register-fallback-captcha-input"]', answer)
                await page.click('[data-testid="register-submit-btn"]')
                await page.wait_for_timeout(5000)

        screenshots.append(shot("02-after-register"))
        await page.screenshot(path=screenshots[-1], full_page=True)

        # If signup redirected to login, sign in with same credentials.
        if "/login-supabase" in page.url:
            if await page.locator('[data-testid="login-email-input"]').count() > 0:
                await page.fill('[data-testid="login-email-input"]', email)
                await page.fill('[data-testid="login-password-input"]', password)
                await page.click('[data-testid="login-submit-btn"]')
                await page.wait_for_timeout(3200)
            if await page.locator('[data-testid="login-fallback-captcha"]').count() > 0:
                challenge_text = await page.locator('[data-testid="login-fallback-captcha"]').inner_text()
                m = re.search(r"solve\s+(\d+)\s*\+\s*(\d+)", challenge_text, re.IGNORECASE)
                if m:
                    answer = str(int(m.group(1)) + int(m.group(2)))
                    await page.fill('[data-testid="login-fallback-captcha-input"]', answer)
                    await page.click('[data-testid="login-submit-btn"]')
                    await page.wait_for_timeout(5500)

        # Ensure calibration route
        if "/calibration" not in page.url:
            await page.goto(f"{BASE_URL}/calibration", wait_until="domcontentloaded")
            await page.wait_for_timeout(3500)

        await close_tutorial_if_open(page)

        # Ignition + welcome
        await click_if_exists(page, '[data-testid="ignition-cta"]')
        await page.wait_for_timeout(1200)
        await close_tutorial_if_open(page)
        await click_if_exists(page, '[data-testid="welcome-continue-btn"]')
        await page.wait_for_timeout(900)

        # Prefer manual summary path (faster and deterministic)
        if await page.locator('[data-testid="website-url-input"]').count() > 0:
            used_manual = await click_if_exists(page, '[data-testid="no-website-btn"]')
            await page.wait_for_timeout(1000)
            if not used_manual:
                await page.fill('[data-testid="website-url-input"]', "thestrategysquad.com")
                await page.click('[data-testid="begin-audit-btn"]')
                await page.wait_for_timeout(11000)

        if await page.locator('[data-testid="manual-summary-input"]').count() > 0:
            await page.fill(
                '[data-testid="manual-summary-input"]',
                "We provide strategic advisory to founders and growth-stage operators in Australia.",
            )
            await page.click('[data-testid="submit-summary-btn"]')
            await page.wait_for_timeout(5500)

        # Identity verify
        if await page.locator('[data-testid="identity-confirm-btn"]').count() > 0:
            await close_tutorial_if_open(page)
            await page.click('[data-testid="identity-confirm-btn"]')
            await page.wait_for_timeout(1200)
            await click_if_exists(page, '[data-testid="low-confirm-yes-btn"]')
            await page.wait_for_timeout(2400)

        # CMO -> continue
        if await page.locator('[data-testid="cms-continue-btn"]').count() > 0:
            await page.click('[data-testid="cms-continue-btn"]')
            await page.wait_for_timeout(5500)

        # Agent calibration start
        await close_tutorial_if_open(page)
        started = await click_if_exists(page, '[data-testid="agent-calibration-start"]')
        await page.wait_for_timeout(4500)

        screenshots.append(shot("03-agent-calibration"))
        await page.screenshot(path=screenshots[-1], full_page=True)

        # Attempt to answer all 9 steps
        answered = 0
        for _ in range(12):
            if await page.locator('[data-testid="choice-0"]').count() > 0:
                await page.click('[data-testid="choice-0"]')
                answered += 1
                await page.wait_for_timeout(2600)
            elif await page.locator('[data-testid="agent-calibration-input"]').count() > 0:
                await page.fill('[data-testid="agent-calibration-input"]', "Balanced approach.")
                await page.click('[data-testid="agent-calibration-send"]')
                answered += 1
                await page.wait_for_timeout(2600)
            else:
                await page.wait_for_timeout(1200)

            if "/market" in page.url:
                break

        # Progress through post-chat steps if present
        await click_if_exists(page, '[data-testid="post-cmo-skip-btn"]')
        await page.wait_for_timeout(1200)
        await click_if_exists(page, '[data-testid="executive-snapshot-continue-btn"]')
        await page.wait_for_timeout(1200)

        screenshots.append(shot("04-end-state"))
        await page.screenshot(path=screenshots[-1], full_page=True)

        body = (await page.inner_text("body")).lower()
        reached_market = "/market" in page.url or "market intelligence" in body
        reached_agent = started or ("agent calibration" in body)

        notes.append(f"final_url={page.url}")
        notes.append(f"answered_count={answered}")
        notes.append(f"reached_agent_calibration={reached_agent}")
        notes.append(f"reached_market_or_post_calibration={reached_market}")

        await browser.close()

    print(
        json.dumps(
            {
                "email": email,
                "password": password,
                "screenshots": screenshots,
                "notes": notes,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(run())
