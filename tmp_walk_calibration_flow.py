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
    return str(OUT_DIR / f"dev-cal-walk-{int(time.time())}-{name}.png")


PRIORITY = [
    "meet biqc",
    "begin",
    "continue manually",
    "manual setup",
    "yes — this is my business",
    "yes, continue anyway",
    "start",
    "continue to social enrichment",
    "continue",
    "confirm",
    "yes",
    "regenerate scan",
    "unlock calibration qa",
    "skip",
    "done",
]


async def pick_button(page, button_texts):
    normalized = []
    for idx, txt in enumerate(button_texts):
        label = (txt or "").strip()
        if not label:
            continue
        try:
            enabled = await page.locator("button").nth(idx).is_enabled()
        except Exception:
            enabled = False
        normalized.append((idx, label, enabled))
    for token in PRIORITY:
        for idx, txt, enabled in normalized:
            if enabled and token in txt.lower():
                return idx, txt
    return None, None


async def run():
    qa_key = os.environ.get("QA_KEY", "").strip()
    if not qa_key:
        raise RuntimeError("QA_KEY required")

    trail = []
    screenshots = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(f"{BASE_URL}/calibration-qa", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)

        if await page.locator('input[placeholder="QA key"]').count() > 0:
            await page.fill('input[placeholder="QA key"]', qa_key)
            await page.click('button:has-text("Unlock Calibration QA")')
            await page.wait_for_timeout(2000)

        idle_loading_steps = 0
        for step in range(28):
            headings = [h.strip() for h in await page.locator("h1,h2,h3").all_inner_texts() if h.strip()]
            buttons = [b.strip() for b in await page.locator("button").all_inner_texts() if b.strip()]
            body_text = (await page.inner_text("body")).lower()
            screenshots.append(shot(f"{step:02d}"))
            await page.screenshot(path=screenshots[-1], full_page=True)
            trail.append({"step": step, "url": page.url, "headings": headings[:5], "buttons": buttons[:10]})

            # Special case: website scan screen requires a domain before CTA enables
            if any("let's scan your business" in h.lower() for h in headings):
                website_input = page.locator('input[placeholder="yourcompany.com"]')
                if await website_input.count() > 0:
                    await website_input.first.fill("thestrategysquad.com")
                    await page.wait_for_timeout(500)
                    trail.append({"step": step, "action": "fill website input"})

            # Special case: manual fallback requires summary text before continue
            if any("tell me about your business" in h.lower() for h in headings):
                summary_input = page.locator("textarea")
                if await summary_input.count() > 0:
                    await summary_input.first.fill(
                        "We provide strategic advisory to founders and growth-stage businesses in Australia."
                    )
                    await page.wait_for_timeout(500)
                    trail.append({"step": step, "action": "fill manual business summary"})

            idx, label = await pick_button(page, buttons)
            if idx is None:
                if await page.locator('[data-testid="choice-0"]').count() > 0:
                    await page.locator('[data-testid="choice-0"]').first.click()
                    trail.append({"step": step, "action": "click testid choice-0"})
                    idle_loading_steps = 0
                    await page.wait_for_timeout(2000)
                    continue
                idle_loading_steps += 1
                trail.append({"step": step, "action": "wait for loading state"})
                if idle_loading_steps > 12:
                    break
                await page.wait_for_timeout(3000)
                continue

            idle_loading_steps = 0
            # click by index to avoid duplicate text ambiguity
            await page.locator("button").nth(idx).click()
            trail.append({"step": step, "action": f"click button[{idx}] {label}"})
            await page.wait_for_timeout(2200)

        body = (await page.inner_text("body"))[:1600]
        await browser.close()

    print(json.dumps({"trail": trail, "screenshots": screenshots, "body_excerpt": body}, indent=2))


if __name__ == "__main__":
    asyncio.run(run())
