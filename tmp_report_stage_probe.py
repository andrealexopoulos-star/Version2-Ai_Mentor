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
    return str(OUT_DIR / f"dev-report-probe-{int(time.time())}-{name}.png")


async def click_by_text(page, text: str) -> bool:
    loc = page.locator(f"button:has-text('{text}')")
    if await loc.count() == 0:
        return False
    await loc.first.click()
    return True


async def run():
    qa_key = os.environ.get("QA_KEY", "").strip()
    if not qa_key:
        raise RuntimeError("QA_KEY required")

    events = []
    failed = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})

        def on_response(resp):
            url = resp.url
            status = resp.status
            if "/api/" in url:
                events.append({"status": status, "url": url})
                if status >= 400:
                    failed.append({"status": status, "url": url})

        page.on("response", on_response)

        await page.goto(f"{BASE_URL}/calibration-qa", wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)
        if await page.locator('input[placeholder="QA key"]').count() > 0:
            await page.fill('input[placeholder="QA key"]', qa_key)
            await click_by_text(page, "Unlock Calibration QA")
            await page.wait_for_timeout(2200)

        await click_by_text(page, "Meet BIQc")
        await page.wait_for_timeout(1200)
        await page.fill('input[placeholder="yourcompany.com"]', "thestrategysquad.com")
        await click_by_text(page, "Begin Strategic Audit")
        await page.wait_for_timeout(14000)

        await click_by_text(page, "Continue to Social Enrichment")
        await page.wait_for_timeout(1000)
        await click_by_text(page, "Continue to Identity Verification")
        await page.wait_for_timeout(1000)
        await click_by_text(page, "Yes — this is my business")
        await page.wait_for_timeout(800)
        await click_by_text(page, "Yes, continue anyway")
        await page.wait_for_timeout(900)
        await click_by_text(page, "Continue to Deep Narrative")
        await page.wait_for_timeout(800)
        await click_by_text(page, "Continue to 7/30/90 Roadmap")
        await page.wait_for_timeout(800)
        await click_by_text(page, "Continue to Report Generation")
        await page.wait_for_timeout(1200)

        pre = await page.inner_text("body")
        pre_shot = shot("before-generate")
        await page.screenshot(path=pre_shot, full_page=True)

        await click_by_text(page, "Generate Report and Continue")
        await page.wait_for_timeout(7000)

        post = await page.inner_text("body")
        post_shot = shot("after-generate")
        await page.screenshot(path=post_shot, full_page=True)

        print(
            json.dumps(
                {
                    "url": page.url,
                    "pre_excerpt": pre[:1200],
                    "post_excerpt": post[:1200],
                    "failed_api": failed[-20:],
                    "api_events_tail": events[-40:],
                    "screenshots": [pre_shot, post_shot],
                },
                indent=2,
            )
        )

        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
