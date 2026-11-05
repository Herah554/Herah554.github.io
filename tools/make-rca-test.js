/* Lager tools/.out/rotarsak-test.html: rotarsak.html med en falsk Firebase i minnet, så siden
   kan lastes og feilsøkes i nettleseren uten innlogging. Kjør: node tools/make-rca-test.js,
   så node tools/serve.js og åpne http://localhost:8765/rotarsak-test.html. Les window.__errors.
   Samme oppskrift virker for andre sider: bytt filnavn og DATA. */
const fs=require("fs");
const path=require("path");
const proj=path.join(__dirname,"..")+"/";
const out=path.join(__dirname,".out")+"/";
fs.mkdirSync(out,{recursive:true});
let s=fs.readFileSync(proj+"rotarsak.html","utf8").replace(/\r\n/g,"\n");
const now=Date.now(), D=86400000;
const events={};
for(let i=0;i<6;i++)events["a"+i]={line:"Glacier",machine:"GMW",cause:"Mekanisk feil",duration:20+i*5,ts:now-(i*4+1)*D,comment:"Kjede hoppet av"};
for(let i=0;i<3;i++)events["b"+i]={line:"Glacier",machine:"MLPH",cause:"Elektrisk feil",duration:35,ts:now-(i*6+2)*D,comment:"HMI"};
events.c1={line:"Glacier",machine:"GMW",cause:"Vask",duration:45,ts:now-3*D};
const DATA={
  users:{u1:{name:"David",role:"master"}},
  settings:{plannedStops:["Vask"],machines:{Glacier:["GMW","MLPH"]}},
  events,
  rca:{r1:{title:"Kjede hopper av på GMW",line:"Glacier",machine:"GMW",cause:"Mekanisk feil",status:"action",problem:"Kjeden hopper av 1–2 ganger i uka.",konsekvens:"Ca. 25 min nedetid per gang.",
    whys:{w1:{text:"Kjeden er slakk",at:1},w2:{text:"Strammeren har gått tom for vandring",at:2},w3:{text:"Kjeden er strukket — aldri byttet",at:3}},
    fish:{maskin:{f1:{text:"Slitt kjede"},f2:{text:"Strammer i endestilling"}},metode:{f3:{text:"Ingen fast kontroll av kjedestramming"}}},
    rootCause:"Kjeden er ikke med i forebyggende vedlikehold.",
    actions:{x1:{text:"Bytt kjede",ansvar:"Marius",frist:"2026-11-10",done:true,doneBy:"Marius",doneAt:now-10*D,createdAt:1},x2:{text:"Legg kjedekontroll inn i 4-ukers PM",ansvar:"Sebastian",frist:"2026-11-01",done:false,createdAt:2}},
    createdAt:now-20*D,createdBy:"David",updatedAt:now-1*D,updatedBy:"David"}}
};
const stub=`<script>
(function(){
  function get(path){const p=path.replace(/^\\/+|\\/+$/g,'');const parts=p.split('/');let cur=DATA[parts[0]];for(let i=1;i<parts.length&&cur!=null;i++)cur=cur[parts[i]];return cur===undefined?null:cur;}
  function setp(path,val){const parts=path.replace(/^\\/+|\\/+$/g,'').split('/');let cur=DATA;for(let i=0;i<parts.length-1;i++){cur[parts[i]]=cur[parts[i]]||{};cur=cur[parts[i]];}if(val===null)delete cur[parts[parts.length-1]];else cur[parts[parts.length-1]]=val;}
  const subs=[];function fire(){subs.forEach(x=>x.cb(snap(x.path,get(x.path))));}
  function snap(path,val){return {key:path.split('/').pop(),val:()=>val,exists:()=>val!=null,forEach(cb){if(val&&typeof val==='object')Object.keys(val).forEach(k=>cb(snap(path+'/'+k,val[k])));}};}
  function ref(path){path=path||'';const r={
    on(ev,cb){subs.push({path,cb});setTimeout(()=>cb(snap(path,get(path))),10);return cb;},off(){},
    once(){return Promise.resolve(snap(path,get(path)));},
    set(v){setp(path,v);setTimeout(fire,5);return Promise.resolve();},
    update(u){Object.keys(u).forEach(k=>setp(path+'/'+k,u[k]));setTimeout(fire,5);return Promise.resolve();},
    remove(){setp(path,null);setTimeout(fire,5);return Promise.resolve();},
    push(){const k='p'+Math.random().toString(36).slice(2,8);const c=ref(path+'/'+k);c.key=k;return c;},
    child(k){return ref(path+'/'+k);}
  };return r;}
  window.DATA=${JSON.stringify(DATA)};
  window.firebase={apps:[1],initializeApp(){return {};},database(){return {ref};},auth(){return {currentUser:{uid:'u1'},onAuthStateChanged(cb){setTimeout(()=>cb({uid:'u1'}),20);},signOut(){return Promise.resolve();}};}};
  window.__errors=[];window.addEventListener('error',e=>window.__errors.push(e.message+' @'+e.lineno));
})();
</script>`;
s=s.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+"><\/script>\s*/g,"");
s=s.replace("<style>",stub+"\n<style>");
fs.writeFileSync(out+"rotarsak-test.html",s);
["theme.css","theme.js","time24.js","nav.js"].forEach(f=>fs.copyFileSync(proj+f,out+f));
console.log("rotarsak-test.html laget");
