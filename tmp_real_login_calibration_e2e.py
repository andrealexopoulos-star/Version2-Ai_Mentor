import asyncio
import json
import os
import re
import time
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = "https://biqc-web-dev.azurewebsites.net"
OUT_DIR = Path(".screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def shot(name: str) -> str:
    return str(OUT_DIR / f"dev-real-cal-e2e-{int(time.time())}-{name}.png")


PRIORITY = [
    "meet biqc",
    "continue manually",
    "manual",
    "begin",
    "continue to social enrichment",
    "continue to identity verification",
    "yes — this is my business",
    "yes, continue anyway",
    "regenerate scan",
    "continue to deep narrative",
    "continue to 7/30/90 roadmap",
    "continue to report generation",
    "generate report and continue",
    "continue",
    "start",
    "next",
    "yes",
    "skip",
    "done",
]


async def pick_enabled_button(page):
    labels = [b.strip() for b in await page.locator("button").all_inner_texts() if b.strip()]
    for token in PRIORITY:
        for idx, label in enumerate(labels):
            if token in label.lower():
                try:
                    if await page.locator("button").nth(idx).is_enabled():
                        return idx, label, labels
                except Exception:
                    pass
    return None, None, labels


async def run():
    email = (os.environ.get("E2E_EMAIL") or "").strip()
    password = (os.environ.get("E2E_PASSWORD") or "").strip()
    if not email or not password:
        raise RuntimeError("E2E_EMAIL and E2E_PASSWORD are required")

    trail = []
    shots = []
    api_events = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})

        def on_response(resp):
            url = resp.url
            if any(token in url for token in ["/api/", "supabase.co/functions", "supabase.co/rest"]):
                api_events.append({"status": resp.status, "url": url})

        page.on("response", on_response)

        # Login with real Supabase session.
        await page.goto(f"{BASE_URL}/login-supabase", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        await page.fill('[data-testid="login-email-input"]', email)
        await page.fill('[data-testid="login-password-input"]', password)
        await page.click('[data-testid="login-submit-btn"]')
        await page.wait_for_timeout(5000)
        # If fallback challenge appears after first submit, solve and retry.
        if "/login-supabase" in page.url and await page.locator('[data-testid="login-fallback-captcha"]').count() > 0:
            challenge_text = await page.locator('[data-testid="login-fallback-captcha"]').inner_text()
            m = re.search(r"solve\s+(\d+)\s*\+\s*(\d+)", challenge_text, re.IGNORECASE)
            if m:
                answer = str(int(m.group(1)) + int(m.group(2)))
                await page.fill('[data-testid="login-fallback-captcha-input"]', answer)
                await page.click('[data-testid="login-submit-btn"]')
                await page.wait_for_timeout(5000)

        # Enter calibration flow.
        await page.goto(f"{BASE_URL}/calibration", wait_until="domcontentloaded")
        await page.wait_for_timeout(2200)

        idle = 0
        for step in range(60):
            headings = [h.strip() for h in await page.locator("h1,h2,h3").all_inner_texts() if h.strip()]
            body = (await page.inner_text("body")).lower()
            idx, label, labels = await pick_enabled_button(page)
            shots.append(shot(f"{step:02d}"))
            await page.screenshot(path=shots[-1], full_page=True)
            trail.append({"step": step, "url": page.url, "headings": headings[:5], "buttons": labels[:10]})

            if "/login-supabase" in page.url:
                trail.append({"step": step, "action": "redirected_back_to_login"})
                break

            # Required inputs for gated CTAs
            if any("let's scan your business" in h.lower() for h in headings):
                website = page.locator('input[placeholder="yourcompany.com"]')
                if await website.count() > 0:
                    await website.first.fill("thestrategysquad.com")
                    trail.append({"step": step, "action": "fill website"})
                    await page.wait_for_timeout(400)
                    idx, label, labels = await pick_enabled_button(page)

            if any("tell me about your business" in h.lower() for h in headings):
                summary = page.locator("textarea")
                if await summary.count() > 0:
                    await summary.first.fill("We provide strategic advisory to founders and growth-stage businesses in Australia.")
                    trail.append({"step": step, "action": "fill summary"})
                    await page.wait_for_timeout(400)
                    idx, label, labels = await pick_enabled_button(page)

            if idx is not None:
                await page.locator("button").nth(idx).click()
                trail.append({"step": step, "action": f"click button[{idx}] {label}"})
                idle = 0
                await page.wait_for_timeout(2200)
            else:
                # Try chip/question interactions if present
                if await page.locator('[data-testid="choice-0"]').count() > 0:
                    await page.locator('[data-testid="choice-0"]').first.click()
                    trail.append({"step": step, "action": "click choice-0"})
                    idle = 0
                    await page.wait_for_timeout(2200)
                elif await page.locator('[data-testid="agent-calibration-input"]').count() > 0:
                    await page.fill('[data-testid="agent-calibration-input"]', "Balanced, structured, and practical.")
                    await page.click('[data-testid="agent-calibration-send"]')
                    trail.append({"step": step, "action": "send free-text answer"})
                    idle = 0
                    await page.wait_for_timeout(2200)
                else:
                    idle += 1
                    trail.append({"step": step, "action": "wait"})
                    if idle > 14:
                        break
                    await page.wait_for_timeout(3000)

            if "/market" in page.url or "/advisor" in page.url:
                trail.append({"step": step, "action": f"terminal page reached: {page.url}"})
                break

            if "calibration complete" in body:
                trail.append({"step": step, "action": "completion marker found in body"})
                break

        final_url = page.url
        final_body = await page.inner_text("body")
        await browser.close()

    print(
        json.dumps(
            {
                "final_url": final_url,
                "trail": trail,
                "screenshots": shots,
                "failed_api": [e for e in api_events if e["status"] >= 400][-40:],
                "api_tail": api_events[-60:],
                "final_body_excerpt": final_body[:2200],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(run())
