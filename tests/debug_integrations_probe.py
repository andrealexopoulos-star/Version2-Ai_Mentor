import asyncio
import os

from playwright.async_api import async_playwright


async def main():
    base = os.getenv("BIQC_BASE_URL", "https://biqc.ai")
    email = os.getenv("BIQC_LOGIN_EMAIL", "andre@thestrategysquad.com.au")
    password = os.getenv("BIQC_LOGIN_PASSWORD", "test1234***")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        await page.goto(f"{base}/login-supabase", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)

        if await page.locator('[data-testid="login-email-input"]').count() > 0:
            await page.fill('[data-testid="login-email-input"]', email)
            await page.fill('[data-testid="login-password-input"]', password)
            await page.click('[data-testid="login-submit-btn"]')
        else:
            await page.fill('input[type="email"]', email)
            await page.fill('input[type="password"]', password)
            await page.click('button[type="submit"]')

        await page.wait_for_url("**/advisor*", timeout=60000)
        await page.goto(f"{base}/integrations", wait_until="domcontentloaded")

        try:
            await page.wait_for_selector('[data-testid="integration-centre-section"]', timeout=20000)
        except Exception:
            pass

        print("URL", page.url)
        print("integration-centre-section", await page.locator('[data-testid="integration-centre-section"]').count())
        print("integrations-paid-upgrade-card", await page.locator('[data-testid="integrations-paid-upgrade-card"]').count())
        print("integrations-free-tier-banner", await page.locator('[data-testid="integrations-free-tier-banner"]').count())
        print("integrations-truth-verifying-banner", await page.locator('[data-testid="integrations-truth-verifying-banner"]').count())
        print("page-error-text", await page.locator("text=Something went wrong").count())

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
