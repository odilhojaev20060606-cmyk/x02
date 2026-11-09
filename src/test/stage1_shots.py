import asyncio, subprocess, time, pathlib, json, urllib.request
from playwright.async_api import async_playwright
R = pathlib.Path(__file__).resolve().parent.parent
api = subprocess.Popen(['node', str(R/'test'/'fake_server.mjs')])
srv = subprocess.Popen(['python3','-m','http.server','8772','--bind','127.0.0.1'], cwd=R/'x02-flat', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
INIT = urllib.request.urlopen('http://127.0.0.1:8770/initdata').read().decode()
MOCK = """window.Telegram = { WebApp: { initData: %s, initDataUnsafe: { user: { id: 42, first_name: 'Abdulhamid', username: 'greednest', language_code: 'ru' } },
  ready(){}, expand(){}, disableVerticalSwipes(){}, setHeaderColor(){}, setBackgroundColor(){},
  BackButton: { onClick(){}, show(){}, hide(){} }, HapticFeedback: { impactOccurred(){}, notificationOccurred(){} }, openInvoice(){} } };""" % json.dumps(INIT)
SH = R/'shots'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        errs = []
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)
        await ctx.add_init_script(MOCK)
        await ctx.add_init_script("localStorage.setItem('x02.scores', JSON.stringify({x1:{me:3,bot:5,draw:1},c3:{me:0,bot:6,draw:5}}))")
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await pg.goto('http://127.0.0.1:8772/'); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=str(SH/'s1_menu_tg.png'))
        print('profile:', (await pg.inner_text('.profile')).replace('\n',' | '))
        # sound toggle
        await pg.evaluate('document.querySelector(`#soundBtn`).click()'); await pg.wait_for_timeout(200)
        print('sound pressed after toggle:', await pg.get_attribute('#soundBtn','aria-pressed'))
        await pg.evaluate('document.querySelector(`#soundBtn`).click()')
        # prelude vs friend
        await pg.evaluate("document.querySelector('.opp[data-mode=x02][data-bot=\"\"]').click()"); await pg.wait_for_timeout(1500)
        for c in [0,4,1,8,2]:
            await pg.click(f'#pc-{c}'); await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(900)
        await pg.screenshot(path=str(SH/'s1_prelude.png'))
        await pg.click('#preludeStart'); await pg.wait_for_timeout(600)
        # play: capture board 1 for X quickly: X plays in board 0 cells, O replies
        import random
        random.seed(3)
        for _ in range(40):
            cells = await pg.query_selector_all('#board .cell[data-legal="1"]')
            if not cells or await pg.is_visible('#banner.show'): break
            await random.choice(cells).click(); await pg.wait_for_timeout(180)
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=str(SH/'s1_main.png'), full_page=True)
        # classic vs friend with a win
        await pg.evaluate("document.querySelector('#scr-x02 [data-act=menu]').click()"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('.opp[data-mode=classic][data-bot=\"\"]').click()"); await pg.wait_for_timeout(900)
        for c in [0,3,4,5,8]:
            await pg.click(f'#tc-{c}'); await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(1600)
        await pg.screenshot(path=str(SH/'s1_classic.png'))
        # guest on web, desktop
        ctx2 = await b.new_context(viewport={'width':1280,'height':900})
        pg2 = await ctx2.new_page(); pg2.on('pageerror', lambda e: errs.append(str(e)))
        await pg2.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await pg2.goto('http://127.0.0.1:8772/'); await pg2.wait_for_timeout(2200)
        await pg2.screenshot(path=str(SH/'s1_menu_web.png'))
        print('errors:', errs or 'none')
        await b.close()
asyncio.run(main()); srv.terminate(); api.terminate()
