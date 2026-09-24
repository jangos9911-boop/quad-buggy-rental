const COOKIE = "qbr_session";
const SESSION_DAYS = 7;

function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"content-type":"application/json; charset=utf-8", ...headers}
  });
}
function corsHeaders() {
  return {"cache-control":"no-store"};
}
function b64(bytes) {
  let s=""; for (const b of new Uint8Array(bytes)) s+=String.fromCharCode(b);
  return btoa(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
function unb64(s) {
  s=s.replaceAll("-","+").replaceAll("_","/");
  while(s.length%4)s+="=";
  const bin=atob(s), out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}
async function sha256(text) {
  return b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
async function hmac(text, secret) {
  return b64(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]
  ), new TextEncoder().encode(text)));
}
async function passwordHash(password, salt) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(salt),iterations:120000,hash:"SHA-256"},key,256);
  return b64(bits);
}
async function verifyPassword(password, salt, hash) { return (await passwordHash(password,salt))===hash; }
function cookies(req) {
  return Object.fromEntries((req.headers.get("cookie")||"").split(";").filter(Boolean).map(x=>{const i=x.indexOf("=");return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}));
}
async function auth(req, env) {
  if(!env.DB || !env.AUTH_SECRET) return null;
  const token=cookies(req)[COOKIE]; if(!token) return null;
  const [body,sig]=token.split(".");
  if(!body||!sig||sig!==(await hmac(body,env.AUTH_SECRET))) return null;
  let p; try { p=JSON.parse(new TextDecoder().decode(unb64(body))); } catch { return null; }
  if(!p.exp||p.exp<Date.now()) return null;
  const u=await env.DB.prepare("SELECT id,email,name,role,active FROM users WHERE id=?").bind(p.uid).first();
  return u&&u.active ? u : null;
}
async function requireAuth(req,env) {
  const u=await auth(req,env); if(!u) throw new Response(JSON.stringify({error:"unauthenticated"}),{status:401,headers:{"content-type":"application/json"}});
  return u;
}
async function sessionCookie(user, env) {
  const body=b64(new TextEncoder().encode(JSON.stringify({uid:user.id,exp:Date.now()+SESSION_DAYS*86400000})));
  const sig=await hmac(body,env.AUTH_SECRET);
  return `${COOKIE}=${body}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS*86400}`;
}
function clearCookie(){return COOKIE+"=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";}
function clean(o){return o&&typeof o==="object"?Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined)):{};}

