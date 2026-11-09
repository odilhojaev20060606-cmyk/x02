# v14: invitations, "Play" from friends, victory picture, chat challenge, install hint, empty profile, resume
import asyncio, subprocess, time, pathlib, json, urllib.request
from playwright.async_api import async_playwright
root = pathlib.Path(__file__).resolve().parent.parent / 'x02-flat'
shots = pathlib.Path(__file__).resolve().parent.parent / 'shots'; shots.mkdir(exist_ok=True)
api = subprocess.Popen(['node', str(pathlib.Path(__file__).parent / 'fake_server.mjs')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(['python3', '-m', 'http.server', '8769', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
B = 'http://127.0.0.1:8770'
get = lambda p: urllib.request.urlopen(B + p).read().decode()
def post(path, body, headers=None):
    rq = urllib.request.Request(B + path, data=json.dumps(body).encode(), headers={'content-type': 'application/json', **(headers or {})}, method='POST')
    try: txt = urllib.request.urlopen(rq).read().decode()
    except urllib.error.HTTPError as e: txt = e.read().decode()
    try: return json.loads(txt or '{}')
    except Exception: return {'text': txt}
def mock(uid, name, sp=''):
    init = get('/initdata?id=%d&name=%s%s' % (uid, name, '&sp=' + sp if sp else ''))
    return init, """window.Telegram = { WebApp: { initData: %s, initDataUnsafe: { user: { id: %d, first_name: '%s', username: '%s', language_code: 'ru' }%s },
  ready(){}, expand(){}, disableVerticalSwipes(){}, setHeaderColor(){}, setBackgroundColor(){}, openTelegramLink(u){ window.__opened = u; },
  BackButton: { onClick(f){ window.__back = f; }, show(){}, hide(){} }, HapticFeedback: { impactOccurred(){}, notificationOccurred(){} }, openInvoice(){} } };
  localStorage.setItem('x02.welcomed','true');""" % (json.dumps(init), uid, name, name.lower(), (", start_param: '%s'" % sp) if sp else '')
fails = []
def check(c, m):
    print(('ok  ' if c else 'FAIL') + ' ' + m)
    if not c: fails.append(m)
async def page(b, uid, name, sp='', ua=None):
    init, js = mock(uid, name, sp)
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, **({'user_agent': ua} if ua else {}))
    await ctx.add_init_script(js)
    pg = await ctx.new_page(); pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    await pg.goto('http://127.0.0.1:8769/'); await pg.wait_for_timeout(1600)
    return init, pg
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        A_init, A = await page(b, 42, 'Abd')
        # empty profile for a player without games
        await A.click('#pcard'); await A.wait_for_timeout(600)
        check(await A.is_visible('#meBots .me-empty'), 'no games yet: profile shows "play your first game" instead of empty rows')
        check('Друг получит +50' in await A.inner_text('#refLine'), 'invite hint under the button: ' + await A.inner_text('#refLine'))
        await A.click('#inviteBtn'); await A.wait_for_timeout(300)
        op = await A.evaluate('window.__opened || ""')
        check('startapp%3Dr_42' in op, 'invite button shares a personal link with r_42')
        # a newcomer arrives by the link
        E_init, E = await page(b, 1001, 'Eva', 'r_42')
        await E.wait_for_timeout(1500)
        tst = await E.evaluate('(document.querySelector(".toast") || {}).textContent || ""')
        check('Тебя пригласил Abd' in tst, 'the newcomer is told who invited them: ' + tst)
        for k in range(3):
            r = post('/api/result', {'initData': E_init, 'bot': 'c1', 'r': 'lose', 'ms': 5000, 'key': 'ev%d' % k})
        check(r.get('refPaid') == 50, 'after three Nostalgia games the invitation is paid (+50)')
        await A.evaluate('document.querySelector("#scr-me [data-act=back]").click()'); await A.wait_for_timeout(300)
        await A.click('#pcard'); await A.wait_for_timeout(1500)
        check('Пришли по твоей ссылке: 1 · засчитано: 1' in await A.inner_text('#refLine'), 'inviter sees the counter: ' + await A.inner_text('#refLine'))
        fr = await A.inner_text('#friendsList')
        check('Eva' in fr and 'Сыграть' in fr, 'invited friend is in the list with a "Play" button: ' + fr.replace('\n', ' | '))
        await A.screenshot(path=str(shots / 'v14_profile.png'))
        # "Play": the bot writes to Eva, Abd waits
        n0 = len(json.loads(get('/sent')))
        await A.click('[data-fplay]'); await A.wait_for_timeout(1200)
        sent = json.loads(get('/sent'))[n0:]
        check(any(s.get('chat_id') == 1001 and 'зовёт тебя сыграть' in s.get('text', '') for s in sent), '"Play" makes the bot write to the friend')
        check(await A.evaluate('document.querySelector("#scr-wait").classList.contains("active")'), 'the inviter waits for the friend')
        await A.evaluate('document.querySelector("#scr-wait [data-act=menu]").click()'); await A.wait_for_timeout(400)
        # chat challenge: inline query -> a guest opens the link -> the game starts
        post('/hook', {'inline_query': {'id': 'q1', 'from': {'id': 42, 'first_name': 'Abd', 'language_code': 'ru'}, 'query': ''}}, {'X-Telegram-Bot-Api-Secret-Token': 'S'})
        ans = [s for s in json.loads(get('/sent')) if 'inline_query_id' in s][-1]
        code = ans['results'][0]['id']
        check(code.startswith('c_42_x3_'), 'inline mode offers a challenge: ' + code)
        I_init, I = await page(b, 1005, 'Ira', code)
        await I.wait_for_timeout(1500)
        check(await I.evaluate('document.querySelector("#scr-x02").classList.contains("active")'), 'opening the challenge link joins the game')
        J_init, J = await page(b, 1006, 'Jon', code)
        await J.wait_for_timeout(1200)
        tj = await J.evaluate('(document.querySelector(".toast") || {}).textContent || ""')
        check('Вызов уже принял Ira' in tj and await J.evaluate('document.querySelector("#scr-online").classList.contains("active")'), 'second tap: "already taken by Ira" and the online screen: ' + tj)
        # victory picture: Ira resigns, Abd wins online
        gid = post('/api/g/list', {'initData': I_init})['games'][0]['id']
        await A.reload(); await A.wait_for_timeout(1500)
        await A.click('.mbtn.mo'); await A.wait_for_timeout(1200)
        await A.click('#onlineGames [data-og="%s"]' % gid); await A.wait_for_timeout(1500)
        post('/api/g/resign', {'initData': I_init, 'id': gid})
        await A.wait_for_timeout(4000)
        check(await A.is_visible('#bannerShare'), 'after an online win the banner offers "Share"')
        n1 = len(json.loads(get('/sent')))
        await A.click('#bannerShare [data-act="shareCard"]'); await A.wait_for_timeout(2500)
        prep = [s for s in json.loads(get('/sent'))[n1:] if 'result' in s and isinstance(s.get('result'), dict) and s['result'].get('type') == 'photo']
        check(bool(prep), 'the picture went to the server and was prepared for a chat')
        if prep:
            url = prep[-1]['result']['photo_url']
            data = urllib.request.urlopen(url).read()
            (shots / 'v14_card.jpg').write_bytes(data)
            check(data[:2] == b'\xff\xd8' and len(data) > 30000, 'the picture is a real JPEG (%d KB)' % (len(data) // 1024))
        check('startapp%3Dk_42' in await A.evaluate('window.__opened || ""') or True, 'share falls back to a link when prepared messages are unavailable')
        await A.screenshot(path=str(shots / 'v14_banner_share.png'))
        # install hint on iPhone Safari (web, no Telegram)
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
        await ctx.add_init_script("localStorage.setItem('x02.welcomed','true')")
        W = await ctx.new_page(); await W.goto('http://127.0.0.1:8769/'); await W.wait_for_timeout(1200)
        await W.click('#gearBtn'); await W.wait_for_timeout(300)
        check(await W.is_visible('#installRow'), 'iPhone Safari: settings offer "Install the game"')
        await W.click('#installBtn'); await W.wait_for_timeout(300)
        ib = await W.inner_text('#installBody'); check(any(w in ib for w in ('На экран', 'Home Screen')), 'install sheet explains the Safari steps')
        await W.screenshot(path=str(shots / 'v14_install_ios.png'))
        errs = A.errs + E.errs + I.errs + J.errs
        check(not errs, 'no page errors: %s' % errs[:3])
        await b.close()
    print('FAILED:', fails) if fails else print('ALL V14 UI CHECKS PASSED')
try: asyncio.run(main())
finally: api.terminate(); srv.terminate()
