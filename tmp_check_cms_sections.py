import asyncio

from playwright.async_api import async_playwright

QA_KEY = "dev-qabypass-20260327"


async def click(page, text):
    button = page.locator(f'button:has-text("{text}")')
    if await button.count() > 0 and await button.first.is_enabled():
        await button.first.click()
        return True
    return False


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto("https://biqc-web-dev.azurewebsites.net/calibration-qa", wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)

        if await page.locator('input[placeholder="QA key"]').count() > 0:
            await page.fill('input[placeholder="QA key"]', QA_KEY)
            await click(page, "Unlock Calibration QA")
            await page.wait_for_timeout(900)

        await click(page, "Meet BIQc")
        await page.wait_for_timeout(500)
        if await page.locator('input[placeholder="yourcompany.com"]').count() > 0:
            await page.fill('input[placeholder="yourcompany.com"]', "thestrategysquad.com")
        await click(page, "Begin Strategic Audit")
        await page.wait_for_timeout(5500)
        await click(page, "Regenerate Scan")
        await page.wait_for_timeout(19000)
        await click(page, "Continue manually after scan retries")
        await page.wait_for_timeout(700)
        if await page.locator("textarea").count() > 0:
            await page.fill("textarea", "We provide strategic advisory.")
        await click(page, "Continue")
        await page.wait_for_timeout(1000)
        await click(page, "Yes — this is my business")
        await page.wait_for_timeout(500)
        await click(page, "Yes, continue anyway")
        await page.wait_for_timeout(500)
        await click(page, "Yes — this is my business")
        await page.wait_for_timeout(800)

        print("url", page.url)
        headings = [h.strip() for h in await page.locator("h1,h2,h3").all_inner_texts() if h.strip()]
        print("headings", headings[:6])
        print("cms", await page.locator('[data-testid="chief-marketing-summary"]').count())
        print("competitor", await page.locator('[data-testid="competitor-intelligence"]').count())
        print("customer_review", await page.locator('[data-testid="customer-review-intelligence"]').count())
        print("staff", await page.locator('[data-testid="staff-intelligence"]').count())
        body = await page.inner_text("body")
        print("body_head", body[:500].replace("\n", " | "))
        print("contains_competitive", "Competitive Intelligence" in body)
        print("contains_customer", "Customer Review Intelligence" in body)
        print("contains_staff", "Staff & Team Signals" in body)
        await page.screenshot(path=".screenshots/dev-cms-competitor-staff-check.png", full_page=True)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
