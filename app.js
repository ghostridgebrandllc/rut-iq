const $=id=>document.getElementById(id);
function localDate(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const startingHome=readLocalJSON('rut_iq_home_county',null);
let selectedState=startingHome?.state||localStorage.getItem('rut_iq_state')||'';
let region=startingHome?.county||localStorage.getItem('rut_iq_county')||'';
let testAccess=false,testMode=false,testEpoch=0,testAccessRequest=0;
let behaviorTotals=null;let reports=[];let regions={};let countyTotal=0;let reportsReady=false;let authUser=null;let authToken=null;let countyGeo=null;let map=null;let mapLayer=null;let mapActivity={};let baseMapLayer=null;let currentBaseMap='satellite';

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
const regionsReady=fetch('./regions.json').then(r=>{if(!r.ok)throw Error('Regions unavailable');return r.json()}).then(data=>{regions=data;if(!regions[selectedState])selectedState='';setSelectors();$('regionPicker').open=!hasRegion();render();loadReports();loadDailyReport();return data}).catch(e=>{ $('county').innerHTML='<option>Unable to load counties</option>'; $('reportCounty').innerHTML='<option>Unable to load counties</option>'; $('reportForm').querySelector('button[type=submit]').disabled=true; $('regionLabel').textContent='Refresh to load counties';return null; });
const routes=new Set(['welcome','home','heatmap','reports','submit','signup','plans','about','help','privacy','terms','account']);
function defaultRoute(){return authUser||localStorage.getItem('rut_iq_welcomed')==='1'?'home':'welcome'}
function enterAccount(mode){
 setAuthMode(mode==='create'?'create':'signin');
 localStorage.setItem('rut_iq_welcomed','1');
 $('signupTitle').textContent=mode==='create'?'Create your free account':'Welcome back';
 $('signupLead').textContent=mode==='create'?'Join the hunters building a clearer picture of the rut.':'Sign in with your email and password, or use a secure email link.';
 show('signup');$('authEmail').focus({preventScroll:true});
}
$('welcomeCreate').addEventListener('click',()=>enterAccount('create'));
$('welcomeSignIn').addEventListener('click',()=>enterAccount('signin'));
$('mapJoin').addEventListener('click',()=>enterAccount('create'));
$('welcomeExplore').addEventListener('click',()=>{localStorage.setItem('rut_iq_welcomed','1');show('heatmap')});
function show(id,record=true){
 if(!routes.has(id))id='home';
 if(id==='submit'&&!authUser)id='signup';
 if(id==='account')updateAccountUI();
 if(record&&location.hash!=='#'+id)history.pushState(null,'','#'+id);
 document.querySelectorAll('.view').forEach(x=>x.classList.toggle('show',x.id===id));
 document.querySelectorAll('.dock button').forEach(x=>{const active=x.dataset.tab===id;x.classList.toggle('active',active);if(active)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
 document.body.classList.toggle('map-view',id==='heatmap');
 document.body.classList.toggle('welcome-view',id==='welcome');
 if(id!=='heatmap'){$('mapAddressInput').blur();document.body.classList.remove('map-searching','map-keyboard')}
 syncMapViewport();
 document.title=({home:'Daily Report',heatmap:'Rut Map',signup:'Hunter Sign-in',privacy:'Privacy',terms:'Terms of Use',help:'Help'}[id]||'Rut IQ')+' | Rut IQ by Ghost Ridge';
 if(id==='home')loadDailyReport();if(id==='plans')updateMembershipUI();if(id==='heatmap')setTimeout(()=>loadHeatmap(),50);
 render();window.scrollTo(0,0);
}
function routeFromURL(){
 const id=location.hash.slice(1);
 if(id.includes('='))return;
 const destination=authUser&&['signup','welcome'].includes(id)?'home':routes.has(id)?id:defaultRoute();
 if(destination!==id&&authUser)history.replaceState(null,'','#'+destination);
 show(destination,false);
}
window.addEventListener('popstate',routeFromURL);
document.addEventListener('click',e=>{const link=e.target.closest('a[href^="#"]');if(link&&routes.has(link.hash.slice(1))){e.preventDefault();show(link.hash.slice(1))}});
function safe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){
 renderSavedCounties();$('comparisonCard').hidden=!proAccess;
 $('behaviorSummary').hidden=!proAccess;
 if(!hasRegion()){$('total').textContent='—';$('regionLabel').textContent='Choose your county on Home to see local reports.';$('activityEmpty').textContent='Choose a county to see recent observations.';$('activityChart').style.display='none';$('activityEmpty').style.display='block';$('feed').innerHTML='<a href="#home">Choose your hunting region →</a>';return}
 const list=reports.filter(r=>r.county===region&&r.state===selectedState).sort((a,b)=>b.saved-a.saved);
 $('total').textContent=reportsReady?countyTotal:'—';

 $('regionLabel').textContent=region+', '+selectedState+' · Past 7 days';
 $('activityEmpty').style.display=list.length&&proAccess?'none':'block';
 $('activityChart').style.display=list.length&&proAccess?'block':'none';
 $('activityEmpty').textContent=!reportsReady?'Loading county reports...':!countyTotal?'No hunter reports in this county in the past 7 days. Be the first to contribute.':proAccess?'Recent county observations are shown below.':'This county has '+countyTotal+' reports in the past 7 days. See today’s observations in your Daily Rut Report. Pro adds detailed behavior analysis.';
 const cats=['Cruising','Chasing','Tending a doe','Breeding observed','Scrape / rub activity','No rut activity observed'];
 const fields=['cruising','chasing','tending','breeding','sign','no_activity'];
 const counts=fields.map(field=>Number(behaviorTotals?.[field+'_7d']||0)),max=Math.max(1,...counts);
 $('bars').innerHTML=counts.map((n,i)=>'<div title="'+safe(cats[i])+': '+n+' reports" style="height:'+Math.max(4,n/max*100)+'%"></div>').join('');
 $('feed').className=list.length?'':'empty';
 $('feed').innerHTML=proAccess&&list.length?(countyTotal>list.length?'<p class="muted">Showing the latest '+list.length+' of '+countyTotal+' reports. Behavior totals below include every report in this window.</p>':'')+list.map(r=>'<div class="feeditem"><div class="row"><b>'+safe(r.behavior)+'</b><span class="muted">'+safe(r.date)+'</span></div><p class="muted">Hunter observation</p><span class="tag">'+safe(r.county)+'</span></div>').join(''):!countyTotal?'No hunter reports yet for this county.':countyTotal+' county reports in the past 7 days.<p>Daily Rut Report is included free. Pro unlocks detailed behavior analysis.</p><button class="ghost" data-route="plans">Explore Pro</button>';
}
const api='https://ddxzyzjsqrnputiibdbi.supabase.co';
const pubKey='sb_publishable_IKgJ-FLqeJDXM0VEoARYqQ_f-9EpGl1';
function headers(access){return {'apikey':pubKey,'Content-Type':'application/json',...(access?{'Authorization':'Bearer '+access}:{})}}
function dayRequest(access,day=localDate()){return {method:'POST',headers:headers(access),body:JSON.stringify({as_of:day})}}
let refreshTimer=null;
let dailyRequest=0;
async function loadDailyReport(){
 if($('home').classList.contains('show'))loadHomeChanges();
 const request=++dailyRequest,st=selectedState,county=region;
 const title=$('dailyTitle'),box=$('dailyContent');
 if(!hasRegion()){title.textContent='Your Daily Rut Report';box.innerHTML='<p class="daily-note">Choose your state and county above to see real hunter observations, or explore the nationwide map.</p>';return}
 title.textContent=county+', '+st;
 box.innerHTML='<p class="muted">Checking recent hunter reports...</p>';
 try{
  const url=new URL(api+'/rest/v1/rpc/rut_daily_counties_for_day');
  url.searchParams.set('select','reports_24h,hunters_24h,cruising_24h,chasing_24h,tending_24h,breeding_24h,signs_24h,no_activity_24h,latest_submission_at');
  url.searchParams.set('state','eq.'+st);url.searchParams.set('county','eq.'+county);url.searchParams.set('limit','1');
  const response=await rutFetch(url,dayRequest());
  if(!response.ok)throw Error('Recent activity is unavailable');
  const data=await response.json();
  if(request!==dailyRequest||st!==selectedState||county!==region)return;
  const r=data[0],total=Number(r?.reports_24h||0),hunters=Number(r?.hunters_24h||0);
  if(!total){
   box.innerHTML='<div class="daily-stats"><div class="daily-stat"><strong>0</strong><span>Reports · 24 hours</span></div><div class="daily-stat"><strong>0</strong><span>Hunters reporting</span></div></div><p class="daily-empty">No fresh reports yet.</p><p class="daily-note">Be the first to share what you saw. An empty report does not mean deer are inactive.</p><p class="daily-meta">Includes reports sent in the last 24 hours for observations from today or yesterday. Dates follow your device’s local calendar.</p>';
   return;
  }
  const items=[['Cruising',r.cruising_24h],['Chasing',r.chasing_24h],['Tending',r.tending_24h],['Breeding',r.breeding_24h],['Scrapes / rubs',r.signs_24h],['No rut behavior seen',r.no_activity_24h]];
  const badges=items.filter(x=>Number(x[1])>0).map(([label,n])=>'<div class="behavior-row"><span>'+safe(label)+'</span><strong>'+Number(n)+'</strong></div>').join('');
  const updated=r.latest_submission_at?new Date(r.latest_submission_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
  const confidence=total>=5&&hunters>=3?'Multiple hunters contributed. These are observations, not predictions.':'Early reports only — not enough independent observations to establish a reliable regional trend.';
  box.innerHTML='<div class="daily-stats"><div class="daily-stat"><strong>'+total+'</strong><span>Reports · 24 hours</span></div><div class="daily-stat"><strong>'+hunters+'</strong><span>Hunters reporting</span></div></div><div class="daily-behavior-list">'+badges+'</div><p class="daily-note">'+safe(confidence)+'</p><p class="daily-meta">Last report: '+safe(updated)+' · Reports submitted in the last 24 hours, describing observations from today or yesterday. Dates follow your device’s local calendar.</p>';
 }catch(error){
  if(request===dailyRequest)box.innerHTML='<p class="daily-note">Daily reports are temporarily unavailable. Please try again later.</p><button class="ghost" type="button" data-action="retry-daily">Retry</button>';
 }
}

let reportRequest=0;
async function loadReports(){
 loadComparison();
 const request=++reportRequest,key=region,st=selectedState,access=proAccess,token=authToken,day=localDate();
 reportsReady=false;reports=[];behaviorTotals=null;countyTotal=0;render();if(!hasRegion())return;
 try{
  const u=new URL(api+'/rest/v1/rpc/rut_free_counties_for_day');
  u.searchParams.set('select','reports_7d');u.searchParams.set('state','eq.'+st);u.searchParams.set('county','eq.'+key);
  const resp=await rutFetch(u,dayRequest(undefined,day));if(!resp.ok)throw Error('Could not load live reports');
  const counts=await resp.json();let data=[],totals=null;
  if(access&&token){
   const detail=new URL(api+'/rest/v1/rpc/rut_reports_for_day');detail.searchParams.set('select','state,county,behavior,observed_on,created_at');detail.searchParams.set('state','eq.'+st);detail.searchParams.set('county','eq.'+key);detail.searchParams.set('order','created_at.desc,id.asc');detail.searchParams.set('limit','200');
   const summary=new URL(api+'/rest/v1/rpc/rut_pro_signals_for_day');summary.searchParams.set('state','eq.'+st);summary.searchParams.set('county','eq.'+key);
   const [r,a]=await Promise.all([rutFetch(detail,dayRequest(token,day)),rutFetch(summary,dayRequest(token,day))]);
   if(!r.ok||!a.ok)throw Error('Could not load behavior details');
   data=await r.json();totals=(await a.json())[0]||{};
  }
  if(request!==reportRequest||region!==key||selectedState!==st||access!==proAccess||token!==authToken)return;
  countyTotal=Number(counts[0]?.reports_7d||0);reportsReady=true;behaviorTotals=totals;
  reports=(access?data:[]).map(r=>({county:r.county,state:r.state,behavior:r.behavior,date:r.observed_on,saved:Date.parse(r.created_at)}));render();
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
 await refreshTestAccess();
 clearTimeout(membershipTimer);
 proAccess=false;reports=[];behaviorTotals=null;++reportRequest;membership={plan:'free',source:'free',status:'active'};
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
 updateMembershipUI();loadComparison();if($('home').classList.contains('show'))loadDailyReport();
 if(proAccess&&membership.current_period_end){membershipTimer=setTimeout(()=>refreshMembership().then(loadReports),Math.min(2147483647,Math.max(500,Date.parse(membership.current_period_end)-Date.now()+50)))}
 if($('mapColorMode')){if(!proAccess){mapColorMode='volume';mapDays=7;$('mapColorMode').value='volume';$('mapTimeWindow').value='7'}}
 ++mapDataRequest;allMapCounts={};reportDataFetchedAt=0;if(map){recolorMap();await fetchMapReportData().then(recolorMap).catch(()=>{})}
}
let session=null,refreshInFlight=null,authRetryUntil=0,authRetryTimer=null,rememberSession=true,authMode='signin',authBusy=false,authGeneration=0;
function pauseEmailResend(seconds){
 authRetryUntil=Date.now()+seconds*1000;clearInterval(authRetryTimer);updateSignInButton();
 authRetryTimer=setInterval(()=>{if(Date.now()>=authRetryUntil){clearInterval(authRetryTimer);authRetryTimer=null}updateSignInButton()},1000);
}
function saveSession(value){
 session=value;authToken=value?.access_token||null;
 if(value){
  if(!value.expires_at&&value.expires_in)value.expires_at=Math.floor(Date.now()/1000)+Number(value.expires_in);
  const target=rememberSession?localStorage:sessionStorage,other=rememberSession?sessionStorage:localStorage;
  other.removeItem('rut_iq_session');target.setItem('rut_iq_session',JSON.stringify(value));
 }else{++authGeneration;localStorage.removeItem('rut_iq_session');sessionStorage.removeItem('rut_iq_session')}

 localStorage.removeItem('rut_iq_access_token');
 clearTimeout(refreshTimer);
 if(value?.refresh_token){refreshTimer=setTimeout(()=>refreshSession().catch(()=>{}),Math.max(1000,(Number(value.expires_at)*1000-Date.now())-60000))}
}
function updateSignInButton(){
 const wait=Math.max(0,Math.ceil((authRetryUntil-Date.now())/1000));
 $('signInButton').textContent=authUser?'Signed in':wait?'Resend available in '+wait+'s':'Email me a sign-in link instead';$('signInButton').disabled=!!authUser||wait>0||authBusy;
 $('forgotPassword').disabled=!!authUser||wait>0||authBusy;
 $('passwordSignIn').disabled=!!authUser||authBusy||(authMode==='create'&&wait>0);
 $('authCreateTab').disabled=authBusy;$('authSignInTab').disabled=authBusy;
}
function updateAuthUI(){
 if(!authUser){++testAccessRequest;setTestState(false,false);$('authPassword').value='';$('newPassword').value='';$('confirmPassword').value=''}
 $('mapGuestActions').hidden=!!authUser;$('heatmap').classList.toggle('guest-map',!authUser);
 updateAccountUI();
 $('signedOutAuth').hidden=!!authUser;$('signedInManage').hidden=!authUser;
 $('authStatus').textContent=authUser?'Signed in as '+authUser.email:'Sign in securely to contribute reports';
 updateSignInButton();
 $('signOutButton').hidden=!authUser;$('authEmail').hidden=!!authUser;
}
async function refreshSession(){
 if(refreshInFlight)return refreshInFlight;
 if(!session?.refresh_token)return false;
 const generation=authGeneration;
 refreshInFlight=(async()=>{
  try{
   const r=await fetch(api+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:headers(),body:JSON.stringify({refresh_token:session.refresh_token})});
   if(generation!==authGeneration)return false;
   if(!r.ok){if(r.status===400||r.status===401){saveSession(null);authUser=null;updateAuthUI();await refreshMembership();await loadReports()}throw Error('Please sign in again to continue.');}
   const next=await r.json();if(generation!==authGeneration)return false;saveSession(next);authUser=next.user;updateAuthUI();return true;
  }catch(e){clearTimeout(refreshTimer);if(session?.refresh_token)refreshTimer=setTimeout(()=>refreshSession().catch(()=>{}),30000);throw e}
 })().finally(()=>{refreshInFlight=null});return refreshInFlight;
}
async function initAuth(){
 const params=new URLSearchParams(location.hash.slice(1));
 if(params.has('error_description'))$('authMessage').textContent='This sign-in link has expired or was already used. Request a fresh link.';
 try{
  const tabSession=sessionStorage.getItem('rut_iq_session'),savedSession=localStorage.getItem('rut_iq_session');
  session=JSON.parse(tabSession||savedSession||'null');rememberSession=tabSession?false:savedSession?true:localStorage.getItem('rut_iq_remember')!=='0';
 }catch(e){session=null}
 $('rememberMe').checked=rememberSession;
 if(params.get('access_token')){saveSession({access_token:params.get('access_token'),refresh_token:params.get('refresh_token'),expires_at:Number(params.get('expires_at'))||Math.floor(Date.now()/1000)+Number(params.get('expires_in')||3600)})}
 else if(session)saveSession(session);
 else authToken=localStorage.getItem('rut_iq_access_token');
 if(params.has('access_token')||params.has('error'))history.replaceState(null,'',location.pathname+location.search);
 const generation=authGeneration;
 if(session?.refresh_token&&Number(session.expires_at)*1000<Date.now()+60000)await refreshSession().catch(()=>{});
 if(generation!==authGeneration)return;
 if(authToken){try{
  const r=await fetch(api+'/auth/v1/user',{headers:headers(authToken)});
  if(generation!==authGeneration)return;
  if(r.ok){const user=await r.json();if(generation!==authGeneration)return;authUser=user}else if(r.status===401){saveSession(null);authUser=null}
 }catch(e){$('authMessage').textContent='Unable to verify your session. Check your connection and refresh.'}}
 updateAuthUI();await refreshMembership();
 if(generation!==authGeneration)return;
 if(params.has('error'))show('signup');
 if(authUser){localStorage.setItem('rut_iq_welcomed','1');if(params.get('access_token')){$('authMessage').textContent='You’re signed in. Your hunter account is ready.';show(params.get('type')==='recovery'?'account':'home');if(params.get('type')==='recovery'){$('passwordMessage').textContent='Choose your new password below.';$('newPassword').focus()}}}
}
$('signOutButton').addEventListener('click',async()=>{
 const token=authToken;saveSession(null);localStorage.setItem('rut_iq_signout',String(Date.now()));authUser=null;updateAuthUI();
 if(token)fetch(api+'/auth/v1/logout',{method:'POST',headers:headers(token)}).catch(()=>{});
 await refreshMembership();await loadReports();
 $('authMessage').textContent='Signed out.';show('signup');
});
$('signInButton').addEventListener('click',async()=>{
 if(authUser||authBusy||Date.now()<authRetryUntil)return;
 const email=$('authEmail').value.trim(),msg=$('authMessage');msg.textContent='';
 if(!email||!$('authEmail').checkValidity()){msg.textContent='Enter a valid email address.';return}
 rememberSession=$('rememberMe').checked;localStorage.setItem('rut_iq_remember',rememberSession?'1':'0');
 authBusy=true;updateSignInButton();
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const redirect='https://rut-iq-preview.onrender.com/';
  const resp=await fetch(api+'/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{method:'POST',headers:headers(),body:JSON.stringify({email,create_user:true}),signal:controller.signal});
  if(!resp.ok){
   const error=await resp.json().catch(()=>({}));
   if(resp.status===429){
    pauseEmailResend(60);
    throw Error(error.error_code==='over_email_send_rate_limit'?'Sign-in email delivery has reached its service limit. Please try again later.':'Too many sign-in requests. Please wait before requesting another link.');
   }
   throw Error('We couldn’t send your sign-in email. Please try again later.');
  }
  pauseEmailResend(60);
  msg.textContent='Check your email for the secure Rut IQ sign-in link. Check your spam folder too.';
 }catch(e){msg.textContent=e.name==='AbortError'?'The email request timed out. Check your inbox before requesting another link.':e instanceof TypeError?'Unable to connect. Check your connection and try again.':e.message}finally{clearTimeout(timeout);authBusy=false;updateAuthUI()}
});
window.addEventListener('hashchange',()=>{if(location.hash.includes('access_token=')||location.hash.includes('error='))initAuth().then(loadReports);else routeFromURL()});
window.addEventListener('storage',event=>{
 if(event.key==='rut_iq_signout'){saveSession(null);authUser=null;updateAuthUI();refreshMembership().then(loadReports);return}
 if(event.key==='rut_iq_session'&&!sessionStorage.getItem('rut_iq_session')){
  if(event.oldValue&&!event.newValue){saveSession(null);authUser=null;updateAuthUI();refreshMembership().then(loadReports)}else location.reload();
 }
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&authUser){(async()=>{if(session?.refresh_token)await refreshSession();await refreshMembership();await loadReports();await loadDailyReport()})().catch(()=>{})}});
$('reportForm').addEventListener('submit',async e=>{
 e.preventDefault();const msg=$('message');msg.textContent='';
 if(!authUser||!authToken){msg.textContent='Please sign in before submitting.';show('signup');return}
 const behavior=$('behavior').value,date=$('date').value,notes=$('notes').value.trim(),submittedState=selectedState,submittedCounty=region;
 if(!(regions[selectedState]||[]).some(c=>c.name===region)){msg.textContent='Choose a state and county before submitting.';return}
 if(!behavior||!date)return;
 if(date>localDate()){msg.textContent='Choose today or an earlier date.';return}
 const button=$('reportForm').querySelector('button[type=submit]');button.disabled=true;button.textContent='Submitting...';
 try{
  if(session?.refresh_token&&Number(session.expires_at)*1000<Date.now()+60000)await refreshSession();
  const resp=await fetch(api+'/rest/v1/rut_reports',{method:'POST',headers:{...headers(authToken),'Prefer':'return=minimal'},body:JSON.stringify({user_id:authUser.id,state:submittedState,county:submittedCounty,behavior,observed_on:date,notes})});
  if(!resp.ok){const err=await resp.json().catch(()=>({}));if(resp.status===409)throw Error('You already submitted this behavior for that day and county.');throw Error(err.message||'Could not save the report')}
  $('reportForm').reset();$('date').value=localDate();setSelectors();
  await Promise.all([loadReports(),loadDailyReport()]);
  reportDataFetchedAt=0;await fetchMapReportData().then(()=>{if(map)recolorMap()}).catch(()=>{});
  showReportReceipt(submittedState,submittedCounty,behavior,date,!!authUser.app_metadata?.rut_iq_qa);
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
 for(const n of ['satellite','topo','street']){const b=$(n+'Btn');if(b){b.style.borderColor=n===type?'#d3ad78':'#6c5035';b.setAttribute('aria-pressed',String(n===type))}}
}
let mapInitInFlight=null,reportDataDay='';let stateBounds=null,countyCache={},mapLayers={},mapLoading={},allMapCounts={},mapInitialized=false;let nameByFips={},stateByFips={};let mapColorMode='volume',mapDays=7,reportDataFetchedAt=0,mapDataRequest=0;
async function initMapData(){
 if(stateBounds)return;
 if(mapInitInFlight)return mapInitInFlight;
 mapInitInFlight=(async()=>{
  const geography=await regionsReady;
  if(!geography)throw Error('County names unavailable. Refresh to try again.');
  const r=await fetch('./state-bounds.json');if(!r.ok)throw Error('Map boundaries unavailable');
  const bounds=await r.json();
  const names={},states={};
  for(const [st,list] of Object.entries(geography))for(const c of list){names[c.fips]=c.name;states[c.fips.slice(0,2)]=st}
  nameByFips=names;stateByFips=states;stateBounds=bounds;
  const select=$('mapStateSelect');
  select.innerHTML='<option value="">Jump to a state...</option>'+Object.keys(geography).sort().map(st=>'<option>'+safe(st)+'</option>').join('');
  select.addEventListener('change',()=>{
   const st=select.value,f=(regions[st]||[])[0]?.fips.slice(0,2);
   if(f&&stateBounds[f]){closeCountySheet(false);clearSearchLocation();$('mapFilters').open=false;const b=stateBounds[f];map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[15,15]})}
  });
 })().finally(()=>{mapInitInFlight=null});
 return mapInitInFlight;
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
 const request=++mapDataRequest,access=proAccess,token=authToken,day=localDate(),rows=[];
 const endpoint=access&&token?'rut_pro_signals_for_day':'rut_free_counties_for_day';
 for(let offset=0;offset<10000;offset+=1000){
  const url=new URL(api+'/rest/v1/rpc/'+endpoint);
  url.searchParams.set('order','state.asc,county.asc');url.searchParams.set('offset',String(offset));url.searchParams.set('limit','1000');
  if(!access)url.searchParams.set('select','state,county,reports_7d');
  const response=await rutFetch(url,dayRequest(access?token:undefined,day));
  if(!response.ok)throw Error('Rut report data unavailable');
  const data=await response.json();rows.push(...data);if(data.length<1000)break;
 }
 if(request!==mapDataRequest||access!==proAccess||token!==authToken)return;
 allMapCounts=Object.fromEntries(rows.map(r=>[r.state+'|'+r.county,r]));
 reportDataFetchedAt=Date.now();reportDataDay=day;
}
function recolorMap(){
 updateMapLegend();if(activeMapCounty)renderCountySheet();
 for(const layer of Object.values(mapLayers)){layer.eachLayer(f=>{if(f.feature){f.setStyle(countyStyle(f.feature));if(f.isPopupOpen())f.closePopup()}})}
 $('mapStatus').textContent='Map covers all 50 states. '+(mapColorMode==='signal'?'Behavior colors require 5 reports from 3 hunters.':'Colors show real report totals.')+' Window: '+mapDays+' days. Dates follow your device’s local calendar.';
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
function resetNationMap(){if(!map)return;closeCountySheet(false);clearSearchLocation();$('mapFilters').open=false;map.setView([39,-97],4);$('mapStateSelect').value='';setSearchStatus('Showing the United States. Search for a city, ZIP, or address to zoom in.')}
let searchMarker=null;
let mapSearchInProgress=false,mapSearchRequest=0;
const searchPrivacy='Search goes to a map service. Your search marker is not shared with hunters.';
function clearSearchLocation(){++mapSearchRequest;setSearchLoading(false);if(searchMarker&&map)map.removeLayer(searchMarker);searchMarker=null;$('mapAddressInput').value='';setSearchStatus(searchPrivacy)}
let viewportFrame=0;
function syncMapViewport(){
 cancelAnimationFrame(viewportFrame);
 viewportFrame=requestAnimationFrame(()=>{
  const viewport=window.visualViewport,height=viewport?.height||window.innerHeight;
  const keyboard=document.body.classList.contains('map-view')&&document.activeElement===$('mapAddressInput')&&window.innerHeight-height>120;
  document.body.classList.toggle('map-keyboard',keyboard);
  const root=document.documentElement.style;
  root.setProperty('--map-viewport-height',height+'px');root.setProperty('--map-viewport-top',(viewport?.offsetTop||0)+'px');
  const toolbar=document.querySelector('.map-toolbar'),bottom=toolbar.offsetTop+toolbar.offsetHeight;
  root.setProperty('--map-toolbar-bottom',bottom+'px');
  if(map&&document.body.classList.contains('map-view'))map.invalidateSize({animate:false});
 });
}
window.addEventListener('resize',syncMapViewport);
window.visualViewport?.addEventListener('resize',syncMapViewport);
window.visualViewport?.addEventListener('scroll',syncMapViewport);
if(window.ResizeObserver)new ResizeObserver(syncMapViewport).observe(document.querySelector('.map-toolbar'));
$('mapAddressInput').addEventListener('focus',()=>{$('mapFilters').open=false;closeCountySheet(false);document.body.classList.add('map-searching');syncMapViewport()});
$('mapAddressInput').addEventListener('blur',()=>{document.body.classList.remove('map-searching');syncMapViewport()});
$('mapAddressInput').addEventListener('search',()=>{if(!$('mapAddressInput').value)clearSearchLocation()});
$('clearMapSearch').addEventListener('click',()=>{clearSearchLocation();$('mapAddressInput').focus()});
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
 $('mapAddressInput').blur();closeCountySheet(false);$('mapFilters').open=false;
 const request=++mapSearchRequest;setSearchLoading(true);setSearchStatus('Finding location...');
 try{
  const location=await geocodeUnitedStates(query);
  if(request!==mapSearchRequest)return;
  if(searchMarker){map.removeLayer(searchMarker);searchMarker=null}
  const isStreet=['house','building','amenity','residential','road','street'].includes(location.type);
  const isZip=['postcode','postal_code'].includes(location.type);
  const zoom=isStreet?14:isZip?11:10;
  map.setView([location.lat,location.lon],zoom,{animate:true});
  searchMarker=L.circleMarker([location.lat,location.lon],{radius:7,color:'#fff1d7',weight:2,fillColor:'#d3ad78',fillOpacity:.95}).addTo(map);
  searchMarker.bindTooltip('Your private search location',{direction:'top'});
  $('mapStateSelect').value='';
  setSearchStatus('Showing '+location.label+'. The marker is only visible to you in this session.');
 }catch(error){if(request===mapSearchRequest)setSearchStatus(error.name==='AbortError'?'Address search timed out. Please try again.':error.message||'Search failed. Try again.')}
 finally{if(request===mapSearchRequest)setSearchLoading(false)}
});

let activeMapCounty=null,countyFocusReturn=null;
function openCountySheet(state,county){countyFocusReturn=document.activeElement;$('mapAddressInput').blur();activeMapCounty={state,county};$('mapFilters').open=false;renderCountySheet();$('countySheet').hidden=false;$('heatmap').classList.add('has-county');$('sheetContent').scrollTop=0;$('closeCountySheet').focus({preventScroll:true})}
function renderCountySheet(){
 if(!activeMapCounty)return;
 const {state,county}=activeMapCounty,data=allMapCounts[state+'|'+county],count=mapReportCount(data);
 $('sheetState').textContent=state;$('sheetCounty').textContent=county;
 if(!reportDataFetchedAt){$('sheetContent').innerHTML='<p class="sheet-note">County report counts are not available yet. Try again when the map has loaded.</p>';return}
 $('sheetContent').innerHTML='<div class="sheet-count"><strong>'+count+'</strong><span>reports · past '+mapDays+' days</span></div>'+(proAccess?'<p class="sheet-note">'+Number(data?.['hunters_'+mapDays+'d']||0)+' contributing hunters · '+safe(mapSignal(data).label)+'</p>':'')+'<p class="sheet-note">'+(count?'Hunter observations show what was reported here. They do not guarantee current rut activity.':'No reports in this window. Deer may still be active here.')+'</p>';
}
function closeCountySheet(restoreFocus=true){const wasOpen=!$('countySheet').hidden;activeMapCounty=null;$('countySheet').hidden=true;$('heatmap').classList.remove('has-county');if(wasOpen&&restoreFocus)(countyFocusReturn?.isConnected?countyFocusReturn:$('countyMap')).focus({preventScroll:true})}
$('closeCountySheet').addEventListener('click',()=>closeCountySheet());
$('mapFilters').addEventListener('toggle',()=>{$('heatmap').classList.toggle('filters-open',$('mapFilters').open);if($('mapFilters').open)closeCountySheet(false)});
$('closeMapFilters').addEventListener('click',()=>{$('mapFilters').open=false;$('mapFilters').querySelector('summary').focus({preventScroll:true})});
function useMapCounty(destination){if(!activeMapCounty)return;selectedState=activeMapCounty.state;region=activeMapCounty.county;saveRegion();setSelectors();$('regionPicker').open=false;loadReports();loadDailyReport();show(destination)}
$('sheetReports').addEventListener('click',()=>useMapCounty('reports'));
$('sheetHome').addEventListener('click',()=>useMapCounty('home'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('mapFilters').open=false;$('closeCountySheet').click()}});
function isVisibleState(box,viewport){return box[0]<=viewport.getEast()&&box[2]>=viewport.getWest()&&box[1]<=viewport.getNorth()&&box[3]>=viewport.getSouth()}
async function updateVisibleCounties(){
 if(!map||!stateBounds||!document.body.classList.contains('map-view'))return;
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
 if(!document.body.classList.contains('map-view'))return;
 if(typeof L==='undefined'){$('mapStatus').textContent='Map library unavailable. Reload with an internet connection.';return}
 if(!map){
  map=L.map('countyMap',{zoomControl:true,scrollWheelZoom:true,trackResize:false,minZoom:3,maxZoom:19}).setView([39,-97],4);
  switchMapBase(currentBaseMap);
  map.on('moveend',()=>{updateVisibleCounties()});
 }
 setTimeout(()=>{if(document.body.classList.contains('map-view'))map.invalidateSize({animate:false})},90);
 try{
  await initMapData();
  if(reportDataDay!==localDate()||Date.now()-reportDataFetchedAt>120000)await fetchMapReportData();
  if(!mapInitialized){mapInitialized=true;map.setView([39,-97],4)}
  await updateVisibleCounties();
 }catch(e){$('mapStatus').textContent='Unable to load nationwide county reports. Try refreshing.'}
}


