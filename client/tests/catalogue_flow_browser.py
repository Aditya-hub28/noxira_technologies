import functools,http.server,threading,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  if self.path.startswith('/api/'):
   self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{}');return
  if not (ROOT/'dist'/self.path.split('?')[0].lstrip('/')).is_file() and not self.path.startswith('/assets/'):
   self.path='/index.html'
  return super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',8770),functools.partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':1000});page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 base='http://127.0.0.1:8770'
 page.goto(base+'/?demo=1');page.wait_for_timeout(9000)
 assert page.locator('.program-card').count()==6
 assert all(h=='/apply' for h in page.locator('.program-card a').evaluate_all('(a)=>a.map(x=>x.getAttribute("href"))'))
 for w in [390,1440,390,1440]:
  page.set_viewport_size({'width':w,'height':844 if w==390 else 1000});page.wait_for_timeout(300)
  assert page.locator('.hv').count()==1
 page.reload();page.wait_for_timeout(1200);assert page.locator('.hv').count()==1
 page.locator('.program-directory a').click();page.wait_for_selector('[data-program-code]')
 assert page.locator('[data-program-code]').count()==31
 assert page.locator('[data-program-code]').evaluate_all('(cards)=>cards.every(c=>c.innerText.includes("Duration: 4 weeks"))')
 assert page.locator('[data-program-code] .programme-square-action button').evaluate_all('(buttons)=>buttons.every(b=>b.innerText.trim()==="Apply" && b.querySelector("svg")===null)')
 codes=page.locator('[data-program-code]').evaluate_all('(cards)=>cards.map(c=>c.dataset.programCode)')
 images=page.locator('[data-program-code] img')
 assert images.count()==31
 for image in images.all():
  image.scroll_into_view_if_needed();image.evaluate("i=>i.decode()")
 assert images.evaluate_all('(images)=>images.every(i=>i.naturalWidth>0 && i.complete && i.alt.length>0 && i.getAttribute("srcset").includes("960w"))')
 page.evaluate('window.scrollTo(0,0)')
 for w in [1440,768,390,320]:
  page.set_viewport_size({'width':w,'height':1000 if w>390 else 844})
  metrics=page.locator('[data-program-code]').evaluate_all('(cards)=>cards.map(c=>({w:c.getBoundingClientRect().width,h:c.getBoundingClientRect().height,overflow:c.scrollHeight>c.clientHeight+1,art:c.querySelector(".programme-square-art").getBoundingClientRect().height}))')
  assert all(abs(c['w']-c['h'])<=1 and not c['overflow'] and c['art']>60 for c in metrics),(w,metrics)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.set_viewport_size({'width':1440,'height':1000})

 page.screenshot(path='/downloads/noxira-catalogue-desktop.png',full_page=False)
 for category,count in [('Development',5),('Programming',4),('AI & Data Science',6),('Design',3),('Business',5),('Engineering',8)]:
  page.get_by_role('button',name=category,exact=False).click();assert page.locator('[data-program-code]').count()==count
 page.get_by_role('button',name='All Programmes',exact=False).click()
 page.get_by_role('searchbox').fill('python');assert page.locator('[data-program-code]').count()==1
 page.get_by_role('searchbox').fill('no-match-track');assert page.locator('[data-program-code]').count()==0
 page.get_by_role('button',name='Clear filters').click();assert page.locator('[data-program-code]').count()==31
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(400);page.screenshot(path='/downloads/noxira-catalogue-mobile.png')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.get_by_role('button',name='Engineering',exact=False).click();page.wait_for_timeout(250);page.evaluate('window.scrollTo(0,530)');page.wait_for_timeout(250);page.screenshot(path='/downloads/noxira-catalogue-engineering-mobile.png')
 page.evaluate('document.documentElement.setAttribute("data-theme","light")');page.wait_for_timeout(350);page.screenshot(path='/downloads/noxira-catalogue-light-mobile.png')
 for code in codes:
  page.goto(base+'/programs/'+code);page.wait_for_selector('h1');assert 'Programme Not Found' not in page.locator('h1').inner_text(),code
 page.goto(base+'/programs/FE-DEV');page.wait_for_selector('h1');page.screenshot(path='/downloads/noxira-programme-detail-mobile.png')
 page.get_by_role('link',name='Check application status').click();page.wait_for_selector('input[aria-label="Search programs"]');assert page.locator('input').input_value()=='FE-DEV';assert page.get_by_role('button',name='Apply',exact=True).is_disabled()
 page.goto(base+'/programs?program=PY-PROG');page.wait_for_selector('input');assert '/apply?program=PY-PROG' in page.url;assert page.locator('input').input_value()=='PY-PROG';assert page.locator('[data-program-code]').count()==1
 # A successful empty feed must not resurrect catalogue entries.
 page.route('**/api/v1/programs',lambda route:route.fulfill(json={'programs':[]}));page.goto(base+'/programs');page.wait_for_timeout(500);assert page.locator('[data-program-code]').count()==0
 page.route('**/api/v1/programs',lambda route:route.fulfill(json={'programs':[{'code':'OWNER','title':'Owner Edited Programme','category':'Design','description':'Owner description'}]}));page.reload();page.wait_for_timeout(500);assert page.locator('[data-program-code]').count()==1;assert 'Owner Edited Programme' in page.locator('[data-program-code]').inner_text()
 # Preserve established policy and distinguish configured/live application states.
 page.route('**/api/v1/programs/FE-DEV',lambda route:route.fulfill(json={'program':{'code':'FE-DEV','title':'Owner Frontend Track','category':'Development','durationWeeks':4,'description':'Owner syllabus description','syllabus':['Owner syllabus item'],'tasks':['Owner task']}}))
 page.route('**/api/v1/settings/public',lambda route:route.fulfill(json={'googleForm1Url':'https://example.test/official-application'}))
 page.goto(base+'/programs/FE-DEV');page.wait_for_selector('h1');page.wait_for_timeout(250)
 assert 'Owner Frontend Track' in page.locator('h1').inner_text()
 assert 'Review Fee is payable only at final submission. Applying is free.' in page.locator('body').inner_text()
 assert '4 weeks' in page.locator('body').inner_text()
 assert 'Owner syllabus item' in page.locator('body').inner_text() and 'Owner task' in page.locator('body').inner_text()
 page.screenshot(path='/downloads/noxira-live-detail-policy.png')
 page.route('**/api/v1/programs/FE-DEV',lambda route:route.fulfill(json={'program':{'code':'FE-DEV','title':'Live Track','category':'Development'}}))
 page.reload();page.wait_for_timeout(400);assert 'Applications are open for candidate intake via Google Form.' in page.locator('body').inner_text()
 page.route('**/api/v1/settings/public',lambda route:route.fulfill(json={'googleForm1Url':''}));page.reload();page.wait_for_timeout(400);assert 'Applications are not open yet.' in page.locator('body').inner_text()
 page.route('**/api/v1/settings/public',lambda route:route.fulfill(status=503,json={'message':'Unavailable'}));page.reload();page.wait_for_timeout(400);assert 'Application status is currently unavailable.' in page.locator('body').inner_text()
 page.route('**/api/v1/programs/FE-DEV',lambda route:route.fulfill(status=404,json={'message':'Not found'}));page.reload();page.wait_for_timeout(400);assert 'Programme Not Found' in page.locator('h1').inner_text()
 # Existing application card must retain real configured form behavior for live feed.
 page.route('**/api/v1/settings/public',lambda route:route.fulfill(json={'googleForm1Url':'https://example.test/official-application'}))
 page.goto(base+'/apply');page.wait_for_selector('[data-program-code]');page.wait_for_timeout(250)
 assert page.locator('[data-program-code] a[title="Apply via the official Google Form"]').get_attribute('href')=='https://example.test/official-application'
 assert page.locator('[data-program-code] .programme-square-action a').evaluate_all('(links)=>links.every(a=>a.innerText.trim()==="Apply" && a.querySelector("svg")===null)')
 page.route('**/api/v1/settings/public',lambda route:route.fulfill(json={'googleForm1Url':''}));page.reload();page.wait_for_timeout(350);assert page.get_by_role('button',name='Apply',exact=True).is_disabled()
 page.route('**/api/v1/settings/public',lambda route:route.fulfill(status=503,json={'message':'Unavailable'}));page.reload();page.wait_for_timeout(350);assert page.get_by_role('button',name='Apply',exact=True).is_disabled()
 assert not errors,errors
 print('PASS: single existing ApplyPage;programs alias/query preservation;6 direct home routes;31 source-backed cards;categories/search/clear;application live/closed/unavailable gating;resize/reload;detail policy/state coverage;zero JS errors')
 context.close();browser.close()
server.shutdown()
