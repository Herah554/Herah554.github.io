/* Lager tools/.out/<side>-test.html for en vilkårlig side: samme falske Firebase i minnet som
   make-rca-test.js, men med generelle testdata (bruker, linjer, skift, telling, hendelser).
   Kjør: node tools/make-page-test.js index.html   (eller tavle.html, rapporter.html …)
   så node tools/serve.js og åpne http://localhost:8765/index-test.html. Les window.__errors.
   Brukes til å se etter runtime-feil og utseende uten innlogging — se lærdom 14 i CLAUDE.md. */
const fs=require("fs");
const path=require("path");
const page=process.argv[2]||"index.html";
const proj=path.join(__dirname,"..")+"/";
const out=path.join(__dirname,".out")+"/";
fs.mkdirSync(out,{recursive:true});
let s=fs.readFileSync(proj+page,"utf8").replace(/\r\n/g,"\n");
const now=new Date(), D=86400000, pad=n=>String(n).padStart(2,"0");
const dk=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const today=dk(now), yday=dk(new Date(now-D));
const hourly={};let count=0;
for(let h=6;h<=Math.min(now.getHours(),13);h++){const v=40+((h*7)%15);hourly[pad(h)]=v;count+=v;}
const events={};
const t0=new Date(now);t0.setHours(8,10,0,0);
events.e1={line:"Glacier",machine:"GMW",cause:"Mekanisk feil",duration:22,severity:"medium",comment:"Kjede hoppet av",ts:t0.getTime(),product:"Krone-is Jordbær"};
events.e2={line:"Glacier",machine:"MLPH",cause:"Elektrisk feil",duration:35,severity:"high",comment:"HMI hang",ts:t0.getTime()-D,product:"Krone-is Jordbær"};
events.e3={line:"Glacier",machine:"",cause:"",duration:12,ts:t0.getTime()+3600000,source:"opc",unhandled:true,wholeLine:true};
events.e4={line:"Løp 1",machine:"Fyller",cause:"Vask",duration:45,ts:t0.getTime()-2*D};
const shift={s1:{name:"Dag",start:"06:00",end:"14:00",bemanning:4,color:"#0d9488"}};
const DATA={
  users:{u1:{name:"David Solbakken",email:"david@example.com",role:"master",dashboardId:"std"},u2:{name:"Operatør Ola",role:"linjeoperator",lines:["Glacier"]}},
  settings:{globalGoal:3000,oeeGoal:60,defaultDayHours:8,resetTime:"06:00",lineGoals:{Glacier:500},oeeGoals:{Glacier:60},
    plannedStops:["Vask"],generalCauses:["Annet"],machines:{Glacier:["GMW","MLPH"],"Løp_1":["Fyller"]},causes:{Glacier__GMW:["Mekanisk feil"],Glacier__MLPH:["Elektrisk feil"]},
    products:{Glacier:[{name:"Krone-is Jordbær",artNr:"11001",teknKapasitet:6000,stkPerDpack:80,eskerPerDpack:1}]}},
  events,
  production:{[today]:{Glacier:{count,hourly}},[yday]:{Glacier:{count:412,hourly:{"06":50,"07":52,"08":49,"09":55,"10":51,"11":53,"12":50,"13":52}}}},
  productHourly:{},
  active_product:{Glacier:{product:"Krone-is Jordbær",setAt:now.getTime()-5*3600000,setByName:"David Solbakken"}},
  opc_status:{connected:true,last_seen:now.getTime(),url:"opc.tcp://192.168.10.1:4840"},
  shiftPlan:{[today]:{Glacier:shift},[yday]:{Glacier:shift}},
  plan:{production:{[today]:{Glacier:[{product:"Krone-is Jordbær",artNr:"11001",antall:480,timer:8}]}}},
  shiftReports:{},deleteRequests:{},calibrationReviews:{},board:{},rca:{},userDashboards:{}
};
const stub=`<script>
(function(){
  function get(path){const p=path.replace(/^\\/+|\\/+$/g,'');if(!p)return DATA;const parts=p.split('/');let cur=DATA[parts[0]];for(let i=1;i<parts.length&&cur!=null;i++)cur=cur[parts[i]];return cur===undefined?null:cur;}
  function setp(path,val){const parts=path.replace(/^\\/+|\\/+$/g,'').split('/');let cur=DATA;for(let i=0;i<parts.length-1;i++){cur[parts[i]]=cur[parts[i]]||{};cur=cur[parts[i]];}if(val===null||val===undefined)delete cur[parts[parts.length-1]];else cur[parts[parts.length-1]]=val;}
  const subs=[];function fire(){subs.forEach(x=>x.cb(snap(x.path,get(x.path))));}
  function snap(path,val){return {key:path.split('/').pop(),ref:{toString(){return path;}},val:()=>val,exists:()=>val!=null,numChildren:()=>val&&typeof val==='object'?Object.keys(val).length:0,child(k){return snap(path+'/'+k,val&&val[k]!==undefined?val[k]:null);},forEach(cb){if(val&&typeof val==='object')Object.keys(val).forEach(k=>cb(snap(path+'/'+k,val[k])));}};}
  function ref(path){path=path||'';const r={
    key:path.split('/').pop(),
    on(ev,cb){if(ev!=='value')return cb;subs.push({path,cb});setTimeout(()=>cb(snap(path,get(path))),10);return cb;},off(){},
    once(){return Promise.resolve(snap(path,get(path)));},
    get(){return Promise.resolve(snap(path,get(path)));},
    set(v){setp(path,v);setTimeout(fire,5);return Promise.resolve();},
    update(u){Object.keys(u).forEach(k=>setp(path+'/'+k,u[k]));setTimeout(fire,5);return Promise.resolve();},
    remove(){setp(path,null);setTimeout(fire,5);return Promise.resolve();},
    transaction(fn){const v=fn(get(path));setp(path,v);setTimeout(fire,5);return Promise.resolve({committed:true,snapshot:snap(path,v)});},
    push(v){const k='p'+Math.random().toString(36).slice(2,8);const c=ref(path+'/'+k);c.key=k;if(v!==undefined){setp(path+'/'+k,v);setTimeout(fire,5);}c.then=(f)=>Promise.resolve(c).then(f);c.catch=()=>c;return c;},
    child(k){return ref(path+'/'+k);},
    onDisconnect(){return {set(){},remove(){},update(){}};}
  };
  ['orderByKey','orderByChild','orderByValue','startAt','endAt','equalTo','limitToLast','limitToFirst'].forEach(m=>{r[m]=()=>r;});
  return r;}
  window.DATA=${JSON.stringify(DATA)};
  const user={uid:'u1',email:'david@example.com',getIdToken(){return Promise.resolve('x');}};
  const dbf=function(){return {ref,goOffline(){},goOnline(){}};};dbf.ServerValue={TIMESTAMP:Date.now()};
  const authf=function(){return {currentUser:user,onAuthStateChanged(cb){setTimeout(()=>cb(user),20);},signOut(){return Promise.resolve();},sendPasswordResetEmail(){return Promise.resolve();}};};
  window.firebase={apps:[1],initializeApp(){return {delete(){return Promise.resolve();},auth:authf,database:dbf};},app(){return {};},database:dbf,auth:authf};
  window.__errors=[];window.addEventListener('error',e=>window.__errors.push(e.message+' @'+e.lineno));
  window.addEventListener('unhandledrejection',e=>window.__errors.push('promise: '+(e.reason&&e.reason.message||e.reason)));
  const ce=console.error;console.error=function(){window.__errors.push('console.error: '+[].slice.call(arguments).map(a=>a&&a.message||a).join(' '));ce.apply(console,arguments);};
})();
</script>`;
s=s.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+"><\/script>\s*/g,"");
if(!/<head[^>]*>/.test(s))throw new Error("fant ikke <head>");
s=s.replace(/<head[^>]*>/,m=>m+"\n"+stub);
const name=page.replace(/\.html$/,"")+"-test.html";
fs.writeFileSync(out+name,s);
["theme.css","theme.js","time24.js","nav.js","dashboard-widgets.js"].forEach(f=>fs.copyFileSync(proj+f,out+f));
console.log(name+" laget");
