const assert=require('node:assert/strict');
const puppeteer=require(process.env.PUPPETEER_MODULE||'/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8927/',{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>!document.body.classList.contains('booting'));
  const output=await page.evaluate(async()=>{
   const realFetch=window.fetch.bind(window),calls=[];
   authUser={id:'11111111-1111-4111-8111-111111111111',email:'hunter@example.invalid'};authToken='fake-hunter';
   const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
   window.fetch=async(url,opts={})=>{
    const path=String(url);calls.push(path);
    if(path.includes('/rest/v1/rpc/rut_field_is_moderator'))return reply(false);
    if(path.includes('/rest/v1/rut_field_'))throw Error('Non-moderator attempted review query: '+path);
    return realFetch(url,opts);
   };
   document.querySelector('#fieldModeration').hidden=false;
   await loadFieldModeration();
   const deniedHidden=document.querySelector('#fieldModeration').hidden;
   authUser=null;authToken=null;
   document.querySelector('#fieldModeration').hidden=false;
   await loadFieldModeration();
   const signedOutHidden=document.querySelector('#fieldModeration').hidden;
   window.fetch=realFetch;
   return {deniedHidden,signedOutHidden,calls};
  });
  assert.ok(output.deniedHidden,'regular hunter must never see review queue');
  assert.ok(output.signedOutHidden,'signed-out hunter must never see review queue');
  assert.equal(output.calls.filter(x=>x.includes('/rest/v1/rpc/rut_field_is_moderator')).length,1);
  assert.deepEqual(errors,[]);
  console.log('PASS denied moderator role / signed-out hides moderation UI without fetching queue (mocked)');
 }finally{await browser.close()}
})().catch(err=>{console.error(err.stack);process.exit(1)});
