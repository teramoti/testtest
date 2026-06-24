import subprocess, time, sys, os, json, pathlib, random
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

project = pathlib.Path('/mnt/data/selfrun_v7')
log = project/'selfrun_runtime.log'
err = project/'selfrun_runtime.err.log'
server = subprocess.Popen(['npm','run','dev','--','--host','127.0.0.1','--port','5174'], cwd=project, stdout=open(log,'w'), stderr=open(err,'w'), text=True)
try:
    time.sleep(3)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required','--no-proxy-server','--proxy-server=direct://','--proxy-bypass-list=*'])
        page = browser.new_page(viewport={'width':1280,'height':720}, device_scale_factor=1)
        console=[]; pageerrors=[]; requests=[]
        page.on('console', lambda msg: console.append({'type':msg.type,'text':msg.text}))
        page.on('pageerror', lambda exc: pageerrors.append(str(exc)))
        page.on('requestfailed', lambda req: requests.append({'url':req.url, 'failure': req.failure}))
        page.goto('http://127.0.0.1:5174', wait_until='networkidle', timeout=30000)
        page.screenshot(path='/mnt/data/selfrun_v7_start.png')
        page.get_by_label('START').click(timeout=10000)
        page.wait_for_selector('canvas', timeout=30000)
        page.screenshot(path='/mnt/data/selfrun_v7_game.png')
        # Click on likely slide board positions and use STOP. This is not a skillful playtest, but exercises interactions/runtime.
        board_x0, board_y0, tile = 430, 118, 90
        positions=[]
        for r in range(6):
            for c in range(6):
                positions.append((board_x0+c*tile+tile/2, board_y0+r*tile+tile/2))
        start=time.time()
        # run until result title appears or 75s
        i=0
        while time.time()-start < 76:
            if page.locator('text=Result').count() > 0 or page.locator('.scoreBoardList').count() > 0:
                break
            if i == 8:
                page.keyboard.press('Space')
            # click route/board locations alternating, avoid click on STOP button except space
            x,y=positions[(i*7 + i//2) % len(positions)]
            page.mouse.click(x,y)
            page.wait_for_timeout(260)
            i+=1
        try:
            page.wait_for_selector('.scoreBoardList', timeout=10000)
        except PlaywrightTimeoutError:
            pass
        page.screenshot(path='/mnt/data/selfrun_v7_result.png')
        result_visible = page.locator('.scoreBoardList').count() > 0 or page.locator('text=Result').count() > 0
        # Pull a small DOM status
        body_text = page.locator('body').inner_text(timeout=5000)
        browser.close()
        report = {
            'result_visible': bool(result_visible),
            'body_text_tail': body_text[-1000:],
            'console_errors': [c for c in console if c['type'] in ('error','warning')],
            'page_errors': pageerrors,
            'request_failures': requests[:20],
            'screenshots': ['/mnt/data/selfrun_v7_start.png','/mnt/data/selfrun_v7_game.png','/mnt/data/selfrun_v7_result.png'],
        }
        pathlib.Path('/mnt/data/selfrun_v7_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False, indent=2)[:4000])
        if pageerrors or any(c['type']=='error' for c in console) or not result_visible:
            sys.exit(2)
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
