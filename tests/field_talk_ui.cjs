const assert=require('node:assert/strict');
const puppeteer=require(process.env.PUPPETEER_MODULE||'/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.goto('http://127.0.0.1:8925/#fieldtalk',{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>!document.body.classList.contains('booting'));
  await page.evaluate(()=>show('fieldtalk'));
  assert.equal(await page.$eval('#fieldtalk',x=>x.classList.contains('show')),true);
  assert.equal(await page.$$eval('.dock [data-tab]',items=>items.length),5);
  assert.ok(await page.$('[data-route="reports"]'));
  assert.ok(await page.$('#fieldGuidelines'));

  assert.equal(await page.$eval('#fieldPostForm',x=>x.hidden),true);
  assert.ok((await page.$eval('#fieldStatus',x=>x.textContent)).includes('Sign in'));
  for(const width of [320,390,430]){
   await page.setViewport({width,height:844,isMobile:true,hasTouch:true});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Field Talk overflow '+width);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS Field Talk guest, navigation, signed-out post guard, mobile widths, no JavaScript errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
