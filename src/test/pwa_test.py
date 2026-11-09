import asyncio, subprocess, time, pathlib, random
from playwright.async_api import async_playwright
root = pathlib.Path(__file__).resolve().parent.parent / 'x02-flat'
srv = subprocess.Popen(['python3', '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto('http://127.0.0.1:8765/')
        await page.wait_for_function('navigator.serviceWorker && navigator.serviceWorker.controller !== null || window.__r', timeout=3000) if False else None
        ready = await page.evaluate('navigator.serviceWorker.ready.then(r => !!r.active)')
        await page.wait_for_timeout(1500)
        cached = await page.evaluate('caches.open("x02-v7").then(c => c.keys()).then(k => k.length)')
        fonts = await page.evaluate('document.fonts.check("700 30px Caveat")')
        man = await page.evaluate('fetch("manifest.webmanifest").then(r => r.json()).then(j => j.short_name)')
        print('service worker active:', ready, '| cached files:', cached, '| Caveat font loaded:', fonts, '| manifest:', man)
        await page.screenshot(path='shots/pwa_menu.png')
        # offline
        await ctx.set_offline(True)
        await page.reload()
        await page.wait_for_timeout(1200)
        title = await page.title()
        await page.evaluate('document.querySelector(`.opp[data-bot="c3"]`).click()'); await page.wait_for_timeout(300)
        await page.click('#tc-4'); await page.wait_for_timeout(1200)
        botMoved = await page.eval_on_selector_all('#tttBoard .tcell svg', 'e => e.length')
        print('offline reload title:', title, '| marks on board after one move (bot answered):', botMoved)
        await page.click('#scr-classic [data-act="menu"]'); await page.wait_for_timeout(300)
        await page.evaluate('document.querySelector(`.opp[data-bot="x1"]`).click()'); await page.wait_for_timeout(300)
        await page.click('#preludeSkip'); await page.wait_for_timeout(300)
        cells = await page.eval_on_selector_all('#board .cell[data-legal="1"]', 'els => els.map(e => +e.dataset.i)')
        await page.click(f'#cell-{random.choice(cells)}')
        for w in range(40):
            await page.wait_for_timeout(150)
            if 'Твой ход' in await page.inner_text('#turnWho'): break
        print('offline X02.0 bot replied:', await page.eval_on_selector_all('#log li', 'e => e.length'), 'log entries')
        await page.screenshot(path='shots/pwa_offline_game.png')
        await b.close()
asyncio.run(main())
srv.terminate()
print('ERRORS:', errors if errors else 'none')
