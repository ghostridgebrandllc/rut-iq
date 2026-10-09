// Phone viewport checks against the real Rut IQ app and read-only APIs.
// Search success is live; the failure response and keyboard geometry are simulated.
const assert=require('node:assert/strict');
const puppeteer=require(process.env.PUPPETEER_MODULE||'/Users/brentparham/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const base=process.env.RUT_TEST_URL||'http://127.0.0.1:8911/';
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  const response=await page.goto(base+'#heatmap',{waitUntil:'networkidle2',timeout:90000});assert.equal(response.status(),200);
  await page.waitForFunction(()=>map&&reportDataFetchedAt&&Object.keys(mapLayers).length>0);
  const rect=sel=>page.$eval(sel,e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right}});
  for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[844,390],[390,400]]){
   await page.setViewport({width,height,isMobile:true,hasTouch:true});
   await page.evaluate(()=>{closeCountySheet(false);$('mapFilters').open=false;syncMapViewport()});
   await page.waitForFunction(()=>Math.abs($('heatmap').getBoundingClientRect().height-(visualViewport.height-72))<2);
   const toolbar=await rect('.map-toolbar');
   if(width<600)assert.ok(toolbar.w>=width-30,'Portrait toolbar squeezed at '+width+'x'+height);
   await page.click('#mapFilters summary');
   await page.waitForFunction(()=>$('mapFilters').open);
   await page.$eval('#closeMapFilters',e=>e.scrollIntoView({block:'nearest'}));
   const done=await rect('#closeMapFilters'),dock=await rect('.dock');
   assert.ok(done.y>=0&&done.bottom<=dock.y&&done.right<=width,'Filters escape viewport '+width+'x'+height);
   await page.click('#closeMapFilters');
   assert.equal(await page.$eval('#mapFilters',e=>e.open),false);
   await page.evaluate(()=>openCountySheet('Alabama','Tuscaloosa'));
   for(const sel of ['#closeCountySheet','#sheetReports','#sheetHome']){
    const r=await rect(sel);assert.ok(r.x>=0&&r.right<=width&&r.y>=0&&r.bottom<=dock.y,sel+' clipped '+width+'x'+height);
    assert.ok(r.h>=44,sel+' touch target too small');
   }
   const layout=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
   assert.ok(layout.s<=layout.w,'Horizontal overflow '+width+'x'+height);
   if(width===320||width===844)await page.screenshot({path:'/tmp/rut-mobile-sheet-'+width+'.png'});
   await page.click('#closeCountySheet');
   console.log('PASS geometry / filters / county actions '+width+'x'+height);
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.click('#mapFilters summary');await page.select('#mapStateSelect','Alabama');
  await page.waitForFunction(()=>mapLayers['01']&&!$('mapFilters').open&&!map._animatingZoom);
  await page.evaluate(()=>map.setView([33.2,-87.6],9,{animate:false}));
  const point=await page.evaluate(()=>{const p=map.latLngToContainerPoint([33.2,-87.6]),r=$('countyMap').getBoundingClientRect();return{x:p.x+r.x,y:p.y+r.y}});
  await page.touchscreen.tap(point.x,point.y);
  await page.waitForFunction(()=>!$('countySheet').hidden);
  assert.equal(await page.$eval('#sheetCounty',e=>e.textContent),'Tuscaloosa County');
  await page.click('#sheetHome');
  await page.waitForFunction(()=>$('home').classList.contains('show')&&$('dailyContent').textContent.includes('Reports · 24 hours'));
  assert.ok((await page.$eval('#dailyTitle',e=>e.textContent)).includes('Tuscaloosa'));
  await page.click('.dock [data-route="heatmap"]');
  await page.click('#closeCountySheet');
  await page.click('#mapFilters summary');
  for(const layer of ['topo','street','satellite']){
   await page.click('#'+layer+'Btn');
   assert.equal(await page.$eval('#'+layer+'Btn',e=>e.getAttribute('aria-pressed')),'true');
  }
  await page.click('#closeMapFilters');
  await page.focus('#mapAddressInput');
  assert.equal(await page.$eval('.map-title-row',e=>getComputedStyle(e).display),'none');
  await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>380});visualViewport.dispatchEvent(new Event('resize'))});
  await page.waitForFunction(()=>document.body.classList.contains('map-keyboard'));
  assert.equal(await page.$eval('.dock',e=>getComputedStyle(e).display),'none');
  assert.ok((await rect('#mapAddressInput')).bottom<380);
  await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'))});
  await page.type('#mapAddressInput','Northport Alabama');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>!mapSearchInProgress&&searchMarker,{timeout:20000});
  assert.equal(await page.evaluate(()=>document.activeElement.id),'');
  assert.equal(await page.$eval('.dock',e=>getComputedStyle(e).display),'flex');
  await page.waitForFunction(()=>!map._animatingZoom);
  await page.waitForNetworkIdle({idleTime:500,timeout:20000});
  await page.screenshot({path:'/tmp/rut-mobile-map-390.png'});
  await page.click('#mapFilters summary');await page.click('#clearMapSearch');
  assert.equal(await page.evaluate(()=>searchMarker),null);
  assert.equal(await page.$eval('#mapAddressInput',e=>e.value),'');
  await page.setRequestInterception(true);
  page.on('request',r=>r.url().startsWith('https://nominatim.openstreetmap.org/search')?r.respond({status:503,headers:{'Access-Control-Allow-Origin':'*'},body:'Unavailable'}):r.continue());
  await page.type('#mapAddressInput','Failure test');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>!mapSearchInProgress&&$('mapAddressStatus').textContent.includes('unavailable'));
  assert.equal(await page.$eval('#mapAddressSearchButton',e=>e.disabled),false);
  await page.click('#mapFilters summary');await page.click('#clearMapSearch');await page.$eval('#mapAddressInput',e=>e.blur());
  await page.click('#mapFilters summary');await page.select('#mapColorMode','signal');
  await page.waitForFunction(()=>$('plans').classList.contains('show'));
  await page.click('.dock [data-route="heatmap"]');
  if(!await page.$eval('#mapFilters',e=>e.open))await page.click('#mapFilters summary');
  await page.select('#mapTimeWindow','30');
  await page.waitForFunction(()=>$('plans').classList.contains('show'));
  assert.equal(await page.$eval('.plan-card.pro button',e=>e.disabled),true);
  await page.goBack();await page.waitForFunction(()=>$('heatmap').classList.contains('show'));
  for(const route of ['home','reports','signup','plans','about','help','privacy','terms','account']){
   await page.evaluate(v=>show(v),route);
   const layout=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
   assert.ok(layout.s<=layout.w,'Overflow on '+route);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS actual county tap, Home selection, layer controls, live city search, clear search, simulated keyboard and search failure, Free gates, disabled checkout, history, navigation, no JS errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
