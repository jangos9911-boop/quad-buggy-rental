(function(){
"use strict";
const KEY="quad_rental_standalone_v3";
let S=JSON.parse(localStorage.getItem(KEY)||"null")||{vehicles:[],customers:[],services:[],rentals:[],expenses:[],maintenance:[]};
let tab="Overview", modal="", mode="local", user=null;
const $=id=>document.getElementById(id);
const money=n=>"AED "+Number(n||0).toLocaleString("en-AE",{minimumFractionDigits:2,maximumFractionDigits:2});
const save=()=>localStorage.setItem(KEY,JSON.stringify(S));
async function api(path,opt={}){
 const r=await fetch(path,{credentials:"include",headers:{"content-type":"application/json",...(opt.headers||{})},...opt});
 if(!r.ok) throw new Error((await r.json().catch(()=>({}))).error||"Request failed");
 return r.json();
}
async function boot(){
 try{
  const h=await api("/api/health");
  if(h.ok){
   mode="api";
   try{const m=await api("/api/me");user=m.user;}catch(e){}
   if(!user){modal="login";render();return;}
   await refreshApi();
  }
 }catch(e){mode="local";}
 render();
}
async function refreshApi(){
 const keys=["vehicles","customers","services","rentals","expenses","maintenance"];
 const data=await Promise.all(keys.map(k=>api("/api/"+k).catch(()=>[])));
 S=Object.fromEntries(keys.map((k,i)=>[k,data[i]])); save();
}
function nav(){
 return ["Overview","Bookings","Vehicles","Customers","Services","Expenses","Maintenance","Reports"]
 .map(x=>'<button class="'+(tab===x?"active":"")+'" onclick="go('+JSON.stringify(x)+')">'+x+"</button>").join("");
}
function shell(content){
 return '<div class="app"><aside class="side"><div class="brand">QUAD <b>RENTAL</b><small>UAE DESK</small></div><div class="nav">'+nav()+'</div><div class="muted">'+(mode==="api"?"● Cloud database":"● Offline mode")+(user?"<br>"+user.email:"")+"</div></aside><main class="main"><div class="mobile">'+nav()+"</div>"+content+"</main>"+(modal?modalHtml():"")+"</div>";
}
function header(title,desc,action=""){return '<div class="top"><div><h1>'+title+'</h1><p class="muted">'+desc+"</p></div>"+action+"</div>";}
function table(rows,cols){
 if(!rows.length)return '<div class="card empty">No records yet.</div>';
 return '<div class="tablebox"><table><thead><tr>'+cols.map(c=>"<th>"+c+"</th>").join("")+"</tr></thead><tbody>"+
 rows.slice().reverse().map(r=>"<tr>"+cols.map(c=>"<td>"+(r[c]??"")+"</td>").join("")+"</tr>").join("")+
 "</tbody></table></div>";
}
function overview(){
 const rev=S.rentals.reduce((a,x)=>a+Number(x.total||0),0);
 const ex=S.expenses.reduce((a,x)=>a+Number(x.amount||0),0);
 const out=S.rentals.filter(x=>x.payment_status!=="paid").reduce((a,x)=>a+Number(x.total||0),0);
 return header("Overview","Rental operations and cashflow.",'<button class="btn primary" onclick="openm(\'booking\')">+ New booking</button>')+
 '<div class="grid"><div class="card">Revenue<div class="metric accent">'+money(rev)+"</div></div>"+
 '<div class="card">Expenses<div class="metric">'+money(ex)+"</div></div>"+
 '<div class="card">Net result<div class="metric accent">'+money(rev-ex)+"</div></div>"+
 '<div class="card">Outstanding<div class="metric">'+money(out)+"</div></div></div>"+
 '<section><h2>Recent bookings</h2>'+table(S.rentals.slice(-10),["invoice_no","customer_name","vehicle_name","total","payment_status"])+"</section>";
}
function listing(k,title,desc,cols,formKey){
 return header(title,desc,'<button class="btn primary" onclick="openm('+JSON.stringify(formKey)+')">+ Add</button>')+
 '<section>'+table(S[k],cols)+"</section>";
}
function reports(){
 return header("Reports","Export your business data.")+
 '<div class="card"><h3>Exports</h3><div class="actions">'+
 ["rentals","expenses","vehicles","customers","services","maintenance"].map(k=>'<button class="btn" onclick="csv('+JSON.stringify(k)+')">'+k+" CSV</button>").join("")+
 '<button class="btn primary" onclick="backup()">Full JSON backup</button></div></div>';
}
function form(fields){
 return '<div class="form">'+fields.map(f=>'<div class="field '+(f[0]==="notes"||f[0]==="description"?"full":"")+'"><label>'+f[1]+'</label><input id="f_'+f[0]+'" type="'+(f[2]||"text")+'" value="'+(f[3]||"")+'"></div>').join("")+"</div>";
}
function modalHtml(){
 if(modal==="login")return '<div class="modal"><div class="modalbox"><h2>Staff login</h2><p class="muted">Production database connected.</p>'+form([["email","Email"],["password","Password","password"]])+'<div class="actions"><button class="btn primary" onclick="login()">Sign in</button></div></div></div>';
 const defs={
 booking:["New booking",[["customer_id","Customer ID","number"],["vehicle_id","Vehicle ID","number"],["service_id","Service ID","number"],["quantity","Hours / quantity","number","1"],["unit_price","Unit price AED","number","0"],["discount","Discount AED","number","0"],["vat_rate","VAT %","number","5"],["deposit","Deposit AED","number","0"],["payment_status","Payment status","text","unpaid"],["start_at","Start","datetime-local"],["end_at","End","datetime-local"],["notes","Notes"]]],
 vehicles:["Add vehicle",[["name","Vehicle name"],["category","Category","text","Quad"],["registration","Registration"],["rate_per_hour","Hourly rate AED","number"],["status","Status","text","available"],["notes","Notes"]]],
 customers:["Add customer",[["name","Name"],["phone","Phone"],["email","Email"],["nationality","Nationality"],["id_reference","ID / passport reference"],["notes","Notes"]]],
 services:["Add service",[["name","Service name"],["category","Category","text","Other"],["price","Price AED","number"],["vat_rate","VAT %","number","5"]]],
 maintenance:["Add maintenance",[["vehicle_id","Vehicle ID","number"],["maintenance_date","Date","date"],["type","Type"],["description","Description"],["cost","Cost AED","number"],["status","Status","text","open"],["next_due_date","Next due","date"],["notes","Notes"]]],
 expense:["Add expense",[["expense_date","Date","date"],["category","Category"],["description","Description"],["amount","Amount AED","number"],["vat_amount","VAT amount AED","number"],["payment_method","Payment method"]]]
 };
 const d=defs[modal]||defs.expense;
 return '<div class="modal"><div class="modalbox"><div class="top"><h2>'+d[0]+'</h2><button class="btn close" onclick="closem()">×</button></div>'+form(d[1])+'<div class="actions"><button class="btn" onclick="closem()">Cancel</button><button class="btn primary" onclick="submitForm()">Save</button></div></div></div>';
}
const val=k=>($(("f_"+k))?.value)||"";
window.go=async x=>{tab=x;modal="";if(mode==="api"&&user)await refreshApi();render();};
window.openm=x=>{modal=x;render();};
window.closem=()=>{modal="";render();};
window.login=async()=>{
 try{const r=await api("/api/login",{method:"POST",body:JSON.stringify({email:val("email"),password:val("password")})});user=r.user;modal="";await refreshApi();render();}
 catch(e){alert(e.message);}
};
window.submitForm=async()=>{
 const map={vehicles:"vehicles",customers:"customers",services:"services",maintenance:"maintenance",expense:"expenses",booking:"rentals"};
 const endpoint=map[modal], b={};
 document.querySelectorAll(".modalbox input").forEach(i=>{if(i.id.startsWith("f_"))b[i.id.slice(2)]=i.value;});
 ["quantity","unit_price","discount","vat_rate","deposit","rate_per_hour","price","amount","vat_amount","cost","customer_id","vehicle_id","service_id"].forEach(k=>{if(k in b)b[k]=Number(b[k]||0);});
 if(modal==="booking"){b.status="completed";b.invoice_no="RNT-"+Date.now();}
 try{
  if(mode==="api"){await api("/api/"+endpoint,{method:"POST",body:JSON.stringify(b)});await refreshApi();}
  else{b.id=Date.now();if(modal==="booking"){const taxable=Math.max(0,(b.quantity||1)*(b.unit_price||0)-(b.discount||0));b.subtotal=(b.quantity||1)*(b.unit_price||0);b.vat_amount=taxable*(b.vat_rate||5)/100;b.total=taxable+b.vat_amount;}S[endpoint].push(b);save();}
  modal="";render();
 }catch(e){alert(e.message);}
};
window.csv=k=>{
 const rows=S[k];if(!rows?.length)return alert("No data.");
 const keys=Object.keys(rows[0]);const txt=keys.join(",")+"\n"+rows.map(r=>keys.map(x=>'"'+String(r[x]??"").replace(/"/g,'""')+'"').join(",")).join("\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"text/csv"}));a.download=k+".csv";a.click();
};
window.backup=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:"application/json"}));a.download="quad-rental-backup.json";a.click();};
function render(){
 let c=tab==="Overview"?overview():
 tab==="Bookings"?listing("rentals","Bookings","Rental invoices and payments.",["invoice_no","customer_name","vehicle_name","total","payment_status"],"booking"):
 tab==="Vehicles"?listing("vehicles","Vehicles","Quad and buggy fleet.",["id","name","category","rate_per_hour","status"],"vehicles"):
 tab==="Customers"?listing("customers","Customers","Customer records.",["id","name","phone","nationality","email"],"customers"):
 tab==="Services"?listing("services","Services","Additional services.",["id","name","category","price","vat_rate","active"],"services"):
 tab==="Expenses"?listing("expenses","Expenses","Operating costs.",["id","expense_date","category","description","amount","payment_method"],"expense"):
 tab==="Maintenance"?listing("maintenance","Maintenance","Vehicle maintenance history.",["id","vehicle_id","maintenance_date","type","cost","status","next_due_date"],"maintenance"):
 reports();
 $("app").innerHTML=shell(c);
}
boot();
})();