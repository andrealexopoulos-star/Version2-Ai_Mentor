import asyncio

from playwright.async_api import async_playwright

QA_KEY = "dev-qabypass-20260327"


async def click_text(page, text):
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
            await page.click('button:has-text("Unlock Calibration QA")')
            await page.wait_for_timeout(1000)

        await click_text(page, "Meet BIQc")
        await page.wait_for_timeout(500)
        if await page.locator('input[placeholder="yourcompany.com"]').count() > 0:
            await page.fill('input[placeholder="yourcompany.com"]', "thestrategysquad.com")
        await click_text(page, "Begin Strategic Audit")
        await page.wait_for_timeout(6000)
        await click_text(page, "Regenerate Scan")
        await page.wait_for_timeout(19000)
        await click_text(page, "Continue manually after scan retries")
        await page.wait_for_timeout(700)
        if await page.locator("textarea").count() > 0:
            await page.fill("textarea", "We provide strategic advisory.")
        await click_text(page, "Continue")
        await page.wait_for_timeout(1000)
        await click_text(page, "Yes — this is my business")
        await page.wait_for_timeout(500)
        # Handle confidence modal variations
        await click_text(page, "Yes, continue anyway")
        await page.wait_for_timeout(500)
        await click_text(page, "Yes — this is my business")
        await page.wait_for_timeout(500)
        await click_text(page, "Continue to Calibrate")
        await page.wait_for_timeout(1200)
        await click_text(page, "Begin Agent Calibration")
        await page.wait_for_timeout(2200)

        for i in range(6):
            step_label = ""
            if await page.locator("text=Step ").count() > 0:
                step_label = (await page.locator("text=Step ").first.inner_text()).strip()
            body = (await page.inner_text("body"))[:500]
            print("ITER", i, "STEP_LABEL", step_label)
            print("BODY_HEAD", body.replace("\n", " | "))
            if await page.locator('[data-testid="choice-0"]').count() > 0:
                await page.click('[data-testid="choice-0"]')
            await page.wait_for_timeout(2600)

        await page.screenshot(path=".screenshots/dev-agent-step-probe.png", full_page=True)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
