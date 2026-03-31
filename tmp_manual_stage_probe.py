import asyncio
import json
import os

from playwright.async_api import async_playwright

BASE_URL = "https://biqc-web-dev.azurewebsites.net"


async def click_text(page, text: str):
    loc = page.locator(f"button:has-text('{text}')")
    if await loc.count() > 0:
        await loc.first.click()
        return True
    return False


async def run():
    qa_key = os.environ.get("QA_KEY", "").strip()
    if not qa_key:
        raise RuntimeError("QA_KEY required")

    api_events = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})

        def on_response(resp):
            url = resp.url
            if any(token in url for token in ["/api/", "supabase.co/functions", "azurewebsites.net/api", "supabase.co/rest"]):
                api_events.append({"status": resp.status, "url": url})

        page.on("response", on_response)

        await page.goto(f"{BASE_URL}/calibration-qa", wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)
        if await page.locator('input[placeholder="QA key"]').count() > 0:
            await page.fill('input[placeholder="QA key"]', qa_key)
            await click_text(page, "Unlock Calibration QA")
            await page.wait_for_timeout(1500)

        await click_text(page, "Meet BIQc")
        await page.wait_for_timeout(1000)
        await page.fill('input[placeholder="yourcompany.com"]', "thestrategysquad.com")
        await click_text(page, "Begin Strategic Audit")
        await page.wait_for_timeout(2500)

        await click_text(page, "Regenerate Scan")
        await page.wait_for_timeout(1200)
        await click_text(page, "Continue manually after scan retries")
        await page.wait_for_timeout(1200)
        await page.fill("textarea", "We provide strategic advisory to founders and growth-stage businesses in Australia.")
        await click_text(page, "Continue")
        await page.wait_for_timeout(15000)

        body = await page.inner_text("body")
        print(
            json.dumps(
                {
                    "url": page.url,
                    "body_excerpt": body[:1800],
                    "events_tail": api_events[-40:],
                    "failed": [e for e in api_events if e["status"] >= 400][-20:],
                },
                indent=2,
            )
        )
        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
