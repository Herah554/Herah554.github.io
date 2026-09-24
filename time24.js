/* time24.js — 24-timers klokkeslett i alle skjema
   ====================================================
   Nettleseren viser <input type="time"> og <input type="datetime-local"> med
   AM/PM når Windows/Chrome står på engelsk, og det kan ikke overstyres med
   CSS eller lang-attributt. Derfor bytter vi dem ut:

   - type="time"  →  tekstfelt «HH:MM» som retter seg selv ved blur:
                     «8» → 08:00, «830» → 08:30, «8.30» → 08:30, «14:5» → 14:05.
                     Ugyldig → tømmes og markeres rødt. .value leses og settes
                     som før («HH:MM»), så sidene trenger ingen endring.
   - datetime-local → dato-felt + HH:MM-felt. Det opprinnelige feltet skjules,
                     men beholder id og en .value som gir/tar «YYYY-MM-DDTHH:MM»,
                     så eksisterende kode virker uendret.

   Nye felt som lages senere (behandlingsmodalen, linjekortene i Innstillinger)
   fanges av en MutationObserver. Lastes etter theme.js på alle sider. */
(function(){
  'use strict';
  var pad=function(n){return String(n).padStart(2,'0');};

  /* «8», «830», «8.30», «8:3», «1430» → «HH:MM» eller '' */
  function normHM(v){
    v=String(v||'').trim().replace(/[.,;h ]/g,':');
    if(!v)return '';
    var h,m,x;
    if(v.indexOf(':')>=0){x=v.split(':');h=parseInt(x[0],10);m=parseInt(x[1]||'0',10);}
    else if(v.length<=2){h=parseInt(v,10);m=0;}
    else if(v.length===3){h=parseInt(v.slice(0,1),10);m=parseInt(v.slice(1),10);}
    else{h=parseInt(v.slice(0,2),10);m=parseInt(v.slice(2,4),10);}
    if(isNaN(h)||isNaN(m))return '';
    if(h===24&&m===0)h=0;
    if(h<0||h>23||m<0||m>59)return '';
    return pad(h)+':'+pad(m);
  }

  function makeTimeText(el){
    if(el.dataset.t24)return;
    el.dataset.t24='1';
    var cur=el.value;
    el.type='text';
    el.inputMode='numeric';
    el.placeholder='HH:MM';
    el.maxLength=5;
    el.autocomplete='off';
    el.classList.add('t24');
    if(cur)el.value=cur;
    el.addEventListener('blur',function(){
      var raw=el.value, n=normHM(raw);
      el.classList.toggle('t24-bad',!!raw&&!n);
      if(n!==raw){el.value=n;el.dispatchEvent(new Event('change',{bubbles:true}));}
    });
    el.addEventListener('keydown',function(ev){if(ev.key==='Enter'){el.blur();}});
  }

  function makeDateTime(el){
    if(el.dataset.t24)return;
    el.dataset.t24='1';
    var init=el.value||'';
    var wrap=document.createElement('span');
    wrap.className='t24-pair';
    var d=document.createElement('input');d.type='date';d.className=el.className;d.style.flex='1.4';
    var t=document.createElement('input');t.type='text';t.className=el.className;t.style.flex='1';
    makeTimeText(t);
    el.parentNode.insertBefore(wrap,el);
    wrap.appendChild(d);wrap.appendChild(t);wrap.appendChild(el);
    el.type='hidden';
    function setPair(v){
      v=String(v||'');
      var m=v.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
      d.value=m?m[1]:'';t.value=m?m[2]:'';
    }
    // .value på det skjulte feltet speiler paret — eksisterende kode leser og skriver som før
    Object.defineProperty(el,'value',{
      get:function(){return (d.value&&t.value)?d.value+'T'+t.value:'';},
      set:function(v){setPair(v);},
      configurable:true
    });
    setPair(init);
    function sync(){el.dispatchEvent(new Event('change',{bubbles:true}));}
    d.addEventListener('change',sync);t.addEventListener('change',sync);
  }

  function scan(root){
    (root.querySelectorAll?root:document).querySelectorAll('input[type="time"]').forEach(makeTimeText);
    (root.querySelectorAll?root:document).querySelectorAll('input[type="datetime-local"]').forEach(makeDateTime);
  }

  var css=document.createElement('style');
  css.textContent='.t24{font-variant-numeric:tabular-nums}.t24-bad{border-color:#dc2626!important;background:rgba(220,38,38,.08)!important}'
    +'.t24-pair{display:flex;gap:6px;width:100%}.t24-pair input{min-width:0}';
  document.head.appendChild(css);

  function start(){
    scan(document);
    new MutationObserver(function(muts){
      muts.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(n.nodeType!==1)return;
          if(n.matches&&n.matches('input[type="time"]'))makeTimeText(n);
          else if(n.matches&&n.matches('input[type="datetime-local"]'))makeDateTime(n);
          else scan(n);
        });
      });
    }).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
