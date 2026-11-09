import asyncio, subprocess, time, pathlib, random
from playwright.async_api import async_playwright
root = pathlib.Path(__file__).resolve().parent.parent / 'x02-flat'
srv = subprocess.Popen(['python3', '-m', 'http.server', '8766', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
MOCK = """
window.__tg = [];
window.Telegram = { WebApp: {
  initData: 'query_id=TEST', initDataUnsafe: { user: { id: 1, first_name: 'Test', language_code: 'uz' } },
  ready() { __tg.push('ready'); }, expand() { __tg.push('expand'); }, disableVerticalSwipes() { __tg.push('noSwipe'); },
  setHeaderColor(c) { __tg.push('header ' + c); }, setBackgroundColor(c) { __tg.push('bg ' + c); },
  BackButton: { _cb: null, visible: false, onClick(cb) { this._cb = cb; }, show() { this.visible = true; __tg.push('back show'); }, hide() { this.visible = false; __tg.push('back hide'); } },
  HapticFeedback: { impactOccurred(k) { __tg.push('haptic ' + k); }, notificationOccurred(k) { __tg.push('notify ' + k); } }
} };
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 800})
        await ctx.add_init_script(MOCK)
        page = await ctx.new_page()
        errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto('http://127.0.0.1:8766/'); await page.wait_for_timeout(800)
        print('init calls:', await page.evaluate('__tg'))
        print('language from Telegram:', await page.evaluate('document.documentElement.lang'), '|', (await page.inner_text('.tagline'))[:40])
        await page.evaluate('document.querySelector(`.opp[data-mode="classic"][data-bot=""]`).click()'); await page.wait_for_timeout(300)
        await page.click('#tc-4'); await page.wait_for_timeout(200)
        print('back visible in game:', await page.evaluate('Telegram.WebApp.BackButton.visible'))
        await page.evaluate('Telegram.WebApp.BackButton._cb()'); await page.wait_for_timeout(300)
        print('after back: menu active =', await page.evaluate("document.getElementById('scr-menu').classList.contains('active')"), '| back visible:', await page.evaluate('Telegram.WebApp.BackButton.visible'))
        print('haptics:', [x for x in await page.evaluate('__tg') if x.startswith('haptic')])
        await page.screenshot(path='shots/tg_menu.png')
        print('errors:', errs or 'none')
        await b.close()
asyncio.run(main())
srv.terminate()
