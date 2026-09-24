/* nav.js — menyen skal stå riktig med én gang, ikke etter at Firebase har svart
   ================================================================================
   Hver side skjuler rollestyrte lenker (display:none) til brukerprofilen er lest fra
   Firebase. Det tar et halvt sekund, og menyen «hoppet» ved hvert sidebytte. Her
   huskes sist kjente rolle i localStorage og brukes ved DOMContentLoaded, før
   Firebase svarer. Når profilen er lest, oppdateres både menyen og minnet, så en
   feil rolle rettes innen et sekund. Ved utlogging tømmes minnet.

   Reglene her SKAL være de samme som i hver sides egen auth-kode:
     master  → alt
     leder   → Rapporter, Produkter, Skiftrapport, Innstillinger, Brukere, Dashbord-oppsett
     operatør → Dashbord (+ Skiftrapport ved shiftAccess)
   Lastes etter theme.js på alle sider unntatt login.html. */
(function(){
  'use strict';
  var KEY='diplomis.nav';
  function show(id,on){var el=document.getElementById(id);if(el)el.style.display=on?'':'none';}
  function apply(p){
    var r=p.role, staff=(r==='master'||r==='leder');
    show('nav-rap',staff);show('nav-prod',staff);show('nav-set',staff);show('nav-usr',staff);
    show('nav-import',r==='master');show('nav-logg',r==='master');
    show('nav-skift',staff||p.shiftAccess===true);
    show('nav-dash',r!=='linjeoperator');
  }
  function remember(p){
    try{localStorage.setItem(KEY,JSON.stringify({role:p.role,shiftAccess:p.shiftAccess===true}));}catch(e){}
    apply(p);
  }
  function forget(){try{localStorage.removeItem(KEY);}catch(e){}}
  window.navRemember=remember;

  function start(){
    try{var p=JSON.parse(localStorage.getItem(KEY)||'null');if(p&&p.role)apply(p);}catch(e){}
    // Bekreft mot Firebase når den er klar — sidene har allerede initialisert appen
    if(window.firebase&&firebase.apps&&firebase.apps.length&&firebase.auth){
      firebase.auth().onAuthStateChanged(function(u){
        if(!u){forget();return;}
        firebase.database().ref('users/'+u.uid).once('value').then(function(s){
          var v=s.val();if(v&&v.role)remember(v);
        }).catch(function(){});
      });
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
