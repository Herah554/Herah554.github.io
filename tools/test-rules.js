/* Enkel simulering av uttrykkene i database.rules.json — fanger logiske feil før reglene
   publiseres. Erstatter IKKE Rules playground i Firebase-konsollen (syntaksen der er fasiten),
   men viser om hvert uttrykk gir riktig svar for eier, master, leder, operatør og bro.
   Kjør: node tools/test-rules.js */
const fs=require("fs"),path=require("path");
const R=JSON.parse(fs.readFileSync(path.join(__dirname,"..","database.rules.json"),"utf8")).rules;
function snap(v){return {val:()=>(v===undefined?null:v),exists:()=>v!==undefined&&v!==null,isNumber:()=>typeof v==="number",
  child:k=>snap(v&&typeof v==="object"?v[k]:undefined),hasChildren:l=>!!v&&l.every(k=>v[k]!==undefined)};}
function ev(expr,ctx){return !!new Function("root","data","newData","auth","$uid","$cid","$id","return ("+expr+")")(snap(ctx.db),snap(ctx.data),snap(ctx.newData),ctx.uid?{uid:ctx.uid}:null,ctx.$uid,ctx.$cid,ctx.$id);}
const users={o:{role:"master"},m:{role:"master"},m0:{role:"master",caseLevel:0},m3:{role:"master",caseLevel:3},l:{role:"leder"},l2:{role:"leder",caseLevel:2},
  op:{role:"linjeoperator"},opb:{role:"linjeoperator",boardAccess:true},b:{role:"bridge"}};
const DB={users,system:{owner:"o"}}, DB0={users,system:{}};
let fail=0,n=0;
function t(name,expr,ctx,want){n++;let got;try{got=ev(expr,ctx);}catch(e){got="FEIL: "+e.message;}if(got!==want){fail++;console.log("✗ "+name+" — fikk "+got+", ventet "+want);}}
const rd=(node,uid)=>({db:DB,uid}), each=(o,f)=>Object.keys(o).forEach(k=>f(k,o[k]));

/* lesing av saker per nivå */
each({o:1,m:1,m3:1,l:1,l2:1,opb:1,m0:0,op:0,b:0},(u,w)=>t("les cases som "+u,R.rca.cases[".read"],rd(0,u),!!w));
each({o:1,m:1,m3:1,l2:1,l:0,opb:0,m0:0,op:0,b:0},(u,w)=>t("les cases2 som "+u,R.rca.cases2[".read"],rd(0,u),!!w));
each({o:1,m3:1,m:0,l2:0,l:0,opb:0,m0:0,op:0,b:0},(u,w)=>t("les cases3 som "+u,R.rca.cases3[".read"],rd(0,u),!!w));
/* skriving av saker: må være saksbehandler OG ha nivået */
each({o:1,m:1,l:1,opb:1,op:0,b:0,m0:0},(u,w)=>t("skriv cases som "+u,R.rca.cases[".write"],rd(0,u),!!w));
each({o:1,m:1,l2:1,l:0,opb:0},(u,w)=>t("skriv cases2 som "+u,R.rca.cases2[".write"],rd(0,u),!!w));
each({o:1,m3:1,m:0,l2:0},(u,w)=>t("skriv cases3 som "+u,R.rca.cases3[".write"],rd(0,u),!!w));
t("uinnlogget leser ikke saker",R.rca.cases[".read"],{db:DB,uid:null},false);
/* rapporter: alle innloggede kan opprette, bare innsyn kan lese */
t("operatør oppretter rapport",R.rca.reports.$id[".write"],{db:DB,uid:"op",data:undefined,newData:{text:"x"}},true);
t("operatør overskriver ikke rapport",R.rca.reports.$id[".write"],{db:DB,uid:"op",data:{text:"x"},newData:{text:"y"}},false);
t("operatør leser ikke rapporter",R.rca.reports[".read"],rd(0,"op"),false);
t("leder leser rapporter",R.rca.reports[".read"],rd(0,"l"),true);
t("følg egen",R.rca.cases.$cid.followers.$uid[".write"],{db:DB,uid:"l",$uid:"l"},true);
t("følg for andre",R.rca.cases.$cid.followers.$uid[".write"],{db:DB,uid:"l",$uid:"m"},false);
t("følg uten innsyn",R.rca.cases2.$cid.followers.$uid[".write"],{db:DB,uid:"l",$uid:"l"},false);
t("løpenummer som leder",R.rca.counter[".write"],rd(0,"l"),true);
t("løpenummer som operatør",R.rca.counter[".write"],rd(0,"op"),false);

