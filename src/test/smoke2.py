import asyncio, random, pathlib
from playwright.async_api import async_playwright
URL = 'file://' + str(pathlib.Path(__file__).resolve().parent.parent / 'index.html')
errors = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        page = await b.new_page(viewport={'width': 1280, 'height': 900})
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type in ('error','warning') and 'ERR_TUNNEL' not in m.text else None)
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto(URL); await page.wait_for_timeout(1500)
        # human plays O against "Уже нет"
        await page.evaluate('document.querySelector(`.seg[data-side="2"]`).click()')
        await page.evaluate('document.querySelector(`.opp[data-bot="x2"]`).click()')
        print('menu hidden in game:', not await page.is_visible('#scr-menu'))
        for k in range(12):
            await page.wait_for_timeout(700)
            if await page.is_visible('#preludeStart') or await page.is_visible('#coinStage'): break
            free = await page.eval_on_selector_all('#preludeGrid .tcell:not([disabled])', 'els => els.map(e => +e.dataset.i)')
            if free: await page.click(f'#pc-{random.choice(free)}')
        print('prelude status:', await page.inner_text('#status'))
        if await page.is_visible('#coinStage'):
            await page.click('#coinBtn'); await page.wait_for_timeout(2300)
            print('coin:', await page.inner_text('#coinText'))
            await page.click('#coinStart')
        else:
            await page.click('#preludeStart')
        await page.wait_for_timeout(300)
        print('main started, turn:', await page.inner_text('#turnWho'), '| stars:', await page.inner_text('#starsCount'))
        # wait for bot if it moves first, then play 5 moves
        for k in range(5):
            for w in range(60):
                who = await page.inner_text('#turnWho')
                if 'Твой ход' in who or 'окончена' in who: break
                await page.wait_for_timeout(150)
            cells = await page.eval_on_selector_all('#board .cell[data-legal="1"]', 'els => els.map(e => +e.dataset.i)')
            if not cells: break
            await page.click(f'#cell-{random.choice(cells)}')
            await page.wait_for_timeout(200)
        for w in range(60):
            who = await page.inner_text('#turnWho')
            if 'Твой ход' in who: break
            await page.wait_for_timeout(150)
        n1 = await page.eval_on_selector_all('#log li', 'e => e.length')
        await page.click('#scr-x02 .buttons [data-act="undo"]'); await page.wait_for_timeout(300)
        n2 = await page.eval_on_selector_all('#log li', 'e => e.length')
        print('undo vs bot: log', n1, '->', n2, '| turn after undo:', await page.inner_text('#turnWho'))
        await page.screenshot(path='shots/bot_game2.png')
        # classic vs "Попробуй" until a decisive banner
        await page.click('#scr-x02 .game-bar [data-act="menu"]'); await page.wait_for_timeout(300)
        await page.evaluate('document.querySelector(`.seg[data-side="1"]`).click()')
        await page.evaluate('document.querySelector(`.opp[data-bot="c1"]`).click()')
        for g in range(6):
            for k in range(12):
                await page.wait_for_timeout(650)
                if await page.is_visible('#cBanner.show'): break
                free = await page.eval_on_selector_all('#tttBoard .tcell:not([disabled])', 'els => els.map(e => +e.dataset.i)')
                if free: await page.click(f'#tc-{random.choice(free)}')
            await page.wait_for_timeout(1200)
            title = await page.inner_text('#cBannerTitle')
            if 'Ты победил' in title or g == 5:
                await page.wait_for_timeout(400)
                await page.screenshot(path='shots/classic_banner.png'); print('classic banner:', title, '|', await page.inner_text('#cBannerTaunt')); break
            await page.click('#cBanner [data-act="again"]')
        await page.click('#scr-classic .game-bar [data-act="menu"]'); await page.wait_for_timeout(1500)
        await page.screenshot(path='shots/menu_after.png')
        print('menu scores:', await page.eval_on_selector_all('.opp-score', 'els => els.map(e => e.textContent).join(" | ")'))
        await b.close()
    print('ERRORS:', errors if errors else 'none')
asyncio.run(main())
