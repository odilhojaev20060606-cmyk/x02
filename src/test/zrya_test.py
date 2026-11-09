import asyncio, pathlib, sys
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
        await page.evaluate("localStorage.setItem('x02.profile', JSON.stringify({clips:0,coins:0,owned:[],cc:{c2:0},cnext:{c2:3}}))")
        await page.reload(); await page.wait_for_timeout(400)
        await page.evaluate('document.querySelector(`.seg.lang[data-lang="ru"]`).click()'); await page.evaluate('document.querySelector(`.seg[data-side="1"]`).click()')
        await page.evaluate('document.querySelector(`.opp[data-bot="c2"]`).click()')
        for g in range(4):
            await page.wait_for_timeout(250); await play_classic(page, True); await page.wait_for_timeout(1700)
            prof = await page.evaluate("JSON.parse(localStorage.getItem('x02.profile'))")
            print('game', g + 1, ':', await page.inner_text('#cBannerTitle'), '| reward:', (await page.inner_text('#cBannerReward')).replace('\n', ' '), '| counter', prof['cc'], 'next', prof['cnext'])
            await page.click('#cBanner [data-act="again"]')
        print('errors', errs or 'none')
        await b.close()
asyncio.run(main())
