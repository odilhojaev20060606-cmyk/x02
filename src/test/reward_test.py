import asyncio, random, pathlib
from playwright.async_api import async_playwright
URL = 'file://' + str(pathlib.Path(__file__).resolve().parent.parent / 'index.html')
errors = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        page = await b.new_page(viewport={'width': 1280, 'height': 900})
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto(URL); await page.wait_for_timeout(500)
        await page.evaluate('document.querySelector(`.opp[data-bot="c3"]`).click()')
        for g in range(12):
            await page.wait_for_timeout(300)
            for k in range(12):
                if await page.is_visible('#cBanner.show'): break
                free = await page.eval_on_selector_all('#tttBoard .tcell:not([disabled])', 'els => els.map(e => +e.dataset.i)')
                if free: await page.click(f'#tc-{random.choice(free)}')
                await page.wait_for_timeout(650)
            await page.wait_for_timeout(1800)
            title = await page.inner_text('#cBannerTitle'); rw = await page.inner_text('#cBannerReward')
            fives = await page.evaluate("(JSON.parse(localStorage.getItem('x02.profile')||'{}').fives)||0")
            print(g, title, '| reward:', repr(rw), '| fives:', fives)
            if rw:
                await page.screenshot(path='shots/reward.png'); break
            await page.click('#cBanner [data-act="again"]')
        await b.close()
    print('ERRORS:', errors or 'none')
asyncio.run(main())
