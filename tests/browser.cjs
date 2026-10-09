const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require(process.env.PUPPETEER_MODULE || '/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const base = process.env.RUT_TEST_URL || 'http://127.0.0.1:8901/';
const mode = process.argv[2] || 'guest';
const api = 'https://ddxzyzjsqrnputiibdbi.supabase.co';
const key = 'sb_publishable_IKgJ-FLqeJDXM0VEoARYqQ_f-9EpGl1';
const headers = token => ({apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})});
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try {
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const response=await page.goto(base,{waitUntil:'networkidle2',timeout:90000});assert.equal(response.status(),200);
  await page.waitForFunction(()=>document.querySelector('#moreStatus').textContent!=='Checking...'&&Object.keys(regions).length>0);
  if(mode==='guest'){
   for(const width of [320,375,390,430]){
    await page.setViewport({width,height:844,isMobile:true,hasTouch:true});
    for(const tab of ['home','heatmap','reports','signup','plans','about']){
     await page.evaluate(tab=>show(tab),tab);
     if(tab==='heatmap')await page.waitForFunction(()=>map&&Object.keys(mapLayers).length>0,{timeout:60000});
     const layout=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
     assert.ok(layout.scroll<=layout.width,`${tab} overflow at ${width}: ${JSON.stringify(layout)}`);
    }
   }
   await page.evaluate(()=>show('heatmap'));console.log('MAP READY');await page.select('#mapColorMode','signal');
   assert.equal(await page.$eval('#plans',e=>e.classList.contains('show')),true);
   await page.evaluate(()=>show('heatmap'));await page.select('#mapTimeWindow','30');
   assert.equal(await page.$eval('#plans',e=>e.classList.contains('show')),true);
   assert.equal(await page.$eval('.plan-card.pro button',e=>e.disabled),true);
   assert.ok((await page.$eval('#plans',e=>e.innerText)).includes('$49.99/year'));
   await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
   for(const view of ['home','heatmap','plans']){await page.evaluate(v=>show(v),view);await page.screenshot({path:`/tmp/rut-iq-${view}.png`,fullPage:true})}
   // Request shape and UX only: no email is sent by this test.
   await page.setRequestInterception(true);let otp=null;
   page.on('request',req=>{if(req.url().includes('/auth/v1/otp')&&req.method()==='OPTIONS'){req.respond({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'POST'}})}else if(req.url().includes('/auth/v1/otp')){otp={url:req.url(),body:JSON.parse(req.postData())};req.respond({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:'{}'})}else req.continue()});
   await page.evaluate(()=>show('signup'));await page.type('#authEmail','qa@example.invalid');await page.click('#signInButton');
   await page.waitForFunction(()=>document.querySelector('#authMessage').textContent.includes('Check your email'));
   assert.equal(new URL(otp.url).searchParams.get('redirect_to'),'https://rut-iq-preview.onrender.com/');assert.equal(otp.body.create_user,true);
   console.log('PASS guest: 320/375/390/430 widths, navigation, Free locks, disabled checkout, OTP request shape (mocked, not delivery)');
  }else{
   const qa=JSON.parse(fs.readFileSync('/tmp/rut-iq-qa.json'));
   const login=await fetch(api+'/auth/v1/token?grant_type=password',{method:'POST',headers:headers(),body:JSON.stringify({email:qa.email,password:qa.password})});
   const session=await login.json();assert.equal(login.status,200,JSON.stringify({status:login.status,error:session.msg||session.message}));
   fs.writeFileSync('/tmp/rut-iq-test-session.json',JSON.stringify(session),{mode:0o600});
   console.log('LOGIN OK');await page.goto('about:blank');await page.goto(base+'#access_token='+encodeURIComponent(session.access_token)+'&refresh_token='+encodeURIComponent(session.refresh_token)+'&expires_in=3600',{waitUntil:'networkidle2'});
   console.log('CALLBACK',await page.evaluate(()=>({signedIn:!!authUser,pro:proAccess,status:document.querySelector('#authStatus').textContent,message:document.querySelector('#authMessage').textContent})));await page.waitForFunction(()=>authUser&&document.querySelector('#moreStatus').textContent!=='Checking...');
   assert.equal(await page.evaluate(()=>location.hash),'');
   assert.equal(await page.evaluate(()=>authUser.id),qa.id);
   assert.equal(await page.evaluate(()=>proAccess),mode==='pro');
   assert.equal(await page.evaluate(()=>refreshSession()),true);
   console.log('REFRESH OK');const token=await page.evaluate(()=>authToken);
   const proResp=await fetch(api+'/rest/v1/rpc/rut_pro_county_signals',{method:'POST',headers:headers(token),body:'{}'});
   assert.equal(proResp.status,mode==='pro'?200:403);
   const promote=await fetch(api+'/rest/v1/rut_memberships?user_id=eq.'+qa.id,{method:'PATCH',headers:headers(token),body:'{"plan":"pro"}'});assert.equal(promote.status,403);console.log('API GATES OK');
   await page.evaluate(()=>show('heatmap'));await page.waitForFunction(()=>map&&Object.keys(mapLayers).length>0,{timeout:60000});
   console.log('MAP READY');await page.select('#mapColorMode','signal');
   assert.equal(await page.$eval('#plans',e=>e.classList.contains('show')),mode!=='pro');
   if(mode==='pro'){
    await page.select('#mapTimeWindow','30');assert.equal(await page.evaluate(()=>mapDays),30);
    await page.screenshot({path:'/tmp/rut-iq-pro-map.png',fullPage:true});
   }
   if(mode==='free'){
    await page.evaluate(()=>show('submit'));
    await page.select('#behavior','Cruising');await page.type('#notes','ISOLATED QA: not a hunter observation');
    await page.$eval('#reportForm button[type=submit]',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'/tmp/rut-submit-before.png'});console.log('TARGET',await page.$eval('#reportForm button[type=submit]',e=>{const r=e.getBoundingClientRect();return {rect:r.toJSON(),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML}}));await page.click('#reportForm button[type=submit]');console.log('SUBMIT CLICKED');await page.waitForFunction(()=>!document.querySelector('#reportSuccess').hidden||document.querySelector('#message').textContent,{timeout:15000}).catch(()=>{});console.log('FORM',await page.evaluate(()=>({message:document.querySelector('#message').textContent,date:document.querySelector('#date').value,invalid:[...document.querySelectorAll('#reportForm :invalid')].map(x=>({id:x.id,value:x.value})),success:document.querySelector('#reportSuccess').textContent})));assert.equal(await page.$eval('#reportSuccess',e=>e.hidden),false);
    const own=await fetch(api+'/rest/v1/rut_reports?select=status,notes&user_id=eq.'+qa.id,{headers:headers(token)});const rows=await own.json();assert.equal(rows.length,1);assert.equal(rows[0].status,'hidden');
    const counts=await fetch(api+'/rest/v1/rut_free_county_activity',{headers:headers()});assert.deepEqual(await counts.json(),[]);
    assert.equal(await page.evaluate(()=>countyTotal),0);
    console.log('PASS real API: QA login, callback, refresh, automatic Free, self-upgrade denial, Free report saved hidden, public counts unchanged');
   }
   await page.evaluate(()=>show('signup'));await page.click('#signOutButton');await page.waitForFunction(()=>!authUser&&!proAccess);
   assert.equal(await page.evaluate(()=>localStorage.getItem('rut_iq_session')),null);
   console.log('PASS '+mode+': real membership RPC, feature gates, refresh, sign out');
  }
  assert.deepEqual(errors,[]);console.log('PASS no JavaScript errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
