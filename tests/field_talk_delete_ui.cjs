const assert=require('node:assert/strict');
const puppeteer=require(process.env.PUPPETEER_MODULE||'/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8927/',{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>!document.body.classList.contains('booting'));
  const result=await page.evaluate(async()=>{
   const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',post='33333333-3333-4333-8333-333333333333',p2='44444444-4444-4444-8444-444444444444';
   authUser={id:owner,email:'owner@example.invalid'};authToken='fake-owner';
   selectedState='Alabama';region='Tuscaloosa';setSelectors();
   const real=window.fetch.bind(window),requests=[];
   window.confirm=()=>true;
   window.fetch=async(url,opt={})=>{
    const path=String(url);
    const reply=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
    if(path.includes('/rpc/rut_field_is_moderator'))return reply(false);
    if(path.includes('/functions/v1/rut-field-delete-own')){requests.push(JSON.parse(opt.body));return reply({deleted:true})}
    if(path.includes('/rest/v1/rut_field_blocks'))return reply([]);
    if(path.includes('/rest/v1/rut_field_posts'))return reply([{id:post,author_id:owner,state:'Alabama',county:'Tuscaloosa',category:'Field Talk',caption:'My post',status:'pending',created_at:new Date().toISOString()},{id:p2,author_id:other,state:'Alabama',county:'Tuscaloosa',category:'Field Talk',caption:'Other post',status:'approved',created_at:new Date().toISOString()}]);
    if(path.includes('/rest/v1/rut_field_photos'))return reply([]);
    return real(url,opt);
   };
   await loadFieldTalk();
   const own=!!document.querySelector('[data-field-delete-post="'+post+'"]');
   const otherDelete=!!document.querySelector('[data-field-delete-post="'+p2+'"]');
   document.querySelector('[data-field-delete-post="'+post+'"]').click();
   for(let i=0;i<50&&!requests.length;i++)await new Promise(r=>setTimeout(r,30));
   window.fetch=real;
   return {own,otherDelete,requests};
  });
  assert.equal(result.own,true);assert.equal(result.otherDelete,false);
  assert.deepEqual(result.requests,[{type:'post',id:'33333333-3333-4333-8333-333333333333'}]);
  assert.deepEqual(errors,[]);
  console.log('PASS owner-only thread delete controls and authorized endpoint request (mocked)');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
