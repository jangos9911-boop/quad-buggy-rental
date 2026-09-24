(function(){
"use strict";
const KEY="quad_rental_standalone_v2";
let S=JSON.parse(localStorage.getItem(KEY)||"null")||{vehicles:[],customers:[],services:[],rentals:[],expenses:[],maintenance:[]};
let tab="Overview",modal="",mode="local",user=null;
const $=id=>document.getElementById(id);
const money=n=>"AED "+Number(n||0).toLocaleString("en-AE",{minimumFractionDigits:2,maximumFractionDigits:2});
const save=()=>localStorage.setItem(KEY,JSON.stringify(S));
async function api(path,opt={}){const r=await fetch(path,{credentials:"include",headers:{"content-type":"application/json",...(opt.headers||{})},...opt});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"Request failed");return r.json()}
async function boot(){
  try{const h=await api("/api/health");if(h.ok){mode="api";try{const m=await api("/api/me");user=m.user}catch{} if(!user){renderLogin();return} await refreshApi();}}
  catch(e){mode="local"}
  render();
}
async function refreshApi(){
  const [v,c,s,r,e,m]=await Promise.all(["vehicles","customers","services","rentals","expenses","maintenance"].map(k=>api("/api/"+k).catch(()=>[])));
  S={vehicles:v,customers:c,services:s,rentals:r,expenses:e,maintenance:m};save();
}
function nav(){return ["Overview","Bookings","Vehicles","Customers","Services","Expenses","Maintenance","Reports"].map(x=>'<button class="'+(tab==x?"active":"")+'" onclick="go(\''+x+'\')">'+x+"</button>").join("")}
function shell(x){return '<div class="app"><aside class="side"><div class="brand">QUAD <i>RENTAL</i><br>UAE DESK</div><div class="nav">'+nav()+'</div><div class="muted" style="margin-top:20px">'+(mode==="api"?"● Cloud database":"● Offline demo")+(user?"<br>"+user.email:"")+"</div></aside><main class="main"><div class="mobile">'+nav()+'</div>'+x+'</main>'+(modal?modalHtml():"")+"</div>"}
function header(a,b,c){return '<div class="top"><div><h1>'+a+'</h1><div class="muted">'+b+"</div></div>"+(c||"")+"</div>"}
function table(rows,cols){if(!rows.length)return '<div class="card empty">No records yet.</div>';return '<div class="tablebox"><table class="table"><thead><tr>'+cols.map(c=>"<th>"+c+"</th>").join("")+"</tr></thead><tbody>"+rows.slice().reverse().map(r=>"<tr>"+cols.map(c=>"<td>"+(r[c]??"")+"</td>").join("")+"</tr>").join("")+"</tbody></table></div>"}
function overview(){const rev=S.rentals.reduce((a,x)=>a+Number(x.total||0),0),ex=S.expenses.reduce((a,x)=>a+Number(x.amount||0),0),out=S.rentals.filter(x=>x.payment_status!=="paid"&&x.paymentStatus!=="paid").reduce((a,x)=>a+Number(x.total||0),0);return header("Overview","Rental operations and cashflow.",'<button class="btn primary" style="width:auto" onclick="openm(\'booking\')">+ New booking</button>')+'<div class="grid"><div class="card">Revenue<div class="metric accent">'+money(rev)+'</div></div><div class="card">Expenses<div class="metric">'+money(ex)+'</div></div><div class="card">Net result<div class="metric accent">'+money(rev-ex)+'</div></div><div class="card">Outstanding<div class="metric">'+money(out)+'</div></div></div><div class="section"><h2>Recent bookings</h2>'+table(S.rentals.slice(-10),["invoice_no","customer_name","vehicle_name","total","payment_status"])+"</div>"}
function listing(k,title,desc,cols,formKey){return header(title,desc,'<button class="btn primary" style="width:auto" onclick="openm(\''+formKey+'\')">+ Add</button>')+'<div class="section">'+table(S[k],cols)+"</div>"}
function reports(){return header("Reports","Export business data and create backups.")+'<div class="card"><h3>Exports</h3><div class="actions">'+["rentals","expenses","vehicles","customers","services","maintenance"].map(k=>'<button class="btn" style="width:auto" onclick="csv(\''+k+'\')">'+k+' CSV</button>').join("")+'<button class="btn primary" style="width:auto" onclick="backup()">Full JSON backup</button></div></div><div class="section card">'+(mode==="api"?"Connected to the production API.":"This browser is using offline demo storage until D1/authentication is configured.")+"</div>"}
function form(fields){return '<div class="form">'+fields.map(f=>'<div class="field '+(f[0]=="description"?"full":"")+'"><label>'+f[1]+'</label><input id="f_'+f[0]+'" type="'+(f[2]||"text")+'" value="'+(f[3]||"")+'"></div>').join("")+"</div>"}
function modalHtml(){let title="",body="";
if(modal==="login")return '<div class="modal"><div class="modalbox"><h2>Staff login</h2>'+form([["email","Email"],["password","Password","password"]])+'<div class="actions" style="margin-top:16px"><button class="btn primary" style="width:auto" onclick="login()">Sign in</button></div></div></div>';
if(modal==="booking"){title="New booking";body=form([["customer_id","Customer ID","number"],["vehicle_id","Vehicle ID","number"],["service_id","Service ID","number"],["quantity","Hours / quantity","number","1"],["unit_price","Unit price AED","number","0"],["discount","Discount AED","number","0"],["vat_rate","VAT %","number","5"],["deposit","Deposit AED","number","0"],["payment_status","Payment status","text","unpaid"],["start_at","Start","datetime-local"],["end_at","End","datetime-local"],["notes","Notes"]])}
else if(modal==="vehicles"){title="Add vehicle";body=form([["name","Vehicle name"],["category","Category","text","Quad"],["registration","Registration"],["rate_per_hour","Hourly rate AED","number"],["status","Status","text","available"],["notes","Notes"]])}
else if(modal==="customers"){title="Add customer";body=form([["name","Name"],["phone","Phone"],["email","Email"],["nationality","Nationality"],["id_reference","ID / passport reference"],["notes","Notes"]])}
else if(modal==="services"){title="Add service";body=form([["name","Service name"],["category","Category","text","Other"],["price","Price AED","number"],["vat_rate","VAT %","number","5"]])}
else if(modal==="maintenance"){title="Add maintenance";body=form([["vehicle_id","Vehicle ID","number"],["maintenance_date","Date","date"],["type","Type"],["description","Description"],["cost","Cost AED","number"],["status","Status","text","open"],["next_due_date","Next due","date"],["notes","Notes"]])}
else{title="Add expense";body=form([["expense_date","Date","date"],["category","Category"],["description","Description"],["amount","Amount AED","number"],["vat_amount","VAT amount AED","number"],["payment_method","Payment method"]])}
return '<div class="modal"><div class="modalbox"><div class="top"><b>'+title+'</b><button class="btn" style="width:auto" onclick="closem()">×</button></div>'+body+'<div class="actions" style="margin-top:16px"><button class="btn" style="width:auto" onclick="closem()">Cancel</button><button class="btn primary" style="width:auto" onclick="submit()">Save</button></div></div></div>'}
const val=x=>$("f_"+x)?.value||"";
window.go=async x=>{tab=x;modal="";if(mode==="api")await refreshApi();render()};
window.openm=x=>{modal=x;render()};window.closem=()=>{modal="";render()};
window.login=async()=>{try{const r=await api("/api/login",{method:"POST",body:JSON.stringify({email:val("email"),password:val("password")})});user=r.user;modal="";await refreshApi();render()}catch(e){alert(e.message)}};
window.submit=async()=>{
 const map={vehicles:"vehicles",customers:"customers",services:"services",maintenance:"maintenance",expense:"expenses",booking:"rentals"};
 const t=map[modal];let b={};
 document.querySelectorAll(".modalbox input").forEach(i=>{if(i.id.startsWith("f_"))b[i.id.slice(2)]=i.value});
 for(const k of Object.keys(b))if(["quantity","unit_price","discount","vat_rate","deposit","rate_per_hour","price","amount","vat_amount","cost","customer_id","vehicle_id","service_id"].includes(k))b[k]=Number(b[k]||0);
 if(modal==="booking"){b.status="completed";b.payment_status=b.payment_status||"unpaid";b.invoice_no="RNT-"+Date.now()}
 if(mode==="api"){try{await api("/api/"+t,{method:"POST",body:JSON.stringify(b)});await refreshApi()}catch(e){alert(e.message);return}}
 else {const localKey=modal==="booking"?"rentals":t;b.id=Date.now();if(modal==="booking"){const q=b.quantity||1,u=b.unit_price||0,d=b.discount||0,v=b.vat_rate||5;const taxable=Math.max(0,q*u-d);b.subtotal=q*u;b.vat_amount=taxable*v/100;b.total=taxable+b.vat_amount}S[localKey].push(b);save()}
 modal="";render();
};
window.csv=k=>{const rows=S[k];if(!rows?.length)return alert("No data.");const keys=Object.keys(rows[0]),txt=keys.join(",")+"\n"+rows.map(r=>keys.map(x=>'"'+String(r[x]??"").replace(/"/g,'""')+'"').join(",")).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"text/csv"}));a.download=k+".csv";a.click()};
window.backup=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:"application/json"}));a.download="quad-rental-backup.json";a.click()};
function render(){let c=tab==="Overview"?overview():tab==="Bookings"?listing("rentals","Bookings","Rental invoices and payments.",["invoice_no","customer_name","vehicle_name","total","payment_status"],"booking"):tab==="Vehicles"?listing("vehicles","Vehicles","Quad and buggy fleet.",["id","name","category","rate_per_hour","status"],"vehicles"):tab==="Customers"?listing("customers","Customers","Customer records.",["id","name","phone","nationality","email"],"customers"):tab==="Services"?listing("services","Services","Rental and other services.",["id","name","category","price","vat_rate","active"],"services"):tab==="Expenses"?listing("expenses","Expenses","Operating costs.",["id","expense_date","category","description","amount","payment_method"],"expense"):tab==="Maintenance"?listing("maintenance","Maintenance","Vehicle service and maintenance history.",["id","vehicle_id","maintenance_date","type","cost","status","next_due_date"],"maintenance"):reports();document.getElementById("app").innerHTML=shell(c)+(modal?modalHtml():"")}
boot();
})();