document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.route)show(button.dataset.route);else if(button.dataset.base)switchMapBase(button.dataset.base);else if(button.dataset.action==='reset-map')resetNationMap();else if(button.dataset.action==='retry-daily')loadDailyReport()});

function updateAccountUI(){
 $('accountStatus').textContent=authUser?'Signed in as '+authUser.email:'Sign in to manage your Rut IQ account.';
 $('accountSignIn').hidden=!!authUser;$('accountControls').hidden=!authUser;
 $('accountRemember').checked=rememberSession;
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
  ++reportRequest;++dailyRequest;++mapDataRequest;reports=[];behaviorTotals=null;countyTotal=0;reportsReady=false;allMapCounts={};reportDataFetchedAt=0;
  $('reportForm').reset();$('date').value=localDate();$('authEmail').value='';$('reportSuccess').hidden=true;
  for(const key of ['rut_iq_saved_counties','rut_iq_home_county','rut_iq_visits'])localStorage.removeItem(key);savedCounties=[];preferredCounty=null;visitStarts.clear();++changeRequest;++comparisonRequest;
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

/* Personal counties remain on this device; public summaries contain no hunter identities. */
function readLocalJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function writeLocalJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
let savedCounties=readLocalJSON('rut_iq_saved_counties',[]);
if(!Array.isArray(savedCounties))savedCounties=[];
let preferredCounty=readLocalJSON('rut_iq_home_county',null),changeRequest=0,comparisonRequest=0;
const visitStarts=new Map();
let neighborPromise=null,installPrompt=null,savedRenderSignature='';
function countyKey(st,co){return st+'|'+co}
function validCounty(c){return c&&typeof c.state==='string'&&typeof c.county==='string'&&(regions[c.state]||[]).some(x=>x.name===c.county)}
function renderSavedCounties(){
 const valid=savedCounties.filter(validCounty).slice(0,10);
 $('saveCounty').disabled=!hasRegion();
 $('saveCounty').textContent=valid.some(c=>c.state===selectedState&&c.county===region)?'County saved':'Save this county';
 const signature=JSON.stringify([valid,preferredCounty,selectedState,region]);
 if(signature===savedRenderSignature)return;savedRenderSignature=signature;
 $('savedCountyList').innerHTML=valid.length?valid.map((c,i)=>{
  const home=preferredCounty?.state===c.state&&preferredCounty?.county===c.county,active=c.state===selectedState&&c.county===region;
  return '<div class="saved-county"><button class="county-choice'+(active?' selected':'')+'" data-saved-use="'+i+'" aria-pressed="'+active+'"><b>'+safe(c.county)+'</b><small>'+safe(c.state)+(home?' · Home county':'')+'</small></button><div class="saved-tools"><button class="text-button" data-saved-home="'+i+'" aria-label="Make '+safe(c.county)+' your Home county" '+(home?'disabled':'')+'>'+(home?'Home':'Set Home')+'</button><button class="text-button" data-saved-remove="'+i+'" aria-label="Remove '+safe(c.county)+' from saved counties">Remove</button></div></div>';
 }).join(''):'<p class="muted">Save a county above to keep your hunting areas close.</p>';
 $('savedCount').textContent=valid.length?valid.length+' saved':'On this device';
}
function persistCounties(){const a=writeLocalJSON('rut_iq_saved_counties',savedCounties),b=writeLocalJSON('rut_iq_home_county',preferredCounty);if(!a||!b)$('savedMessage').textContent='Your browser could not save this. These choices will last for this visit only.'}
function selectCounty(st,co){if(!validCounty({state:st,county:co}))return;selectedState=st;region=co;saveRegion();setSelectors();$('regionPicker').open=false;renderSavedCounties();loadReports();loadDailyReport()}
$('saveCounty').addEventListener('click',()=>{
 if(!validCounty({state:selectedState,county:region}))return;
 savedCounties=savedCounties.filter(validCounty);
 if(savedCounties.some(c=>c.state===selectedState&&c.county===region)){$('savedCounties').open=true;return}
 if(savedCounties.length>=10){$('savedMessage').textContent='You have 10 saved counties. Remove one to save another.';$('savedCounties').open=true;return}
 const c={state:selectedState,county:region};savedCounties.push(c);if(!validCounty(preferredCounty))preferredCounty=c;
 persistCounties();renderSavedCounties();$('savedMessage').textContent=region+' saved on this device.';
});
$('savedCountyList').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 savedCounties=savedCounties.filter(validCounty);
 for(const [action,key] of [['use','savedUse'],['home','savedHome'],['remove','savedRemove']]){
  if(b.dataset[key]===undefined)continue;
  const i=Number(b.dataset[key]),c=savedCounties[i];if(!c)return;
  if(action==='use')selectCounty(c.state,c.county);
  if(action==='home'){preferredCounty=c;$('savedMessage').textContent=c.county+' will open next time.'}
  if(action==='remove'){savedCounties.splice(i,1);if(preferredCounty?.state===c.state&&preferredCounty?.county===c.county)preferredCounty=savedCounties[0]||null;$('savedMessage').textContent=c.county+' removed.'}
  persistCounties();renderSavedCounties();break;
 }
});
function formatDay(day){return new Date(day+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
async function loadHomeChanges(){
 const st=selectedState,co=region,token=authToken,access=proAccess,id=++changeRequest;
 const box=$('changesContent');$('nearbyContent').textContent='';
 if(!hasRegion()){box.innerHTML='<p class="muted">Choose a county to start your field updates.</p>';return}
 const key=(testMode?'test:'+authUser.id+'|':'')+countyKey(st,co);
 if(!visitStarts.has(key)){const visits=readLocalJSON('rut_iq_visits',{});const t=visits&&typeof visits==='object'?visits[key]:null;visitStarts.set(key,typeof t==='string'&&Number.isFinite(Date.parse(t))?t:null)}
 box.innerHTML='<p class="muted">Checking for new reports…</p>';
 try{
  const response=await rutFetch(api+'/rest/v1/rpc/rut_county_changes',{method:'POST',headers:headers(token),body:JSON.stringify({focus_state:st,focus_county:co,as_of:localDate(),last_seen:visitStarts.get(key)})});
  if(!response.ok)throw Error('Changes unavailable');const data=await response.json();
  if(id!==changeRequest||st!==selectedState||co!==region||token!==authToken||access!==proAccess)return;
  const count=Number(data.new_reports||0);
  box.innerHTML=data.first_visit?'<p class="change-title">Your starting point is set.</p><p class="muted">Next visit, see how many new reports hunters have submitted for '+safe(co)+'. Today’s reported behaviors are in your Daily Rut Report below.</p>':'<p class="change-title"><strong>'+count+'</strong> new '+(count===1?'report':'reports')+'</p><p class="muted">Submitted since '+safe(new Date(data.since).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))+' for observations in the past 7 local calendar days.</p>'+(count===0?'<p class="muted">No new reports does not mean deer are inactive.</p>':'');
  if(access&&data.behaviors){const rows=Object.entries(data.behaviors).filter(([,n])=>Number(n)>0);box.innerHTML+=rows.map(([label,n])=>'<div class="behavior-row"><span>'+safe(label)+'</span><strong>'+Number(n)+'</strong></div>').join('')}
  if($('home').classList.contains('show')&&typeof data.checked_at==='string'){
   const visits=readLocalJSON('rut_iq_visits',{}),clean=visits&&typeof visits==='object'&&!Array.isArray(visits)?visits:{};
   clean[key]=data.checked_at;const latest=Object.entries(clean).filter(([,v])=>typeof v==='string').sort((a,b)=>Date.parse(b[1])-Date.parse(a[1])).slice(0,100);writeLocalJSON('rut_iq_visits',Object.fromEntries(latest));
  }
  loadNearbyCounties(st,co,id);
 }catch{if(id===changeRequest)box.innerHTML='<p class="muted">Couldn’t check for updates. Your last visit has been kept.</p><button class="ghost" data-action="retry-changes">Try again</button>'}
}
async function loadNearbyCounties(st,co,id){
 try{
  if(!neighborPromise)neighborPromise=fetch('./county-neighbors.json').then(r=>{if(!r.ok)throw Error();return r.json()}).catch(e=>{neighborPromise=null;throw e});
  const neighbors=await neighborPromise,fips=(regions[st]||[]).find(c=>c.name===co)?.fips;
  const wanted=new Set(neighbors[fips]||[]),areas=[];
  for(const [state,list] of Object.entries(regions))for(const c of list)if(wanted.has(c.fips))areas.push({state,county:c.name});
  if(id!==changeRequest)return;
  if(!areas.length){$('nearbyContent').innerHTML='<p class="muted">Nearby county coverage isn’t available for this area.</p>';return}
  const u=new URL(api+'/rest/v1/rpc/rut_free_counties_for_day');
  u.searchParams.set('or','('+areas.map(c=>'and(state.eq.'+JSON.stringify(c.state)+',county.eq.'+JSON.stringify(c.county)+')').join(',')+')');
  u.searchParams.set('select','state,county,reports_7d');
  const r=await rutFetch(u,dayRequest());if(!r.ok)throw Error();const rows=await r.json();
  if(id!==changeRequest||st!==selectedState||co!==region)return;
  const totals=new Map(rows.map(x=>[countyKey(x.state,x.county),Number(x.reports_7d)]));
  const top=areas.map(c=>({...c,count:totals.get(countyKey(c.state,c.county))||0})).sort((a,b)=>b.count-a.count||a.county.localeCompare(b.county)).slice(0,6);
  $('nearbyContent').innerHTML='<h4>Nearby county reports</h4><p class="muted">Past 7 local calendar days · '+(areas.length>6?'Showing 6 of '+areas.length+' nearby counties.':'Shared map boundaries.')+'</p>'+top.map(c=>'<button class="nearby-row" data-nearby-state="'+safe(c.state)+'" data-nearby-county="'+safe(c.county)+'"><span>'+safe(c.county)+'<small>'+safe(c.state)+'</small></span><b>'+c.count+' <span class="muted">→</span></b></button>').join('');
 }catch{if(id===changeRequest)$('nearbyContent').innerHTML='<p class="muted">Nearby reports are temporarily unavailable.</p>'}
}
$('nearbyContent').addEventListener('click',e=>{const b=e.target.closest('[data-nearby-county]');if(b)selectCounty(b.dataset.nearbyState,b.dataset.nearbyCounty)});
async function loadComparison(){
 const id=++comparisonRequest,st=selectedState,co=region,token=authToken;
 $('comparisonCard').hidden=!proAccess;
 if(!proAccess||!token||!hasRegion()){$('comparisonContent').innerHTML='<p class="muted">Choose a county to compare reports.</p>';return}
 $('comparisonContent').innerHTML='<p class="muted">Comparing completed days…</p>';
 try{
  const r=await rutFetch(api+'/rest/v1/rpc/rut_county_comparison',{method:'POST',headers:headers(token),body:JSON.stringify({focus_state:st,focus_county:co,as_of:localDate()})});
  if(!r.ok)throw Error();const rows=await r.json();
  if(id!==comparisonRequest||token!==authToken||!proAccess||st!==selectedState||co!==region)return;
  const a=rows.find(x=>x.period==='recent'),b=rows.find(x=>x.period==='previous');if(!a||!b)throw Error();
  const total=Number(a.reports)+Number(b.reports),enough=Number(a.reports)>=5&&Number(b.reports)>=5&&Number(a.hunters)>=3&&Number(b.hunters)>=3;
  const delta=Number(a.reports)-Number(b.reports);
  const note=!total?'No reports to compare yet.':!enough?'Not enough reports for a reliable comparison.':delta===0?'The same number of reports in both periods.':Math.abs(delta)+' '+(delta>0?'more':'fewer')+' reports than the previous period.';
  const cats=[['Cruising','cruising'],['Chasing','chasing'],['Tending','tending'],['Breeding','breeding'],['Scrapes / rubs','signs'],['No rut activity seen','no_activity']];
  $('comparisonContent').innerHTML='<p class="change-title">'+safe(note)+'</p><div class="comparison-stats">'+[a,b].map((x,i)=>'<div><small>'+(i?'Previous 7 days':'Last 7 completed days')+'</small><strong>'+Number(x.reports)+'</strong><span>'+Number(x.hunters)+' hunters</span><small>'+formatDay(x.starts_on)+'–'+formatDay(x.ends_on)+'</small></div>').join('')+'</div>'+(total?'<table class="comparison-table"><caption>Reports by observed behavior</caption><thead><tr><th scope="col">Behavior</th><th scope="col">Recent</th><th scope="col">Previous</th></tr></thead><tbody>'+cats.map(([label,k])=>'<tr><th scope="row">'+label+'</th><td>'+Number(a[k]||0)+'</td><td>'+Number(b[k]||0)+'</td></tr>').join('')+'</tbody></table>':'')+'<p class="muted">Today is excluded so both periods cover seven full local calendar days. Report counts depend on hunter participation; changes don’t prove a change in deer activity.</p>'+(!enough?'<p class="muted">A comparison needs at least 5 reports from 3 hunters in each period. Zero reports does not mean no rut activity.</p>':'');
 }catch{if(id===comparisonRequest)$('comparisonContent').innerHTML='<p class="muted">Comparison unavailable.</p><button class="ghost" data-action="retry-comparison">Try again</button>'}
}
let lastSubmittedCounty=null;
function showReportReceipt(st,co,behavior,date,isQA){
 lastSubmittedCounty={state:st,county:co};
 $('reportSuccess').innerHTML='<div class="receipt-mark" aria-hidden="true">✓</div><div class="eyebrow">'+(isQA?'PRIVATE TEST REPORT':'OBSERVATION SAVED')+'</div><h3 tabindex="-1" id="receiptTitle">'+(isQA?'Your test report is saved privately.':'Added to '+safe(co)+'.')+'</h3><p>'+safe(behavior)+' · '+formatDay(date)+'<br><span class="muted">'+safe(co)+', '+safe(st)+'</span></p><p class="muted">'+(isQA?'Excluded from public reports. Private Test Mode shows this in your own Home and map views.':'Thank you for contributing. Only county-level activity is shared; your identity and notes stay private.')+'</p><div class="receipt-actions"><button class="action" data-action="receipt-map">View county map</button><button class="ghost" data-action="receipt-another">Log another observation</button></div>';
 $('reportSuccess').hidden=false;show('reports');$('receiptTitle').focus({preventScroll:true});
}
async function focusCountyMap(c){
 if(!validCounty(c))return;
 show('heatmap');
 try{
  await loadHeatmap();const fips=regions[c.state].find(x=>x.name===c.county).fips,code=fips.slice(0,2);
  if(!countyCache[code]){const r=await fetch('./maps/'+code+'.json');if(!r.ok)throw Error();countyCache[code]=await r.json()}
  if(!document.body.classList.contains('map-view'))return;
  const feature=countyCache[code].features.find(f=>f.properties.STATE+f.properties.COUNTY===fips);
  if(feature){map.fitBounds(L.geoJSON(feature).getBounds(),{padding:[35,35],maxZoom:10});await updateVisibleCounties();openCountySheet(c.state,c.county)}
 }catch{$('mapStatus').textContent='Your report is saved. County zoom is unavailable; use the state selector to find it.'}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b)return;
 switch(b.dataset.action){
  case 'retry-changes':loadHomeChanges();break;
  case 'retry-comparison':loadComparison();break;
  case 'receipt-map':if(lastSubmittedCounty)focusCountyMap(lastSubmittedCounty);break;
  case 'receipt-another':if(lastSubmittedCounty)selectCounty(lastSubmittedCounty.state,lastSubmittedCounty.county);$('reportSuccess').hidden=true;show('submit');$('behavior').focus();break;
 }
});
function updateInstallUI(){
 const installed=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 $('installButton').hidden=!installPrompt||installed;
 $('installStatus').textContent=installed?'Rut IQ is running from your Home Screen.':'Keep Rut IQ one tap away.';
 $('installSteps').hidden=!!installed;
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;updateInstallUI()});
window.addEventListener('appinstalled',()=>{installPrompt=null;updateInstallUI()});
$('installButton').addEventListener('click',async()=>{if(!installPrompt)return;const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice;updateInstallUI()});
window.matchMedia('(display-mode: standalone)').addEventListener('change',updateInstallUI);
updateInstallUI();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

