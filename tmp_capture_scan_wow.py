import asyncio
import time
from pathlib import Path

from playwright.async_api import async_playwright

QA_KEY = "dev-qabypass-20260327"
OUT_DIR = Path(".screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)


async def main():
    out = OUT_DIR / f"dev-wow-scan-{int(time.time())}.png"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto("https://biqc-web-dev.azurewebsites.net/calibration-qa", wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)
        if await page.locator('input[placeholder="QA key"]').count() > 0:
            await page.fill('input[placeholder="QA key"]', QA_KEY)
            await page.click('button:has-text("Unlock Calibration QA")')
            await page.wait_for_timeout(900)
        if await page.locator('button:has-text("Meet BIQc")').count() > 0:
            await page.click('button:has-text("Meet BIQc")')
            await page.wait_for_timeout(400)
        if await page.locator('input[placeholder="yourcompany.com"]').count() > 0:
            await page.fill('input[placeholder="yourcompany.com"]', "thestrategysquad.com")
        if await page.locator('button:has-text("Begin Strategic Audit")').count() > 0:
            await page.click('button:has-text("Begin Strategic Audit")')
        await page.wait_for_timeout(1800)
        await page.screenshot(path=str(out), full_page=True)
        print(str(out))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
