const assert=require('node:assert/strict'),fs=require('node:fs');
const puppeteer=require('/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const base=(process.env.RUT_TEST_URL||'http://127.0.0.1:8912/').replace(/\/?$/,'/');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage();await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  const errors=[],changes=[],posts=[];let mock=false,sparse=false,comparisons=0;
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',r=>{
   const u=r.url(),cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,content-type,authorization,prefer','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
   if(u.includes('.supabase.co/')&&r.method()==='OPTIONS')return r.respond({status:204,headers:cors});
   const reply=body=>r.respond({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(body)});
   if(u.includes('/rpc/rut_county_changes')){
    const input=JSON.parse(r.postData());changes.push(input);
    if(mock)return reply({checked_at:new Date().toISOString(),since:input.last_seen||new Date().toISOString(),first_visit:!input.last_seen,new_reports:input.last_seen?2:0,behaviors:null});
   }
   if(u.includes('/rpc/rut_county_comparison')){
    comparisons++;
    if(mock){const day=n=>new Date(Date.now()-n*86400000).toISOString().slice(0,10);return reply([{period:'recent',starts_on:day(7),ends_on:day(1),reports:sparse?0:12,hunters:sparse?0:4,cruising:sparse?0:8,chasing:sparse?0:4},{period:'previous',starts_on:day(14),ends_on:day(8),reports:sparse?0:6,hunters:sparse?0:3,cruising:sparse?0:5,chasing:sparse?0:1}])}
   }
   if(mock&&u.includes('/rest/v1/rut_reports')&&r.method()==='POST'){posts.push(JSON.parse(r.postData()));return r.respond({status:201,headers:cors,body:''})}
   if(mock&&u.includes('/rpc/rut_pro_signals_for_day'))return reply([]);
   if(mock&&u.includes('/rpc/rut_reports_for_day'))return reply([]);
   if(u.includes('/auth/v1/otp'))throw Error('This test must not send email');
   r.continue();
  });
  await page.goto(base+'#home',{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>Object.keys(regions).length===51);
  await page.select('#state','Alabama');await page.select('#county','Tuscaloosa County');
  await page.waitForFunction(()=>$('changesContent').textContent.includes('starting point'));
  await page.click('#saveCounty');
  assert.equal(await page.evaluate(()=>savedCounties.length),1);
  assert.equal(await page.evaluate(()=>preferredCounty.county),'Tuscaloosa County');
  await page.select('#county','Bibb County');await page.click('#saveCounty');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('rut_iq_visits')||'{}')['Alabama|Bibb County']);
  await page.$eval('#savedCounties',e=>e.open=true);
  await page.click('[data-saved-home="1"]');await page.click('[data-saved-use="0"]');
  await page.waitForFunction(()=>$('nearbyContent').textContent.includes('Bibb County'));
  assert.equal(comparisons,0,'Free must not request comparison');
  mock=true;
  await page.reload({waitUntil:'networkidle2'});
  assert.equal(await page.evaluate(()=>region),'Bibb County','Preferred county must open after reload');
  await page.waitForFunction(()=>$('changesContent').textContent.includes('2 new reports'));
  assert(changes.some(c=>c.focus_county==='Bibb County'&&c.last_seen));
  await page.$eval('#savedCounties',e=>e.open=true);await page.click('[data-saved-remove="1"]');
  assert.equal(await page.evaluate(()=>preferredCounty.county),'Tuscaloosa County');
  await page.evaluate(async()=>{authUser={id:'browser-only',email:'qa@example.invalid',app_metadata:{rut_iq_qa:true}};authToken='browser-only';proAccess=true;updateAuthUI();show('reports');await loadComparison()});
  await page.waitForFunction(()=>$('comparisonContent').textContent.includes('6 more reports'));
  assert.match(await page.$eval('#comparisonContent',e=>e.textContent),/4 hunters/);
  assert.equal(await page.$eval('.comparison-table tbody tr td',e=>e.textContent),'8');
  sparse=true;await page.evaluate(()=>loadComparison());
  await page.waitForFunction(()=>$('comparisonContent').textContent.includes('No reports to compare yet'));
  await page.evaluate(()=>{proAccess=false;loadComparison()});
  assert.equal(await page.$eval('#comparisonCard',e=>e.hidden),true);
  await page.evaluate(()=>{selectCounty('Alabama','Tuscaloosa County');show('submit')});
  await page.select('#behavior','Chasing');
  await page.$eval('#reportForm button[type=submit]',e=>e.scrollIntoView({block:'center'}));
  await page.waitForFunction(()=>{const e=$('reportForm').querySelector('button[type=submit]'),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e});
  await page.click('#reportForm button[type=submit]');
  await page.waitForSelector('#receiptTitle',{visible:true,timeout:15000}).catch(async e=>{console.log('Receipt diagnostic',await page.evaluate(()=>({message:$('message').textContent,valid:$('reportForm').checkValidity(),date:$('date').value,behavior:$('behavior').value,state:$('reportState').value,county:$('reportCounty').value,user:!!authUser})),posts,errors);throw e});
  assert.equal(posts.length,1);assert.equal(posts[0].county,'Tuscaloosa County');assert.equal(posts[0].behavior,'Chasing');
  assert.match(await page.$eval('#reportSuccess',e=>e.textContent),/Excluded from public reports/);
  await page.click('[data-action="receipt-map"]');await page.waitForFunction(()=>activeMapCounty?.county==='Tuscaloosa County');
  assert(await page.evaluate(()=>map.getZoom()>4));
  await page.evaluate(()=>show('reports'));await page.click('[data-action="receipt-another"]');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'behavior');
  await page.evaluate(()=>{authUser=null;authToken=null;updateAuthUI();show('about')});
  assert.match(await page.$eval('#installSteps',e=>e.textContent),/Add to Home Screen/);
  const manifest=await page.evaluate(async()=>{const r=await fetch('./manifest.webmanifest');return {type:r.headers.get('content-type'),data:await r.json()}});
  assert.match(manifest.type,/manifest\+json/);assert.equal(manifest.data.display,'standalone');assert.equal(manifest.data.icons.length,3);
  for(const icon of manifest.data.icons)assert.equal(await page.evaluate(async src=>(await fetch(src)).status,icon.src),200);
  await page.evaluate(()=>show('home'));await page.waitForFunction(()=>$('changesContent').textContent.includes('new reports'));
  for(const width of [320,390,430]){await page.setViewport({width,height:844,isMobile:true,hasTouch:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow '+width)}
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.screenshot({path:'/tmp/rut-iq-premium-home.png',fullPage:true});
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle2'});
  const cached=await page.evaluate(async()=>{const keys=await caches.keys();return (await Promise.all(keys.map(async k=>(await (await caches.open(k)).keys()).map(r=>new URL(r.url).pathname)))).flat()});
  assert.deepEqual(cached,['/offline.html'],'Only reconnect screen may be cached');
  const worker=browser.targets().find(t=>t.type()==='service_worker');assert(worker);
  const workerSession=await worker.createCDPSession();await workerSession.send('Network.enable');
  await workerSession.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await page.setOfflineMode(true);await page.goto(base,{waitUntil:'domcontentloaded'});
  assert.match(await page.$eval('h2',e=>e.textContent),/offline/);await page.setOfflineMode(false);
  assert.deepEqual(errors,[]);
  console.log('PASS saved counties/Home persistence/removal, actual zero-data first visit, nearby counties, returning-visit count, Free/Pro comparison UI, sparse data, private QA receipt + county map + another report, install manifest/icons, phone overflow, safe offline fallback. Report and Pro fixtures intercepted in browser only; no email sent.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
