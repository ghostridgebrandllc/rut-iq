/** Rut IQ LIVE checkout. Disabled unless explicitly enabled after launch approval. */
import {createClient} from "npm:@supabase/supabase-js@2";
const origin="https://rut-iq-preview.onrender.com";
const cors={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin","Cache-Control":"no-store"};
const respond=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json",...cors}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return respond(405,{error:"POST only"});
 if(req.headers.get("Origin")!==origin)return respond(403,{error:"Invalid origin"});
 if(Deno.env.get("RUT_IQ_LIVE_CHECKOUT_ENABLED")!=="true")return respond(503,{error:"Live checkout disabled"});
 const secret=Deno.env.get("STRIPE_RUT_IQ_LIVE_SECRET");
 if(!secret?.match(/^(sk_live_|rk_live_)/))return respond(503,{error:"Live billing not configured"});
 const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 const url=Deno.env.get("SUPABASE_URL"),admin=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!jwt||!url||!admin)return respond(401,{error:"Sign in required"});
 const db=createClient(url,admin,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await db.auth.getUser(jwt);
 if(error||!user?.email)return respond(401,{error:"Invalid login"});
 let plan:string;
 try{const body=await req.json();plan=body.plan;if(!["monthly","annual"].includes(plan)||Object.keys(body).length!==1)throw Error();}catch{return respond(400,{error:"Invalid plan"})}
 const {data:member,error:membershipError}=await db.from("rut_memberships").select("plan,status,current_period_end").eq("user_id",user.id).maybeSingle();
 if(membershipError)return respond(503,{error:"Membership unavailable"});
 if(member?.plan==="pro"&&member.status==="active"&&(!member.current_period_end||Date.parse(member.current_period_end)>Date.now()))return respond(409,{error:"Pro already active"});
 const price=plan==="monthly"?"price_1UQdln2MI0v3aLys9deDSpnr":"price_1UQdlq2MI0v3aLys8zznDb9u";
 const params=new URLSearchParams({mode:"subscription","line_items[0][price]":price,"line_items[0][quantity]":"1",success_url:origin+"/?checkout=return",cancel_url:origin+"/#plans",client_reference_id:user.id,customer_email:user.email,"metadata[app]":"rut_iq","subscription_data[metadata][app]":"rut_iq","subscription_data[metadata][rut_user_id]":user.id});
 try{
 const response=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:"Bearer "+secret,"Content-Type":"application/x-www-form-urlencoded"},body:params});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.livemode!==true||!data.url?.startsWith("https://checkout.stripe.com/"))return respond(502,{error:"Checkout unavailable"});
 return respond(200,{checkout_url:data.url});
 }catch{return respond(503,{error:"Stripe unavailable"})}
});