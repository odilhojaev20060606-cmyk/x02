import asyncio, random, sys, pathlib
from playwright.async_api import async_playwright
URL = 'file://' + str(pathlib.Path(__file__).resolve().parent.parent / 'index.html')
errors = []
async def legal_cells(page):
    return await page.eval_on_selector_all('#board .cell[data-legal="1"]', 'els => els.map(e => +e.dataset.i)')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        page = await b.new_page(viewport={'width': 1280, 'height': 900})
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto(URL)
        await page.wait_for_timeout(2200)
        await page.screenshot(path='shots/menu.png')
        # hotseat X02.0: prelude draw -> coin -> main
        await page.evaluate('document.querySelector(`.opp[data-mode="x02"][data-bot=""]`).click()')
        await page.wait_for_timeout(500)
        for i in [4, 0, 2, 6, 3, 5, 7, 1, 8]:
            await page.click(f'#pc-{i}')
            await page.wait_for_timeout(80)
        vis = await page.is_visible('#coinStage')
        print('coin stage visible after draw:', vis)
        await page.click('#coinBtn')
        await page.wait_for_timeout(900)
        await page.screenshot(path='shots/coin_mid.png')
        await page.wait_for_timeout(1400)
        print('coin text:', await page.inner_text('#coinText'))
        await page.click('#coinStart')
        await page.wait_for_timeout(400)
        moves = 0
        for k in range(60):
            cells = await legal_cells(page)
            if not cells: break
            # occasionally use star/strike when enabled
            if not await page.is_disabled('#starBtn') and random.random() < 0.3:
                await page.click('#starBtn')
                cells = await legal_cells(page)
            await page.click(f'#cell-{random.choice(cells)}')
            await page.wait_for_timeout(120)
            # navigator choice
            cells2 = await legal_cells(page)
            st = await page.inner_text('#status')
            if 'Нажми на поле' in st and cells2:
                await page.click(f'#cell-{random.choice(cells2)}')
                await page.wait_for_timeout(100)
            if not await page.is_disabled('#strikeBtn') and random.random() < 0.5:
                await page.click('#strikeBtn')
                tg = await legal_cells(page)
                if tg:
                    await page.click(f'#cell-{random.choice(tg)}'); await page.wait_for_timeout(700)
                else:
                    await page.click('#strikeBtn')
            moves += 1
            if await page.is_visible('#banner.show'): break
        await page.wait_for_timeout(1300)
        print('hotseat moves:', moves, '| log entries:', await page.eval_on_selector_all('#log li', 'e => e.length'), '| banner:', await page.is_visible('#banner.show'))
        await page.screenshot(path='shots/hotseat_main.png', full_page=True)
        # vs bot "Лёгкий?" x02, skip prelude, human X
        await page.click('#scr-x02 .game-bar [data-act="menu"]')
        await page.wait_for_timeout(400)
        await page.evaluate('document.querySelector(`.opp[data-bot="x1"]`).click()')
        await page.wait_for_timeout(300)
        await page.click('#preludeSkip')
        await page.wait_for_timeout(300)
        for k in range(8):
            cells = await legal_cells(page)
            if not cells:
                await page.wait_for_timeout(1500); continue
            await page.click(f'#cell-{random.choice(cells)}')
            # wait for bot
            for w in range(40):
                await page.wait_for_timeout(150)
                who = await page.inner_text('#turnWho')
                if 'Твой ход' in who or 'окончена' in who: break
        logn = await page.eval_on_selector_all('#log li', 'e => e.length')
        print('vs bot x02: log entries after 8 human moves:', logn, '| turn:', await page.inner_text('#turnWho'))
        await page.screenshot(path='shots/bot_main.png')
        # classic vs "Нет": play random until end, 3 games
        await page.click('#scr-x02 .game-bar [data-act="menu"]')
        await page.wait_for_timeout(300)
        await page.evaluate('document.querySelector(`.opp[data-bot="c3"]`).click()')
        results = []
        for g in range(3):
            await page.wait_for_timeout(300)
            for k in range(12):
                if await page.is_visible('#cBanner.show'): break
                free = await page.eval_on_selector_all('#tttBoard .tcell:not([disabled])', 'els => els.map(e => +e.dataset.i)')
                if free:
                    await page.click(f'#tc-{random.choice(free)}')
                await page.wait_for_timeout(750)
            await page.wait_for_timeout(900)
            results.append(await page.inner_text('#cBannerTitle'))
            if g == 0: await page.screenshot(path='shots/classic.png')
            await page.click('#cBanner [data-act="again"]')
        print('classic vs Нет:', results)
        # rules sheet
        await page.click('#scr-classic .game-bar [data-act="rules"]')
        await page.wait_for_timeout(500)
        print('rules open:', await page.is_visible('#rulesSheet'))
        await page.keyboard.press('Escape')
        await page.wait_for_timeout(200)
        print('rules closed:', not await page.is_visible('#rulesSheet'))
        # mobile menu
        m = await b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        m.on('pageerror', lambda e: errors.append('mobile pageerror: ' + str(e)))
        await m.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await m.goto(URL); await m.wait_for_timeout(2000)
        await m.screenshot(path='shots/mobile_menu.png', full_page=True)
        await m.evaluate('document.querySelector(`.opp[data-mode="x02"][data-bot=""]`).click()'); await m.wait_for_timeout(300)
        await m.click('#preludeSkip'); await m.wait_for_timeout(300)
        for k in range(10):
            cells = await m.eval_on_selector_all('#board .cell[data-legal="1"]', 'els => els.map(e => +e.dataset.i)')
            await m.click(f'#cell-{random.choice(cells)}'); await m.wait_for_timeout(120)
        await m.wait_for_timeout(500)
        await m.screenshot(path='shots/mobile_game.png', full_page=True)
        await b.close()
    print('ERRORS:', errors if errors else 'none')
asyncio.run(main())
