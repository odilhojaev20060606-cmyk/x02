import asyncio, subprocess, time, pathlib, json
from playwright.async_api import async_playwright
root = pathlib.Path(__file__).resolve().parent.parent / 'x02-flat'
srv = subprocess.Popen(['python3', '-m', 'http.server', '8769', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
MOCK = """
window.Telegram = { WebApp: {
  initData: 'query_id=TEST&hash=x', initDataUnsafe: { user: { id: 1, first_name: 'Abd', language_code: 'ru' } }, version: '8.0',
  ready(){}, expand(){}, disableVerticalSwipes(){}, setHeaderColor(){}, setBackgroundColor(){}, onEvent(){}, isVersionAtLeast(){ return true; },
  BackButton: { onClick(){}, show(){}, hide(){} }, HapticFeedback: { impactOccurred(){}, notificationOccurred(){} }
} };
"""
from datetime import datetime, timedelta, timezone
day = (datetime.now(timezone.utc) + timedelta(hours=5)).strftime('%Y-%m-%d')
W = {'coins': 5, 'clips': 300, 'gold': [], 'owned': [], 'equip': {}, 'freeze': 0, 'elo': 1087, 'eloN': 4, 'league': 'good', 'subj': 0, 'streak': {'last': day, 'n': 3},
     'tasks': {'day': day, 'list': [{'k': 'play3', 'n': 1, 'need': 3, 'done': False}, {'k': 'daily', 'n': 1, 'need': 1, 'done': True}, {'k': 'online', 'n': 0, 'need': 1, 'done': False}], 'all': False}}
calls = []
async def handle(route):
    req = route.request; path = req.url.split('api.test')[1]; body = json.loads(req.post_data or '{}'); calls.append((path, body))
    res = dict(W)
    if path == '/api/spend':
        it = body['item']; c = {'hint': 1, 'freeze': 2}.get(it, 0)
        if W['coins'] < c: return await route.fulfill(status=409, json={'error': 'coins', **W})
        W['coins'] -= c
        if it == 'freeze': W['freeze'] += 1
        res = {'ok': True, **W}
    elif path == '/api/battle': res = {'week': [{'s': 0, 'n': 7}, {'s': 3, 'n': 4}], 'last': [{'s': 3, 'n': 9}], 'mine': 0, 'myWins': 2, 'prize': 0}
    elif path == '/api/friends': res = {'friends': [{'name': 'Ali', 'fid': '77.abc', 'w': 1, 'l': 0, 'd': 0, 'seen': 0}], 'refs': {'n': 2, 'paid': 2}, 'top': []}
    elif path == '/api/gift': res = {'ok': True, 'left': 2}
    elif path == '/api/subj': res = {'ok': True, 'subj': body['subj']}
    await route.fulfill(json=res, headers={'access-control-allow-origin': '*'})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        await ctx.add_init_script(MOCK); await ctx.route('https://api.test/**', handle)
        page = await ctx.new_page(); errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        await page.add_init_script(f"localStorage.setItem('x02.welcomed','true');localStorage.setItem('x02.streakShown',JSON.stringify('{day}'));localStorage.setItem('x02.sig',JSON.stringify({{name:'Abd',subj:'math'}}))")
        await page.goto('http://127.0.0.1:8769/'); await page.wait_for_timeout(1500)
        badge = await page.eval_on_selector('#tkBadge', 'e => e.hidden ? "" : e.textContent')
        print('ok' if badge == '2' else 'FAIL', 'task badge on profile icon:', badge)
        await page.click('#pcard'); await page.wait_for_timeout(1200)
        await page.screenshot(path='shots/v172_me.png', full_page=True)
        tasks = await page.eval_on_selector_all('#meTasks .task', 'els => els.map(e => e.textContent.replace(/\\s+/g," ").trim())')
        print('ok' if len(tasks) == 3 else 'FAIL', 'tasks:', tasks)
        lg = await page.inner_text('#meLeague'); print('ok' if 'Хорошист' in lg and '1087' in lg else 'FAIL', 'league:', lg.replace('\n', ' | '))
        bt = await page.inner_text('#meBattle'); print('ok' if 'Matematika' in bt else 'FAIL', 'battle:', bt.replace('\n', ' | ')[:120])
        ref = await page.inner_text('#refLine'); print('ok' if 'Наставник' in ref else 'FAIL', 'mentor:', ref)
        await page.click('[data-gift="77.abc"]'); await page.wait_for_timeout(500)
        print('ok' if any(c[0] == '/api/gift' for c in calls) else 'FAIL', 'gift sent')
        # shop: freeze
        await page.click('#scr-me [data-act=back]'); await page.wait_for_timeout(900)
        await page.click('[data-act=shop]'); await page.wait_for_timeout(900)
        await page.click('[data-act="buyFreeze"]'); await page.wait_for_timeout(600)
        print('ok' if W['freeze'] == 1 and W['coins'] == 3 else 'FAIL', 'freeze bought', W['freeze'], W['coins'])
        await page.evaluate("[...document.querySelectorAll('.shop-sec h3')].find(h=>/Услуги/.test(h.textContent)).parentElement.id='svcSec'")
        await page.locator('#svcSec').screenshot(path='shots/v172_services.png')
        await page.click('#scr-shop [data-act=back]'); await page.wait_for_timeout(900)
        # bot game (Nostalgia vs c2): hint
        await page.click('[data-go="modeclassic"]'); await page.wait_for_timeout(900)
        await page.click('#scr-modeclassic [data-bot="c2"]'); await page.wait_for_timeout(1200)
        hb = page.locator('#scr-classic [data-act="hint"]')
        vis = await hb.is_visible(); print('ok' if vis else 'FAIL', 'hint button visible in a bot game')
        await hb.click(); await page.wait_for_timeout(900)
        lit = await page.eval_on_selector_all('#scr-classic .hint', 'e => e.length')
        print('ok' if lit == 1 and W['coins'] == 2 else 'FAIL', 'hint highlighted one cell for 1 coin', lit, W['coins'])
        await page.screenshot(path='shots/v172_hint.png')
        # emotes row in phrases (bot game chat)
        await page.click('#scr-classic [data-act="chat"]'); await page.wait_for_timeout(300)
        em = await page.eval_on_selector_all('#scr-classic .phrase.emote', 'e => e.length')
        print('ok' if em == 6 else 'FAIL', 'emote buttons', em)
        await page.click('#scr-classic .phrase.emote >> nth=2'); await page.wait_for_timeout(300)
        bub = await page.inner_text('#cBubble'); print('ok' if '🔥' in bub else 'FAIL', 'emote bubble', bub)
        await page.screenshot(path='shots/v172_emote.png')
        # music toggle
        await page.goto('http://127.0.0.1:8769/'); await page.wait_for_timeout(1500)
        await page.click('#gearBtn'); await page.wait_for_timeout(900)
        await page.click('[data-music="1"]'); await page.wait_for_timeout(300)
        mu = await page.evaluate("localStorage.getItem('x02.music')"); print('ok' if mu == 'true' else 'FAIL', 'music on saved', mu)
        print('errors:', errs or 'none')
        await b.close()
asyncio.run(main())
