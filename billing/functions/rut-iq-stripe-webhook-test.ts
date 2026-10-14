/** Stripe sandbox webhook: do not use for live payments.
 * Requires STRIPE_RUT_IQ_TEST_SECRET and STRIPE_RUT_IQ_TEST_WEBHOOK_SECRET.
 * Uses raw-body signature verification. Never grants access from redirect URLs.
 */
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
const priceIds=new Set(["price_1UOXLFRqpCnvGztzHmMXcHnE","price_1UOXLJRqpCnvGztzJhbRVsDs"]);
const reply=(code:number,message:string)=>new Response(message,{status:code,headers:{"Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method!=="POST")return reply(405,"POST required");
 const stripeKey=Deno.env.get("STRIPE_RUT_IQ_TEST_SECRET");
 const signingKey=Deno.env.get("STRIPE_RUT_IQ_TEST_WEBHOOK_SECRET");
 const url=Deno.env.get("SUPABASE_URL");
 const dbKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!stripeKey?.startsWith("sk_test_")||!signingKey?.startsWith("whsec_")||!url||!dbKey)
   return reply(503,"Sandbox webhook not configured");
 const signature=req.headers.get("stripe-signature");
 if(!signature)return reply(400,"Missing signature");
 const stripe=new Stripe(stripeKey);
 let event:Stripe.Event;
 try {
   event=await stripe.webhooks.constructEventAsync(await req.text(),signature,signingKey);
 }catch{return reply(400,"Invalid signature")}
 if(event.livemode)return reply(400,"Live events not allowed");
 const accepted=new Set(["checkout.session.completed","checkout.session.async_payment_succeeded",
   "customer.subscription.created","customer.subscription.updated","customer.subscription.deleted",
   "invoice.paid","invoice.payment_failed"]);
 if(!accepted.has(event.type))return reply(200,"Ignored");
 const db=createClient(url,dbKey,{auth:{persistSession:false,autoRefreshToken:false}});
 // Membership changes only for a verifiably owned Rut IQ subscription.
 let subId:string|undefined;
 const object:any=event.data.object;
 if(event.type.startsWith("customer.subscription."))subId=object.id;
 else if(event.type.startsWith("checkout.session."))subId=typeof object.subscription==="string"?object.subscription:object.subscription?.id;
 else if(event.type.startsWith("invoice."))subId=object.parent?.subscription_details?.subscription || object.subscription;
 if(!subId||typeof subId!=="string")return reply(200,"No subscription");
 try{
   const subscription=await stripe.subscriptions.retrieve(subId,{expand:["items.data.price"]});
   if(subscription.livemode||subscription.metadata?.app!=="rut_iq")return reply(200,"Different app");
   const uid=subscription.metadata.rut_user_id;
   if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(uid))return reply(200,"No Rut IQ account");
   const matching=subscription.items.data.filter(x=>priceIds.has(x.price.id));
   if(matching.length!==1||subscription.items.data.length!==1)return reply(200,"Unknown price");
   const customer=typeof subscription.customer==="string"?subscription.customer:subscription.customer.id;
   const periodEnd=matching[0].current_period_end || 0;
   // A protected Supabase SQL function handles atomic event dedupe + account update.
   const {error}=await db.rpc("rut_iq_apply_stripe_event",{
      p_event_id:event.id,p_subscription_id:subscription.id,p_customer_id:customer,
      p_user_id:uid,p_price_id:matching[0].price.id,p_status:subscription.status,
      p_period_end:periodEnd?new Date(periodEnd*1000).toISOString():null
   });
   if(error){console.error("Billing event save failed",{code:error.code});return reply(503,"Retry later")}
   return reply(200,"Processed");
 }catch(error){console.error("Stripe subscription read failed");return reply(503,"Retry later")}
});
