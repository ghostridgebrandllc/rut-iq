/* Field Talk beta: text discussions only; server RLS enforces moderation. */
'use strict';
let fieldLoadSerial=0;
function fieldText(value){return safe(value==null?'':value)}
function fieldRequest(path,opts={}){return fetch(api+'/rest/v1/'+path,{...opts,headers:{...headers(authToken),...(opts.headers||{})}})}
async function loadFieldTalk(){
 const serial=++fieldLoadSerial,feed=$('fieldFeed'),status=$('fieldStatus');
 const state=selectedState,county=region,scope=$('fieldScope').value;
 $('fieldPostForm').hidden=!authUser;
 if(authUser)loadFieldModeration();
 if(!authUser){status.textContent='Sign in to view and contribute to Field Talk.';feed.innerHTML='<button class="action" data-route="signup">Sign in / Join</button>';return}
 if(!state||(scope==='county'&&!county)){status.textContent='Choose your state and county on Home first.';feed.innerHTML='<button class="ghost" data-route="home">Choose a county</button>';return}
 status.textContent=scope==='county'?county+', '+state:state+' statewide';
 feed.innerHTML='<p class="muted">Loading conversations…</p>';
 try{
  const url=new URL(api+'/rest/v1/rut_field_posts');
  url.searchParams.set('select','id,author_id,state,county,category,caption,status,created_at');
  url.searchParams.set('state','eq.'+state);
  if(scope==='county')url.searchParams.set('county','eq.'+county);
  url.searchParams.set('order','created_at.desc');
  url.searchParams.set('limit','40');
  const response=await fieldRequest(url.pathname.replace('/rest/v1/','')+url.search);
  if(!response.ok)throw Error('Unable to load discussions');
  const rows=await response.json();
  if(serial!==fieldLoadSerial)return;
  feed.innerHTML=rows.length?rows.map(p=>'<article class="card" data-field-post="'+fieldText(p.id)+'"><div class="eyebrow">'+fieldText(p.category)+' · '+fieldText(p.county||p.state)+'</div><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+fieldText(p.caption)+'</p><p class="muted">'+(p.status==='approved'?'Community post':'Pending moderator approval')+' · '+fieldText(new Date(p.created_at).toLocaleDateString())+'</p>'+(p.status==='approved'?'<button type="button" class="ghost" data-field-replies="'+fieldText(p.id)+'">View replies</button> <button type="button" class="text-button" data-field-report="'+fieldText(p.id)+'">Report</button><div class="field-replies" hidden></div>':'')+'</article>').join(''):'<div class="card"><p>No discussions here yet. Start the conversation.</p></div>';
 }catch(e){if(serial===fieldLoadSerial)feed.innerHTML='<p class="muted">Could not load Field Talk. Please retry later.</p>'}
}
$('fieldScope').addEventListener('change',loadFieldTalk);
$('fieldPostForm').addEventListener('submit',async e=>{
 e.preventDefault();const message=$('fieldPostMessage'),button=e.currentTarget.querySelector('[type=submit]');
 if(!authUser||!authToken){show('signup');return}
 if(!selectedState){message.textContent='Choose a hunting state on Home first.';return}
 const caption=$('fieldCaption').value.trim();
 if(!caption||caption.length>2000)return;
 button.disabled=true;message.textContent='Submitting for moderation…';
 try{
  const res=await fieldRequest('rut_field_posts',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({author_id:authUser.id,state:selectedState,county:region||null,category:$('fieldCategory').value,caption,status:'pending'})});
  if(!res.ok)throw Error('Could not submit your post.');
  $('fieldCaption').value='';message.textContent='Submitted. Your post will appear after moderator approval.';loadFieldTalk();
 }catch(e){message.textContent='Unable to submit right now. Please try again.'}
 finally{button.disabled=false}
});
$('fieldFeed').addEventListener('click',async e=>{
 const reply=e.target.closest('[data-field-replies]'),flag=e.target.closest('[data-field-report]');
 if(flag){
  const reason=prompt('Report reason: spam, harassment, graphic, privacy, illegal, or other');
  if(!reason)return;
  const value=reason.trim().toLowerCase();
  if(!['spam','harassment','graphic','privacy','illegal','other'].includes(value)){alert('Choose a listed reason.');return}
  try{const res=await fieldRequest('rut_field_flags',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({reporter_id:authUser.id,post_id:flag.dataset.fieldReport,reason:value})});alert(res.ok?'Report submitted for review.':'Could not submit report (possibly already reported).')}catch{alert('Could not submit report.')}
  return;
 }
 if(!reply)return;
 const container=reply.closest('article').querySelector('.field-replies');
 if(!container.hidden){container.hidden=true;return}
 container.hidden=false;container.textContent='Loading replies…';
 try{
  const url='rut_field_comments?select=id,body,created_at&post_id=eq.'+encodeURIComponent(reply.dataset.fieldReplies)+'&status=eq.approved&order=created_at.asc&limit=50';
  const res=await fieldRequest(url);if(!res.ok)throw Error();
  const comments=await res.json();
  container.innerHTML=comments.map(c=>'<p class="card" style="white-space:pre-wrap;overflow-wrap:anywhere">'+fieldText(c.body)+'</p>').join('')+'<form class="field-comment-form"><label>Reply<textarea required maxlength="1000" rows="2"></textarea></label><button class="ghost" type="submit">Submit reply for review</button><p class="muted" role="status"></p></form>';
 }catch{container.textContent='Unable to load replies.'}
});
$('fieldFeed').addEventListener('submit',async e=>{
 const form=e.target.closest('.field-comment-form');if(!form)return;e.preventDefault();
 const post=form.closest('article').dataset.fieldPost,body=form.querySelector('textarea').value.trim();
 if(!body||!authUser)return;
 const button=form.querySelector('button');button.disabled=true;
 try{const r=await fieldRequest('rut_field_comments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({post_id:post,author_id:authUser.id,body,status:'pending'})});form.querySelector('[role=status]').textContent=r.ok?'Reply submitted for review.':'Unable to submit reply.';if(r.ok)form.querySelector('textarea').value=''}
 catch{form.querySelector('[role=status]').textContent='Unable to submit reply.'}
 finally{button.disabled=false}
});

async function loadFieldModeration(){
 const section=$('fieldModeration'),queue=$('fieldReviewQueue');
 section.hidden=true;
 if(!authUser||!authToken)return;
 try{
  const role=await fetch(api+'/rest/v1/rpc/rut_field_is_moderator',{method:'POST',headers:headers(authToken),body:'{}'});
  if(!role.ok||(await role.json())!==true)return;
  section.hidden=false;queue.textContent='Loading moderation queue…';
  const [posts,comments]=await Promise.all([
   fieldRequest('rut_field_posts?select=id,caption,created_at&status=eq.pending&order=created_at.asc&limit=50'),
   fieldRequest('rut_field_comments?select=id,body,created_at&status=eq.pending&order=created_at.asc&limit=50')
  ]);
  if(!posts.ok||!comments.ok)throw Error();
  const a=(await posts.json()).map(p=>({...p,kind:'posts',content:p.caption}));
  const b=(await comments.json()).map(c=>({...c,kind:'comments',content:c.body}));
  queue.innerHTML=[...a,...b].length?[...a,...b].map(item=>'<div class="card" data-mod-id="'+fieldText(item.id)+'" data-mod-kind="'+item.kind+'"><p class="eyebrow">'+item.kind+'</p><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+fieldText(item.content)+'</p><button type="button" class="ghost" data-mod-status="approved">Approve</button> <button type="button" class="danger" data-mod-status="rejected">Reject</button></div>').join(''):'<p class="muted">No pending posts or replies.</p>';
 }catch{if(!section.hidden)queue.textContent='Unable to load review queue.'}
}
$('fieldReviewRefresh').addEventListener('click',loadFieldModeration);
$('fieldReviewQueue').addEventListener('click',async e=>{
 const button=e.target.closest('[data-mod-status]');if(!button)return;
 const card=button.closest('[data-mod-id]'),kind=card.dataset.modKind,id=card.dataset.modId,status=button.dataset.modStatus;
 if(!['posts','comments'].includes(kind)||!['approved','rejected'].includes(status))return;
 button.disabled=true;
 try{
  const response=await fieldRequest('rut_field_'+kind+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,reviewed_at:new Date().toISOString()})});
  if(!response.ok)throw Error();
  await loadFieldModeration();loadFieldTalk();
 }catch{button.disabled=false;alert('Moderation action failed. Please retry.')}
});
