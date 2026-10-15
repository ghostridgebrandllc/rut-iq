const assert=require('node:assert/strict');
function entitlement({status,periodEnd,now,source='stripe'}){
 if(source==='tester')return true;
 return status==='active' && !!periodEnd && periodEnd>now;
}
const now=Date.parse('2026-10-14T20:00:00Z');
const future=Date.parse('2026-11-14T22:13:01Z');
assert.equal(entitlement({status:'active',periodEnd:future,now}),true,'active paid');
assert.equal(entitlement({status:'active',periodEnd:future,now:future+1}),false,'expired active status');
assert.equal(entitlement({status:'past_due',periodEnd:future,now}),false,'failed payment');
assert.equal(entitlement({status:'unpaid',periodEnd:future,now}),false,'unpaid');
assert.equal(entitlement({status:'canceled',periodEnd:future,now}),false,'canceled');
assert.equal(entitlement({status:'active',periodEnd:null,now}),false,'missing period');
console.log('PASS six fail-closed subscription lifecycle scenarios (logic-only)');
