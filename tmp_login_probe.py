import asyncio
import json
import os
import re

from playwright.async_api import async_playwright

BASE_URL = "https://biqc-web-dev.azurewebsites.net"


async def run():
    email = os.environ.get("E2E_EMAIL", "").strip()
    password = os.environ.get("E2E_PASSWORD", "").strip()
    if not email or not password:
        raise RuntimeError("E2E_EMAIL/E2E_PASSWORD required")

    events = []
    failed_requests = []
    console_msgs = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        def on_response(resp):
            url = resp.url
            if any(k in url for k in ["auth/v1/token", "/api/auth", "/api/"]):
                events.append({"status": resp.status, "url": url})
        def on_request_failed(req):
            failed_requests.append({"url": req.url, "method": req.method, "failure": req.failure})
        def on_console(msg):
            console_msgs.append(msg.text)

        page.on("response", on_response)
        page.on("requestfailed", on_request_failed)
        page.on("console", on_console)

        await page.goto(f"{BASE_URL}/login-supabase", wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)
        await page.fill('[data-testid="login-email-input"]', email)
        await page.fill('[data-testid="login-password-input"]', password)
        if await page.locator('[data-testid="login-fallback-captcha"]').count() > 0:
            txt = await page.locator('[data-testid="login-fallback-captcha"]').inner_text()
            m = re.search(r"solve\s+(\d+)\s*\+\s*(\d+)", txt, re.IGNORECASE)
            if m:
                await page.fill('[data-testid="login-fallback-captcha-input"]', str(int(m.group(1)) + int(m.group(2))))
        await page.click('[data-testid="login-submit-btn"]')
        await page.wait_for_timeout(5000)

        # Retry once if challenge appears after first submit.
        if "/login-supabase" in page.url and await page.locator('[data-testid="login-fallback-captcha"]').count() > 0:
            txt = await page.locator('[data-testid="login-fallback-captcha"]').inner_text()
            m = re.search(r"solve\s+(\d+)\s*\+\s*(\d+)", txt, re.IGNORECASE)
            if m:
                await page.fill('[data-testid="login-fallback-captcha-input"]', str(int(m.group(1)) + int(m.group(2))))
                await page.click('[data-testid="login-submit-btn"]')
                await page.wait_for_timeout(5000)

        body = await page.inner_text("body")
        print(
            json.dumps(
                {
                    "final_url": page.url,
                    "events": events[-30:],
                    "failed_requests": failed_requests[-20:],
                    "console": console_msgs[-20:],
                    "body_excerpt": body[:1200],
                },
                indent=2,
            )
        )
        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
