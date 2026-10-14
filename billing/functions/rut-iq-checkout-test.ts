/**
 * Rut IQ sandbox-only hosted Checkout creator.
 * Never enable live Stripe credentials in this endpoint.
 * Deployment needs a separate STRIPE_RUT_IQ_TEST_SECRET environment secret.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
const CORS = {
 "Access-Control-Allow-Origin": "https://rut-iq-field-talk-beta.onrender.com",
 "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods": "POST,OPTIONS",
 "Vary": "Origin",
};
const respond=(status:number, payload:unknown)=>new Response(JSON.stringify(payload),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...CORS}
});
const prices:{[k:string]:string}={
 monthly:"price_1UOXLFRqpCnvGztzHmMXcHnE",
 annual:"price_1UOXLJRqpCnvGztzJhbRVsDs",
};
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
 if(req.method!=="POST")return respond(405,{error:"Method not allowed"});
 const origin=req.headers.get("Origin");
 if(origin && origin!=="https://rut-iq-field-talk-beta.onrender.com")return respond(403,{error:"Invalid origin"});
 const secret=Deno.env.get("STRIPE_RUT_IQ_TEST_SECRET");
 const url=Deno.env.get("SUPABASE_URL"),admin=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!secret||!url||!admin)return respond(503,{error:"Test checkout not configured"});
 // No live key must ever be accepted here.
 if(!secret.startsWith("sk_test_"))return respond(503,{error:"Sandbox key required"});
 const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!jwt)return respond(401,{error:"Sign in required"});
 const supabase=createClient(url,admin,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await supabase.auth.getUser(jwt);
 if(authError||!user?.email)return respond(401,{error:"Invalid session"});
 let selected:string;
 try {
   const body=await req.json();selected=body.plan;
   if(!Object.hasOwn(prices,selected)||Object.keys(body).some(k=>k!=="plan"))throw Error();
 }catch{return respond(400,{error:"Choose monthly or annual"})}
 const {data:member,error:memberError}=await supabase.from("rut_memberships")
  .select("plan,source,status,current_period_end").eq("user_id",user.id).maybeSingle();
 if(memberError)return respond(503,{error:"Membership validation unavailable"});
 if(member?.plan==="pro"&&member?.status==="active" &&
  (!member.current_period_end || Date.parse(member.current_period_end)>Date.now())){
    return respond(409,{error:"Pro is already active on this account"});
 }
 const body=new URLSearchParams({
  mode:"subscription",
  "line_items[0][price]":prices[selected],
  "line_items[0][quantity]":"1",
  success_url:"https://rut-iq-field-talk-beta.onrender.com/?checkout=return",
  cancel_url:"https://rut-iq-field-talk-beta.onrender.com/#plans",
  client_reference_id:user.id,
  customer_email:user.email,
  "metadata[app]":"rut_iq",
  "metadata[rut_user_id]":user.id,
  "subscription_data[metadata][app]":"rut_iq",
  "subscription_data[metadata][rut_user_id]":user.id,
 });
 try {
  const response=await fetch("https://api.stripe.com/v1/checkout/sessions",{
   method:"POST",headers:{
    Authorization:"Bearer "+secret,
    "Content-Type":"application/x-www-form-urlencoded",
    "Idempotency-Key":"rut-iq-checkout-"+user.id+"-"+selected+"-"+Math.floor(Date.now()/120000),
   },body
  });
  const result=await response.json();
  if(!response.ok||result.livemode!==false||!result.url||!result.url.startsWith("https://checkout.stripe.com/")){
   return respond(502,{error:"Test checkout unavailable"});
  }
  return respond(200,{checkout_url:result.url});
 }catch{return respond(503,{error:"Checkout provider unavailable"})}
});
