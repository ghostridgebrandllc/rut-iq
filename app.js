const $=id=>document.getElementById(id);
function localDate(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
let selectedState=localStorage.getItem('rut_iq_state')||'';
let region=localStorage.getItem('rut_iq_county')||'';
let reports=[];let regions={};let countyTotal=0;let reportsReady=false;let authUser=null;let authToken=null;let countyGeo=null;let map=null;let mapLayer=null;let mapActivity={};let baseMapLayer=null;let currentBaseMap='satellite';

$('date').value=localDate();$('date').max=localDate();
function changeState(e){selectedState=e.target.value;region='';saveRegion();setSelectors();render();loadReports();loadDailyReport()}
$('state').addEventListener('change',changeState);$('reportState').addEventListener('change',changeState);
$('county').addEventListener('change',e=>{region=e.target.value;saveRegion();$('reportCounty').value=region;render();loadReports();loadDailyReport()});
$('reportCounty').addEventListener('change',e=>{region=e.target.value;saveRegion();$('county').value=region;render();loadReports();loadDailyReport()});
function hasRegion(){return !!(selectedState&&region)}
function updateRegionSummary(){$('regionSummary').textContent=hasRegion()?region+', '+selectedState:'Choose your hunting region';$('useRegion').disabled=!hasRegion()}
$('useRegion').addEventListener('click',()=>{$('regionPicker').open=false;loadDailyReport()});
function saveRegion(){updateRegionSummary();localStorage.setItem('rut_iq_state',selectedState);localStorage.setItem('rut_iq_county',region)}
function setSelectors(){
 $('state').innerHTML='<option value="">Choose a state</option>'+Object.keys(regions).sort().map(st=>'<option '+(st===selectedState?'selected':'')+'>'+st+'</option>').join('');
 $('reportState').innerHTML=$('state').innerHTML;
 const arr=regions[selectedState]||[];
 if(!arr.some(c=>c.name===region)){region='';saveRegion()}
 const opts='<option value="">Choose a county</option>'+arr.map(c=>'<option value="'+c.name.replace(/"/g,'&quot;')+'" '+(c.name===region?'selected':'')+'>'+c.name+'</option>').join('');
 $('county').innerHTML=opts;$('reportCounty').innerHTML=opts;$('county').disabled=!selectedState;$('reportCounty').disabled=!selectedState;updateRegionSummary();
}
fetch('./regions.json').then(r=>{if(!r.ok)throw Error('Regions unavailable');return r.json()}).then(data=>{regions=data;if(!regions[selectedState])selectedState='';setSelectors();$('regionPicker').open=!hasRegion();render();loadReports();loadDailyReport()}).catch(e=>{ $('county').innerHTML='<option>Unable to load counties</option>'; $('reportCounty').innerHTML='<option>Unable to load counties</option>'; $('reportForm').querySelector('button[type=submit]').disabled=true; $('regionLabel').textContent='Refresh to load counties'; });
const routes=new Set(['home','heatmap','reports','submit','signup','plans','about','help','privacy','terms','account']);
function show(id,record=true){
 if(!routes.has(id))id='home';
 if(id==='submit'&&!authUser)id='signup';
 if(id==='account')updateAccountUI();
 if(record&&location.hash!=='#'+id)history.pushState(null,'','#'+id);
 document.querySelectorAll('.view').forEach(x=>x.classList.toggle('show',x.id===id));
 document.querySelectorAll('.dock button').forEach(x=>{const active=x.dataset.tab===id;x.classList.toggle('active',active);if(active)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
 document.body.classList.toggle('map-view',id==='heatmap');
 document.title=({home:'Daily Report',heatmap:'Rut Map',signup:'Hunter Sign-in',privacy:'Privacy',terms:'Terms of Use',help:'Help'}[id]||'Rut IQ')+' | Rut IQ by Ghost Ridge';
 if(id==='home')loadDailyReport();if(id==='plans')updateMembershipUI();if(id==='heatmap')setTimeout(()=>loadHeatmap(),50);
 render();window.scrollTo(0,0);
}
function routeFromURL(){const id=location.hash.slice(1);if(!id.includes('='))show(routes.has(id)?id:'home',false)}
window.addEventListener('popstate',routeFromURL);
document.addEventListener('click',e=>{const link=e.target.closest('a[href^="#"]');if(link&&routes.has(link.hash.slice(1))){e.preventDefault();show(link.hash.slice(1))}});
function safe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){
 $('behaviorSummary').hidden=!proAccess;
 if(!hasRegion()){$('total').textContent='—';$('regionLabel').textContent='Choose your county on Home to see local reports.';$('activityEmpty').textContent='Choose a county to see recent observations.';$('activityChart').style.display='none';$('activityEmpty').style.display='block';$('feed').innerHTML='<a href="#home">Choose your hunting region →</a>';return}
 const list=reports.filter(r=>r.county===region&&r.state===selectedState).sort((a,b)=>b.saved-a.saved);
 $('total').textContent=reportsReady?countyTotal:'—';

 $('regionLabel').textContent=region+', '+selectedState+' · Past 7 days';
 $('activityEmpty').style.display=list.length&&proAccess?'none':'block';
 $('activityChart').style.display=list.length&&proAccess?'block':'none';
 $('activityEmpty').textContent=!reportsReady?'Loading county reports...':!countyTotal?'No hunter reports in this county in the past 7 days. Be the first to contribute.':proAccess?'Recent county observations are shown below.':'This county has '+countyTotal+' reports in the past 7 days. See today’s observations in your Daily Rut Report. Pro adds detailed behavior analysis.';
 const cats=['Cruising','Chasing','Tending a doe','Breeding observed','Scrape / rub activity','No rut activity observed'];
 const counts=cats.map(c=>list.filter(r=>r.behavior===c).length),max=Math.max(1,...counts);
 $('bars').innerHTML=counts.map((n,i)=>'<div title="'+safe(cats[i])+': '+n+' reports" style="height:'+Math.max(4,n/max*100)+'%"></div>').join('');
 $('feed').className=list.length?'':'empty';
 $('feed').innerHTML=proAccess&&list.length?list.map(r=>'<div class="feeditem"><div class="row"><b>'+safe(r.behavior)+'</b><span class="muted">'+safe(r.date)+'</span></div><p class="muted">Hunter observation</p><span class="tag">'+safe(r.county)+'</span></div>').join(''):!countyTotal?'No hunter reports yet for this county.':countyTotal+' county reports in the past 7 days.<p>Daily Rut Report is included free. Pro unlocks detailed behavior analysis.</p><button class="ghost" data-route="plans">Explore Pro</button>';
}
const api='https://ddxzyzjsqrnputiibdbi.supabase.co';
const pubKey='sb_publishable_IKgJ-FLqeJDXM0VEoARYqQ_f-9EpGl1';
function headers(access){return {'apikey':pubKey,'Content-Type':'application/json',...(access?{'Authorization':'Bearer '+access}:{})}}
let refreshTimer=null;
let dailyRequest=0;
async function loadDailyReport(){
 const request=++dailyRequest,st=selectedState,county=region;
 const title=$('dailyTitle'),box=$('dailyContent');
 if(!hasRegion()){title.textContent='Your Daily Rut Report';box.innerHTML='<p class="daily-note">Choose your state and county above to see real hunter observations, or explore the nationwide map.</p>';return}
 title.textContent=county+', '+st;
 box.innerHTML='<p class="muted">Checking recent hunter reports...</p>';
 try{
  const url=new URL(api+'/rest/v1/rut_daily_county_reports');
  url.searchParams.set('select','reports_24h,hunters_24h,cruising_24h,chasing_24h,tending_24h,breeding_24h,signs_24h,no_activity_24h,latest_submission_at');
  url.searchParams.set('state','eq.'+st);url.searchParams.set('county','eq.'+county);url.searchParams.set('limit','1');
  const response=await fetch(url,{headers:headers()});
  if(!response.ok)throw Error('Recent activity is unavailable');
  const data=await response.json();
  if(request!==dailyRequest||st!==selectedState||county!==region)return;
  const r=data[0],total=Number(r?.reports_24h||0),hunters=Number(r?.hunters_24h||0);
  if(!total){
   box.innerHTML='<div class="daily-stats"><div class="daily-stat"><strong>0</strong><span>Reports · 24 hours</span></div><div class="daily-stat"><strong>0</strong><span>Hunters reporting</span></div></div><p class="daily-empty">No fresh reports yet.</p><p class="daily-note">Be the first to share what you saw. An empty report does not mean deer are inactive.</p><p class="daily-meta">Includes reports sent in the last 24 hours for observations from today or yesterday.</p>';
   return;
  }
  const items=[['Cruising',r.cruising_24h],['Chasing',r.chasing_24h],['Tending',r.tending_24h],['Breeding',r.breeding_24h],['Scrapes / rubs',r.signs_24h],['No rut behavior seen',r.no_activity_24h]];
  const badges=items.filter(x=>Number(x[1])>0).map(([label,n])=>'<div class="behavior-row"><span>'+safe(label)+'</span><strong>'+Number(n)+'</strong></div>').join('');
  const updated=r.latest_submission_at?new Date(r.latest_submission_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
  const confidence=total>=5&&hunters>=3?'Multiple hunters contributed. These are observations, not predictions.':'Early reports only — not enough independent observations to establish a reliable regional trend.';
  box.innerHTML='<div class="daily-stats"><div class="daily-stat"><strong>'+total+'</strong><span>Reports · 24 hours</span></div><div class="daily-stat"><strong>'+hunters+'</strong><span>Hunters reporting</span></div></div><div class="daily-behavior-list">'+badges+'</div><p class="daily-note">'+safe(confidence)+'</p><p class="daily-meta">Last report: '+safe(updated)+' · Reports submitted in the last 24 hours, describing observations from today or yesterday.</p>';
 }catch(error){
  if(request===dailyRequest)box.innerHTML='<p class="daily-note">Daily reports are temporarily unavailable. Please try again later.</p><button class="ghost" type="button" data-action="retry-daily">Retry</button>';
 }
}

let reportRequest=0;
async function loadReports(){
 const request=++reportRequest,key=region,st=selectedState;
 reportsReady=false;reports=[];countyTotal=0;render();if(!hasRegion())return;
 try{
  const u=new URL(api+'/rest/v1/rut_free_county_activity');
  u.searchParams.set('select','reports_7d');u.searchParams.set('state','eq.'+st);u.searchParams.set('county','eq.'+key);
  const resp=await fetch(u,{headers:headers()});if(!resp.ok)throw Error('Could not load live reports');
  const counts=await resp.json();let data=[];
  if(proAccess&&authToken){
   const detail=new URL(api+'/rest/v1/rut_public_reports');detail.searchParams.set('select','state,county,behavior,observed_on,created_at');detail.searchParams.set('state','eq.'+st);detail.searchParams.set('county','eq.'+key);detail.searchParams.set('order','created_at.desc');detail.searchParams.set('limit','200');
   const r=await fetch(detail,{headers:headers(authToken)});if(!r.ok)throw Error('Could not load behavior details');data=await r.json();
  }
  if(request!==reportRequest||region!==key||selectedState!==st)return;
  countyTotal=Number(counts[0]?.reports_7d||0);reportsReady=true;
  reports=(proAccess?data:[]).map(r=>({county:r.county,state:r.state,behavior:r.behavior,date:r.observed_on,saved:Date.parse(r.created_at)}));render();
 }catch(e){if(request===reportRequest){$('activityEmpty').textContent='Community reports are temporarily unavailable. Please try again.';$('feed').textContent='Reports unavailable. Please try again.'}}
}
let membership={plan:'free',source:'free',status:'active'},proAccess=false,membershipTimer=null;
function updateMembershipUI(){
 const label=proAccess?'Rut IQ Pro':'Rut IQ Free';
 const status=authUser?(proAccess?(membership.source==='tester'?'Pro tester':'Active Pro'):'Free member'):'Guest';
 for(const id of ['planCurrent','morePlan']){if($(id))$(id).textContent=label}
 for(const id of ['planStatus','moreStatus']){if($(id))$(id).textContent=status}
 if($('planMessage'))$('planMessage').textContent=proAccess?'Pro access is active. Thank you for helping build Rut IQ.':authUser?'Your Free account is active. Pro checkout is not enabled yet; no payments can be taken.':'Sign in to contribute reports. Pro checkout is not enabled yet.';
}
async function refreshMembership(){
 clearTimeout(membershipTimer);
 proAccess=false;reports=[];membership={plan:'free',source:'free',status:'active'};
 if(authUser&&authToken){
  try{
   const u=new URL(api+'/rest/v1/rut_memberships');
   u.searchParams.set('select','plan,source,status,current_period_end');
   u.searchParams.set('user_id','eq.'+authUser.id);
   u.searchParams.set('limit','1');
   const r=await fetch(u,{headers:headers(authToken)});
   if(!r.ok)throw Error('Could not verify membership');
   const rows=await r.json();
   if(rows.length)membership=rows[0];
   const verified=await fetch(api+'/rest/v1/rpc/rut_is_pro',{method:'POST',headers:headers(authToken),body:'{}'});
   proAccess=verified.ok&&(await verified.json())===true;
  }catch(e){proAccess=false;membership={plan:'free',source:'free',status:'inactive'}}
 }
 updateMembershipUI();
 if(proAccess&&membership.current_period_end){membershipTimer=setTimeout(()=>refreshMembership().then(loadReports),Math.min(2147483647,Math.max(500,Date.parse(membership.current_period_end)-Date.now()+50)))}
 if($('mapColorMode')){if(!proAccess){mapColorMode='volume';mapDays=7;$('mapColorMode').value='volume';$('mapTimeWindow').value='7'}}
 ++mapDataRequest;allMapCounts={};reportDataFetchedAt=0;if(map){recolorMap();await fetchMapReportData().then(recolorMap).catch(()=>{})}
}
let session=null,refreshInFlight=null;
function saveSession(value){
 session=value;authToken=value?.access_token||null;
 if(value)localStorage.setItem('rut_iq_session',JSON.stringify(value));else localStorage.removeItem('rut_iq_session');
 localStorage.removeItem('rut_iq_access_token');
 clearTimeout(refreshTimer);
 if(value?.refresh_token){refreshTimer=setTimeout(()=>refreshSession().catch(()=>{}),Math.max(1000,(Number(value.expires_at)*1000-Date.now())-60000))}
}
function updateAuthUI(){
 updateAccountUI();
 $('authStatus').textContent=authUser?'Signed in as '+authUser.email:'Sign in securely to contribute reports';
 $('signInButton').textContent=authUser?'Signed in':'Send Secure Sign-In Link';$('signInButton').disabled=!!authUser;
 $('signOutButton').hidden=!authUser;$('authEmail').hidden=!!authUser;
}
async function refreshSession(){
 if(refreshInFlight)return refreshInFlight;
 if(!session?.refresh_token)return false;
 refreshInFlight=(async()=>{
  try{
   const r=await fetch(api+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:headers(),body:JSON.stringify({refresh_token:session.refresh_token})});
   if(!r.ok){if(r.status===400||r.status===401){saveSession(null);authUser=null;updateAuthUI();await refreshMembership();await loadReports()}throw Error('Please sign in again to continue.');}
   const next=await r.json();saveSession(next);authUser=next.user;updateAuthUI();return true;
  }catch(e){clearTimeout(refreshTimer);if(session?.refresh_token)refreshTimer=setTimeout(()=>refreshSession().catch(()=>{}),30000);throw e}
 })().finally(()=>{refreshInFlight=null});return refreshInFlight;
}
async function initAuth(){
 const params=new URLSearchParams(location.hash.slice(1));
 if(params.has('error_description'))$('authMessage').textContent='This sign-in link has expired or was already used. Request a fresh link.';
 try{session=JSON.parse(localStorage.getItem('rut_iq_session')||'null')}catch(e){session=null}
 if(params.get('access_token')){saveSession({access_token:params.get('access_token'),refresh_token:params.get('refresh_token'),expires_at:Number(params.get('expires_at'))||Math.floor(Date.now()/1000)+Number(params.get('expires_in')||3600)})}
 else if(session)saveSession(session);
 else authToken=localStorage.getItem('rut_iq_access_token');
 if(params.has('access_token')||params.has('error'))history.replaceState(null,'',location.pathname+location.search);
 if(session?.refresh_token&&Number(session.expires_at)*1000<Date.now()+60000)await refreshSession().catch(()=>{});
 if(authToken){try{
  const r=await fetch(api+'/auth/v1/user',{headers:headers(authToken)});
  if(r.ok)authUser=await r.json();else if(r.status===401){saveSession(null);authUser=null}
 }catch(e){$('authMessage').textContent='Unable to verify your session. Check your connection and refresh.'}}
 updateAuthUI();await refreshMembership();
 if(params.has('error'))show('signup');
 if(authUser&&params.get('access_token')){$('authMessage').textContent='You’re signed in. Your hunter account is ready.';show('submit')}
}
$('signOutButton').addEventListener('click',async()=>{
 const token=authToken;saveSession(null);authUser=null;updateAuthUI();await refreshMembership();await loadReports();
 if(token)fetch(api+'/auth/v1/logout',{method:'POST',headers:headers(token)}).catch(()=>{});
 $('authMessage').textContent='Signed out.';show('signup');
});
$('signInButton').addEventListener('click',async()=>{
 const email=$('authEmail').value.trim(),msg=$('authMessage');msg.textContent='';
 if(!email||!$('authEmail').checkValidity()){msg.textContent='Enter a valid email address.';return}
 $('signInButton').disabled=true;
 try{
  const redirect='https://rut-iq-preview.onrender.com/';
  const resp=await fetch(api+'/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{method:'POST',headers:headers(),body:JSON.stringify({email,create_user:true})});
  if(!resp.ok){const error=await resp.json().catch(()=>({}));throw Error(resp.status===429?'Too many sign-in requests. Please wait a minute before trying again.':error.msg||error.message||'Unable to send a sign-in link right now.')}
  msg.textContent='Check your email for the secure Rut IQ sign-in link. Check your spam folder too.';
 }catch(e){msg.textContent=e.message}finally{$('signInButton').disabled=false}
});
window.addEventListener('hashchange',()=>{if(location.hash.includes('access_token=')||location.hash.includes('error='))initAuth().then(loadReports);else routeFromURL()});
window.addEventListener('storage',event=>{if(event.key==='rut_iq_session')location.reload()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&authUser){(async()=>{if(session?.refresh_token)await refreshSession();await refreshMembership();await loadReports();await loadDailyReport()})().catch(()=>{})}});
$('reportForm').addEventListener('submit',async e=>{
 e.preventDefault();const msg=$('message');msg.textContent='';
 if(!authUser||!authToken){msg.textContent='Please sign in using your email link before submitting.';show('signup');return}
 const behavior=$('behavior').value,date=$('date').value,notes=$('notes').value.trim();
 if(!(regions[selectedState]||[]).some(c=>c.name===region)){msg.textContent='Choose a state and county before submitting.';return}
 if(!behavior||!date)return;
 if(date>localDate()){msg.textContent='Choose today or an earlier date.';return}
 const button=$('reportForm').querySelector('button[type=submit]');button.disabled=true;button.textContent='Submitting...';
 try{
  if(session?.refresh_token&&Number(session.expires_at)*1000<Date.now()+60000)await refreshSession();
  const resp=await fetch(api+'/rest/v1/rut_reports',{method:'POST',headers:{...headers(authToken),'Prefer':'return=minimal'},body:JSON.stringify({user_id:authUser.id,state:selectedState,county:region,behavior,observed_on:date,notes})});
  if(!resp.ok){const err=await resp.json().catch(()=>({}));if(resp.status===409)throw Error('You already submitted this behavior for that day and county.');throw Error(err.message||'Could not save the report')}
  $('reportForm').reset();$('date').value=localDate();setSelectors();
  await Promise.all([loadReports(),loadDailyReport()]);
  reportDataFetchedAt=0;await fetchMapReportData().then(()=>{if(map)recolorMap()}).catch(()=>{});
  $('reportSuccess').textContent=authUser.app_metadata?.rut_iq_qa?'QA report saved privately. Excluded from public activity.':'Your observation is saved. Thank you for contributing to Rut IQ.';$('reportSuccess').hidden=false;show('reports');
 }catch(err){msg.textContent=err.message}finally{button.disabled=false;button.textContent='Submit Hunter Report'}
});
function switchMapBase(type){
 currentBaseMap=type;
 if(!map||typeof L==='undefined')return;
 if(baseMapLayer)map.removeLayer(baseMapLayer);
 const sources={
 satellite:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}','Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',19],
 topo:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}','Tiles &copy; Esri and contributors',19],
 street:['https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png','&copy; OpenStreetMap contributors',19]
 };
 const x=sources[type]||sources.satellite;
 baseMapLayer=L.tileLayer(x[0],{maxZoom:x[2],attribution:x[1]}).addTo(map);
 if(mapLayer)mapLayer.bringToFront();
 for(const n of ['satellite','topo','street']){const b=$(n+'Btn');if(b)b.style.borderColor=n===type?'#d3ad78':'#6c5035'}
}
let stateBounds=null,countyCache={},mapLayers={},mapLoading={},allMapCounts={},mapInitialized=false;let nameByFips={},stateByFips={};let mapColorMode='volume',mapDays=7,reportDataFetchedAt=0,mapDataRequest=0;
async function initMapData(){
 if(stateBounds)return;
 const r=await fetch('./state-bounds.json');if(!r.ok)throw Error('Map boundaries unavailable');
 stateBounds=await r.json();
 for(const [st,list] of Object.entries(regions)){for(const c of list){nameByFips[c.fips]=c.name;stateByFips[c.fips.slice(0,2)]=st}}
 const select=$('mapStateSelect');
 select.innerHTML='<option value="">Jump to a state...</option>'+Object.keys(regions).sort().map(st=>'<option>'+st+'</option>').join('');
 select.addEventListener('change',()=>{const st=select.value;const f=(regions[st]||[])[0]?.fips.slice(0,2);if(f&&stateBounds[f]){const b=stateBounds[f];map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[15,15]})}});
 await fetchMapReportData();

}
function mapReportCount(data){return Number(data?.['reports_'+mapDays+'d']||0)}
function mapSignal(data){
 const count=mapReportCount(data),hunters=Number(data?.['hunters_'+mapDays+'d']||0);
 if(!count)return {level:0,label:'No reports'};
 if(count<5||hunters<3)return {level:0,label:'Insufficient reports for a behavior signal'};
 const suffix='_'+mapDays+'d';
 const chasing=Number(data['chasing'+suffix]||0);
 const tending=Number(data['tending'+suffix]||0);
 const breeding=Number(data['breeding'+suffix]||0);
 const cruising=Number(data['cruising'+suffix]||0);
 const signs=Number(data['sign'+suffix]||0);
 const high=tending+breeding;
 if(high>=2&&high/count>=.2)return {level:3,label:'Tending / breeding reported'};
 if(chasing>=2&&chasing/count>=.2)return {level:2,label:'Chasing reported'};
 if(cruising+signs>=2)return {level:1,label:'Cruising / sign reported'};
 return {level:0,label:'No clear rut behavior signal'};
}
function mapColor(data){
 if(mapColorMode==='signal'){
  const s=mapSignal(data);
  return s.level===3?'#d93630':s.level===2?'#f28c28':s.level===1?'#f3d343':'#4b4a43';
 }
 const n=mapReportCount(data);
 return n>=8?'#d93630':n>=3?'#f28c28':n>=1?'#f3d343':'#4b4a43';
}
function updateMapLegend(){
 const signal=mapColorMode==='signal';
 $('mapModeCaption').textContent=(signal?'Reported behavior':'Report volume')+' · '+mapDays+' days';
 const items=signal?[['#4b4a43','Insufficient evidence'],['#f3d343','Cruising / sign'],['#f28c28','Chasing'],['#d93630','Tending / breeding']]:[['#4b4a43','No reports'],['#f3d343','1–2 reports'],['#f28c28','3–7 reports'],['#d93630','8+ reports']];
 $('mapLegend').innerHTML=items.map(([color,label])=>'<span class="key"><span class="swatch" style="background:'+color+'"></span>'+label+'</span>').join('');
 $('mapExplanation').textContent=signal?'Behavior colors summarize hunter reports, not predictions. At least 5 reports from 3 hunters are required; gray means insufficient evidence, not no rut.':'Colors show number of approved hunter reports in the selected time window, not confirmed rut intensity.';
}
async function fetchMapReportData(){
 const request=++mapDataRequest,access=proAccess,token=authToken;
 let resp;
 if(proAccess&&authToken){
  resp=await fetch(api+'/rest/v1/rpc/rut_pro_county_signals?order=state.asc,county.asc&limit=1000',{method:'POST',headers:headers(authToken),body:'{}'});
 }else{
  const u=new URL(api+'/rest/v1/rut_free_county_activity');
  u.searchParams.set('select','state,county,reports_7d');u.searchParams.set('limit','1000');u.searchParams.set('order','state.asc,county.asc');
  resp=await fetch(u,{headers:headers()});
 }
 if(!resp.ok)throw Error('Rut report data unavailable');
 let rows=await resp.json();
 for(let offset=rows.length;rows.length&&rows.length%1000===0&&offset<10000;offset+=1000){
  const url=new URL(proAccess&&authToken?api+'/rest/v1/rpc/rut_pro_county_signals':api+'/rest/v1/rut_free_county_activity');url.searchParams.set('order','state.asc,county.asc');url.searchParams.set('offset',String(offset));url.searchParams.set('limit','1000');
  const page=await fetch(url,{method:proAccess&&authToken?'POST':'GET',headers:headers(proAccess?authToken:undefined),...(proAccess&&authToken?{body:'{}'}:{})});if(!page.ok)throw Error('Rut report data unavailable');const data=await page.json();rows.push(...data);if(data.length<1000)break;
 }
 if(request!==mapDataRequest||access!==proAccess||token!==authToken)return;
 allMapCounts=Object.fromEntries(rows.map(r=>[r.state+'|'+r.county,r]));
 reportDataFetchedAt=Date.now();
}
function recolorMap(){
 updateMapLegend();if(activeMapCounty)renderCountySheet();
 for(const layer of Object.values(mapLayers)){layer.eachLayer(f=>{if(f.feature){f.setStyle(countyStyle(f.feature));if(f.isPopupOpen())f.closePopup()}})}
 $('mapStatus').textContent='Map covers all 50 states. '+(mapColorMode==='signal'?'Behavior colors require 5 reports from 3 hunters.':'Colors show real report totals.')+' Window: '+mapDays+' days.';
}
$('mapColorMode').addEventListener('change',e=>{if(e.target.value==='signal'&&!proAccess){e.target.value='volume';show('plans');return}mapColorMode=e.target.value;recolorMap()});
$('mapTimeWindow').addEventListener('change',e=>{if(e.target.value==='30'&&!proAccess){e.target.value='7';show('plans');return}mapDays=Number(e.target.value);recolorMap()});
function countyStyle(feature){
 const name=countyNameFromFips(feature.properties.STATE+feature.properties.COUNTY)||feature.properties.NAME;
 const st=stateNameFromCode(feature.properties.STATE);
 const data=allMapCounts[st+'|'+name];
 const n=mapReportCount(data),level=mapColorMode==='signal'?mapSignal(data).level:n;
 return {color:level?'#f4d2a5':'#c0b09c',weight:level?1.2:.6,fillColor:mapColor(data),fillOpacity:level?.64:.08};
}
function countyNameFromFips(fips){return nameByFips[fips]||null}
function stateNameFromCode(code){return stateByFips[code]||'Unknown'}
function resetNationMap(){if(!map)return;map.setView([39,-97],4);$('mapStateSelect').value='';if(searchMarker){map.removeLayer(searchMarker);searchMarker=null}setSearchStatus('Showing the United States. Search for a city, ZIP, or address to zoom in.')}
let searchMarker=null;
let mapSearchInProgress=false;
function setSearchStatus(message){$('mapAddressStatus').textContent=message}
function setSearchLoading(isLoading){
 mapSearchInProgress=isLoading;
 const button=$('mapAddressSearchButton');
 button.disabled=isLoading;
 button.textContent=isLoading?'Finding...':'Search';
}
async function geocodeUnitedStates(query){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const url=new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format','jsonv2');
  url.searchParams.set('countrycodes','us');
  url.searchParams.set('limit','1');
  url.searchParams.set('addressdetails','1');
  url.searchParams.set('q',query);
  const response=await fetch(url,{signal:controller.signal,headers:{'Accept':'application/json'}});
  if(!response.ok)throw Error('The address search service is unavailable. Try again.');
  const items=await response.json();
  if(!Array.isArray(items)||!items.length)throw Error('No U.S. location found. Include the city and state, or try a ZIP code.');
  const result=items[0],lat=Number(result.lat),lon=Number(result.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))throw Error('This location could not be mapped.');
  return {lat,lon,label:result.display_name||query,type:result.addresstype||result.type||'',bbox:result.boundingbox};
 }finally{clearTimeout(timeout)}
}
$('mapAddressForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(mapSearchInProgress)return;
 const query=$('mapAddressInput').value.trim();
 if(query.length<3){setSearchStatus('Enter at least three characters to search.');return}
 if(!map){setSearchStatus('Open the map first and try again.');return}
 setSearchLoading(true);setSearchStatus('Finding location...');
 try{
  const location=await geocodeUnitedStates(query);
  if(searchMarker){map.removeLayer(searchMarker);searchMarker=null}
  const isStreet=['house','building','amenity','residential','road','street'].includes(location.type);
  const isZip=['postcode','postal_code'].includes(location.type);
  const zoom=isStreet?14:isZip?11:10;
  map.setView([location.lat,location.lon],zoom,{animate:true});
  searchMarker=L.circleMarker([location.lat,location.lon],{radius:7,color:'#fff1d7',weight:2,fillColor:'#d3ad78',fillOpacity:.95}).addTo(map);
  searchMarker.bindTooltip('Your private search location',{direction:'top'});
  $('mapStateSelect').value='';
  setSearchStatus('Showing '+location.label+'. The marker is only visible to you in this session.');
 }catch(error){setSearchStatus(error.name==='AbortError'?'Address search timed out. Please try again.':error.message||'Search failed. Try again.')}
 finally{setSearchLoading(false)}
});

