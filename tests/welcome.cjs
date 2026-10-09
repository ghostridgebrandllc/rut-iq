const assert=require('node:assert/strict');
const puppeteer=require('/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const base=process.env.RUT_TEST_URL||'http://127.0.0.1:8911/';
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.goto(base,{waitUntil:'networkidle2'});await page.waitForFunction(()=>!document.body.classList.contains('booting'));
 assert.equal(await page.$eval('#welcome',e=>e.classList.contains('show')),true);
 assert.equal(await page.$eval('.dock',e=>getComputedStyle(e).display),'none');
 for(const [width,height] of [[320,568],[390,844],[844,390]]){
 await page.setViewport({width,height,isMobile:true,hasTouch:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.$eval('#welcomeExplore',e=>e.scrollIntoView({block:'center'}));
 await page.screenshot({path:'/tmp/rut-welcome-'+width+'.png',fullPage:true});
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.click('#welcomeCreate');assert.equal(await page.$eval('#signupTitle',e=>e.textContent),'Create your free account');
 await page.click('.welcome-back');await page.click('#welcomeSignIn');
 assert.equal(await page.$eval('#signupTitle',e=>e.textContent),'Welcome back');
 await page.click('.welcome-back');await page.click('#welcomeExplore');
 await page.waitForFunction(()=>map&&Object.keys(mapLayers).length>0);
 for(const width of [320,390]){
 await page.setViewport({width,height:844,isMobile:true,hasTouch:true});
 for(const sel of ['.map-back','#mapJoin'])assert.ok(await page.$eval(sel,e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.height>=44&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}));
 await page.click('.map-back');assert.equal(await page.$eval('#welcome',e=>e.classList.contains('show')),true);
 await page.click('#welcomeExplore');await page.click('#mapJoin');assert.equal(await page.$eval('#signup',e=>e.classList.contains('show')),true);
 await page.click('.welcome-back');await page.click('#welcomeExplore');
 }
 await page.screenshot({path:'/tmp/rut-map-back.png'});
 assert.equal(await page.evaluate(()=>localStorage.getItem('rut_iq_welcomed')),'1');
 await page.goto(base,{waitUntil:'networkidle2'});assert.equal(await page.$eval('#home',e=>e.classList.contains('show')),true);
 await page.evaluate(()=>localStorage.removeItem('rut_iq_welcomed'));
 await page.goto(base+'#privacy',{waitUntil:'networkidle2'});
 assert.equal(await page.$eval('#privacy',e=>e.classList.contains('show')),true);
 await page.goto(base+'#heatmap',{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>map&&Object.keys(mapLayers).length>0);
 // Mock only the returning-session UI; no account is created and no email is sent.
 await page.setRequestInterception(true);
 page.on('request',r=>{
 const u=r.url(),cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,content-type,authorization','Access-Control-Allow-Methods':'GET,POST'};
 if(u.includes('.supabase.co/')&&r.method()==='OPTIONS')return r.respond({status:204,headers:cors});
 let body;
 if(u.endsWith('/auth/v1/user'))body={id:'welcome-ui-test',email:'qa@example.invalid'};
 else if(u.includes('/rest/v1/rut_memberships'))body=[{plan:'free',source:'free',status:'active'}];
 else if(u.includes('/rest/v1/rpc/rut_is_pro'))body=false;
 if(body!==undefined)return r.respond({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(body)});
 r.continue();
 });
 await page.evaluate(()=>{localStorage.removeItem('rut_iq_welcomed');localStorage.setItem('rut_iq_session',JSON.stringify({access_token:'ui-test-only',expires_at:Math.floor(Date.now()/1000)+3600}))});
 await page.goto(base,{waitUntil:'networkidle2'});await page.waitForFunction(()=>!document.body.classList.contains('booting'));
 assert.equal(await page.$eval('#home',e=>e.classList.contains('show')),true);
 // Email links can finish in another tab while the original tab stays on signup.
 for(const route of ['signup','welcome']){
  await page.goto(base+'#'+route,{waitUntil:'networkidle2'});await page.reload({waitUntil:'networkidle2'});
  await page.waitForFunction(()=>location.hash==='#home'&&document.querySelector('#home.show'));
 }
 await page.goto(base+'#privacy',{waitUntil:'networkidle2'});
 assert.equal(await page.$eval('#privacy',e=>e.classList.contains('show')),true);
 await page.evaluate(()=>{history.replaceState(null,'','#signup');window.dispatchEvent(new StorageEvent('storage',{key:'rut_iq_session'}))});
 await page.waitForFunction(()=>location.hash==='#home'&&document.querySelector('#home.show'));
 await page.goto(base+'#access_token=ui-test-only&expires_in=3600',{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>location.hash==='#home');
 assert.deepEqual(errors,[]);
 console.log('PASS welcome at 320/390/844px, create/sign-in buttons, guest map, remembered choice, deep links, returning-session and callback UI (mocked), no JS errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});