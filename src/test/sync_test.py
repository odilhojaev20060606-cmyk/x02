import asyncio, subprocess, time, pathlib, json, urllib.request
from playwright.async_api import async_playwright
root = pathlib.Path(__file__).resolve().parent.parent / 'x02-flat'
api = subprocess.Popen(['node', str(pathlib.Path(__file__).parent / 'fake_server.mjs')])
srv = subprocess.Popen(['python3', '-m', 'http.server', '8769', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
get = lambda p: urllib.request.urlopen('http://127.0.0.1:8770' + p).read().decode()
INIT = get('/initdata')
MOCK = """
window.Telegram = { WebApp: { initData: %s, initDataUnsafe: { user: { id: 42, language_code: 'ru' } },
  ready(){}, expand(){}, disableVerticalSwipes(){}, setHeaderColor(){}, setBackgroundColor(){},
  BackButton: { onClick(){}, show(){}, hide(){} }, HapticFeedback: { impactOccurred(){}, notificationOccurred(){} }, openInvoice(){} } };
""" % json.dumps(INIT)
LOCAL = json.dumps({"clips": 120, "coins": 0, "owned": ["x_plus"], "equip": {"xShape": "x_plus"}})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        # --- inside Telegram, with old local progress
        ctx = await b.new_context(viewport={'width': 390, 'height': 844})
        await ctx.add_init_script(MOCK)
        await ctx.add_init_script("if(!localStorage.getItem('x02.seeded')){localStorage.setItem('x02.profile', %s);localStorage.setItem('x02.scores', JSON.stringify({c2:{me:3,bot:1,draw:0}}));localStorage.setItem('x02.seeded','1')}" % json.dumps(LOCAL))
        page = await ctx.new_page(); errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto('http://127.0.0.1:8769/'); await page.wait_for_timeout(1500)
        kv = json.loads(get('/kv'))
        print('TG: server after first sync -> clips', kv.get('clips'), 'owned', kv.get('owned'), 'c2 score', kv.get('scores', {}).get('c2'))
        print('TG: login button hidden in Telegram:', (await page.inner_html('#tgLogin')) == '')
        # lose a classic game to "Нет"
        await page.evaluate('document.querySelector(`.opp[data-mode="classic"][data-bot="c3"]`).click()'); await page.wait_for_timeout(400)
        for _ in range(9):
            if await page.is_visible('#cBanner.show') if await page.query_selector('#cBanner') else False: break
            cells = await page.query_selector_all('#scr-classic .tcell:not(.filled), #scr-classic button[id^="tc-"]')
            for c in cells:
                if (await c.inner_text()).strip() == '' and await c.is_enabled():
                    await c.click(); break
            await page.wait_for_timeout(900)
        await page.wait_for_timeout(1200)
        kv = json.loads(get('/kv'))
        print('TG: after a game vs Нет -> c3 score', kv.get('scores', {}).get('c3'), '| netLosses', kv.get('netLosses'))
        # buy a skin with paperclips through the server
        await page.evaluate("document.querySelector('#scr-classic [data-act=menu]').click()"); await page.wait_for_timeout(300)
        await page.evaluate("document.querySelector('[data-act=shop]').click()"); await page.wait_for_timeout(600)
        await page.click('[data-buy="o_square"]'); await page.wait_for_timeout(800)
        kv = json.loads(get('/kv'))
        print('TG: bought o_square -> server clips', kv.get('clips'), 'owned', kv.get('owned'), 'equip', kv.get('equip'))
        print('TG errors:', errs or 'none')
        # --- web/PWA version on another device: log in with Telegram
        ctx2 = await b.new_context(viewport={'width': 390, 'height': 844})
        page2 = await ctx2.new_page(); errs2 = []; page2.on('pageerror', lambda e: errs2.append(str(e)))
        await page2.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page2.goto('http://127.0.0.1:8769/'); await page2.wait_for_timeout(800)
        print('WEB: login button:', await page2.inner_text('#tgLogin'))
        await page2.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page2.goto('http://127.0.0.1:8769/?' + get('/login')); await page2.wait_for_timeout(1500)
        print('WEB: after Telegram login ->', (await page2.inner_text('#tgLogin')).replace('\n', ' '), '| url clean:', page2.url.endswith('/'))
        print('WEB: wallet', (await page2.inner_text('#menuWallet')).replace('\n', ' '))
        await page2.evaluate("document.querySelector('[data-act=shop]').click()"); await page2.wait_for_timeout(700)
        print('WEB: o_square owned here too:', 'Equipped' in await page2.inner_text('#shopBody'))
        print('WEB: coins section:', (await page2.inner_text('.shop-sec:last-of-type')).replace('\n', ' ')[:120])
        await page2.screenshot(path=str(root.parent/'shots'/'web_login_shop.png'))
        await page2.evaluate("document.querySelector('#scr-shop [data-act=back]').click()"); await page2.wait_for_timeout(300)
        await page2.evaluate("document.querySelector('[data-act=logout]').click()"); await page2.wait_for_timeout(300)
        print('WEB: after logout:', await page2.inner_text('#tgLogin'))
        print('WEB errors:', errs2 or 'none')
        await b.close()
asyncio.run(main())
srv.terminate(); api.terminate()