let activeMapCounty=null;
function openCountySheet(state,county){activeMapCounty={state,county};$('mapFilters').open=false;renderCountySheet();$('countySheet').hidden=false;$('heatmap').classList.add('has-county')}
function renderCountySheet(){
 if(!activeMapCounty)return;
 const {state,county}=activeMapCounty,data=allMapCounts[state+'|'+county],count=mapReportCount(data);
 $('sheetState').textContent=state;$('sheetCounty').textContent=county;
 if(!reportDataFetchedAt){$('sheetContent').innerHTML='<p class="sheet-note">County report counts are not available yet. Try again when the map has loaded.</p>';return}
 $('sheetContent').innerHTML='<div class="sheet-count"><strong>'+count+'</strong><span>reports · past '+mapDays+' days</span></div>'+(proAccess?'<p class="sheet-note">'+Number(data?.['hunters_'+mapDays+'d']||0)+' contributing hunters · '+safe(mapSignal(data).label)+'</p>':'')+'<p class="sheet-note">'+(count?'Hunter observations show what was reported here. They do not guarantee current rut activity.':'No reports in this window. Deer may still be active here.')+'</p>';
}
$('closeCountySheet').addEventListener('click',()=>{activeMapCounty=null;$('countySheet').hidden=true;$('heatmap').classList.remove('has-county')});
function useMapCounty(destination){if(!activeMapCounty)return;selectedState=activeMapCounty.state;region=activeMapCounty.county;saveRegion();setSelectors();$('regionPicker').open=false;loadReports();loadDailyReport();show(destination)}
$('sheetReports').addEventListener('click',()=>useMapCounty('reports'));
$('sheetHome').addEventListener('click',()=>useMapCounty('home'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('mapFilters').open=false;$('closeCountySheet').click()}});
function isVisibleState(box,viewport){return box[0]<=viewport.getEast()&&box[2]>=viewport.getWest()&&box[1]<=viewport.getNorth()&&box[3]>=viewport.getSouth()}
async function updateVisibleCounties(){
 if(!map||!stateBounds)return;
 const boundsNow=map.getBounds(),codes=Object.keys(stateBounds).filter(code=>isVisibleState(stateBounds[code],boundsNow));
 const allowed=new Set(codes);
 for(const [code,layer] of Object.entries(mapLayers)){if(!allowed.has(code)){map.removeLayer(layer);delete mapLayers[code]}}
 const fipsToName={};const stateByCode={};
 for(const [st,list] of Object.entries(regions))for(const c of list){fipsToName[c.fips]=c.name;stateByCode[c.fips.slice(0,2)]=st}
 const tasks=codes.map(async code=>{
  if(mapLayers[code]||mapLoading[code])return;
  mapLoading[code]=true;
  try{
   if(!countyCache[code]){const r=await fetch('./maps/'+code+'.json');if(!r.ok)throw Error('Map missing');countyCache[code]=await r.json()}
   if(!isVisibleState(stateBounds[code],map.getBounds()))return;
   const st=stateByCode[code]||'Unknown';
   const layer=L.geoJSON(countyCache[code],{
    style:countyStyle,
    onEachFeature:(f,featureLayer)=>{
     const name=fipsToName[f.properties.STATE+f.properties.COUNTY]||f.properties.NAME;
     const data=allMapCounts[st+'|'+name],n=mapReportCount(data),signal=mapSignal(data);
     const hunterCount=Number(data?.['hunters_'+mapDays+'d']||0);
     featureLayer.on('click',()=>openCountySheet(st,name));
    }
   }).addTo(map);
   mapLayers[code]=layer;
  }catch(e){console.warn('County boundaries unavailable for '+code,e)}
  finally{delete mapLoading[code]}
 });
 await Promise.all(tasks);
 recolorMap();
}
async function loadHeatmap(){
 if(typeof L==='undefined'){$('mapStatus').textContent='Map library unavailable. Reload with an internet connection.';return}
 if(!map){
  map=L.map('countyMap',{zoomControl:true,scrollWheelZoom:true,minZoom:3,maxZoom:19}).setView([39,-97],4);
  switchMapBase(currentBaseMap);
  map.on('moveend',()=>{updateVisibleCounties()});
 }
 setTimeout(()=>map.invalidateSize(),90);
 try{
  await initMapData();
  if(Date.now()-reportDataFetchedAt>120000)await fetchMapReportData();
  if(!mapInitialized){mapInitialized=true;map.setView([39,-97],4)}
  await updateVisibleCounties();
 }catch(e){$('mapStatus').textContent='Unable to load nationwide county reports. Try refreshing.'}
}
initAuth().then(()=>{routeFromURL();loadReports()});

