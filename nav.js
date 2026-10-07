/* nav.js — én felles meny for alle sider, med nedtrekksgrupper
   ================================================================================
   Sidene har hver sin <nav> i HTML. Ved DOMContentLoaded byttes lenkene ut med
   denne strukturen (logo og .ml med brukernavn/logg ut/temabryter beholdes):

     Dashboard · Tavle · Rapporter ▾ (Rapporter, Produkter) · Skiftrapport ·
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

  function current(){return (location.pathname.split('/').pop()||'index.html').toLowerCase();}
  function link(it){
    var a=document.createElement('a');a.href=it.href;a.className='nl'+(current()===it.href?' on':'');a.textContent=it.label;
    if(it.id){a.id=it.id;a.style.display='none';}
    return a;
  }
  function build(nav){
    if(nav.dataset.built)return;nav.dataset.built='1';
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
  function show(id,on){var el=document.getElementById(id);if(el)el.style.display=on?'':'none';}
  function syncGroups(){
    document.querySelectorAll('.nav-grp').forEach(function(g){
      var any=Array.prototype.some.call(g.querySelectorAll('.nav-dd .nl'),function(a){return a.style.display!=='none';});
      g.style.display=any?'':'none';
    });
  }
  function apply(p){
    var r=p.role, staff=(r==='master'||r==='leder');
    show('nav-rap',staff);show('nav-prod',staff);show('nav-set',staff);show('nav-usr',staff);
    show('nav-import',r==='master');show('nav-logg',r==='master');
    show('nav-skift',staff||p.shiftAccess===true);
    show('nav-dash',r!=='linjeoperator');
    show('nav-tavle',true);
    syncGroups();
  }
  function remember(p){try{localStorage.setItem(KEY,JSON.stringify({role:p.role,shiftAccess:p.shiftAccess===true}));}catch(e){}apply(p);}
  function forget(){try{localStorage.removeItem(KEY);}catch(e){}}
  window.navRemember=remember;

  function start(){
    var nav=document.querySelector('nav');if(!nav)return;
    build(nav);
    try{var p=JSON.parse(localStorage.getItem(KEY)||'null');if(p&&p.role)apply(p);}catch(e){}
    // Sidenes egen kode kan vise/skjule enkeltlenker etterpå — hold gruppene i takt
    new MutationObserver(syncGroups).observe(nav,{attributes:true,subtree:true,attributeFilter:['style']});
    if(window.firebase&&firebase.apps&&firebase.apps.length&&firebase.auth){
      firebase.auth().onAuthStateChanged(function(u){
        if(!u){forget();return;}
        firebase.database().ref('users/'+u.uid).once('value').then(function(s){var v=s.val();if(v&&v.role)remember(v);}).catch(function(){});
      });
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
