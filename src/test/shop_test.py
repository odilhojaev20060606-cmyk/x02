import asyncio, random, pathlib
from playwright.async_api import async_playwright
URL = 'file://' + str(pathlib.Path(__file__).resolve().parent.parent / 'index.html')
errors = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        page = await b.new_page(viewport={'width': 1280, 'height': 1000})
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto(URL); await page.wait_for_timeout(600)
        print('menu wallet:', await page.inner_text('#menuWallet'))
        await page.click('[data-act="shop"]'); await page.wait_for_timeout(300)
        await page.click('[data-buy="x_plus"]'); await page.wait_for_timeout(200)
        print('no money:', await page.inner_text('.shop-note'))
        await page.click('[data-ink="500"]'); await page.wait_for_timeout(200)
        await page.click('[data-buy="x_gold"]'); await page.wait_for_timeout(200)
        await page.click('[data-buy="o_gold"]'); await page.wait_for_timeout(200)
        print('after gold:', await page.inner_text('.shop-note'), '| wallet:', await page.inner_text('#shopWallet'))
        # give fives to test shapes
        await page.evaluate("""() => { const p = JSON.parse(localStorage.getItem('x02.profile')); p.fives = 400; localStorage.setItem('x02.profile', JSON.stringify(p)); }""")
        await page.reload(); await page.wait_for_timeout(500)
        await page.click('[data-act="shop"]'); await page.wait_for_timeout(200)
        await page.click('[data-buy="o_hex"]'); await page.wait_for_timeout(150)
        await page.click('[data-buy="xc_purple"]'); await page.wait_for_timeout(150)
        await page.click('[data-buy="x_star"]'); await page.wait_for_timeout(400)
        print('shapes bought:', await page.inner_text('.shop-note'), '| wallet:', await page.inner_text('#shopWallet'))
        await page.screenshot(path='shots/shop.png', full_page=True)
        # hotseat game shows skins on both sides
        await page.click('#scr-shop [data-act="back"]'); await page.wait_for_timeout(300)
        await page.evaluate('document.querySelector(`.opp[data-mode="x02"][data-bot=""]`).click()'); await page.wait_for_timeout(200)
        await page.click('#preludeSkip'); await page.wait_for_timeout(200)
        for k in range(14):
            cells = await page.eval_on_selector_all('#board .cell[data-legal="1"]', 'els => els.map(e => +e.dataset.i)')
            await page.click(f'#cell-{random.choice(cells)}'); await page.wait_for_timeout(90)
        await page.wait_for_timeout(600)
        await page.screenshot(path='shots/skins_board.png')
        # reward: classic vs "Попробуй" until win (as X), check fives increase
        await page.click('#scr-x02 .game-bar [data-act="menu"]'); await page.wait_for_timeout(200)
        before = await page.evaluate("JSON.parse(localStorage.getItem('x02.profile')).fives")
        got = None
        await page.evaluate('document.querySelector(`.opp[data-bot="c1"]`).click()')
        for g in range(10):
            await page.wait_for_timeout(300)
            for k in range(12):
                if await page.is_visible('#cBanner.show'): break
                free = await page.eval_on_selector_all('#tttBoard .tcell:not([disabled])', 'els => els.map(e => +e.dataset.i)')
                if free: await page.click(f'#tc-{random.choice(free)}')
                await page.wait_for_timeout(650)
            await page.wait_for_timeout(500)
            title = await page.inner_text('#cBannerTitle')
            if 'Ты победил' in title:
                got = await page.inner_text('#cBannerReward'); break
            await page.click('#cBanner [data-act="again"]')
        after = await page.evaluate("JSON.parse(localStorage.getItem('x02.profile')).fives")
        print('classic reward banner:', got, '| fives', before, '->', after)
        await b.close()
    print('ERRORS:', errors if errors else 'none')
asyncio.run(main())
