/** Rut IQ isolated Stripe sandbox webhook; not active until deployed with secrets. */
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18";
const reply=(status:number,text:string)=>new Response(text,{status,headers:{"Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method!=="POST")return reply(405,"POST required");
 const key=Deno.env.get("STRIPE_RUT_IQ_TEST_SECRET");
 const webhookSecret=Deno.env.get("STRIPE_RUT_IQ_WEBHOOK_SECRET");
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!key?.startsWith("sk_test_")||!webhookSecret?.startsWith("whsec_")||!url||!service)return reply(503,"Not configured");
 const sig=req.headers.get("stripe-signature");if(!sig)return reply(400,"Missing signature");
 const stripe=new Stripe(key);
 let event:Stripe.Event;
 try{event=await stripe.webhooks.constructEventAsync(await req.text(),sig,webhookSecret)}
 catch{return reply(400,"Invalid signature")}
 if(event.livemode)return reply(400,"Live event rejected");
 if(!["checkout.session.completed","customer.subscription.updated","customer.subscription.deleted","invoice.paid","invoice.payment_failed"].includes(event.type))return reply(200,"Ignored");
 // No entitlements are written until the subscription/customer reconciliation is fully verified.
 // This endpoint is deliberately fail-closed rather than granting access on a redirect.
 return reply(503,"Sandbox billing reconciliation not enabled");
});
