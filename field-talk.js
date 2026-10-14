/* Field Talk beta: moderated public threads and private pending photo attachments. */
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
  for(const p of rows){const el=feed.querySelector('[data-field-post="'+p.id+'"]');if(el)loadFieldImages(el,{post_id:p.id});}
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
  const res=await fieldRequest('rut_field_posts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({author_id:authUser.id,state:selectedState,county:region||null,category:$('fieldCategory').value,caption,status:'pending'})});
  if(!res.ok)throw Error('Could not submit your post.');
  const newPost=await res.json().catch(()=>[]);
  const postId=newPost[0]?.id;
  const files=[...$('fieldPostPhotos').files];
  if(files.length&&postId){await uploadFieldPhotos(files,{post_id:postId});}
  $('fieldCaption').value='';$('fieldPostPhotos').value='';
  message.textContent='Submitted for moderator review.';loadFieldTalk();
 }catch(e){message.textContent='Your text post may have been saved, but one or more photos did not upload. Check your pending post before trying again.'}
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
  container.innerHTML=comments.map(c=>'<div class="card" data-field-comment="'+fieldText(c.id)+'"><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+fieldText(c.body)+'</p></div>').join('')+'<form class="field-comment-form"><label>Reply<textarea required maxlength="1000" rows="2"></textarea></label><label>Photos (up to 3)<input type="file" accept="image/jpeg,image/png,image/webp" multiple></label><button class="ghost" type="submit">Submit reply for review</button><p class="muted" role="status"></p></form>';
  for(const c of comments){const el=container.querySelector('[data-field-comment="'+c.id+'"]');if(el)loadFieldImages(el,{comment_id:c.id});}
 }catch{container.textContent='Unable to load replies.'}
});
$('fieldFeed').addEventListener('submit',async e=>{
 const form=e.target.closest('.field-comment-form');if(!form)return;e.preventDefault();
 const post=form.closest('article').dataset.fieldPost,body=form.querySelector('textarea').value.trim();
 if(!body||!authUser)return;
 const button=form.querySelector('button');button.disabled=true;
 try{const r=await fieldRequest('rut_field_comments',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({post_id:post,author_id:authUser.id,body,status:'pending'})});form.querySelector('[role=status]').textContent=r.ok?'Reply submitted for review.':'Unable to submit reply.';if(r.ok){const saved=await r.json();const files=[...form.querySelector('input[type=file]').files];if(files.length&&saved[0]?.id)await uploadFieldPhotos(files,{comment_id:saved[0].id});form.querySelector('textarea').value='';form.querySelector('input[type=file]').value=''}}
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
  const [posts,comments,photos]=await Promise.all([
   fieldRequest('rut_field_posts?select=id,caption,created_at&status=eq.pending&order=created_at.asc&limit=50'),
   fieldRequest('rut_field_comments?select=id,body,created_at&status=eq.pending&order=created_at.asc&limit=50'),
   fieldRequest('rut_field_photos?select=id,storage_path,created_at&status=eq.pending&order=created_at.asc&limit=50')
  ]);
  if(!posts.ok||!comments.ok||!photos.ok)throw Error();
  const a=(await posts.json()).map(p=>({...p,kind:'posts',content:p.caption}));
  const b=(await comments.json()).map(c=>({...c,kind:'comments',content:c.body}));
  const c=(await photos.json()).map(p=>({...p,kind:'photos',content:'Photo attachment pending manual review'}));
  const pending=[...a,...b,...c];
  queue.innerHTML=pending.length?pending.map(item=>
   '<div class="card" data-mod-id="'+fieldText(item.id)+'" data-mod-kind="'+item.kind+'"><p class="eyebrow">'+item.kind+'</p><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+fieldText(item.content)+'</p>'+
   (item.kind==='photos'?'<div data-review-photo="'+fieldText(item.storage_path)+'"></div>':'')+
   '<button type="button" class="ghost" data-mod-status="approved">Approve</button> <button type="button" class="danger" data-mod-status="rejected">Reject</button></div>').join(''):'<p class="muted">No pending posts, replies or photos.</p>';
  for(const el of queue.querySelectorAll('[data-review-photo]'))await showPrivateFieldImage(el,el.dataset.reviewPhoto);
 }catch{if(!section.hidden)queue.textContent='Unable to load review queue.'}
}
$('fieldReviewRefresh').addEventListener('click',loadFieldModeration);
$('fieldReviewQueue').addEventListener('click',async e=>{
 const button=e.target.closest('[data-mod-status]');if(!button)return;
 const card=button.closest('[data-mod-id]'),kind=card.dataset.modKind,id=card.dataset.modId,status=button.dataset.modStatus;
 if(!['posts','comments','photos'].includes(kind)||!['approved','rejected'].includes(status))return;
 button.disabled=true;
 try{
  const response=await fieldRequest('rut_field_'+kind+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,reviewed_at:new Date().toISOString()})});
  if(!response.ok)throw Error();
  await loadFieldModeration();loadFieldTalk();
 }catch{button.disabled=false;alert('Moderation action failed. Please retry.')}
});

