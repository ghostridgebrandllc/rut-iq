const assert=require('node:assert/strict');
const puppeteer=require(process.env.PUPPETEER_MODULE||'/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.goto('http://127.0.0.1:8927/',{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>!document.body.classList.contains('booting'));
  const result=await page.evaluate(async()=>{
   const id='11111111-1111-4111-8111-111111111111',post='22222222-2222-4222-8222-222222222222',photo='33333333-3333-4333-8333-333333333333',flag='44444444-4444-4444-8444-444444444444';
   const changes=[],requests=[],native=window.fetch.bind(window);
   authUser={id,email:'moderator@example.invalid'};authToken='mock-moderator';
   selectedState='Alabama';region='Tuscaloosa';setSelectors();
   window.fetch=async(input,opts={})=>{
    const url=String(input),method=opts.method||'GET';requests.push({url,method});
    const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
    if(url.includes('/rest/v1/rpc/rut_field_is_moderator'))return reply(true);
    if(url.includes('/rest/v1/rut_field_posts')&&method==='PATCH'){changes.push({type:'post',body:JSON.parse(opts.body)});return reply([])}
    if(url.includes('/rest/v1/rut_field_flags')&&method==='PATCH'){changes.push({type:'flag',body:JSON.parse(opts.body)});return reply([])}
    if(url.includes('/rest/v1/rut_field_photos')&&method==='PATCH'){changes.push({type:'photo',body:JSON.parse(opts.body)});return reply([])}
    if(url.includes('/rest/v1/rut_field_posts')&&url.includes('status=eq.pending'))return reply([]);
    if(url.includes('/rest/v1/rut_field_posts')&&url.includes('id=eq.'))return reply([{caption:'Reported discussion',status:'approved'}]);
    if(url.includes('/rest/v1/rut_field_posts'))return reply([]);
    if(url.includes('/rest/v1/rut_field_comments'))return reply([]);
    if(url.includes('/rest/v1/rut_field_flags'))return reply([{id:flag,reason:'harassment',post_id:post,comment_id:null}]);
    if(url.includes('/rest/v1/rut_field_photos'))return reply([{id:photo,storage_path:id+'/'+post+'/'+photo+'.jpg'}]);
    if(url.includes('/rest/v1/rut_field_blocks'))return reply([]);
    if(url.includes('/storage/v1/object/authenticated/'))return new Response(new Blob(['not-an-image'],{type:'application/octet-stream'}),{status:403});
    return native(input,opts);
   };
   show('fieldtalk');
   const wait=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,40))}throw Error('Timed out')};
   await wait(()=>document.querySelector('[data-mod-kind="flags"]')&&document.querySelector('[data-mod-kind="photos"]'));
   const flagCard=document.querySelector('[data-mod-kind="flags"]');
   const photoCard=document.querySelector('[data-mod-kind="photos"]');
   if(!flagCard.textContent.includes('Reported discussion'))throw Error('Missing reported content context');
   if(!photoCard.querySelector('[data-review-photo]'))throw Error('Missing photo preview');
   if(!photoCard.querySelector('[data-mod-status="approved"]').disabled)throw Error('Unreviewable photo must not be approvable');
   flagCard.querySelector('[data-mod-status="content_hidden"]').click();
   await wait(()=>changes.some(c=>c.type==='flag'));
   const result={changes,photoPreview:!!photoCard.querySelector('[data-review-photo]'),queueVisible:!document.querySelector('#fieldModeration').hidden};
   window.fetch=native;return result;
  });
  assert.ok(result.queueVisible);assert.ok(result.photoPreview);
  assert.equal(result.changes[0].type,'post');
  assert.equal(result.changes[0].body.status,'hidden');
  assert.equal(result.changes[1].type,'flag');
  assert.equal(result.changes[1].body.resolution,'content_hidden');
  assert.deepEqual(errors,[]);
  console.log('PASS moderation mock: photo review queue, reported post context, hide before resolve, no JavaScript errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
