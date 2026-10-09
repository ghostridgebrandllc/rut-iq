// Unit-test the actual UI event handler without sending requests or deleting users.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const fragment=code.slice(code.indexOf('function updateAccountUI(){'),code.indexOf('/* Personal counties'));
function setup(){
 const nodes=new Map(),saved=[],store=new Map();let requests=0,reloaded=false;
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,hidden:false,textContent:'',addEventListener(type,fn){this[type]=fn},focus(){},reset(){}});return nodes.get(id)};
 const context={rememberSession:true,$,savedCounties:[],preferredCounty:null,visitStarts:new Map(),changeRequest:0,comparisonRequest:0,authUser:{email:'qa@example.invalid'},authToken:'test-only',session:null,refreshSession:async()=>{},fetch:async()=>{requests++;return {ok:true,json:async()=>({deleted:true})}},api:'https://unit-test.invalid',headers:()=>({}),saveSession:s=>saved.push(s),clearTimeout(){},membershipTimer:null,proAccess:true,membership:{},reportRequest:0,dailyRequest:0,mapDataRequest:0,reports:[],countyTotal:0,reportsReady:false,allMapCounts:{},reportDataFetchedAt:0,localDate:()=>'',localStorage:{removeItem(){}},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},selectedState:'',region:'',setSelectors(){},searchMarker:null,map:null,mapColorMode:'volume',mapDays:7,recolorMap(){},updateAuthUI(){},updateMembershipUI(){},render(){},loadDailyReport(){},show(){},location:{reload(){reloaded=true}}};
 vm.createContext(context);vm.runInContext(fragment,context);
 return {$,context,saved,store,requests:()=>requests,reloaded:()=>reloaded};
}
(async()=>{
 let t=setup();t.context.updateAccountUI();assert.equal(t.$('accountControls').hidden,false);assert.equal(t.$('deleteAccountPanel').hidden,true);
 t.$('openDeleteAccount').click();assert.equal(t.$('deleteAccountPanel').hidden,false);
 t.$('deleteConfirmation').value='delete';t.$('deleteConfirmation').input();assert.equal(t.$('confirmDeleteAccount').disabled,true);
 await t.$('deleteAccountForm').submit({preventDefault(){}});assert.equal(t.requests(),0);
 t.$('cancelDeleteAccount').click();assert.equal(t.$('deleteAccountPanel').hidden,true);assert.equal(t.requests(),0);
 t.$('openDeleteAccount').click();t.$('deleteConfirmation').value='DELETE';t.$('deleteConfirmation').input();assert.equal(t.$('confirmDeleteAccount').disabled,false);
 await t.$('deleteAccountForm').submit({preventDefault(){}});assert.equal(t.requests(),1);assert.equal(t.saved[0],null);assert.equal(t.context.authUser,null);assert.equal(t.reloaded(),true);assert.equal(t.store.get('rut_iq_deleted'),'1');
 t=setup();t.context.authUser=null;t.context.authToken=null;t.context.updateAccountUI();assert.equal(t.$('accountControls').hidden,true);
 await t.$('deleteAccountForm').submit({preventDefault(){}});assert.equal(t.requests(),0);
 t=setup();t.$('deleteConfirmation').value='DELETE';t.context.fetch=async()=>({ok:false,status:403,json:async()=>({})});
 await t.$('deleteAccountForm').submit({preventDefault(){}});assert.equal(t.saved.length,0);assert.match(t.$('deleteAccountMessage').textContent,/expired/);assert.equal(t.reloaded(),false);
 console.log('PASS: sign-in guard, typed confirmation, cancel, deletion request, session/cache cleanup, error recovery');
})().catch(e=>{console.error(e);process.exitCode=1});