function updateTestUI(){
 $('testControls').hidden=!testAccess;
 $('testToggle').checked=testMode;
 $('testModeStatus').textContent=testMode?'Only your own private test reports are shown.':'You are viewing public reports. Your submissions still stay private.';
 document.querySelectorAll('[data-test-notice]').forEach(e=>{
  e.hidden=!testAccess;
  e.textContent=testMode?'PRIVATE TEST MODE · Your reports only · Hidden from other hunters':'PRIVATE TEST ACCOUNT · Viewing public reports · Your submissions stay private';
 });
}
function setTestState(access,enabled){
 const changed=testAccess!==access||testMode!==enabled;testAccess=access;testMode=access&&enabled;
 if(changed){
  ++testEpoch;++reportRequest;++dailyRequest;++mapDataRequest;++changeRequest;++comparisonRequest;
  reports=[];behaviorTotals=null;countyTotal=0;reportsReady=false;allMapCounts={};reportDataFetchedAt=0;reportDataDay='';
  $('dailyContent').textContent='Refreshing county reports…';$('changesContent').textContent='Refreshing county updates…';$('nearbyContent').textContent='';$('comparisonContent').textContent='';
  if(map)recolorMap();render();
 }
 updateTestUI();return changed;
}
async function refreshTestAccess(){
 const token=authToken,user=authUser?.id,id=++testAccessRequest;
 if(!token||!user){setTestState(false,false);return}
 let access=false;
 try{const r=await fetch(api+'/rest/v1/rpc/rut_test_access',{method:'POST',headers:headers(token),body:'{}'});access=r.ok&&(await r.json())===true}catch{}
 if(id!==testAccessRequest||token!==authToken||user!==authUser?.id)return;
 setTestState(access,access&&sessionStorage.getItem('rut_iq_test_public_'+user)!=='1');
}
const testEndpoints=new Set(['rut_free_counties_for_day','rut_daily_counties_for_day','rut_pro_signals_for_day','rut_reports_for_day','rut_county_changes','rut_county_comparison']);
async function rutFetch(input,options){
 const url=new URL(input),epoch=testEpoch,privateView=testMode;
 if(privateView&&testEndpoints.has(url.pathname.split('/').pop())){
  if(!testAccess||!authToken)throw Error('Private test access unavailable');
  url.pathname+='_test';options={...options,headers:{...options.headers,...headers(authToken)}};
 }
 const response=await fetch(url,options);
 if(epoch!==testEpoch)throw Error('Report view changed');
 if(privateView&&(response.status===401||response.status===403))$('testModeStatus').textContent='Private test access could not be verified. Sign in again or check your membership.';
 return response;
}
$('testToggle').addEventListener('change',async e=>{
 if(!testAccess){e.target.checked=false;return}
 const enabled=e.target.checked;
 sessionStorage.setItem('rut_iq_test_public_'+authUser.id,enabled?'0':'1');
 setTestState(true,enabled);
 await Promise.all([loadReports(),loadDailyReport(),fetchMapReportData().then(()=>{if(map)recolorMap()}).catch(()=>{})]);
});

