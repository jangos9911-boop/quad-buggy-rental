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

const APP_HTML="<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"#10130f\"><title>Quad & Buggy UAE Rental Desk</title><style>*{box-sizing:border-box}body{margin:0;background:#0b0e0a;color:#eef2e9;font:14px system-ui,-apple-system,Segoe UI,sans-serif}.app{display:flex;min-height:100vh}.side{width:220px;background:#11150f;border-right:1px solid #252c22;padding:20px}.brand{font-weight:800;font-size:17px;margin-bottom:25px}.brand i{color:#b8ef4a;font-style:normal}.nav button,.btn{display:block;width:100%;border:1px solid #30382c;background:#161c13;color:#e9efe4;padding:10px 12px;border-radius:8px;margin:6px 0;text-align:left}.nav button.active,.btn.primary{background:#b8ef4a;color:#11150d;border-color:#b8ef4a;font-weight:700}.main{flex:1;padding:25px;max-width:1400px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center}.muted{color:#8f9989}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card{background:#121710;border:1px solid #252c22;border-radius:12px;padding:17px}.metric{font-size:25px;font-weight:800;margin-top:7px}.accent{color:#b8ef4a}.section{margin-top:22px}.tablebox{overflow:auto;border:1px solid #252c22;border-radius:10px}.table{width:100%;border-collapse:collapse;min-width:650px}.table th,.table td{padding:11px;border-bottom:1px solid #232a21;text-align:left}.table th{color:#8f9989;font-size:11px;text-transform:uppercase}.modal{position:fixed;inset:0;background:#000a;display:flex;align-items:center;justify-content:center;padding:20px}.modalbox{background:#11150f;border:1px solid #30382c;border-radius:13px;padding:20px;width:min(620px,100%);max-height:90vh;overflow:auto}.form{display:grid;grid-template-columns:1fr 1fr;gap:11px}.field{display:grid;gap:5px}.field.full{grid-column:1/-1}.field label{font-size:12px;color:#9da698}.field input{background:#0b0e0a;color:#eef2e9;border:1px solid #30382c;border-radius:7px;padding:10px}.actions{display:flex;gap:8px;flex-wrap:wrap}.empty{padding:30px;text-align:center;color:#818a7b}.mobile{display:none}@media(max-width:850px){.side{display:none}.mobile{display:flex;gap:6px;overflow:auto;margin-bottom:18px}.grid{grid-template-columns:1fr 1fr}.main{padding:16px}}@media(max-width:550px){.grid,.form{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}}</style></head><body><div id=\"app\"></div><script>(function(){\n\"use strict\";\nconst KEY=\"quad_rental_standalone_v2\";\nlet S=JSON.parse(localStorage.getItem(KEY)||\"null\")||{vehicles:[],customers:[],services:[],rentals:[],expenses:[],maintenance:[]};\nlet tab=\"Overview\",modal=\"\",mode=\"local\",user=null;\nconst $=id=>document.getElementById(id);\nconst money=n=>\"AED \"+Number(n||0).toLocaleString(\"en-AE\",{minimumFractionDigits:2,maximumFractionDigits:2});\nconst save=()=>localStorage.setItem(KEY,JSON.stringify(S));\nasync function api(path,opt={}){const r=await fetch(path,{credentials:\"include\",headers:{\"content-type\":\"application/json\",...(opt.headers||{})},...opt});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||\"Request failed\");return r.json()}\nasync function boot(){\n  try{const h=await api(\"/api/health\");if(h.ok){mode=\"api\";try{const m=await api(\"/api/me\");user=m.user}catch{} if(!user){modal=\"login\";render();return} await refreshApi();}}\n  catch(e){mode=\"local\"}\n  render();\n}\nasync function refreshApi(){\n  const [v,c,s,r,e,m]=await Promise.all([\"vehicles\",\"customers\",\"services\",\"rentals\",\"expenses\",\"maintenance\"].map(k=>api(\"/api/\"+k).catch(()=>[])));\n  S={vehicles:v,customers:c,services:s,rentals:r,expenses:e,maintenance:m};save();\n}\nfunction nav(){return [\"Overview\",\"Bookings\",\"Vehicles\",\"Customers\",\"Services\",\"Expenses\",\"Maintenance\",\"Reports\"].map(x=>'<button class=\"'+(tab==x?\"active\":\"\")+'\" onclick=\"go(\\''+x+'\\')\">'+x+\"</button>\").join(\"\")}\nfunction shell(x){return '<div class=\"app\"><aside class=\"side\"><div class=\"brand\">QUAD <i>RENTAL</i><br>UAE DESK</div><div class=\"nav\">'+nav()+'</div><div class=\"muted\" style=\"margin-top:20px\">'+(mode===\"api\"?\"● Cloud database\":\"● Offline demo\")+(user?\"<br>\"+user.email:\"\")+\"</div></aside><main class=\"main\"><div class=\"mobile\">'+nav()+'</div>'+x+'</main>'+(modal?modalHtml():\"\")+\"</div>\"}\nfunction header(a,b,c){return '<div class=\"top\"><div><h1>'+a+'</h1><div class=\"muted\">'+b+\"</div></div>\"+(c||\"\")+\"</div>\"}\nfunction table(rows,cols){if(!rows.length)return '<div class=\"card empty\">No records yet.</div>';return '<div class=\"tablebox\"><table class=\"table\"><thead><tr>'+cols.map(c=>\"<th>\"+c+\"</th>\").join(\"\")+\"</tr></thead><tbody>\"+rows.slice().reverse().map(r=>\"<tr>\"+cols.map(c=>\"<td>\"+(r[c]??\"\")+\"</td>\").join(\"\")+\"</tr>\").join(\"\")+\"</tbody></table></div>\"}\nfunction overview(){const rev=S.rentals.reduce((a,x)=>a+Number(x.total||0),0),ex=S.expenses.reduce((a,x)=>a+Number(x.amount||0),0),out=S.rentals.filter(x=>x.payment_status!==\"paid\"&&x.paymentStatus!==\"paid\").reduce((a,x)=>a+Number(x.total||0),0);return header(\"Overview\",\"Rental operations and cashflow.\",'<button class=\"btn primary\" style=\"width:auto\" onclick=\"openm(\\'booking\\')\">+ New booking</button>')+'<div class=\"grid\"><div class=\"card\">Revenue<div class=\"metric accent\">'+money(rev)+'</div></div><div class=\"card\">Expenses<div class=\"metric\">'+money(ex)+'</div></div><div class=\"card\">Net result<div class=\"metric accent\">'+money(rev-ex)+'</div></div><div class=\"card\">Outstanding<div class=\"metric\">'+money(out)+'</div></div></div><div class=\"section\"><h2>Recent bookings</h2>'+table(S.rentals.slice(-10),[\"invoice_no\",\"customer_name\",\"vehicle_name\",\"total\",\"payment_status\"])+\"</div>\"}\nfunction listing(k,title,desc,cols,formKey){return header(title,desc,'<button class=\"btn primary\" style=\"width:auto\" onclick=\"openm(\\''+formKey+'\\')\">+ Add</button>')+'<div class=\"section\">'+table(S[k],cols)+\"</div>\"}\nfunction reports(){return header(\"Reports\",\"Export business data and create backups.\")+'<div class=\"card\"><h3>Exports</h3><div class=\"actions\">'+[\"rentals\",\"expenses\",\"vehicles\",\"customers\",\"services\",\"maintenance\"].map(k=>'<button class=\"btn\" style=\"width:auto\" onclick=\"csv(\\''+k+'\\')\">'+k+' CSV</button>').join(\"\")+'<button class=\"btn primary\" style=\"width:auto\" onclick=\"backup()\">Full JSON backup</button></div></div><div class=\"section card\">'+(mode===\"api\"?\"Connected to the production API.\":\"This browser is using offline demo storage until D1/authentication is configured.\")+\"</div>\"}\nfunction form(fields){return '<div class=\"form\">'+fields.map(f=>'<div class=\"field '+(f[0]==\"description\"?\"full\":\"\")+'\"><label>'+f[1]+'</label><input id=\"f_'+f[0]+'\" type=\"'+(f[2]||\"text\")+'\" value=\"'+(f[3]||\"\")+'\"></div>').join(\"\")+\"</div>\"}\nfunction modalHtml(){let title=\"\",body=\"\";\nif(modal===\"login\")return '<div class=\"modal\"><div class=\"modalbox\"><h2>Staff login</h2>'+form([[\"email\",\"Email\"],[\"password\",\"Password\",\"password\"]])+'<div class=\"actions\" style=\"margin-top:16px\"><button class=\"btn primary\" style=\"width:auto\" onclick=\"login()\">Sign in</button></div></div></div>';\nif(modal===\"booking\"){title=\"New booking\";body=form([[\"customer_id\",\"Customer ID\",\"number\"],[\"vehicle_id\",\"Vehicle ID\",\"number\"],[\"service_id\",\"Service ID\",\"number\"],[\"quantity\",\"Hours / quantity\",\"number\",\"1\"],[\"unit_price\",\"Unit price AED\",\"number\",\"0\"],[\"discount\",\"Discount AED\",\"number\",\"0\"],[\"vat_rate\",\"VAT %\",\"number\",\"5\"],[\"deposit\",\"Deposit AED\",\"number\",\"0\"],[\"payment_status\",\"Payment status\",\"text\",\"unpaid\"],[\"start_at\",\"Start\",\"datetime-local\"],[\"end_at\",\"End\",\"datetime-local\"],[\"notes\",\"Notes\"]])}\nelse if(modal===\"vehicles\"){title=\"Add vehicle\";body=form([[\"name\",\"Vehicle name\"],[\"category\",\"Category\",\"text\",\"Quad\"],[\"registration\",\"Registration\"],[\"rate_per_hour\",\"Hourly rate AED\",\"number\"],[\"status\",\"Status\",\"text\",\"available\"],[\"notes\",\"Notes\"]])}\nelse if(modal===\"customers\"){title=\"Add customer\";body=form([[\"name\",\"Name\"],[\"phone\",\"Phone\"],[\"email\",\"Email\"],[\"nationality\",\"Nationality\"],[\"id_reference\",\"ID / passport reference\"],[\"notes\",\"Notes\"]])}\nelse if(modal===\"services\"){title=\"Add service\";body=form([[\"name\",\"Service name\"],[\"category\",\"Category\",\"text\",\"Other\"],[\"price\",\"Price AED\",\"number\"],[\"vat_rate\",\"VAT %\",\"number\",\"5\"]])}\nelse if(modal===\"maintenance\"){title=\"Add maintenance\";body=form([[\"vehicle_id\",\"Vehicle ID\",\"number\"],[\"maintenance_date\",\"Date\",\"date\"],[\"type\",\"Type\"],[\"description\",\"Description\"],[\"cost\",\"Cost AED\",\"number\"],[\"status\",\"Status\",\"text\",\"open\"],[\"next_due_date\",\"Next due\",\"date\"],[\"notes\",\"Notes\"]])}\nelse{title=\"Add expense\";body=form([[\"expense_date\",\"Date\",\"date\"],[\"category\",\"Category\"],[\"description\",\"Description\"],[\"amount\",\"Amount AED\",\"number\"],[\"vat_amount\",\"VAT amount AED\",\"number\"],[\"payment_method\",\"Payment method\"]])}\nreturn '<div class=\"modal\"><div class=\"modalbox\"><div class=\"top\"><b>'+title+'</b><button class=\"btn\" style=\"width:auto\" onclick=\"closem()\">×</button></div>'+body+'<div class=\"actions\" style=\"margin-top:16px\"><button class=\"btn\" style=\"width:auto\" onclick=\"closem()\">Cancel</button><button class=\"btn primary\" style=\"width:auto\" onclick=\"submit()\">Save</button></div></div></div>'}\nconst val=x=>$(\"f_\"+x)?.value||\"\";\nwindow.go=async x=>{tab=x;modal=\"\";if(mode===\"api\")await refreshApi();render()};\nwindow.openm=x=>{modal=x;render()};window.closem=()=>{modal=\"\";render()};\nwindow.login=async()=>{try{const r=await api(\"/api/login\",{method:\"POST\",body:JSON.stringify({email:val(\"email\"),password:val(\"password\")})});user=r.user;modal=\"\";await refreshApi();render()}catch(e){alert(e.message)}};\nwindow.submit=async()=>{\n const map={vehicles:\"vehicles\",customers:\"customers\",services:\"services\",maintenance:\"maintenance\",expense:\"expenses\",booking:\"rentals\"};\n const t=map[modal];let b={};\n document.querySelectorAll(\".modalbox input\").forEach(i=>{if(i.id.startsWith(\"f_\"))b[i.id.slice(2)]=i.value});\n for(const k of Object.keys(b))if([\"quantity\",\"unit_price\",\"discount\",\"vat_rate\",\"deposit\",\"rate_per_hour\",\"price\",\"amount\",\"vat_amount\",\"cost\",\"customer_id\",\"vehicle_id\",\"service_id\"].includes(k))b[k]=Number(b[k]||0);\n if(modal===\"booking\"){b.status=\"completed\";b.payment_status=b.payment_status||\"unpaid\";b.invoice_no=\"RNT-\"+Date.now()}\n if(mode===\"api\"){try{await api(\"/api/\"+t,{method:\"POST\",body:JSON.stringify(b)});await refreshApi()}catch(e){alert(e.message);return}}\n else {const localKey=modal===\"booking\"?\"rentals\":t;b.id=Date.now();if(modal===\"booking\"){const q=b.quantity||1,u=b.unit_price||0,d=b.discount||0,v=b.vat_rate||5;const taxable=Math.max(0,q*u-d);b.subtotal=q*u;b.vat_amount=taxable*v/100;b.total=taxable+b.vat_amount}S[localKey].push(b);save()}\n modal=\"\";render();\n};\nwindow.csv=k=>{const rows=S[k];if(!rows?.length)return alert(\"No data.\");const keys=Object.keys(rows[0]),txt=keys.join(\",\")+\"\\n\"+rows.map(r=>keys.map(x=>'\"'+String(r[x]??\"\").replace(/\"/g,'\"\"')+'\"').join(\",\")).join(\"\\n\"),a=document.createElement(\"a\");a.href=URL.createObjectURL(new Blob([txt],{type:\"text/csv\"}));a.download=k+\".csv\";a.click()};\nwindow.backup=()=>{const a=document.createElement(\"a\");a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:\"application/json\"}));a.download=\"quad-rental-backup.json\";a.click()};\nfunction render(){let c=tab===\"Overview\"?overview():tab===\"Bookings\"?listing(\"rentals\",\"Bookings\",\"Rental invoices and payments.\",[\"invoice_no\",\"customer_name\",\"vehicle_name\",\"total\",\"payment_status\"],\"booking\"):tab===\"Vehicles\"?listing(\"vehicles\",\"Vehicles\",\"Quad and buggy fleet.\",[\"id\",\"name\",\"category\",\"rate_per_hour\",\"status\"],\"vehicles\"):tab===\"Customers\"?listing(\"customers\",\"Customers\",\"Customer records.\",[\"id\",\"name\",\"phone\",\"nationality\",\"email\"],\"customers\"):tab===\"Services\"?listing(\"services\",\"Services\",\"Rental and other services.\",[\"id\",\"name\",\"category\",\"price\",\"vat_rate\",\"active\"],\"services\"):tab===\"Expenses\"?listing(\"expenses\",\"Expenses\",\"Operating costs.\",[\"id\",\"expense_date\",\"category\",\"description\",\"amount\",\"payment_method\"],\"expense\"):tab===\"Maintenance\"?listing(\"maintenance\",\"Maintenance\",\"Vehicle service and maintenance history.\",[\"id\",\"vehicle_id\",\"maintenance_date\",\"type\",\"cost\",\"status\",\"next_due_date\"],\"maintenance\"):reports();document.getElementById(\"app\").innerHTML=shell(c)}\nboot();\n})();</script></body></html>";

export default {
  async fetch(req,env,ctx) {
    const url=new URL(req.url);
    if(url.pathname.startsWith("/api/")) return api(req,env);
    return new Response(APP_HTML,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
  }
};
