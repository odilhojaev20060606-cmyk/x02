import asyncio, random, pathlib, time
from playwright.async_api import async_playwright
URL = 'file://' + str(pathlib.Path(__file__).resolve().parent.parent / 'index.html')
errors = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        page = await b.new_page(viewport={'width': 1280, 'height': 900})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto(URL); await page.wait_for_timeout(500)
        await page.evaluate('document.querySelector(`.seg.lang[data-lang="ru"]`).click()'); await page.evaluate('document.querySelector(`.seg[data-side="1"]`).click()')
        await page.evaluate('document.querySelector(`.opp[data-bot="x3"]`).click()'); await page.wait_for_timeout(300)
        await page.click('#preludeSkip'); await page.wait_for_timeout(300)
        times = []
        for k in range(4):
            cells = await page.eval_on_selector_all('#board .cell[data-legal="1"]', 'els => els.map(e => +e.dataset.i)')
            if not cells: break
            await page.click(f'#cell-{random.choice(cells)}')
            t0 = time.time()
            for w in range(120):
                await page.wait_for_timeout(200)
                who = await page.inner_text('#turnWho')
                if 'Твой ход' in who or 'окончена' in who: break
            times.append(round(time.time() - t0, 1))
        print('bot reply times (s):', times)
        print('debug:', await page.evaluate('X02_DEBUG()'))
        print('status:', await page.inner_text('#status'))
        await b.close()
    print('ERRORS:', errors or 'none')
asyncio.run(main())