/* Passwords go directly to Auth over HTTPS and are never stored by Rut IQ. */
function setAuthMode(mode){
 authMode=mode;
 $('authSignInTab').setAttribute('aria-pressed',String(mode==='signin'));
 $('authCreateTab').setAttribute('aria-pressed',String(mode==='create'));
 $('passwordSignIn').textContent=mode==='create'?'Create free account':'Sign in';
 $('authPassword').autocomplete=mode==='create'?'new-password':'current-password';
 $('authPassword').minLength=mode==='create'?12:1;
 $('passwordHint').textContent=mode==='create'?'Use at least 12 characters. We’ll email you a confirmation link.':'Already used an email link? Choose “Set or reset password” below, or set one in My account while signed in.';
 $('authPassword').value='';$('authMessage').textContent='';updateSignInButton();
}
$('authSignInTab').addEventListener('click',()=>setAuthMode('signin'));
$('authCreateTab').addEventListener('click',()=>setAuthMode('create'));
async function authRequest(path,body,token,method='POST'){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(api+'/auth/v1/'+path,{method,headers:headers(token),body:JSON.stringify(body),signal:controller.signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
   const code=data.error_code||data.code;
   if(response.status===429){pauseEmailResend(60);throw Error('Too many requests. Please wait a minute and try again.')}
   if(code==='email_not_confirmed')throw Error('Confirm your email first. You can request a fresh email sign-in link below.');
   if(code==='invalid_credentials')throw Error('Email or password wasn’t recognized. Try again or choose “Set or reset password.”');
   if(code==='weak_password')throw Error('Choose a stronger password with at least 12 characters.');
   if(code==='same_password')throw Error('Choose a different password from your current one.');
   if(code==='reauthentication_needed'||code==='reauthentication_not_valid')throw Error('Please use a fresh password reset email before changing your password.');
   if(response.status===401||response.status===403)throw Error('Your sign-in could not be verified. Sign in again and retry.');
   throw Error('We couldn’t complete that request. Try again, or use an email sign-in link.');
  }
  return data;
 }catch(e){
  if(e.name==='AbortError')throw Error('The request timed out. Check your connection before trying again.');
  if(e instanceof TypeError)throw Error('Unable to connect. Check your connection and try again.');
  throw e;
 }finally{clearTimeout(timeout)}
}
$('passwordAuthForm').addEventListener('submit',async e=>{
 e.preventDefault();if(authUser||authBusy)return;
 if(!$('passwordAuthForm').reportValidity())return;
 const mode=authMode,email=$('authEmail').value.trim(),password=$('authPassword').value,generation=authGeneration;
 if(mode==='create'&&Date.now()<authRetryUntil)return;
 rememberSession=$('rememberMe').checked;localStorage.setItem('rut_iq_remember',rememberSession?'1':'0');
 authBusy=true;updateSignInButton();$('authMessage').textContent=mode==='create'?'Creating your account…':'Signing in…';
 try{
  const path=mode==='create'?'signup?redirect_to='+encodeURIComponent('https://rut-iq-preview.onrender.com/'):'token?grant_type=password';
  const data=await authRequest(path,{email,password});
  if(generation!==authGeneration)return;
  $('authPassword').value='';
  if(data.access_token){
   saveSession(data);authUser=data.user;
   if(!authUser){const r=await fetch(api+'/auth/v1/user',{headers:headers(authToken)});if(!r.ok)throw Error('Please sign in again.');authUser=await r.json()}
   localStorage.setItem('rut_iq_welcomed','1');updateAuthUI();await refreshMembership();show('home');await loadReports();
   $('authMessage').textContent='You’re signed in.';
  }else{
   pauseEmailResend(60);
   $('authMessage').textContent='Check your email to confirm your Rut IQ account. Already registered? Sign in or reset your password.';
  }
 }catch(e){$('authMessage').textContent=e.message}
 finally{authBusy=false;updateSignInButton()}
});
$('forgotPassword').addEventListener('click',async()=>{
 if(authUser||authBusy||Date.now()<authRetryUntil)return;
 if(!$('authEmail').value.trim()||!$('authEmail').reportValidity())return;
 rememberSession=$('rememberMe').checked;localStorage.setItem('rut_iq_remember',rememberSession?'1':'0');
 authBusy=true;updateSignInButton();$('authMessage').textContent='Requesting a password reset…';
 try{
  await authRequest('recover?redirect_to='+encodeURIComponent('https://rut-iq-preview.onrender.com/'),{email:$('authEmail').value.trim()});
  pauseEmailResend(60);$('authMessage').textContent='If an account exists for that email, you’ll receive a link to set a new password. Open the newest email on this device.';
 }catch(e){$('authMessage').textContent=e.message}
 finally{authBusy=false;updateSignInButton()}
});
$('setPasswordForm').addEventListener('submit',async e=>{
 e.preventDefault();const button=$('savePassword'),msg=$('passwordMessage');
 if(button.disabled)return;
 if(!authUser||!authToken){show('signup');return}
 if(!$('setPasswordForm').reportValidity())return;
 if($('newPassword').value!==$('confirmPassword').value){msg.textContent='The passwords don’t match. Please enter the same password twice.';return}
 const generation=authGeneration,password=$('newPassword').value,remember=$('accountRemember').checked;
 button.disabled=true;msg.textContent='Saving your password…';
 try{
  if(session?.refresh_token&&Number(session.expires_at)*1000<Date.now()+60000)await refreshSession();
  if(generation!==authGeneration||!authToken)throw Error('Please sign in again before changing your password.');
  await authRequest('user',{password},authToken,'PUT');
  if(generation!==authGeneration)return;
  rememberSession=remember;localStorage.setItem('rut_iq_remember',rememberSession?'1':'0');
  if(session)saveSession(session);
  $('setPasswordForm').reset();$('accountRemember').checked=rememberSession;
  msg.textContent='Password saved. You can now sign in with your email and password.';
 }catch(e){msg.textContent=e.message}
 finally{button.disabled=false}
});
$('saveRemember').addEventListener('click',()=>{
 if(!authUser||!session)return;
 rememberSession=$('accountRemember').checked;localStorage.setItem('rut_iq_remember',rememberSession?'1':'0');saveSession(session);
 $('passwordMessage').textContent=rememberSession?'Remember me is on for this browser.':'Remember me is off. This sign-in uses tab-session storage. Sign out when finished on a shared device.';
});

initAuth().then(()=>{routeFromURL();loadReports()}).catch(()=>{show('signup',false);$('authMessage').textContent='We couldn’t check your sign-in. Please try again.'}).finally(()=>document.body.classList.remove('booting'));