// Re-encode with canvas to remove EXIF/GPS metadata before upload.
// Private storage never exposes a public image URL.
function sanitizeFieldPhoto(file){
 return new Promise((resolve,reject)=>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024){reject(Error('Use a JPEG, PNG or WebP under 12 MB.'));return}
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{
   URL.revokeObjectURL(url);
   const ratio=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
   if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>50000000){reject(Error('Photo dimensions unsupported.'));return}
   const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   canvas.toBlob(blob=>blob&&blob.size<=5242880?resolve(blob):reject(Error('Unable to prepare photo.')),'image/jpeg',.82);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Photo could not be opened.'))};
  img.src=url;
 });
}
function fieldUUID(){return crypto.randomUUID()}
async function uploadFieldPhotos(files,target){
 if(files.length>3)throw Error('Maximum 3 photos per post or reply.');
 if(!authUser||!authToken)throw Error('Sign in to upload.');
 const targetId=target.post_id||target.comment_id;
 for(const file of files){
  const blob=await sanitizeFieldPhoto(file);
  const path=authUser.id+'/'+targetId+'/'+fieldUUID()+'.jpg';
  // Reserve a moderated attachment first. Storage RLS rejects unregistered paths.
  const result=await fieldRequest('rut_field_photos',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({uploader_id:authUser.id,storage_path:path,status:'pending',...target})});
  if(!result.ok)throw Error('Photo attachment could not be created.');
  try{
   const upload=await fetch(api+'/storage/v1/object/rut-field-photos/'+path,{
    method:'POST',headers:{apikey:pubKey,Authorization:'Bearer '+authToken,'Content-Type':'image/jpeg','x-upsert':'false'},body:blob
   });
   if(!upload.ok)throw Error('Photo upload failed.');
  }catch(error){
   await fieldRequest('rut_field_photos?storage_path=eq.'+encodeURIComponent(path),{method:'DELETE'}).catch(()=>{});
   throw error;
  }
 }
}

async function showPrivateFieldImage(container,path){
 try{
  const response=await fetch(api+'/storage/v1/object/authenticated/rut-field-photos/'+path,{headers:{apikey:pubKey,Authorization:'Bearer '+authToken}});
  if(!response.ok)throw Error('Photo unavailable');
  const blob=await response.blob();
  if(!blob.type.startsWith('image/'))throw Error('Invalid photo');
  const url=URL.createObjectURL(blob),img=document.createElement('img');
  img.src=url;img.alt='Photo attached to Field Talk thread';
  img.style.cssText='display:block;max-width:100%;max-height:420px;object-fit:contain;border-radius:10px;margin:10px 0';
  img.onload=()=>URL.revokeObjectURL(url);
  img.onerror=()=>URL.revokeObjectURL(url);
  container.append(img);
 }catch{container.textContent='Photo preview unavailable.'}
}
async function loadFieldImages(container,target){
 if(!authToken)return;
 try{
  const key=target.post_id?'post_id':'comment_id',id=target[key];
  const response=await fieldRequest('rut_field_photos?select=storage_path,status&'+key+'=eq.'+encodeURIComponent(id)+'&status=eq.approved&limit=3');
  if(!response.ok)return;
  for(const item of await response.json()){
   const frame=document.createElement('div');container.append(frame);
   showPrivateFieldImage(frame,item.storage_path);
  }
 }catch{}
}
