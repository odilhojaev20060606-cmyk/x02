import asyncio, random, pathlib, re
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
        for lg in ['uz', 'en', 'ru']:
            await page.click(f'.seg.lang[data-lang="{lg}"]'); await page.wait_for_timeout(200)
            print(lg, '| tagline:', (await page.inner_text('.tagline'))[:50], '| bot:', await page.inner_text('.opp[data-bot="x3"] .opp-name'))
        await page.evaluate('document.querySelector(`.seg.lang[data-lang="en"]`).click()')
        # x02 vs bot with prelude, play through quickly
        await page.evaluate('document.querySelector(`.opp[data-bot="x1"]`).click()')
        for k in range(12):
            await page.wait_for_timeout(650)
            if await page.is_visible('#preludeStart') or await page.is_visible('#coinStage'): break
            free = await page.eval_on_selector_all('#preludeGrid .tcell:not([disabled])', 'els => els.map(e => +e.dataset.i)')
            if free: await page.click(f'#pc-{random.choice(free)}')
        print('EN prelude status:', await page.inner_text('#status'))
        if await page.is_visible('#coinStage'):
            await page.click('#coinBtn'); await page.wait_for_timeout(2300); print('coin:', await page.inner_text('#coinText')); await page.click('#coinStart')
        else: await page.click('#preludeStart')
        for k in range(4):
            for w in range(50):
                who = await page.inner_text('#turnWho')
                if 'Your move' in who: break
                await page.wait_for_timeout(150)
            cells = await page.eval_on_selector_all('#board .cell[data-legal="1"]', 'els => els.map(e => +e.dataset.i)')
            await page.click(f'#cell-{random.choice(cells)}'); await page.wait_for_timeout(150)
        for w in range(50):
            if 'Your move' in await page.inner_text('#turnWho'): break
            await page.wait_for_timeout(150)
        print('EN status:', await page.inner_text('#status'), '| where:', await page.inner_text('#turnWhere'))
        # switch to uz mid game via menu
        await page.click('#scr-x02 .game-bar [data-act="menu"]'); await page.evaluate('document.querySelector(`.seg.lang[data-lang="uz"]`).click()')
        await page.evaluate('document.querySelector(`.opp[data-bot="c2"]`).click()'); await page.wait_for_timeout(200)
        for k in range(10):
            if await page.is_visible('#cBanner.show'): break
            free = await page.eval_on_selector_all('#tttBoard .tcell:not([disabled])', 'els => els.map(e => +e.dataset.i)')
            if free: await page.click(f'#tc-{random.choice(free)}')
            await page.wait_for_timeout(700)
        await page.wait_for_timeout(1000)
        print('UZ classic banner:', await page.inner_text('#cBannerTitle'), '|', await page.inner_text('#cBannerTaunt'), '| status:', await page.inner_text('#cStatus'))
        await page.click('#scr-classic .game-bar [data-act="rules"]'); await page.wait_for_timeout(300)
        print('UZ rules first line:', (await page.inner_text('#rulesBody'))[:70])
        await page.screenshot(path='shots/uz_rules.png')
        await page.keyboard.press('Escape')
        await page.click('#scr-classic .game-bar [data-act="menu"]'); await page.wait_for_timeout(900)
        await page.screenshot(path='shots/uz_menu.png')
        body = await page.inner_text('#scr-menu')
        print('cyrillic left in UZ menu:', re.findall('[А-Яа-яЁё]+', body)[:10])
        await b.close()
    print('ERRORS:', errors if errors else 'none')
asyncio.run(main())
