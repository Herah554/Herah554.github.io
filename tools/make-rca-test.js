/* Lager tools/.out/rotarsak-test.html: rotarsak.html med en falsk Firebase i minnet, så siden
   kan lastes og feilsøkes i nettleseren uten innlogging. Kjør: node tools/make-rca-test.js,
   så node tools/serve.js og åpne http://localhost:8765/rotarsak-test.html. Les window.__errors.
   ?as=u2 logger inn som en annen testbruker (u1 eier, u2 leder, u3 leder nivå 2, u4 operatør, u5 master uten Saker).
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
  users:{u1:{name:"David Solbakken",role:"master"},u2:{name:"Sebastian Strøm",role:"leder"},u3:{name:"Nermala Mahmic",role:"leder",caseLevel:2},u4:{name:"Operatør Ola",role:"linjeoperator"},u5:{name:"Mona Master",role:"master",hide:{saker:true}},b:{name:"bro",role:"bridge"}},
  system:{owner:"u1"},
  settings:{plannedStops:["Vask"],machines:{Glacier:["GMW","MLPH"],"Løp_3":["Fyller","Folie"]}},
  events,
  rca:{
    counter:201,
    reports:{
      r1:{text:"Manglende oblat/folie på boks 0,9L. Dette fører til sperringer av produkter, deretter underkjenninger og mye nedetid på linja.",line:"Løp 3",where:"foliedispenser",when:now-16*D,done:"Slangene blir blåst, sugekoppene byttet, justering av vakuum",createdAt:now-16*D,createdBy:"u3",createdByName:"Nermala Mahmic",caseId:"c201"},
      r2:{text:"Kommer doble is på pakkemaskin som forårsaker mye svinn. Forekommer generelt på alle produkter.",line:"Glacier",where:"pakkemaskin",when:now-2*D,done:"Nei",createdAt:now-2*D,createdBy:"u4",createdByName:"Operatør Ola"},
      r3:{text:"Eskereiser lager dårlige esker, må justeres nesten hvert skift.",line:"Glacier",where:"eskereiser",when:now-1*D,done:"Justert",createdAt:now-1*D,createdBy:"u4",createdByName:"Operatør Ola"},
      r4:{text:"Gammel rapport som er arkivert",line:"Rollo",createdAt:now-40*D,createdByName:"Operatør Ola",archived:true}
    },
    cases:{
      c201:{nr:201,title:"Manglende oblat/folie på 0,9L-bokser",priority:"high",stage:"undersoker",status:"open",owner:"u3",ownerName:"Nermala Mahmic",participants:{u2:"Sebastian Strøm"},line:"Løp 3",where:"Løp 3",createdAt:now-16*D,createdBy:"u3",createdByName:"Nermala Mahmic",
        problem:"Manglende oblat/folie på boks 0,9L fører til sperringer, underkjenninger og nedetid. Flere produkter, Royal 0,9L.",
        followers:{u1:true},
        causes:{
          k1:{cat:"metode",text:"Vanskelig å rengjøre varmeelement",flag:"mulig",klass:"medv",whys:{w1:{text:"Undersøke om det er riktig metode/utstyr",at:1}}},
          k2:{cat:"metode",text:"Ved utført vask vann i vakuumslanger"},
          k3:{cat:"maskin",text:"Feil deler på varmeelement",flag:"mulig",klass:"medv",whys:{w1:{text:"Bestilt feil?",at:1}}},
          k4:{cat:"maskin",text:"For lite luft på RUF",flag:"mulig",klass:"rot",whys:{w1:{text:"Feil fordeling av lufta",at:1},w2:{text:"Tilkoblet til samme lufttilførsel",at:2}}},
          k5:{cat:"maskin",text:"Vann i slange",flag:"mulig",klass:"rot",whys:{w1:{text:"Ikke tildekt åpningen der vann kan trekkes inn",at:1},w2:{text:"Manglende metoder under vask av åpne kritiske punkter",at:2}}},
          k6:{cat:"maskin",text:"Feil posisjon på nedlegger",flag:"ikke"}},
        actions:{
          t1:{type:"korr",text:"Dekk til under vask",owner:"u2",ownerName:"Sebastian Strøm",due:"2026-10-27",pdca:"plan",createdAt:1},
          t2:{type:"korr",text:"Kontroller fordeling fra hovedtilførsel",owner:"u2",ownerName:"Sebastian Strøm",due:"2026-10-27",pdca:"check",createdAt:2},
          t3:{type:"foreb",text:"Sjekk rengjøringsmetode for varmeelementer",owner:"u3",ownerName:"Nermala Mahmic",due:"2026-12-01",pdca:"plan",createdAt:3},
          t4:{type:"foreb",text:"Skaff riktige deler til varmeelement",owner:"u1",ownerName:"David Solbakken",due:"2026-12-10",pdca:"lukket",closedAt:now-5*D,closedBy:"David Solbakken",createdAt:4}},
        log:{l1:{at:now-16*D,by:"Nermala Mahmic",text:"opprettet saken fra rapport"}}},
      c200:{nr:200,title:"Kjede hopper av på GMW",priority:"medium",stage:"opprettet",status:"open",line:"Glacier",where:"Glacier GMW",machine:"GMW",cause:"Mekanisk feil",createdAt:now-9*D,createdBy:"u1",createdByName:"David Solbakken",recurringId:"g1"},
      c150:{nr:150,title:"Sot fra herdetunnel forurenset produksjon",priority:"medium",stage:"bekreftet",status:"archived",line:"Glacier",where:"Glacier herdetunnel",ownerName:"David Solbakken",owner:"u1",rcaDone:{by:"David Solbakken",at:now-30*D},archivedAt:now-28*D,archivedBy:"David Solbakken",archiveComment:"Tunnel vasket, rutine innført",createdAt:now-60*D,createdByName:"David Solbakken",recurringId:"g1"}
    },
    recurring:{g1:{name:"Herdetunnel Glacier",description:"Gjentatte problemer rundt herdetunnelen.",createdAt:now-50*D,createdBy:"David Solbakken"}}
  }
};
const stub=`<script>
(function(){
  function get(path){const p=path.replace(/^\\/+|\\/+$/g,'');const parts=p.split('/');let cur=DATA[parts[0]];for(let i=1;i<parts.length&&cur!=null;i++)cur=cur[parts[i]];return cur===undefined?null:cur;}
  function setp(path,val){const parts=path.replace(/^\\/+|\\/+$/g,'').split('/');let cur=DATA;for(let i=0;i<parts.length-1;i++){cur[parts[i]]=cur[parts[i]]||{};cur=cur[parts[i]];}if(val===null||val===undefined)delete cur[parts[parts.length-1]];else cur[parts[parts.length-1]]=val;}
  const subs=[];function fire(){subs.forEach(x=>x.cb(snap(x.path,get(x.path))));}
  function snap(path,val){return {key:path.split('/').pop(),val:()=>val,exists:()=>val!=null,forEach(cb){if(val&&typeof val==='object')Object.keys(val).forEach(k=>cb(snap(path+'/'+k,val[k])));}};}
  function ref(path){path=path||'';const r={
    on(ev,cb){subs.push({path,cb});setTimeout(()=>cb(snap(path,get(path))),10);return cb;},off(){},
    once(){return Promise.resolve(snap(path,get(path)));},
    set(v){setp(path,v);setTimeout(fire,5);return Promise.resolve();},
    update(u){Object.keys(u).forEach(k=>setp(path+'/'+k,u[k]));setTimeout(fire,5);return Promise.resolve();},
    remove(){setp(path,null);setTimeout(fire,5);return Promise.resolve();},
    transaction(fn){const v=fn(get(path));setp(path,v);setTimeout(fire,5);return Promise.resolve({committed:true,snapshot:snap(path,v)});},
    push(v){const k='p'+Math.random().toString(36).slice(2,8);const c=ref(path+'/'+k);c.key=k;if(v!==undefined){setp(path+'/'+k,v);setTimeout(fire,5);c.then=(f)=>Promise.resolve().then(f);c.catch=()=>c;}return c;},
    child(k){return ref(path+'/'+k);}
  };return r;}
  window.DATA=${JSON.stringify(DATA)};
  window.firebase={apps:[1],initializeApp(){return {};},database(){return {ref};},auth(){const AS=new URLSearchParams(location.search).get('as')||'u1';return {currentUser:{uid:AS},onAuthStateChanged(cb){setTimeout(()=>cb({uid:AS}),20);},signOut(){return Promise.resolve();}};}};
  window.__errors=[];window.addEventListener('error',e=>window.__errors.push(e.message+' @'+e.lineno));
})();
</script>`;
s=s.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+"><\/script>\s*/g,"");
s=s.replace("<style>",stub+"\n<style>");
fs.writeFileSync(out+"rotarsak-test.html",s);
["theme.css","theme.js","time24.js","nav.js"].forEach(f=>fs.copyFileSync(proj+f,out+f));
console.log("rotarsak-test.html laget");
