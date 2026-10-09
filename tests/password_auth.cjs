const assert=require('node:assert/strict');
const puppeteer=require('/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const base=process.env.RUT_TEST_URL||'http://127.0.0.1:8912/';
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const errors=[],calls=[];let failLogin=false;
 const user={id:'password-browser-test',email:'qa@example.invalid'};
 async function setup(context){
  const page=await context.newPage();const wait=page.waitForFunction.bind(page);page.waitForFunction=(fn,...args)=>wait(fn,{polling:100},...args);page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.setRequestInterception(true);
  page.on('request',r=>{
   if(!r.url().includes('.supabase.co/'))return r.continue();
   const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'};
   const reply=(body,status=200)=>r.respond({status,headers:cors,contentType:'application/json',body:JSON.stringify(body)});
   if(r.method()==='OPTIONS')return r.respond({status:204,headers:cors});
   const path=new URL(r.url()).pathname,body=r.postData()?JSON.parse(r.postData()):null;
   calls.push({path,method:r.method(),body,authorization:r.headers().authorization,url:r.url()});
   if(path.endsWith('/token'))return failLogin?reply({error_code:'invalid_credentials'},400):reply({access_token:'browser-only-token',refresh_token:'browser-only-refresh',expires_in:3600,user});
   if(path.endsWith('/user'))return reply(user);
   if(path.endsWith('/signup'))return reply(user);
   if(path.endsWith('/recover')||path.endsWith('/otp')||path.endsWith('/logout'))return reply({});
   if(path.endsWith('/rut_test_access')||path.endsWith('/rut_is_pro'))return reply(false);
   if(path.endsWith('/rut_county_changes'))return reply({first_visit:true,checked_at:new Date().toISOString()});
   if(path.endsWith('/rut_memberships'))return reply([{plan:'free',status:'active',source:'free'}]);
   return reply([]);
  });
  return page;
 }
 async function login(p,remember){
  await p.goto(base+'#signup',{waitUntil:'networkidle2'});
  await p.type('#authEmail',user.email);await p.type('#authPassword','Browser fixture password 12');
  await p.$eval('#rememberMe',(e,v)=>e.checked=v,remember);await p.click('#passwordSignIn');
  await p.waitForFunction(()=>authUser&&document.querySelector('#home.show'));
 }
 try{
  let ctx=await browser.createBrowserContext(),p=await setup(ctx);
  await login(p,true);
  assert(await p.evaluate(()=>!!localStorage.getItem('rut_iq_session')&&!sessionStorage.getItem('rut_iq_session')));
  assert(!JSON.stringify(await p.evaluate(()=>({...localStorage,...sessionStorage}))).includes('Browser fixture password'),'No password stored');
  await p.reload({waitUntil:'networkidle2'});assert(await p.evaluate(()=>!!authUser));
  let other=await setup(ctx);await other.goto(base,{waitUntil:'networkidle2'});assert(await other.evaluate(()=>!!authUser),'Remembered in independent tab');
  await p.evaluate(()=>show('account'));
  await p.bringToFront();await p.type('#newPassword','New fixture password 456');await p.type('#confirmPassword','Different fixture 456');
  const before=calls.filter(x=>x.method==='PUT').length;await p.$eval('#savePassword',e=>e.scrollIntoView({block:'center'}));await p.click('#savePassword');
  assert.match(await p.$eval('#passwordMessage',e=>e.textContent),/don’t match/);assert.equal(calls.filter(x=>x.method==='PUT').length,before);
  await p.$eval('#confirmPassword',e=>e.value='New fixture password 456');await p.$eval('#savePassword',e=>e.scrollIntoView({block:'center'}));await p.click('#savePassword');
  await p.waitForFunction(()=>$('passwordMessage').textContent.includes('Password saved'));
  assert(calls.some(x=>x.method==='PUT'&&x.authorization==='Bearer browser-only-token'));
  assert.equal(await p.$eval('#newPassword',e=>e.value),'');
  await p.evaluate(()=>show('signup'));await p.click('#signOutButton');
  await other.waitForFunction(()=>!authUser);await ctx.close();

  ctx=await browser.createBrowserContext();p=await setup(ctx);await login(p,false);
  assert(await p.evaluate(()=>!localStorage.getItem('rut_iq_session')&&!!sessionStorage.getItem('rut_iq_session')));
  await p.evaluate(()=>refreshSession());assert(await p.evaluate(()=>!localStorage.getItem('rut_iq_session')));
  await p.reload({waitUntil:'networkidle2'});assert(await p.evaluate(()=>!!authUser),'Tab reload retained');
  other=await setup(ctx);await other.goto(base,{waitUntil:'networkidle2'});assert.equal(await other.evaluate(()=>!!authUser),false,'Independent tab not remembered');
  await p.close();await other.close();p=await setup(ctx);await p.goto(base+'#signup',{waitUntil:'networkidle2'});assert.equal(await p.evaluate(()=>!!authUser),false,'Closed session does not persist to fresh tab');
  failLogin=true;await p.type('#authEmail',user.email);await p.type('#authPassword','Wrong fixture password');await p.click('#passwordSignIn');
  await p.waitForFunction(()=>$('authMessage').textContent.includes('wasn’t recognized'));assert.equal(await p.evaluate(()=>authUser),null);failLogin=false;
  await p.click('#forgotPassword');await p.waitForFunction(()=>$('authMessage').textContent.includes('If an account exists'));
  assert(calls.some(x=>x.path.endsWith('/recover')&&x.url.includes(encodeURIComponent('https://rut-iq-preview.onrender.com/'))));
  await p.goto(base+'#access_token=recovery-browser-only&expires_in=3600&type=recovery',{waitUntil:'networkidle2'});
  await p.waitForFunction(()=>location.hash==='#account');assert.equal(await p.evaluate(()=>location.hash),'#account');assert(await p.$eval('#accountControls',e=>!e.hidden));
  assert(!p.url().includes('access_token'));await ctx.close();

  ctx=await browser.createBrowserContext();p=await setup(ctx);await p.goto(base+'#signup',{waitUntil:'networkidle2'});
  await p.screenshot({path:'/tmp/rut-password-signin.png',fullPage:true});await p.click('#authCreateTab');await p.type('#authEmail',user.email);await p.type('#authPassword','New hunter fixture 123');
  for(const width of [320,390,844]){await p.setViewport({width,height:844,isMobile:true,hasTouch:true});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
  await p.click('#passwordSignIn');await p.waitForFunction(()=>$('authMessage').textContent.includes('Check your email'));
  assert.equal(await p.evaluate(()=>authUser),null);assert(calls.some(x=>x.path.endsWith('/signup')));
  assert.deepEqual(errors,[]);
  console.log('PASS password login/Home, new signup confirmation, invalid credentials, private tab vs remembered reload/new tab, refresh persistence, cross-tab logout, password mismatch/update, recovery routing/token removal, 320/390/844px. All Auth calls intercepted; no real emails/accounts/password changes.');
  await ctx.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