document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.route)show(button.dataset.route);else if(button.dataset.base)switchMapBase(button.dataset.base);else if(button.dataset.action==='reset-map')resetNationMap();else if(button.dataset.action==='retry-daily')loadDailyReport()});

function updateAccountUI(){
 $('accountStatus').textContent=authUser?'Signed in as '+authUser.email:'Sign in to manage your Rut IQ account.';
 $('accountSignIn').hidden=!!authUser;$('accountControls').hidden=!authUser;
 $('deleteAccountPanel').hidden=true;$('deleteConfirmation').value='';$('confirmDeleteAccount').disabled=true;
}
$('openDeleteAccount').addEventListener('click',()=>{if(!authUser){show('signup');return}$('deleteAccountMessage').textContent='';$('deleteAccountPanel').hidden=false;$('deleteConfirmation').focus()});
$('cancelDeleteAccount').addEventListener('click',()=>{updateAccountUI();$('deleteAccountMessage').textContent='Your account has been kept.'});
$('deleteConfirmation').addEventListener('input',()=>{$('confirmDeleteAccount').disabled=$('deleteConfirmation').value!=='DELETE'});
$('deleteAccountForm').addEventListener('submit',async event=>{
 event.preventDefault();const message=$('deleteAccountMessage'),button=$('confirmDeleteAccount');
 if(!authUser||!authToken){message.textContent='Please sign in before deleting your account.';return}
 if($('deleteConfirmation').value!=='DELETE'||button.disabled)return;
 button.disabled=true;$('cancelDeleteAccount').disabled=true;$('deleteConfirmation').disabled=true;button.textContent='Deleting…';message.textContent='';
 try{
  if(session?.refresh_token&&Number(session.expires_at)*1000<Date.now()+60000)await refreshSession();
  const response=await fetch(api+'/rest/v1/rpc/rut_delete_my_account',{method:'POST',headers:headers(authToken),body:JSON.stringify({confirmation:'DELETE'})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.deleted!==true)throw Error(response.status===401||response.status===403?'Your sign-in has expired. Sign in again before deleting your account.':result.message||'We couldn’t confirm deletion. Please try again.');
  saveSession(null);authUser=null;clearTimeout(membershipTimer);proAccess=false;membership={plan:'free',source:'free',status:'active'};
  ++reportRequest;++dailyRequest;++mapDataRequest;reports=[];countyTotal=0;reportsReady=false;allMapCounts={};reportDataFetchedAt=0;
  $('reportForm').reset();$('date').value=localDate();$('authEmail').value='';$('reportSuccess').hidden=true;
  localStorage.removeItem('rut_iq_state');localStorage.removeItem('rut_iq_county');selectedState='';region='';setSelectors();$('regionPicker').open=true;
  if(searchMarker){map.removeLayer(searchMarker);searchMarker=null}
  $('mapAddressInput').value='';$('mapAddressStatus').textContent='Search a town or ZIP to find a hunting area.';
  mapColorMode='volume';mapDays=7;$('mapColorMode').value='volume';$('mapTimeWindow').value='7';
  if(map)recolorMap();updateAuthUI();updateMembershipUI();render();loadDailyReport();
  message.textContent='Your Rut IQ account and reports have been deleted. You’re signed out. Your Woods IQ and store accounts were not changed.';
  sessionStorage.setItem('rut_iq_deleted','1');location.reload();
 }catch(error){message.textContent=error.message+' If the connection dropped, refresh to check your account status.'}
 finally{button.textContent='Permanently delete';$('cancelDeleteAccount').disabled=false;$('deleteConfirmation').disabled=false;button.disabled=$('deleteConfirmation').value!=='DELETE'}
});

if(sessionStorage.getItem('rut_iq_deleted')){sessionStorage.removeItem('rut_iq_deleted');$('deleteAccountMessage').textContent='Your Rut IQ account and reports have been deleted. You’re signed out. Your Woods IQ and store accounts were not changed.';$('authMessage').textContent='Your Rut IQ account was deleted. Signing in again will create a new Free account.'}
