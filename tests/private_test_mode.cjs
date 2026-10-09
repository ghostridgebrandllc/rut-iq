const assert=require('node:assert/strict');
const puppeteer=require('/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const base=process.env.RUT_TEST_URL||'http://127.0.0.1:8912/';
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
 const page=await browser.newPage();await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 const errors=[],calls=[];let authorized=true,slow=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.evaluateOnNewDocument(()=>{
  localStorage.setItem('rut_iq_session',JSON.stringify({access_token:'test-browser-only',expires_at:Math.floor(Date.now()/1000)+3600}));
  localStorage.setItem('rut_iq_state','Alabama');localStorage.setItem('rut_iq_county','Tuscaloosa County');
 });
 await page.setRequestInterception(true);
 page.on('request',r=>{
  const u=r.url(),cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  const reply=body=>r.respond({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(body)});
  if(u.includes('.supabase.co/')&&r.method()==='OPTIONS')return r.respond({status:204,headers:cors});
  if(u.includes('/auth/v1/user'))return reply({id:'test-browser-user',email:'qa@example.invalid',app_metadata:{rut_iq_qa:true}});
  if(u.includes('/rut_memberships'))return reply([{plan:'free',source:'free',status:'active'}]);
  if(u.includes('/rpc/rut_is_pro'))return reply(false);
  if(u.includes('/rpc/rut_test_access'))return reply(authorized);
  if(u.includes('/rpc/rut_')){
   calls.push({path:new URL(u).pathname,authorization:r.headers().authorization,body:r.postData()});
   const privateView=new URL(u).pathname.endsWith('_test');
   const answer=()=>{
    if(u.includes('rut_county_changes'))return reply({checked_at:new Date().toISOString(),since:new Date().toISOString(),first_visit:false,new_reports:privateView?1:0,behaviors:null});
    if(u.includes('rut_daily_counties_for_day'))return reply(privateView?[{state:'Alabama',county:'Tuscaloosa County',reports_24h:1,hunters_24h:1,cruising_24h:0,chasing_24h:0,tending_24h:0,breeding_24h:0,signs_24h:1,no_activity_24h:0,latest_submission_at:new Date().toISOString()}]:[]);
    if(u.includes('rut_free_counties_for_day'))return reply(privateView?[{state:'Alabama',county:'Tuscaloosa County',reports_7d:1}]:[]);
    return reply([]);
   };
   if(privateView&&slow)return setTimeout(answer,650);
   return answer();
  }
  if(u.includes('/rest/v1/rut_reports')||u.includes('/auth/v1/otp'))throw Error('This suite must not submit reports or send email');
  r.continue();
 });
 await page.goto(base+'#home',{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>testMode&&reportsReady&&countyTotal===1&&$('dailyContent').textContent.includes('Scrapes / rubs'));
 assert.match(await page.$eval('#home [data-test-notice]',e=>e.textContent),/PRIVATE TEST MODE/);
 assert.equal(await page.$eval('#total',e=>e.textContent),'1');
 assert(calls.filter(x=>x.path.endsWith('_test')).every(x=>x.authorization==='Bearer test-browser-only'));
 assert(!calls.some(x=>x.path.includes('pro_signals')||x.path.includes('county_comparison')),'Free gate retained');
 await page.evaluate(()=>show('heatmap'));await page.waitForFunction(()=>reportDataFetchedAt&&Object.keys(mapLayers).length>0);
 assert.equal(await page.evaluate(()=>mapColor(allMapCounts['Alabama|Tuscaloosa County'])),'#f3d343');
 for(const [width,height]of [[320,568],[390,844],[844,390],[390,400]]){
  await page.setViewport({width,height,isMobile:true,hasTouch:true});await page.evaluate(()=>{syncMapViewport();$('mapFilters').open=true});
  await page.$eval('#closeMapFilters',e=>e.scrollIntoView({block:'nearest'}));
  assert(await page.$eval('#closeMapFilters',e=>{const r=e.getBoundingClientRect(),dock=document.querySelector('.dock').getBoundingClientRect();return r.top>=0&&r.bottom<=dock.top}),'QA filters clipped');
  await page.click('#closeMapFilters');
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.evaluate(()=>show('about'));await page.click('#testToggle');
 await page.waitForFunction(()=>!testMode&&reportsReady&&countyTotal===0);
 await page.evaluate(()=>show('home'));await page.waitForFunction(()=>$('dailyContent').textContent.includes('No fresh reports'));
 assert.match(await page.$eval('#home [data-test-notice]',e=>e.textContent),/Viewing public reports/);
 await page.reload({waitUntil:'networkidle2'});assert.equal(await page.evaluate(()=>testMode),false,'Public view choice retained');
 await page.evaluate(()=>show('about'));await page.click('#testToggle');await page.waitForFunction(()=>testMode&&countyTotal===1);
 slow=true;await page.evaluate(()=>{loadDailyReport();loadReports();show('about')});await page.click('#testToggle');
 await page.waitForFunction(()=>!testMode&&countyTotal===0&&reportsReady);
 await page.waitForNetworkIdle({idleTime:800});
 assert.equal(await page.evaluate(()=>countyTotal),0,'Late private response must not paint public view');slow=false;
 authorized=false;await page.evaluate(async()=>{await refreshMembership();await loadReports();await loadDailyReport()});
 assert.equal(await page.$eval('#testControls',e=>e.hidden),true);
 assert.equal(await page.evaluate(()=>testMode),false);
 await page.evaluate(async()=>{saveSession(null);authUser=null;updateAuthUI();await refreshMembership();await loadReports();await loadDailyReport()});
 assert(await page.$$eval('[data-test-notice]',es=>es.every(e=>e.hidden)));
 assert.equal(await page.evaluate(()=>countyTotal),0);
 assert.deepEqual(errors,[]);
 console.log('PASS private Home/Daily/volume map, signed private RPCs, Free gates, QA mobile filters, public toggle/reload, stale response isolation, revoked QA and logout cleanup. Browser-only fixtures; no report/email sent.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
