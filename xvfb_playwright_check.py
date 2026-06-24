import subprocess, time, os, pathlib, json, sys
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
project=pathlib.Path('/mnt/data/selfrun_v7')
# start Xvfb
xvfb=subprocess.Popen(['Xvfb',':99','-screen','0','1280x720x24'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
os.environ['DISPLAY']=':99'
server=subprocess.Popen(['npm','run','dev','--','--host','127.0.0.1','--port','5176'], cwd=project, stdout=open(project/'xvfb_vite.log','w'), stderr=open(project/'xvfb_vite.err','w'))
time.sleep(3)
try:
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=False, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'])
    page=browser.new_page(viewport={'width':1280,'height':720})
    errors=[]; console=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: console.append({'type':m.type,'text':m.text}))
    page.goto('http://127.0.0.1:5176', wait_until='load', timeout=30000)
    page.wait_for_timeout(2000)
    page.screenshot(path='/mnt/data/xvfb_start.png')
    page.get_by_label('START').click(timeout=10000)
    page.wait_for_selector('canvas', timeout=30000)
    page.screenshot(path='/mnt/data/xvfb_game.png')
    for i in range(240):
      if page.locator('.scoreBoardList').count()>0: break
      if i==10: page.keyboard.press('Space')
      x=430+((i*2)%6)*90+45; y=118+((i*5)%6)*90+45
      page.mouse.click(x,y)
      page.wait_for_timeout(250)
    page.wait_for_timeout(4000)
    page.screenshot(path='/mnt/data/xvfb_result.png')
    visible=page.locator('.scoreBoardList').count()>0
    txt=page.locator('body').inner_text(timeout=5000)
    report={'visible':visible,'errors':errors,'console_errors':[c for c in console if c['type'] in ('error','warning')], 'text':txt[-500:]}
    pathlib.Path('/mnt/data/xvfb_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2)[:3000])
    browser.close()
    if errors or any(c['type']=='error' for c in console) or not visible:
      sys.exit(2)
finally:
  server.terminate(); xvfb.terminate()
  try: server.wait(timeout=5)
  except: server.kill()
  try: xvfb.wait(timeout=5)
  except: xvfb.kill()
