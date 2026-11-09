import asyncio, random, pathlib
from playwright.async_api import async_playwright
URL = 'file://' + str(pathlib.Path(__file__).resolve().parent.parent / 'index.html')
errors = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        page = await b.new_page(viewport={'width': 1280, 'height': 900})
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto(URL); await page.wait_for_timeout(800)
        await page.evaluate('document.querySelector(`.opp[data-mode="x02"][data-bot=""]`).click()'); await page.wait_for_timeout(300)
        await page.click('#preludeSkip'); await page.wait_for_timeout(200)
        n = 0
        while n < 220:
            if await page.is_visible('#banner.show'): break
            cells = await page.eval_on_selector_all('#board .cell[data-legal="1"]', 'els => els.map(e => +e.dataset.i)')
            if not cells: await page.wait_for_timeout(300); n += 1; continue
            await page.click(f'#cell-{random.choice(cells)}'); n += 1
            await page.wait_for_timeout(30)
        await page.wait_for_timeout(1500)
        print('moves', n, '| banner:', await page.inner_text('#bannerTitle'), '|', await page.inner_text('#bannerText'))
        await page.screenshot(path='shots/end_banner.png')
        m = await b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        await m.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await m.goto(URL); await m.wait_for_timeout(600)
        await m.evaluate('document.querySelector(`.opp[data-bot="x1"]`).click()'); await m.wait_for_timeout(500)
        await m.screenshot(path='shots/mobile_prelude.png')
        await b.close()
    print('ERRORS:', errors if errors else 'none')
asyncio.run(main())
