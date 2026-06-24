import time, pathlib, json, sys, os
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
url='file:///mnt/data/selfrun_v7/dist/selftest.html'
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required','--allow-file-access-from-files'])
  page=browser.new_page(viewport={'width':1280,'height':720})
  errors=[]; console=[]; fails=[]
  page.on('pageerror', lambda e: errors.append(str(e)))
  page.on('console', lambda m: console.append({'type':m.type,'text':m.text}))
  page.on('requestfailed', lambda r: fails.append({'url':r.url,'failure':r.failure}))
  page.goto(url, wait_until='load', timeout=30000)
  page.wait_for_timeout(4000)
  page.screenshot(path='/mnt/data/file_start.png')
  print('body', page.locator('body').inner_text(timeout=5000)[:200])
  page.get_by_label('START').click(timeout=10000)
  page.wait_for_selector('canvas', timeout=30000)
  page.screenshot(path='/mnt/data/file_game.png')
  for i in range(260):
    if page.locator('.scoreBoardList').count()>0: break
    if i==10: page.keyboard.press('Space')
    x=430+((i*2)%6)*90+45; y=118+((i*5)%6)*90+45
    page.mouse.click(x,y)
    page.wait_for_timeout(250)
  page.wait_for_timeout(3000)
  page.screenshot(path='/mnt/data/file_result.png')
  visible=page.locator('.scoreBoardList').count()>0
  txt=page.locator('body').inner_text(timeout=5000)
  report={'visible':visible,'errors':errors,'console_errors':[c for c in console if c['type'] in ('error','warning')], 'fails':fails[:30], 'text_tail':txt[-500:]}
  pathlib.Path('/mnt/data/file_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  print(json.dumps(report,ensure_ascii=False,indent=2)[:4000])
  browser.close()
  if errors or any(c['type']=='error' for c in console) or fails or not visible:
    sys.exit(2)
