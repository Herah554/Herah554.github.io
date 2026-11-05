/* nav.js — én felles meny for alle sider, med nedtrekksgrupper
   ================================================================================
   Sidene har hver sin <nav> i HTML. Ved DOMContentLoaded byttes lenkene ut med
   denne strukturen (logo og .ml med brukernavn/logg ut/temabryter beholdes):

     Dashboard · Tavle · Saker · Rapporter ▾ (Rapporter, Produkter) · Skiftrapport ·
     Admin ▾ (Innstillinger, Brukere, Dashbord-oppsett, Import, Logg & data)

   Rollestyring: sist kjente rolle fra localStorage (diplomis.nav) brukes med én gang,
   så menyen ikke hopper; profilen bekreftes mot users/{uid} når Firebase svarer og
   minnet tømmes ved utlogging. Lenkene beholder id-ene (nav-rap, nav-set …) så
   sidenes egen auth-kode fortsatt kan vise/skjule dem — gruppene følger barna.

     master   → alt
     leder    → Rapporter, Produkter, Skiftrapport, Innstillinger, Brukere, Dashbord-oppsett
     operatør → Dashbord, Tavle (+ Skiftrapport ved shiftAccess)
   Ny side: legg den inn i MENU under, ikke i hver HTML-fil. */
(function(){
  'use strict';
  var KEY='diplomis.nav';
  var MENU=[
    {href:'index.html',label:'Dashboard'},
    {href:'tavle.html',label:'Tavle',id:'nav-tavle'},
    {href:'rotarsak.html',label:'Saker',id:'nav-rca'},
    {label:'Rapporter',items:[
      {href:'rapporter.html',label:'Rapporter',id:'nav-rap'},
      {href:'produkter.html',label:'Produkter',id:'nav-prod'}]},
    {href:'skiftrapport.html',label:'Skiftrapport',id:'nav-skift'},
    {label:'Admin',items:[
      {href:'innstillinger.html',label:'Innstillinger',id:'nav-set'},
      {href:'brukere.html',label:'Brukere',id:'nav-usr'},
      {href:'dashbord.html',label:'Dashbord-oppsett',id:'nav-dash'},
      {href:'import.html',label:'Import',id:'nav-import'},
      {href:'logg.html',label:'Logg & data',id:'nav-logg'}]}
  ];
  var CSS='.nav-grp{position:relative}.nav-grp>.nl{cursor:pointer;user-select:none}.nav-grp>.nl::after{content:" ▾";font-size:10px;opacity:.6}'
    +'.nav-dd{display:none;position:absolute;top:calc(100% + 4px);left:0;min-width:180px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shm);padding:4px;z-index:60;flex-direction:column}'
    +'.nav-grp.open>.nav-dd,.nav-grp:hover>.nav-dd{display:flex}.nav-dd .nl{display:block;padding:7px 12px}'
    +'@media(max-width:700px){.nav-dd{position:fixed;left:8px;right:8px;min-width:0}}';

  // «-test» fjernes så testkopiene fra tools/ (rotarsak-test.html) oppfører seg som den ekte siden
  function current(){return (location.pathname.split('/').pop()||'index.html').toLowerCase().replace('-test.html','.html');}
  function link(it){
    var a=document.createElement('a');a.href=it.href;a.className='nl'+(current()===it.href?' on':'');a.textContent=it.label;
    if(it.id){a.id=it.id;a.style.display='none';}
    return a;
  }
  function build(nav){
    if(nav.dataset.built)return;nav.dataset.built='1';
    nav.style.zIndex='160';   // over det faste ubehandlet-banneret (150), under modaler (200)
    var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    var old=nav.querySelectorAll(':scope > a.nl');old.forEach(function(a){a.remove();});
    var ml=nav.querySelector('.ml');
    MENU.forEach(function(m){
      var el;
      if(m.items){
        el=document.createElement('div');el.className='nav-grp';el.id='grp-'+m.label.toLowerCase();
        var lab=document.createElement('span');lab.className='nl'+(m.items.some(function(i){return i.href===current();})?' on':'');lab.textContent=m.label;
        lab.addEventListener('click',function(ev){ev.stopPropagation();document.querySelectorAll('.nav-grp.open').forEach(function(g){if(g!==el)g.classList.remove('open');});el.classList.toggle('open');});
        var dd=document.createElement('div');dd.className='nav-dd';
        m.items.forEach(function(i){dd.appendChild(link(i));});
        el.appendChild(lab);el.appendChild(dd);
      }else el=link(m);
      nav.insertBefore(el,ml||null);
    });
    document.addEventListener('click',function(){document.querySelectorAll('.nav-grp.open').forEach(function(g){g.classList.remove('open');});});
  }
  /* Sidetilgang per bruker (05.11.2026): users/{uid}.hide = {modul:true} settes i Brukere.
     Skjulte sider fjernes fra menyen, og åpnes en skjult side direkte, sendes brukeren til
     dashbordet. Eieren (system/owner) ser alltid alt. Dette styrer hva som VISES — hva som
     faktisk kan leses i databasen bestemmes av reglene (database.rules.json). */
  var MODS=[['tavle','Tavle','nav-tavle','tavle.html','alle'],['saker','Saker','nav-rca','rotarsak.html','alle'],
    ['skiftrapport','Skiftrapport','nav-skift','skiftrapport.html','alle'],['rapporter','Rapporter','nav-rap','rapporter.html','leder'],
    ['produkter','Produkter','nav-prod','produkter.html','leder'],['innstillinger','Innstillinger','nav-set','innstillinger.html','leder'],
    ['brukere','Brukere','nav-usr','brukere.html','leder'],['dashbord','Dashbord-oppsett','nav-dash','dashbord.html','leder'],
    ['import','Import','nav-import','import.html','master'],['logg','Logg & data','nav-logg','logg.html','master']];
  window.navModules=MODS.map(function(m){return {key:m[0],label:m[1],min:m[4]};});
  var HID={}, OWNER=false;
  function hidden(p){return (p&&!p.owner&&p.hide)||{};}
  function applyHide(p){
    var h=hidden(p), css='';HID={};
    MODS.forEach(function(m){if(h[m[0]]){HID[m[2]]=1;css+='#'+m[2]+'{display:none!important}';}});
    var st=document.getElementById('nav-hidecss');
    if(!st){st=document.createElement('style');st.id='nav-hidecss';document.head.appendChild(st);}
    st.textContent=css;
  }
  /* confirmed=false: bare husket profil — skjul siden til profilen er bekreftet, så den ikke blinker */
  function guard(p,confirmed){
    var h=hidden(p), cur=current(), mod=null;
    MODS.forEach(function(m){if(m[3]===cur)mod=m[0];});
    var blocked=!!(mod&&h[mod]);
    if(blocked&&confirmed){location.replace('index.html');return;}
    document.documentElement.style.visibility=blocked?'hidden':'';
  }
  function show(id,on){var el=document.getElementById(id);if(el)el.style.display=on?'':'none';}
  function syncGroups(){
    document.querySelectorAll('.nav-grp').forEach(function(g){
      var any=Array.prototype.some.call(g.querySelectorAll('.nav-dd .nl'),function(a){return a.style.display!=='none'&&!HID[a.id];});
      g.style.display=any?'':'none';
    });
  }
  function apply(p){
    var r=p.role, staff=(r==='master'||r==='leder');
    show('nav-rap',staff);show('nav-prod',staff);show('nav-set',staff);show('nav-usr',staff);
    show('nav-import',r==='master');show('nav-logg',r==='master');
    show('nav-skift',staff||p.shiftAccess===true);
    show('nav-dash',r!=='linjeoperator');
    show('nav-tavle',true);show('nav-rca',true);
    applyHide(p);
    syncGroups();
  }
  function remember(p){
    if(p.owner===undefined)p=Object.assign({},p,{owner:OWNER});else OWNER=!!p.owner;
    try{localStorage.setItem(KEY,JSON.stringify({role:p.role,shiftAccess:p.shiftAccess===true,hide:p.hide||null,owner:!!p.owner}));}catch(e){}
    apply(p);guard(p,true);
  }
  function forget(){try{localStorage.removeItem(KEY);}catch(e){}}
  window.navRemember=remember;

  function start(){
    var nav=document.querySelector('nav');if(!nav)return;
    build(nav);
    try{var p=JSON.parse(localStorage.getItem(KEY)||'null');if(p&&p.role){OWNER=!!p.owner;apply(p);guard(p,false);}}catch(e){}
    // Sidenes egen kode kan vise/skjule enkeltlenker etterpå — hold gruppene i takt
    new MutationObserver(syncGroups).observe(nav,{attributes:true,subtree:true,attributeFilter:['style']});
    if(window.firebase&&firebase.apps&&firebase.apps.length&&firebase.auth){
      firebase.auth().onAuthStateChanged(function(u){
        if(!u){forget();document.documentElement.style.visibility='';return;}
        var dbn=firebase.database();
        // system/owner kan være stengt til de nye reglene er publisert — da er ingen eier
        Promise.all([dbn.ref('users/'+u.uid).once('value'),dbn.ref('system/owner').once('value').then(function(s){return s.val();}).catch(function(){return null;})])
          .then(function(r){var v=r[0].val();if(v&&v.role)remember(Object.assign({},v,{owner:r[1]===u.uid}));else document.documentElement.style.visibility='';})
          .catch(function(){document.documentElement.style.visibility='';});
      });
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

/* Fersk side (05.11.2026)
   GitHub Pages sender Cache-Control: max-age=600 også på HTML-en, og no-cache-metataggene i
   sidene styrer ikke nettleserens HTTP-cache. Har du nettopp vært på en side, viser nettleseren
   derfor den gamle kopien i opptil ti minutter etter en push — med gamle ?v=-lenker til
   theme.css osv. Det så ut som «Saker fikk ikke ny profil, resten fikk».
   Her spør vi serveren (HEAD, utenom cache) når siden sist ble endret. Er den nyere enn kopien
   vi viser, lastes siden på nytt — en reload henter hoveddokumentet friskt. sessionStorage
   hindrer løkke: maks én reload per side per serverversjon. */
(function(){
  try{
    if(!window.fetch||!/^https?:$/.test(location.protocol))return;
    var path=location.pathname, mine=Date.parse(document.lastModified);
    if(!mine)return;
    fetch(path+'?_='+Date.now(),{method:'HEAD',cache:'no-store'}).then(function(r){
      var lm=r.ok&&r.headers.get('Last-Modified');
      if(!lm)return;
      var srv=Date.parse(lm);
      if(!(srv>mine+2000))return;
      var k='diplomis.fresh:'+path;
      if(sessionStorage.getItem(k)===String(srv))return;
      sessionStorage.setItem(k,String(srv));
      location.reload();
    }).catch(function(){});
  }catch(e){}
})();
