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
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(salt),iterations:100000,hash:"SHA-256"},key,256);
  return b64(bits);
}
async function verifyPassword(password, salt, hash) { const got=await passwordHash(password,salt); return got===hash || got+"="===hash; }
function cookies(req) {
  return Object.fromEntries((req.headers.get("cookie")||"").split(";").filter(Boolean).map(x=>{const i=x.indexOf("=");return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}));
}
async function auth(req, env) {
  if(!env.DB) return null;
  const token=cookies(req)[COOKIE]; if(!token) return null;
  const row=await env.DB.prepare("SELECT u.id,u.username,u.email,u.name,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.active=1").bind(token,Date.now()).first().catch(()=>null);
  return row||null;
}
async function sessionCookie(user, env) {
  const token=crypto.randomUUID()+"-"+crypto.randomUUID();
  const exp=Date.now()+SESSION_DAYS*86400000;
  await env.DB.prepare("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)").bind(token,user.id,exp).run();
  return COOKIE+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+(SESSION_DAYS*86400);
}
function clearCookie(){return COOKIE+"=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";}
function clean(o){return o&&typeof o==="object"?Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined)):{};}

async function api(req, env) {
  if(!env.DB) return json({error:"D1 is not configured. Create a D1 database and bind it as DB."},503,corsHeaders());
  const url=new URL(req.url), path=url.pathname, method=req.method;
  if(path==="/api/health") return json({ok:true,database:true,app:"quad-buggy-rental"});
  if(path==="/api/setup" && method==="GET"){
    const existing=await env.DB.prepare("SELECT id FROM users LIMIT 1").first();
    return json({needsSetup:!existing});
  }
  if(path==="/api/setup" && method==="POST"){
    const body=await req.json().catch(()=>({}));
    const existing=await env.DB.prepare("SELECT id FROM users LIMIT 1").first();
    if(existing){
      if(body.setupToken && env.SETUP_TOKEN && body.setupToken===env.SETUP_TOKEN){
        if(!body.username||!body.password) return json({error:"Username and new password required"},400);
        const target=await env.DB.prepare("SELECT * FROM users WHERE lower(username)=lower(?) AND active=1").bind(String(body.username).trim()).first();
        if(!target) return json({error:"Admin username not found"},404);
        const salt=crypto.randomUUID(), hash=await passwordHash(String(body.password),salt);
        await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=? WHERE id=?").bind(hash,salt,target.id).run();
        const user={id:target.id,username:target.username,name:target.name,role:target.role,active:target.active};
        return json({ok:true,user,migrated:true},200,{"set-cookie":await sessionCookie(user,env)});
      }
      return json({error:"Setup is already completed"},409);
    }
    if(!body.username||!body.password||body.password.length<10) return json({error:"Username and password (10+ chars) required"},400);
    const salt=crypto.randomUUID(), hash=await passwordHash(body.password,salt);
    const username=body.username.trim();
    const r=await env.DB.prepare("INSERT INTO users(username,email,name,role,active,password_hash,password_salt) VALUES(?,?,?, 'admin',1,?,?)")
      .bind(username,username+"@local.invalid",body.name||"Administrator",hash,salt).run();
    const user={id:r.meta.last_row_id,username,name:body.name||"Administrator",role:"admin",active:1};
    return json({ok:true,user},201,{"set-cookie":await sessionCookie(user,env)});
  }
  if(path==="/api/login" && method==="POST"){
    try {
      const b=await req.json().catch(()=>({}));
      const u=await env.DB.prepare("SELECT * FROM users WHERE lower(username)=lower(?) AND active=1").bind(String(b.username||"").trim()).first();
      if(!u||!b.password||!(await verifyPassword(b.password,u.password_salt,u.password_hash))) return json({error:"Invalid username or password"},401);
      const user={id:u.id,username:u.username,name:u.name,role:u.role,active:u.active};
      return json({ok:true,user},200,{"set-cookie":await sessionCookie(user,env)});
    } catch(e) {
      return json({error:"Login failed: "+String(e?.message||e)},500);
    }
  }
  if(path==="/api/logout" && method==="POST"){
    const token=cookies(req)[COOKIE]; if(token) await env.DB.prepare("DELETE FROM sessions WHERE token=?").bind(token).run().catch(()=>{});
    return json({ok:true},200,{"set-cookie":clearCookie()});
  }
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

const APP_HTML="<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Quad & Buggy Rental UAE</title><style>\n*{box-sizing:border-box}body{margin:0;background:#0b0e0a;color:#eef2e9;font:14px system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif}.app{display:flex;min-height:100vh}.side{width:225px;background:#11150f;border-right:1px solid #252c22;padding:20px;flex:none}.brand{font-weight:800;font-size:18px;margin-bottom:28px}.brand b{color:#b8ef4a}.brand small{display:block;color:#899283;font-size:10px;margin-top:4px}.nav button,.btn{display:block;width:100%;border:1px solid #30382c;background:#161c13;color:#e9efe4;padding:10px 12px;border-radius:8px;margin:6px 0;text-align:left}.nav button.active,.btn.primary{background:#b8ef4a;color:#11150d;border-color:#b8ef4a;font-weight:700}.main{flex:1;padding:25px;max-width:1400px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center}.muted{color:#8f9989}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card{background:#121710;border:1px solid #252c22;border-radius:12px;padding:17px}.metric{font-size:25px;font-weight:800;margin-top:7px}.accent{color:#b8ef4a}section{margin-top:24px}.tablebox{overflow:auto;border:1px solid #252c22;border-radius:10px}.tablebox table{width:100%;border-collapse:collapse;min-width:650px}.tablebox th,.tablebox td{padding:11px;border-bottom:1px solid #232a21;text-align:left}.tablebox th{color:#8f9989;font-size:11px;text-transform:uppercase}.modal{position:fixed;inset:0;background:#000b;display:flex;align-items:center;justify-content:center;padding:20px}.modalbox{background:#11150f;border:1px solid #30382c;border-radius:13px;padding:20px;width:min(620px,100%);max-height:90vh;overflow:auto}.form{display:grid;grid-template-columns:1fr 1fr;gap:11px}.field{display:grid;gap:5px}.field.full{grid-column:1/-1}.field label{font-size:12px;color:#9da698}.field input{background:#0b0e0a;color:#eef2e9;border:1px solid #30382c;border-radius:7px;padding:10px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.empty{padding:30px;text-align:center;color:#818a7b}.mobile{display:none}@media(max-width:850px){.side{display:none}.mobile{display:flex;gap:6px;overflow:auto;margin-bottom:18px}.mobile button{min-width:max-content}.grid{grid-template-columns:1fr 1fr}.main{padding:16px}}@media(max-width:550px){.grid,.form{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}}\n</style></head><body><div id=\"app\"></div><script>(function(){\n\"use strict\";\nconst KEY=\"quad_rental_standalone_v3\";\nlet S=JSON.parse(localStorage.getItem(KEY)||\"null\")||{vehicles:[],customers:[],services:[],rentals:[],expenses:[],maintenance:[]};\nlet tab=\"Overview\", modal=\"\", mode=\"local\", user=null;\nconst $=id=>document.getElementById(id);\nconst money=n=>\"AED \"+Number(n||0).toLocaleString(\"en-AE\",{minimumFractionDigits:2,maximumFractionDigits:2});\nconst save=()=>localStorage.setItem(KEY,JSON.stringify(S));\nasync function api(path,opt={}){\n const r=await fetch(path,{credentials:\"include\",headers:{\"content-type\":\"application/json\",...(opt.headers||{})},...opt});\n if(!r.ok) throw new Error((await r.json().catch(()=>({}))).error||\"Request failed\");\n return r.json();\n}\nasync function boot(){\n try{\n  const h=await api(\"/api/health\");\n  if(h.ok){\n   mode=\"api\";\n   try{const m=await api(\"/api/me\");user=m.user;}catch(e){}\n   if(!user){modal=\"login\";render();return;}\n   await refreshApi();\n  }\n }catch(e){mode=\"local\";}\n render();\n}\nasync function refreshApi(){\n const keys=[\"vehicles\",\"customers\",\"services\",\"rentals\",\"expenses\",\"maintenance\"];\n const data=await Promise.all(keys.map(k=>api(\"/api/\"+k).catch(()=>[])));\n S=Object.fromEntries(keys.map((k,i)=>[k,data[i]])); save();\n}\nfunction nav(){\n return [\"Overview\",\"Bookings\",\"Vehicles\",\"Customers\",\"Services\",\"Expenses\",\"Maintenance\",\"Reports\"]\n .map(x=>'<button class=\"'+(tab===x?\"active\":\"\")+'\" onclick=\"go('+JSON.stringify(x)+')\">'+x+\"</button>\").join(\"\");\n}\nfunction shell(content){\n return `<div class=\"app\"><aside class=\"side\"><div class=\"brand\">QUAD <b>RENTAL</b><small>UAE DESK</small></div><div class=\"nav\">${nav()}</div><div class=\"muted\">${mode===\"api\"?\"● Cloud database\":\"● Offline mode\"}${user?\"<br>\"+user.email:\"\"}</div></aside><main class=\"main\"><div class=\"mobile\">${nav()}</div>${content}</main>${modal?modalHtml():\"\"}</div>`;\n}\nfunction header(title,desc,action=\"\"){return '<div class=\"top\"><div><h1>'+title+'</h1><p class=\"muted\">'+desc+\"</p></div>\"+action+\"</div>\";}\nfunction table(rows,cols){\n if(!rows.length)return '<div class=\"card empty\">No records yet.</div>';\n return '<div class=\"tablebox\"><table><thead><tr>'+cols.map(c=>\"<th>\"+c+\"</th>\").join(\"\")+\"</tr></thead><tbody>\"+\n rows.slice().reverse().map(r=>\"<tr>\"+cols.map(c=>\"<td>\"+(r[c]??\"\")+\"</td>\").join(\"\")+\"</tr>\").join(\"\")+\n \"</tbody></table></div>\";\n}\nfunction overview(){\n const rev=S.rentals.reduce((a,x)=>a+Number(x.total||0),0);\n const ex=S.expenses.reduce((a,x)=>a+Number(x.amount||0),0);\n const out=S.rentals.filter(x=>x.payment_status!==\"paid\").reduce((a,x)=>a+Number(x.total||0),0);\n return header(\"Overview\",\"Rental operations and cashflow.\",'<button class=\"btn primary\" onclick=\"openm(\\'booking\\')\">+ New booking</button>')+\n '<div class=\"grid\"><div class=\"card\">Revenue<div class=\"metric accent\">'+money(rev)+\"</div></div>\"+\n '<div class=\"card\">Expenses<div class=\"metric\">'+money(ex)+\"</div></div>\"+\n '<div class=\"card\">Net result<div class=\"metric accent\">'+money(rev-ex)+\"</div></div>\"+\n '<div class=\"card\">Outstanding<div class=\"metric\">'+money(out)+\"</div></div></div>\"+\n '<section><h2>Recent bookings</h2>'+table(S.rentals.slice(-10),[\"invoice_no\",\"customer_name\",\"vehicle_name\",\"total\",\"payment_status\"])+\"</section>\";\n}\nfunction listing(k,title,desc,cols,formKey){\n return header(title,desc,'<button class=\"btn primary\" onclick=\"openm('+JSON.stringify(formKey)+')\">+ Add</button>')+\n '<section>'+table(S[k],cols)+\"</section>\";\n}\nfunction reports(){\n return header(\"Reports\",\"Export your business data.\")+\n '<div class=\"card\"><h3>Exports</h3><div class=\"actions\">'+\n [\"rentals\",\"expenses\",\"vehicles\",\"customers\",\"services\",\"maintenance\"].map(k=>'<button class=\"btn\" onclick=\"csv('+JSON.stringify(k)+')\">'+k+\" CSV</button>\").join(\"\")+\n '<button class=\"btn primary\" onclick=\"backup()\">Full JSON backup</button></div></div>';\n}\nfunction form(fields){\n return '<div class=\"form\">'+fields.map(f=>'<div class=\"field '+(f[0]===\"notes\"||f[0]===\"description\"?\"full\":\"\")+'\"><label>'+f[1]+'</label><input id=\"f_'+f[0]+'\" type=\"'+(f[2]||\"text\")+'\" value=\"'+(f[3]||\"\")+'\"></div>').join(\"\")+\"</div>\";\n}\nfunction modalHtml(){\n if(modal===\"login\")return '<div class=\"modal\"><div class=\"modalbox\"><h2>Staff login</h2><p class=\"muted\">Production database connected.</p>'+form([[\"username\",\"Username\"],[\"password\",\"Password\",\"password\"]])+'<div class=\"actions\"><button class=\"btn primary\" onclick=\"login()\">Sign in</button><button class=\"btn\" onclick=\"openm('repair')\">Repair admin login</button></div></div></div>';\n if(modal===\"repair\")return '<div class=\"modal\"><div class=\"modalbox\"><h2>Repair admin login</h2><p class=\"muted\">Enter the SETUP_TOKEN from your Cloudflare Worker secret, then choose the password you want to use.</p>'+form([[\"username\",\"Username\",\"text\",\"admin\"],[\"password\",\"New password\",\"password\"],[\"setupToken\",\"SETUP_TOKEN\",\"password\"]])+'<div class=\"actions\"><button class=\"btn\" onclick=\"modal=\\'login\\';render()\">Back</button><button class=\"btn primary\" onclick=\"repair()\">Repair & sign in</button></div></div></div>';\n const defs={={\n booking:[\"New booking\",[[\"customer_id\",\"Customer ID\",\"number\"],[\"vehicle_id\",\"Vehicle ID\",\"number\"],[\"service_id\",\"Service ID\",\"number\"],[\"quantity\",\"Hours / quantity\",\"number\",\"1\"],[\"unit_price\",\"Unit price AED\",\"number\",\"0\"],[\"discount\",\"Discount AED\",\"number\",\"0\"],[\"vat_rate\",\"VAT %\",\"number\",\"5\"],[\"deposit\",\"Deposit AED\",\"number\",\"0\"],[\"payment_status\",\"Payment status\",\"text\",\"unpaid\"],[\"start_at\",\"Start\",\"datetime-local\"],[\"end_at\",\"End\",\"datetime-local\"],[\"notes\",\"Notes\"]]],\n vehicles:[\"Add vehicle\",[[\"name\",\"Vehicle name\"],[\"category\",\"Category\",\"text\",\"Quad\"],[\"registration\",\"Registration\"],[\"rate_per_hour\",\"Hourly rate AED\",\"number\"],[\"status\",\"Status\",\"text\",\"available\"],[\"notes\",\"Notes\"]]],\n customers:[\"Add customer\",[[\"name\",\"Name\"],[\"phone\",\"Phone\"],[\"email\",\"Email\"],[\"nationality\",\"Nationality\"],[\"id_reference\",\"ID / passport reference\"],[\"notes\",\"Notes\"]]],\n services:[\"Add service\",[[\"name\",\"Service name\"],[\"category\",\"Category\",\"text\",\"Other\"],[\"price\",\"Price AED\",\"number\"],[\"vat_rate\",\"VAT %\",\"number\",\"5\"]]],\n maintenance:[\"Add maintenance\",[[\"vehicle_id\",\"Vehicle ID\",\"number\"],[\"maintenance_date\",\"Date\",\"date\"],[\"type\",\"Type\"],[\"description\",\"Description\"],[\"cost\",\"Cost AED\",\"number\"],[\"status\",\"Status\",\"text\",\"open\"],[\"next_due_date\",\"Next due\",\"date\"],[\"notes\",\"Notes\"]]],\n expense:[\"Add expense\",[[\"expense_date\",\"Date\",\"date\"],[\"category\",\"Category\"],[\"description\",\"Description\"],[\"amount\",\"Amount AED\",\"number\"],[\"vat_amount\",\"VAT amount AED\",\"number\"],[\"payment_method\",\"Payment method\"]]]\n };\n const d=defs[modal]||defs.expense;\n return '<div class=\"modal\"><div class=\"modalbox\"><div class=\"top\"><h2>'+d[0]+'</h2><button class=\"btn close\" onclick=\"closem()\">×</button></div>'+form(d[1])+'<div class=\"actions\"><button class=\"btn\" onclick=\"closem()\">Cancel</button><button class=\"btn primary\" onclick=\"submitForm()\">Save</button></div></div></div>';\n}\nconst val=k=>($((\"f_\"+k))?.value)||\"\";\nwindow.go=async x=>{tab=x;modal=\"\";if(mode===\"api\"&&user)await refreshApi();render();};\nwindow.openm=x=>{modal=x;render();};\nwindow.closem=()=>{modal=\"\";render();};\nwindow.login=async()=>{\n try{const r=await api(\"/api/login\",{method:\"POST\",body:JSON.stringify({username:val(\"username\"),password:val(\"password\")})});user=r.user;modal=\"\";await refreshApi();render();}\n catch(e){alert(e.message);}\n};\nwindow.repair=async()=>{\n try{\n  const r=await api(\"/api/setup\",{method:\"POST\",body:JSON.stringify({username:val(\"username\"),password:val(\"password\"),setupToken:val(\"setupToken\")})});user=r.user;modal=\"\";await refreshApi();render();\n }catch(e){alert(e.message);}\n};\nwindow.submitForm=async()=>{\n const map={vehicles:\"vehicles\",customers:\"customers\",services:\"services\",maintenance:\"maintenance\",expense:\"expenses\",booking:\"rentals\"};\n const endpoint=map[modal], b={};\n document.querySelectorAll(\".modalbox input\").forEach(i=>{if(i.id.startsWith(\"f_\"))b[i.id.slice(2)]=i.value;});\n [\"quantity\",\"unit_price\",\"discount\",\"vat_rate\",\"deposit\",\"rate_per_hour\",\"price\",\"amount\",\"vat_amount\",\"cost\",\"customer_id\",\"vehicle_id\",\"service_id\"].forEach(k=>{if(k in b)b[k]=Number(b[k]||0);});\n if(modal===\"booking\"){b.status=\"completed\";b.invoice_no=\"RNT-\"+Date.now();}\n try{\n  if(mode===\"api\"){await api(\"/api/\"+endpoint,{method:\"POST\",body:JSON.stringify(b)});await refreshApi();}\n  else{b.id=Date.now();if(modal===\"booking\"){const taxable=Math.max(0,(b.quantity||1)*(b.unit_price||0)-(b.discount||0));b.subtotal=(b.quantity||1)*(b.unit_price||0);b.vat_amount=taxable*(b.vat_rate||5)/100;b.total=taxable+b.vat_amount;}S[endpoint].push(b);save();}\n  modal=\"\";render();\n }catch(e){alert(e.message);}\n};\nwindow.csv=k=>{\n const rows=S[k];if(!rows?.length)return alert(\"No data.\");\n const keys=Object.keys(rows[0]);const txt=keys.join(\",\")+\"\\n\"+rows.map(r=>keys.map(x=>'\"'+String(r[x]??\"\").replace(/\"/g,'\"\"')+'\"').join(\",\")).join(\"\\n\");\n const a=document.createElement(\"a\");a.href=URL.createObjectURL(new Blob([txt],{type:\"text/csv\"}));a.download=k+\".csv\";a.click();\n};\nwindow.backup=()=>{const a=document.createElement(\"a\");a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:\"application/json\"}));a.download=\"quad-rental-backup.json\";a.click();};\nfunction render(){\n let c=tab===\"Overview\"?overview():\n tab===\"Bookings\"?listing(\"rentals\",\"Bookings\",\"Rental invoices and payments.\",[\"invoice_no\",\"customer_name\",\"vehicle_name\",\"total\",\"payment_status\"],\"booking\"):\n tab===\"Vehicles\"?listing(\"vehicles\",\"Vehicles\",\"Quad and buggy fleet.\",[\"id\",\"name\",\"category\",\"rate_per_hour\",\"status\"],\"vehicles\"):\n tab===\"Customers\"?listing(\"customers\",\"Customers\",\"Customer records.\",[\"id\",\"name\",\"phone\",\"nationality\",\"email\"],\"customers\"):\n tab===\"Services\"?listing(\"services\",\"Services\",\"Additional services.\",[\"id\",\"name\",\"category\",\"price\",\"vat_rate\",\"active\"],\"services\"):\n tab===\"Expenses\"?listing(\"expenses\",\"Expenses\",\"Operating costs.\",[\"id\",\"expense_date\",\"category\",\"description\",\"amount\",\"payment_method\"],\"expense\"):\n tab===\"Maintenance\"?listing(\"maintenance\",\"Maintenance\",\"Vehicle maintenance history.\",[\"id\",\"vehicle_id\",\"maintenance_date\",\"type\",\"cost\",\"status\",\"next_due_date\"],\"maintenance\"):\n reports();\n $(\"app\").innerHTML=shell(c);\n}\nboot();\n})();</script></body></html>";

export default {async fetch(req,env,ctx){const url=new URL(req.url);if(url.pathname.startsWith("/api/"))return api(req,env);return new Response(APP_HTML,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});}};