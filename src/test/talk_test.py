import asyncio, subprocess, time, pathlib
from playwright.async_api import async_playwright
R = pathlib.Path(__file__).resolve().parent.parent
srv = subprocess.Popen(['python3','-m','http.server','8774','--bind','127.0.0.1'], cwd=R/'x02-flat', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        errs = []
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, locale='ru-RU')
        await ctx.add_init_script("localStorage.setItem('x02.lang', JSON.stringify('ru'))")
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("localStorage.setItem('x02.welcomed','true')")
        await pg.goto('http://127.0.0.1:8774/'); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelector('.opp[data-mode=classic][data-bot=c2]').click()"); await pg.wait_for_timeout(1300)
        print('face visible:', await pg.is_visible('#cFace'), '| start bubble:', (await pg.inner_text('#cBubble')).replace('\n',' ') if await pg.is_visible('#cBubble') else 'none')
        print('chat button visible vs bot:', await pg.is_visible('#scr-classic [data-act=chat]'), '| resign hidden:', not await pg.is_visible('#scr-classic [data-act=resign]'))
        await pg.screenshot(path=str(R/'shots'/'talk_start.png'))
        await pg.wait_for_timeout(3500)
        await pg.click('#scr-classic [data-act=chat]'); await pg.click('[data-phrase="3"]'); await pg.wait_for_timeout(300)
        print('my bubble:', (await pg.inner_text('#cBubble')).replace('\n',' '))
        await pg.wait_for_timeout(1900)
        print('bot reply:', (await pg.inner_text('#cBubble')).replace('\n',' '), '| face:', await pg.get_attribute('#cFace', 'data-k'))
        await pg.screenshot(path=str(R/'shots'/'talk_reply.png'))
        # X02.0 against "Конец" — face thinks while the bot computes
        await pg.evaluate("document.querySelector('#scr-classic [data-act=menu]').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('.opp[data-mode=x02][data-bot=x1]').click()"); await pg.wait_for_timeout(900)
        await pg.click('#pc-4'); await pg.wait_for_timeout(250)
        print('x1 face while thinking:', await pg.get_attribute('#x02Face', 'data-k'))
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=str(R/'shots'/'talk_x02.png'))
        # turn talk off
        await pg.evaluate("document.querySelector('#scr-x02 [data-act=menu]').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate('document.querySelector(`[data-talk="0"]`).click()'); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('.opp[data-mode=classic][data-bot=c3]').click()"); await pg.wait_for_timeout(1300)
        print('talk off -> chat hidden:', not await pg.is_visible('#scr-classic [data-act=chat]'), '| bubble:', await pg.is_visible('#cBubble'), '| face still shown:', await pg.is_visible('#cFace'))
        print('errors:', errs or 'none')
        await b.close()
asyncio.run(main()); srv.terminate()
