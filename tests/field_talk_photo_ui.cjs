const assert=require('node:assert/strict');
const puppeteer=require(process.env.PUPPETEER_MODULE||'/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.goto('http://127.0.0.1:8926/',{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>!document.body.classList.contains('booting'));
  const result=await page.evaluate(async()=>{
   const uid='11111111-1111-4111-8111-111111111111';
   const postId='22222222-2222-4222-8222-222222222222';
   let uploads=[],postCount=0,scanRequests=[];
   authUser={id:uid,email:'qa@example.invalid'};authToken='fake-qa-token';
   selectedState='Alabama';region='Tuscaloosa';setSelectors();
   const nativeFetch=window.fetch.bind(window);
   window.fetch=async(input,opts={})=>{
    const u=String(input),method=opts.method||'GET';
    if(u.includes('/rest/v1/rpc/rut_field_is_moderator'))return new Response('false',{status:200,headers:{'Content-Type':'application/json'}});
    if(u.includes('/rest/v1/rut_field_posts')&&method==='POST'){postCount++;return new Response(JSON.stringify([{id:postId}]),{status:201,headers:{'Content-Type':'application/json'}})}
    if(u.includes('/storage/v1/object/rut-field-photos/')&&method==='POST'){uploads.push({url:u,type:opts.headers['Content-Type'],blob:opts.body});return new Response('{}',{status:200})}
    if(u.includes('/rest/v1/rut_field_photos')&&method==='POST')return new Response(JSON.stringify([{id:'33333333-3333-4333-8333-333333333333'}]),{status:201,headers:{'Content-Type':'application/json'}});
    if(u.includes('/functions/v1/rut-field-photo-scan')){scanRequests.push(JSON.parse(opts.body));return new Response(JSON.stringify({scan_status:'pending'}),{status:503,headers:{'Content-Type':'application/json'}})}
    if(u.includes('/rest/v1/rut_field_posts'))return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
    if(u.includes('/rest/v1/rut_field_photos'))return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
    return nativeFetch(input,opts);
   };
   show('fieldtalk');
   const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;
   canvas.getContext('2d').fillRect(0,0,200,100);
   const image=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   const dt=new DataTransfer();dt.items.add(new File([image],'hunter.png',{type:'image/png'}));
   document.querySelector('#fieldPostPhotos').files=dt.files;
   document.querySelector('#fieldCaption').value='Mock hunting discussion';
   document.querySelector('#fieldPostForm').requestSubmit();
   await new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{if(uploads.length===1&&document.querySelector('#fieldPostMessage').textContent.includes('Submitted')){clearInterval(timer);resolve()}else if(Date.now()-start>8000){clearInterval(timer);resolve()}},50)});
   const output={uploads:uploads.length,posts:postCount,scanRequests,filename:uploads[0]?.url.split('/').pop(),contentType:uploads[0]?.type,mime:uploads[0]?.blob.type,size:uploads[0]?.blob.size,message:document.querySelector('#fieldPostMessage').textContent};
   window.fetch=nativeFetch;return output;
  });
  assert.equal(result.uploads,1);assert.equal(result.posts,1);
  assert.deepEqual(result.scanRequests,[{photo_id:'33333333-3333-4333-8333-333333333333'}]);
  assert.match(result.filename,/^[0-9a-f-]{36}\.jpg$/);
  assert.equal(result.contentType,'image/jpeg');assert.equal(result.mime,'image/jpeg');
  assert.ok(result.size<5242880);assert.match(result.message,/Submitted/);
  assert.deepEqual(errors,[]);
  console.log('PASS photo upload mock: post-linked path, JPEG re-encoding, private upload, pending attachment, mobile UI, no JS errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
