import asyncio

from playwright.async_api import async_playwright

QA_KEY = "dev-qabypass-20260327"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        events = []

        page.on("console", lambda m: print("CONSOLE", m.type, m.text))
        page.on("pageerror", lambda e: print("PAGEERROR", e))
        page.on("response", lambda r: events.append((r.status, r.url)))

        await page.goto("https://biqc-web-dev.azurewebsites.net/calibration-qa", wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)

        qa_input = page.locator('input[placeholder="QA key"]')
        if await qa_input.count() > 0:
            await qa_input.first.fill(QA_KEY)
            await page.click('button:has-text("Unlock Calibration QA")')
            await page.wait_for_timeout(4000)

        print("URL", page.url)
        body = await page.inner_text("body")
        print("BODYLEN", len(body))
        print("BODYHEAD", body[:700])
        bad = [e for e in events if e[0] >= 400]
        print("BAD_COUNT", len(bad))
        for status, url in bad[:40]:
            print(status, url)

        await page.screenshot(path=".screenshots/dev-qa-unlock-debug.png", full_page=True)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
