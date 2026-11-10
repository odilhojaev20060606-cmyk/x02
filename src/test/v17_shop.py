import asyncio, subprocess, time, pathlib, json
from playwright.async_api import async_playwright
root = pathlib.Path(__file__).resolve().parent.parent / 'x02-flat'
srv = subprocess.Popen(['python3', '-m', 'http.server', '8768', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
MOCK = """
window.Telegram = { WebApp: {
  initData: 'query_id=TEST&hash=x', initDataUnsafe: { user: { id: 1, language_code: 'ru' } },
  ready(){}, expand(){}, disableVerticalSwipes(){}, setHeaderColor(){}, setBackgroundColor(){},
  BackButton: { onClick(){}, show(){}, hide(){} }, HapticFeedback: { impactOccurred(){}, notificationOccurred(){} },
  openInvoice(link, cb) { setTimeout(() => cb('paid'), 50); }
} };
"""
COIN = { 'x_neon': 25, 'o_neon': 25, 'x_cosmos': 35, 'o_cosmos': 35, 'x_vostok': 45, 'o_vostok': 45, 'x_samurai': 60, 'o_samurai': 60, 'x_pirate': 60, 'o_pirate': 60, 'x_gold': 100, 'o_gold': 100 }
PACKS = [(10,[]),(100,[]),(30,[]),(250,[]),(20,['x_neon','o_neon','x_cosmos','o_cosmos'],'start'),(100,list(COIN),'king')]
wallet = {'coins': 120, 'gold': [], 'packs': [], 'equip': {}}
async def handle(route):
    req = route.request; path = req.url.split('api.test')[1]; body = json.loads(req.post_data or '{}')
    res = wallet
    if path == '/api/invoice':
        pk = PACKS[body['pack']]; res = {'link': 'https://t.me/$inv'}
        wallet['coins'] += pk[0]
        for i in pk[1]:
            if i not in wallet['gold']: wallet['gold'].append(i)
        if len(pk) > 2: wallet['packs'].append(pk[2])
    elif path == '/api/spend':
        it = body['item']; cost = COIN[it]
        if wallet['coins'] < cost: return await route.fulfill(status=409, json={'error': 'coins', **wallet})
        wallet['coins'] -= cost; wallet['gold'].append(it); res = {'ok': True, **wallet}
    elif path not in ('/api/wallet',): res = {**wallet}
    await route.fulfill(json=res, headers={'access-control-allow-origin': '*'})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        await ctx.add_init_script(MOCK); await ctx.route('https://api.test/**', handle)
        page = await ctx.new_page(); errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        await page.add_init_script("localStorage.setItem('x02.welcomed','true');localStorage.setItem('x02.streakShown',JSON.stringify(new Date(Date.now()+5*3600000).toISOString().slice(0,10)))")
        await page.goto('http://127.0.0.1:8768/'); await page.wait_for_timeout(1200)
        await page.click("[data-act=shop]"); await page.wait_for_timeout(700)
        await page.screenshot(path='shots/v17_shop1.png', full_page=False)
        await page.evaluate("document.querySelectorAll('.shop-sec')[1].scrollIntoView()"); await page.wait_for_timeout(300)
        await page.screenshot(path='shots/v17_shop2.png')
        print('packs:', await page.eval_on_selector_all('[data-pack]', 'els => els.map(e => e.textContent.trim())'))
        await page.click('[data-buy="x_neon"]'); await page.wait_for_timeout(600)
        print('after neon:', wallet['coins'], wallet['gold'])
        await page.click('[data-buy="x_gold"]'); await page.wait_for_timeout(600)
        print('gold with 95 coins (should refuse):', wallet['gold'], await page.inner_text('.shop-note'))
        await page.locator('.chests').screenshot(path='shots/v17_chests.png')
        await page.click('[data-pack="5"]'); await page.wait_for_timeout(2500)
        print('after king chest:', wallet['coins'], len(wallet['gold']), wallet['packs'])
        print('chest buttons:', await page.eval_on_selector_all('.chest button', 'els => els.map(e => e.textContent.trim()+(e.disabled?" [off]":""))'))
        await page.evaluate("[...document.querySelectorAll('.shop-sec h3')].find(h=>/Премиум/.test(h.textContent)).parentElement.id='premSec'")
        await page.locator('#premSec').screenshot(path='shots/v17_prem.png')
        await page.locator('.chests').screenshot(path='shots/v17_chests.png')
        print('errors:', errs or 'none')
        await b.close()
asyncio.run(main())
