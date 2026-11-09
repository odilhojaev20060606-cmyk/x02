import asyncio, random, pathlib
from playwright.async_api import async_playwright
URL = 'file://' + str(pathlib.Path(__file__).resolve().parent.parent / 'index.html')
errors = []
JS_BEST = """() => { const E = ENGINE(); const b = [...document.querySelectorAll('#tttBoard .tcell')].map(c => { const s = c.querySelector('svg'); return !s ? 0 : s.classList.contains('x') ? 1 : 2; });
  const n = b.filter(Boolean).length; const t = { b, turn: n % 2 === 0 ? 1 : 2, result: 0, line: null, last: -1 }; return E.tttBot(t, 3, 'win'); }"""
async def play_classic(page, perfect):
    for k in range(12):
        if await page.is_visible('#cBanner.show'): return
        free = await page.eval_on_selector_all('#tttBoard .tcell:not([disabled])', 'els => els.map(e => +e.dataset.i)')
        if free:
            m = await page.evaluate(JS_BEST) if perfect else random.choice(free)
            if m in free: await page.click(f'#tc-{m}')
        await page.wait_for_timeout(700)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        page = await b.new_page(viewport={'width': 1280, 'height': 1000}, locale='ru-RU')
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto(URL); await page.wait_for_timeout(500)
        await page.evaluate('document.querySelector(`.seg.lang[data-lang="ru"]`).click()')
        print('wallet:', (await page.inner_text('#menuWallet')).replace('\n', ' '))
        # shop: gold label & buy with coin
        await page.click('[data-act="shop"]'); await page.wait_for_timeout(300)
        print('gold card label:', await page.inner_text('.item.premium .item-price'))
        await page.click('[data-buy="x_gold"]'); await page.wait_for_timeout(150)
        print('no coins:', await page.inner_text('.shop-note'))
        await page.click('[data-coins="10"]'); await page.wait_for_timeout(150)
        await page.click('[data-buy="x_gold"]'); await page.wait_for_timeout(300)
        print('after buy:', await page.inner_text('.shop-note'), '| wallet:', (await page.inner_text('#shopWallet')).replace('\n', ' '))
        await page.screenshot(path='shots/shop2.png')
        print('skew card:', await page.inner_text('.items .item:nth-child(5) .item-name'))
        # reward with undo -> none; reset profile first
        await page.evaluate("localStorage.removeItem('x02.profile')"); await page.reload(); await page.wait_for_timeout(400)
        # chance: 1000 losses, counter 9 -> next game vs Нет is the chance game; human plays perfectly
        await page.evaluate("localStorage.setItem('x02.profile', JSON.stringify({clips:0,coins:0,owned:[],netLosses:1000,netCounter:9}))")
        await page.reload(); await page.wait_for_timeout(400)
        await page.evaluate('document.querySelector(`.seg[data-side="1"]`).click()')
        await page.evaluate('document.querySelector(`.opp[data-bot="c3"]`).click()'); await page.wait_for_timeout(300)
        await play_classic(page, True)
        await page.wait_for_timeout(2200)
        print('chance game:', await page.inner_text('#cBannerTitle'), '|', (await page.inner_text('#cBannerReward')).replace('\n', ' '))
        await page.screenshot(path='shots/gold_win.png')
        prof = await page.evaluate("localStorage.getItem('x02.profile')"); print('profile:', prof)
        # next 10 games: bot should never err again -> perfect human draws
        await page.click('#cBanner [data-act="again"]'); await page.wait_for_timeout(300)
        await play_classic(page, True); await page.wait_for_timeout(1500)
        print('after beaten, next game:', await page.inner_text('#cBannerTitle'))
        # paperclips for "Попробуй" win with perfect play; and undo -> no reward
        await page.click('#scr-classic .game-bar [data-act="menu"]'); await page.evaluate('document.querySelector(`.opp[data-bot="c1"]`).click()')
        got = None
        for g in range(6):
            await page.wait_for_timeout(300); await play_classic(page, True); await page.wait_for_timeout(1800)
            title = await page.inner_text('#cBannerTitle')
            if 'победил' in title and 'Ты' in title: got = (await page.inner_text('#cBannerReward')).replace('\n',' '); break
            await page.click('#cBanner [data-act="again"]')
        print('Попробуй win reward:', got, '| clips:', await page.evaluate("JSON.parse(localStorage.getItem('x02.profile')).clips"))
        await b.close()
    print('ERRORS:', errors or 'none')
if __name__ == "__main__": asyncio.run(main())
