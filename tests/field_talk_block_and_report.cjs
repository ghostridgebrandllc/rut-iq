const assert=require('node:assert/strict');
const puppeteer=require(process.env.PUPPETEER_MODULE||'/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.goto('http://127.0.0.1:8928/',{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>!document.body.classList.contains('booting'));
  const result=await page.evaluate(async()=>{
   const me='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',post='33333333-3333-4333-8333-333333333333',comment='44444444-4444-4444-8444-444444444444';
   authUser={id:me,email:'qa@example.invalid'};authToken='mock-session';selectedState='Alabama';region='Tuscaloosa';setSelectors();
   const original=window.fetch.bind(window),actions=[];
   window.prompt=()=> 'spam';window.alert=()=>{};
   window.fetch=async(input,opts={})=>{
    const url=String(input),method=opts.method||'GET';
    const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    if(url.includes('/rest/v1/rpc/rut_field_is_moderator'))return json(false);
    if(url.includes('/rest/v1/rut_field_blocks')&&method==='DELETE'){actions.push({method,url});return json([])}
    if(url.includes('/rest/v1/rut_field_blocks'))return json([{blocked_id:other}]);
    if(url.includes('/rest/v1/rut_field_flags')&&method==='POST'){actions.push({method,body:JSON.parse(opts.body)});return json([])}
    if(url.includes('/rest/v1/rut_field_posts'))return json([{id:post,author_id:other,state:'Alabama',county:'Tuscaloosa',category:'Field Talk',caption:'Blocked user post',status:'approved',created_at:new Date().toISOString()}]);
    if(url.includes('/rest/v1/rut_field_comments'))return json([]);
    return original(input,opts);
   };
   show('fieldtalk');
   for(let i=0;i<100&&!document.querySelector('[data-field-unblock]');i++)await new Promise(r=>setTimeout(r,30));
   const hidden=!document.querySelector('[data-field-post="'+post+'"]');
   document.querySelector('[data-field-unblock]').click();
   for(let i=0;i<100&&!actions.length;i++)await new Promise(r=>setTimeout(r,30));
   const unblocked=actions.some(a=>a.method==='DELETE'&&a.url.includes(other));
   const c=document.createElement('button');c.dataset.fieldReportComment=comment;
   document.querySelector('#fieldFeed').append(c);
   c.click();
   for(let i=0;i<100&&!actions.some(a=>a.body?.comment_id===comment);i++)await new Promise(r=>setTimeout(r,30));
   window.fetch=original;
   return {hidden,unblocked,reported:actions.some(a=>a.body?.comment_id===comment&&a.body?.reason==='spam')};
  });
  assert.deepEqual(result,{hidden:true,unblocked:true,reported:true});
  assert.deepEqual(errors,[]);
  console.log('PASS Field Talk blocked hunter filtered, unblock request, reply report submission (mocked)');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
