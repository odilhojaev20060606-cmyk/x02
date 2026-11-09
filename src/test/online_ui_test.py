import asyncio, subprocess, time, pathlib, json, urllib.request, re
from playwright.async_api import async_playwright
R = pathlib.Path(__file__).resolve().parent.parent
api = subprocess.Popen(['node', str(R/'test'/'fake_server.mjs')], stderr=subprocess.DEVNULL)
srv = subprocess.Popen(['python3','-m','http.server','8773','--bind','127.0.0.1'], cwd=R/'x02-flat', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.3)
get = lambda p: urllib.request.urlopen('http://127.0.0.1:8770' + p).read().decode()
def mock(init, uid, name, sp=''):
    return """window.__links = [];
window.Telegram = { WebApp: { initData: %s, initDataUnsafe: { user: { id: %d, first_name: %s, username: %s, language_code: 'ru' }%s },
  ready(){}, expand(){}, disableVerticalSwipes(){}, setHeaderColor(){}, setBackgroundColor(){}, openTelegramLink(u){ __links.push(u); },
  showConfirm(t, cb){ cb(true); }, BackButton: { onClick(){}, show(){}, hide(){} }, HapticFeedback: { impactOccurred(){}, notificationOccurred(){} }, openInvoice(){} } };""" % (
        json.dumps(init), uid, json.dumps(name), json.dumps(name.lower()), (", start_param: %s" % json.dumps(sp)) if sp else "")
SH = R/'shots'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        errs = []
        hctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)
        await hctx.add_init_script(mock(get('/initdata?id=42&name=Abd'), 42, 'Abd'))
        H = await hctx.new_page(); H.on('pageerror', lambda e: errs.append('H ' + str(e)))
        await H.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await H.goto('http://127.0.0.1:8773/'); await H.wait_for_timeout(1500)
        await H.evaluate('document.querySelector(`.opp-link[data-online="x02"]`).click()'); await H.wait_for_timeout(300)
        await H.click('#onlineSheet [data-min="2"]'); await H.wait_for_timeout(100)
        await H.screenshot(path=str(SH/'o_sheet.png'))
        await H.click('[data-act="createOnline"]'); await H.wait_for_timeout(900)
        links = await H.evaluate('window.__links')
        print('host share link opened:', links[0][:90] if links else None)
        await H.screenshot(path=str(SH/'o_wait.png'))
        link = await H.inner_text('#waitLink'); gid = re.search(r'g_([a-z0-9]+)', link).group(1)
        print('wait screen shows link:', link)
        gctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)
        await gctx.add_init_script(mock(get('/initdata?id=77&name=Ali&sp=g_' + gid), 77, 'Ali', 'g_' + gid))
        G = await gctx.new_page(); G.on('pageerror', lambda e: errs.append('G ' + str(e)))
        await G.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await G.goto('http://127.0.0.1:8773/'); await G.wait_for_timeout(2200)
        print('guest screen:', await G.evaluate("document.querySelector('.screen.active').id"), '| vs:', (await G.inner_text('#x02Vs')).replace('\n',' '))
        await H.wait_for_timeout(1800)
        print('host screen:', await H.evaluate("document.querySelector('.screen.active').id"), '| clock:', (await H.inner_text('#clock')).replace('\n',' '))
        for page, c in [(H,0),(G,3),(H,1),(G,4),(H,2)]:
            await page.click(f'#pc-{c}'); await page.wait_for_timeout(700)
        await G.wait_for_timeout(1700)
        print('guest sees warm-up result:', (await G.inner_text('#status')).replace('\n',' '))
        await G.wait_for_timeout(4200)
        print('main started for guest:', await G.is_visible('#board'), '| turn:', await G.inner_text('#turnWho'))
        # guest (O) moves first, then host replies in the sent board
        await G.click('#cell-40'); await G.wait_for_timeout(2200)
        legal = await H.query_selector_all('#board .cell[data-legal="1"]')
        print('host legal cells after O move:', len(legal), '| host status:', (await H.inner_text('#status'))[:60])
        await legal[0].click(); await H.wait_for_timeout(2000)
        # guest says a phrase
        await G.click('#scr-x02 [data-act="chat"]'); await G.wait_for_timeout(200)
        await G.click('[data-phrase="3"]'); await G.wait_for_timeout(2200)
        print('host sees bubble:', (await H.inner_text('#bubble')).replace('\n',' ') if await H.is_visible('#bubble') else 'no bubble')
        await H.screenshot(path=str(SH/'o_host_game.png'))
        await G.screenshot(path=str(SH/'o_guest_game.png'))
        # host resigns
        await H.click('#scr-x02 [data-act="resign"]'); await H.wait_for_timeout(2500)
        print('host banner:', (await H.inner_text('#bannerTitle')), '|', await H.inner_text('#bannerText'))
        print('guest banner:', (await G.inner_text('#bannerTitle')), '|', await G.inner_text('#bannerText'))
        await G.screenshot(path=str(SH/'o_guest_won.png'))
        # guest asks for a rematch, host accepts
        await G.click('#banner [data-act="again"]'); await G.wait_for_timeout(1500)
        print('guest after rematch:', await G.evaluate("document.querySelector('.screen.active').id"))
        await H.wait_for_timeout(3500)
        print('host rematch note:', await H.inner_text('#rematchNote') if await H.is_visible('#rematchNote') else 'hidden', '| button:', await H.inner_text('#banner [data-act="again"]'))
        await H.click('#banner [data-act="again"]'); await H.wait_for_timeout(2500)
        await G.wait_for_timeout(2000)
        print('after accept: host', await H.evaluate("document.querySelector('.screen.active').id"), 'side', await H.inner_text('#x02Vs'), '| guest', await G.evaluate("document.querySelector('.screen.active').id"))
        # menu list
        await H.evaluate("document.querySelector('#scr-x02 [data-act=menu]').click()"); await H.wait_for_timeout(2000)
        await H.evaluate("window.scrollTo(0, 900)")
        print('menu list:', (await H.inner_text('#onlineGames')).replace('\n',' | ') if await H.is_visible('#onlineGames') else 'hidden')
        await H.screenshot(path=str(SH/'o_menu_list.png'))
        stats = json.loads(get('/kv?id=77')).get('scores', {})
        print('guest scores on server:', stats.get('fx'))
        print('errors:', errs or 'none')
        await b.close()
asyncio.run(main()); srv.terminate(); api.terminate()