/* brukere */
const W=R.users.$uid[".write"], w=(uid,data,newData,db)=>({db:db||DB,uid,data,newData});
t("eier endrer master",W,w("o",users.m,{role:"master"}),true);
t("master endrer master",W,w("m",users.m3,{role:"master"}),false);
t("master endrer seg selv",W,w("m",users.m,{role:"master",name:"x"}),false);
t("master gjør leder til master",W,w("m",users.l,{role:"master"}),false);
t("master endrer leder",W,w("m",users.l,{role:"leder"}),true);
t("master oppretter operatør",W,w("m",undefined,{role:"linjeoperator"}),true);
t("master sletter operatør",W,w("m",users.op,undefined),true);
t("master sletter master",W,w("m",users.m3,undefined),false);
t("master sletter eier",W,w("m",users.o,undefined),false);
t("leder endrer operatør",W,w("l",users.op,{role:"linjeoperator"}),true);
t("leder endrer leder",W,w("l",users.l2,{role:"leder"}),false);
t("leder gjør operatør til leder",W,w("l",users.op,{role:"leder"}),false);
t("operatør endrer seg selv",W,w("op",users.op,{role:"master"}),false);
t("bro endrer bruker",W,w("b",users.op,{role:"linjeoperator"}),false);
t("FØR eier: master endrer master",W,w("m",users.m3,{role:"master"},DB0),true);
t("FØR eier: leder endrer master",W,w("l",users.m3,{role:"master"},DB0),false);
const V=R.users.$uid.caseLevel[".validate"], v=(uid,data,newData,db)=>({db:db||DB,uid,data,newData});
t("eier gir nivå 3",V,v("o",undefined,3),true);
t("master gir nivå 2",V,v("m",undefined,2),true);
t("master gir nivå 3",V,v("m",undefined,3),false);
t("master med nivå 3 gir nivå 3",V,v("m3",undefined,3),false);
t("master med nivå 0 gir nivå 1",V,v("m0",undefined,1),false);
t("master med nivå 0 gir nivå 0",V,v("m0",undefined,0),true);
t("leder gir operatør nivå 1",V,v("l",undefined,1),false);
t("leder lar nivå stå urørt",V,v("l",1,1),true);
t("nivå 4 finnes ikke",V,v("o",undefined,4),false);
t("nivå som tekst",V,v("o",undefined,"3"),false);
const H=R.users.$uid.hide[".validate"];
t("master skjuler sider",H,v("m",undefined,{saker:true}),true);
t("leder skjuler sider",H,v("l",undefined,{saker:true}),false);
const D=R.users.$uid.dashboardId[".write"];
t("leder bytter eget dashbord",D,{db:DB,uid:"l",$uid:"l"},true);
t("operatør bytter eget dashbord",D,{db:DB,uid:"op",$uid:"op"},false);
t("master tildeler dashbord til master",D,{db:DB,uid:"m",$uid:"m3"},true);

/* eier */
const O=R.system.owner[".write"];
t("master tar eierskap når ingen har det",O,{db:DB0,uid:"m",data:undefined,newData:"m"},true);
t("master setter en annen som eier",O,{db:DB0,uid:"m",data:undefined,newData:"l"},false);
t("leder tar eierskap",O,{db:DB0,uid:"l",data:undefined,newData:"l"},false);
t("master tar eierskap når eier finnes",O,{db:DB,uid:"m",data:"o",newData:"m"},false);
t("eier overfører eierskap",O,{db:DB,uid:"o",data:"o",newData:"m"},true);

/* det broen trenger skal være urørt */
["production","productHourly","active_product","opc_status"].forEach(k=>t("bro skriver "+k,R[k][".write"],{db:DB,uid:"b"},true));
t("bro oppretter hendelse",R.events.$id[".write"],{db:DB,uid:"b",data:undefined,newData:{line:"Glacier",ts:1}},true);
t("uinnlogget leser ingenting",R.events[".read"],{db:DB,uid:null},false);

console.log(fail?fail+" av "+n+" feilet":"alle "+n+" regeltester ok");process.exit(fail?1:0);
