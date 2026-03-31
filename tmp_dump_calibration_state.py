import asyncio
import json
import os

from playwright.async_api import async_playwright

BASE_URL = "https://biqc-web-dev.azurewebsites.net"


async def run():
    qa_key = os.environ.get("QA_KEY", "").strip()
    if not qa_key:
        raise RuntimeError("QA_KEY is required")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE_URL}/calibration-qa", wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)

        if await page.locator('input[placeholder="QA key"]').count() > 0:
            await page.fill('input[placeholder="QA key"]', qa_key)
            await page.click('button:has-text("Unlock Calibration QA")')
            await page.wait_for_timeout(3000)

        async def capture_state(label: str):
            headings = await page.locator("h1,h2,h3").all_inner_texts()
            buttons = await page.locator("button").all_inner_texts()
            links = await page.locator("a").all_inner_texts()
            inputs = await page.locator("input,textarea").evaluate_all(
                "els => els.map(e => ({tag:e.tagName.toLowerCase(),type:e.type||'',placeholder:e.placeholder||'',name:e.name||'',id:e.id||'',disabled:e.disabled}))"
            )
            body = await page.inner_text("body")
            return {
                "label": label,
                "url": page.url,
                "headings": [h.strip() for h in headings if h.strip()],
                "buttons": [b.strip() for b in buttons if b.strip()],
                "links": [l.strip() for l in links if l.strip()],
                "inputs": inputs,
                "body_excerpt": body[:1200],
            }

        states = [await capture_state("initial")]
        if await page.locator("button:has-text('Meet BIQc')").count() > 0:
            await page.locator("button:has-text('Meet BIQc')").first.click()
            await page.wait_for_timeout(1800)
            states.append(await capture_state("after_meet_biqc"))

        print(json.dumps({"states": states}, indent=2))

        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
