import asyncio, random, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from econ_test import play_classic, URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        page = await b.new_page(viewport={'width': 1280, 'height': 900})
        errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto(URL); await page.wait_for_timeout(400)
        await page.evaluate('document.querySelector(`.seg.lang[data-lang="ru"]`).click()'); await page.evaluate('document.querySelector(`.seg[data-side="1"]`).click()')
        await page.evaluate('document.querySelector(`.opp[data-bot="c1"]`).click()')
        wins = 0
        for g in range(25):
            await page.wait_for_timeout(250); await play_classic(page, True); await page.wait_for_timeout(1700)
            title = await page.inner_text('#cBannerTitle')
            if 'Ты победил' in title:
                wins += 1
                print('game', g, 'WIN reward:', (await page.inner_text('#cBannerReward')).replace('\n', ' '), '| clips:', await page.evaluate("JSON.parse(localStorage.getItem('x02.profile')).clips"))
                if wins == 1:
                    # next: win again but use undo once -> expect no reward
                    pass
                if wins >= 2: break
            await page.click('#cBanner [data-act="again"]')
        print('wins', wins, 'errors', errs or 'none')
        await b.close()
asyncio.run(main())
