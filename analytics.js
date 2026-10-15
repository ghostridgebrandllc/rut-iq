// Privacy-conscious, anonymous Woods IQ activity events.
(() => {
  const endpoint = 'https://ddxzyzjsqrnputiibdbi.supabase.co/rest/v1/rut_visitor_events';
  const key = 'sb_publishable_IKgJ-FLqeJDXM0VEoARYqQ_f-9EpGl1';
  const getId = (name, store) => {
    try { let id=store.getItem(name); if(!id){id=crypto.randomUUID();store.setItem(name,id)} return id; }
    catch { return crypto.randomUUID(); }
  };
  const visitor_id=getId('rut_iq_visitor_id',localStorage);
  const session_id=getId('rut_iq_session_id',sessionStorage);
  const allowed=new Set(['welcome','home','heatmap','reports','submit','signup','plans','fieldtalk','about','help','privacy','terms','account']);
  const page=()=>{const p=location.hash.slice(1).split(/[?&]/)[0];return allowed.has(p)?p:'welcome'};
  const referrer_host=(()=>{try{return document.referrer?new URL(document.referrer).hostname.slice(0,120):null}catch{return null}})();
  const utm_source=(new URLSearchParams(location.search).get('utm_source')||'').slice(0,120)||null;
  function send(event_name, feature=null){
    if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return;
    const payload={visitor_id,session_id,event_name,page:page(),feature,referrer_host,utm_source};
    fetch(endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{});
  }
  send('session_start');
  send('page_view');
  window.addEventListener('hashchange',()=>send('page_view'));
  document.addEventListener('click',e=>{
    const el=e.target.closest('button,[data-route],a[href]');
    if(!el)return;
    const feature=(el.dataset.route||el.dataset.tab||el.id||el.getAttribute('href')||'button').slice(0,80);
    send('feature_click',feature);
  },{passive:true});
  window.woodsIQTrackPage=()=>send('page_view');
})();