async function api(req, env) {
  if(!env.DB) return json({error:"D1 is not configured. Create a D1 database and bind it as DB."},503,corsHeaders());
  const url=new URL(req.url), path=url.pathname, method=req.method;
  if(path==="/api/health") return json({ok:true,database:true,app:"quad-buggy-rental"});
  if(path==="/api/setup" && method==="POST"){
    const body=await req.json().catch(()=>({}));
    if(!env.SETUP_TOKEN || body.setupToken!==env.SETUP_TOKEN) return json({error:"Invalid setup token"},403);
    if(!body.email||!body.password||body.password.length<10) return json({error:"Email and password (10+ chars) required"},400);
    const existing=await env.DB.prepare("SELECT id FROM users LIMIT 1").first();
    if(existing) return json({error:"Setup is already completed"},409);
    const salt=crypto.randomUUID(), hash=await passwordHash(body.password,salt);
    const r=await env.DB.prepare("INSERT INTO users(email,name,role,active,password_hash,password_salt) VALUES(?,?, 'admin',1,?,?)")
      .bind(body.email.toLowerCase().trim(),body.name||"Administrator",hash,salt).run();
    const user={id:r.meta.last_row_id,email:body.email.toLowerCase().trim(),name:body.name||"Administrator",role:"admin",active:1};
    return json({ok:true,user},201,{"set-cookie":await sessionCookie(user,env)});
  }
  if(path==="/api/login" && method==="POST"){
    const b=await req.json().catch(()=>({})), u=await env.DB.prepare("SELECT * FROM users WHERE lower(email)=lower(?) AND active=1").bind(b.email||"").first();
    if(!u||!b.password||!(await verifyPassword(b.password,u.password_salt,u.password_hash))) return json({error:"Invalid email or password"},401);
    const user={id:u.id,email:u.email,name:u.name,role:u.role,active:u.active};
    return json({ok:true,user},200,{"set-cookie":await sessionCookie(user,env)});
  }
  if(path==="/api/logout" && method==="POST") return json({ok:true},200,{"set-cookie":clearCookie()});
  if(path==="/api/me" && method==="GET") {
    const u=await auth(req,env); return u?json({authenticated:true,user:u}):json({authenticated:false},401);
  }
  let user; try { user=await requireAuth(req,env); } catch(e) { return e; }

  if(path==="/api/dashboard" && method==="GET"){
    const [rev,exp,out,vat,count,recent]=await Promise.all([
      env.DB.prepare("SELECT COALESCE(SUM(total),0) value FROM rentals WHERE status!='cancelled'").first(),
      env.DB.prepare("SELECT COALESCE(SUM(amount),0) value FROM expenses").first(),
      env.DB.prepare("SELECT COALESCE(SUM(total),0) value FROM rentals WHERE payment_status!='paid' AND status!='cancelled'").first(),
      env.DB.prepare("SELECT COALESCE(SUM(vat_amount),0) value FROM rentals WHERE status!='cancelled'").first(),
      env.DB.prepare("SELECT COUNT(*) value FROM rentals").first(),
      env.DB.prepare("SELECT r.*,c.name customer_name,v.name vehicle_name FROM rentals r LEFT JOIN customers c ON c.id=r.customer_id LEFT JOIN vehicles v ON v.id=r.vehicle_id ORDER BY r.id DESC LIMIT 10").all()
    ]);
    return json({revenue:Number(rev.value),expenses:Number(exp.value),net:Number(rev.value)-Number(exp.value),outstanding:Number(out.value),vat:Number(vat.value),bookingCount:Number(count.value),recent:recent.results});
  }

  const routes={
    "/api/vehicles":["vehicles","name,category,registration,status,rate_per_hour,notes"],
    "/api/customers":["customers","name,phone,email,nationality,id_reference,notes"],
    "/api/services":["services","name,category,price,vat_rate,active"],
    "/api/expenses":["expenses","expense_date,category,description,amount,vat_amount,payment_method,vehicle_id,notes"],
    "/api/maintenance":["maintenance","vehicle_id,maintenance_date,type,description,cost,status,next_due_date,notes"],
    "/api/rentals":["rentals","invoice_no,customer_id,vehicle_id,service_id,start_at,end_at,quantity,unit_price,subtotal,discount,vat_rate,vat_amount,total,deposit,payment_status,status,notes"]
  };
  const route=routes[path];
  if(route && method==="GET"){
    const rows=await env.DB.prepare(`SELECT * FROM ${route[0]} ORDER BY id DESC LIMIT 1000`).all();
    return json(rows.results);
  }
  if(route && method==="POST"){
    const b=clean(await req.json().catch(()=>({}))), table=route[0];
    if(table==="rentals"){
      const qty=Number(b.quantity||1), unit=Number(b.unit_price||0), discount=Number(b.discount||0), vat=Number(b.vat_rate??5);
      const taxable=Math.max(0,qty*unit-discount), vatAmount=taxable*vat/100, total=taxable+vatAmount;
      b.invoice_no=b.invoice_no||"RNT-"+Date.now(); b.subtotal=qty*unit; b.vat_amount=vatAmount; b.total=total;
      b.created_by=user.id;
    }
    if(table==="expenses") b.created_by=user.id;
    const cols=Object.keys(b), qs=cols.map(()=>"?").join(",");
    const result=await env.DB.prepare(`INSERT INTO ${table}(${cols.join(",")}) VALUES(${qs})`).bind(...cols.map(k=>b[k])).run();
    return json({ok:true,id:result.meta.last_row_id},201);
  }
  if(path.startsWith("/api/") && method==="DELETE"){
    const m=path.match(/^\/api\/(vehicles|customers|services|expenses|maintenance|rentals)\/(\d+)$/);
    if(m){await env.DB.prepare(`DELETE FROM ${m[1]} WHERE id=?`).bind(Number(m[2])).run();return json({ok:true});}
  }
  return json({error:"Not found"},404);
}

export default {
  async fetch(req,env,ctx) {
    const url=new URL(req.url);
    if(url.pathname.startsWith("/api/")) return api(req,env);
    return env.ASSETS.fetch(req);
  }
};
