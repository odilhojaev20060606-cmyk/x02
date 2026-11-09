import asyncio, subprocess, time, pathlib, json
from playwright.async_api import async_playwright
root = pathlib.Path(__file__).resolve().parent.parent / 'x02-flat'
srv = subprocess.Popen(['python3', '-m', 'http.server', '8768', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
MOCK = """
window.__inv = [];
window.Telegram = { WebApp: {
  initData: 'query_id=TEST&hash=x', initDataUnsafe: { user: { id: 1, language_code: 'ru' } },
  ready(){}, expand(){}, disableVerticalSwipes(){}, setHeaderColor(){}, setBackgroundColor(){},
  BackButton: { onClick(){}, show(){}, hide(){} }, HapticFeedback: { impactOccurred(){}, notificationOccurred(){} },
  openInvoice(link, cb) { __inv.push(link); setTimeout(() => cb(window.__payResult || 'paid'), 50); }
} };
"""
wallet = {'coins': 3, 'gold': []}
async def handle(route):
    req = route.request; path = req.url.split('api.test')[1]; body = json.loads(req.post_data or '{}')
    assert body.get('initData', '').startswith('query_id'), 'initData missing'
    if path == '/api/wallet': res = wallet
    elif path == '/api/invoice': res = {'link': 'https://t.me/$inv' + str(body['pack'])}; wallet['coins'] += [10, 100][body['pack']]
    elif path == '/api/spend':
        cost = {'x_gold': 1, 'o_gold': 1, 'ex0': 5, 'ex1': 10, 'ex2': 20}[body['item']]
        if wallet['coins'] < cost: return await route.fulfill(status=409, json={'error': 'coins', **wallet})
        wallet['coins'] -= cost
        if 'gold' in body['item']: wallet['gold'].append(body['item'])
        res = {'ok': True, **wallet}
    await route.fulfill(json=res, headers={'access-control-allow-origin': '*'})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844})
        await ctx.add_init_script(MOCK); await ctx.route('https://api.test/**', handle)
        page = await ctx.new_page(); errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        await page.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page.goto('http://127.0.0.1:8768/'); await page.wait_for_timeout(900)
        await page.click("[data-act=shop]")
        await page.wait_for_timeout(500)
        wal = lambda: page.inner_text('#shopWallet')
        print('wallet from server:', (await wal()).replace('\n', ' '))
        print('pack buttons:', await page.eval_on_selector_all('[data-pack]', 'els => els.map(e => e.textContent)'))
        await page.click('[data-pack="0"]'); await page.wait_for_timeout(1500)
        print('after paying 50⭐:', (await wal()).replace('\n', ' '), '| note:', await page.inner_text('.shop-note'))
        await page.click('[data-buy="x_gold"]'); await page.wait_for_timeout(500)
        print('gold X bought, server gold:', wallet['gold'], '| coins:', wallet['coins'])
        await page.click('[data-exchange="0"]'); await page.wait_for_timeout(500)
        print('exchange 5 coins:', (await wal()).replace('\n', ' '))
        await page.evaluate("window.__payResult='failed'"); await page.click('[data-pack="1"]'); await page.wait_for_timeout(600)
        print('failed payment note:', await page.inner_text('.shop-note'))
        await page.evaluate("document.querySelector('.shop-sec:last-of-type').scrollIntoView()")
        await page.screenshot(path='shots/stars_shop.png')
        print('errors:', errs or 'none')
        # outside Telegram
        page2 = await (await b.new_context(viewport={'width': 390, 'height': 844})).new_page()
        await page2.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await page2.goto('http://127.0.0.1:8768/'); await page2.wait_for_timeout(700)
        await page2.click("[data-act=shop]")
        await page2.wait_for_timeout(300)
        print('web version coin section:', await page2.inner_text('.shop-sec:last-of-type'))
        await b.close()
asyncio.run(main())
srv.terminate()
