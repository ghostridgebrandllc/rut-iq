const assert=require('node:assert/strict');
const puppeteer=require('/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const base=(process.env.RUT_TEST_URL||'http://127.0.0.1:8911/').replace(/\/?$/,'/');
const expectedDay=new Date().toISOString().slice(0,10);
const nextDay=new Date(Date.now()+86400000).toISOString().slice(0,10);
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage();await page.setViewport({width:390,height:844});
  await page.emulateTimezone('America/Los_Angeles');
  await page.evaluateOnNewDocument(day=>{
   const RealDate=Date,instant=RealDate.parse(day+'T02:00:00Z');
   window.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[instant]))}static now(){return instant}};
  },nextDay);
  let mode='rate',mockReports=false;const days=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{
   const u=r.url(),cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,content-type,authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
   if(u.endsWith('/regions.json'))return setTimeout(()=>r.continue().catch(()=>{}),3500);
   if(u.includes('.supabase.co/')&&r.method()==='OPTIONS')return r.respond({status:204,headers:cors});
   if(u.includes('/auth/v1/otp')){
    if(mode==='network')return r.abort('failed');
    return r.respond({status:mode==='rate'?429:200,headers:cors,contentType:'application/json',body:JSON.stringify(mode==='rate'?{error_code:'over_email_send_rate_limit'}:{})});
   }
   if(u.includes('/rpc/rut_')&&u.includes('_for_day'))days.push(JSON.parse(r.postData()).as_of);
   let body;
   if(mockReports&&u.includes('rut_free_counties_for_day'))body=[{state:'Alabama',county:'Tuscaloosa County',reports_7d:210}];
   if(mockReports&&u.includes('rut_reports_for_day'))body=Array.from({length:200},()=>({state:'Alabama',county:'Tuscaloosa County',behavior:'Cruising',observed_on:expectedDay,created_at:expectedDay+'T12:00:00Z'}));
   if(mockReports&&u.includes('rut_pro_signals_for_day'))body=[{state:'Alabama',county:'Tuscaloosa County',reports_7d:210,cruising_7d:42,chasing_7d:42,tending_7d:42,breeding_7d:42,sign_7d:42,no_activity_7d:0}];
   if(body!==undefined)return r.respond({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(body)});
   r.continue();
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#welcomeExplore',{visible:true});await page.click('#welcomeExplore');
  await page.waitForFunction(()=>stateBounds&&Object.keys(nameByFips).length>3000);
  assert.equal(await page.$eval('#mapStateSelect',e=>e.options.length),52);
  assert.equal(await page.evaluate(()=>Object.keys(nameByFips).length),3143);
  assert.equal(await page.evaluate(()=>localDate()),expectedDay);
  mockReports=true;
  await page.evaluate(async()=>{
   selectedState='Alabama';region='Tuscaloosa County';authToken='ui-only';authUser={id:'ui-only',email:'qa@example.invalid'};proAccess=true;
   setSelectors();await loadReports();show('reports');
  });
  assert.match(await page.$eval('#feed',e=>e.textContent),/latest 200 of 210/);
  assert.equal(await page.$eval('#bars div',e=>e.title),'Cruising: 42 reports');
  assert(days.length>0);assert(days.every(d=>d===expectedDay));
  await page.evaluate(()=>{authUser=null;authToken=null;proAccess=false;updateAuthUI();show('signup')});
  await page.type('#authEmail','audit@example.invalid');await page.click('#signInButton');
  await page.waitForFunction(()=>document.getElementById('authMessage').textContent.includes('service limit'));
  assert.equal(await page.$eval('#signInButton',e=>e.disabled),true);
  assert(!/wait a minute/i.test(await page.$eval('#authMessage',e=>e.textContent)));
  mode='network';
  await page.evaluate(()=>{authRetryUntil=0;updateAuthUI()});await page.click('#signInButton');
  await page.waitForFunction(()=>document.getElementById('authMessage').textContent.includes('Check your connection'));
  assert.deepEqual(errors,[]);
  console.log('PASS delayed geography, populated state/FIPS lookup, local-day RPC payloads across UTC midnight, full aggregate chart beyond 200 reports, labeled feed cap, hourly-limit guidance/cooldown, network recovery. All report/auth fixtures intercepted in this browser; no email sent.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
