/* ═══════════════════════════════════════════════════════════
   WIDGET-REGISTER — delt mellom index.html og dashbord.html

   Ligger i egen fil nettopp fordi den brukes to steder. Legges en
   widget til her, dukker den opp begge steder uten videre.

   Layoutmodellen er {key:{on,order,w,h}} der w er antall kolonner
   (1-12) og h er høyde i piksler, eller 0 for innholdsstyrt.
   ═══════════════════════════════════════════════════════════ */
const GRID_COLS=12;
const WSTEPS=[2,3,4,6,8,12];
const MIN_H=90;   // laveste widget-høyde i piksler
const WIDGETS=[
  {key:'filter',       name:'Filtrer',                 w:12, els:['#fbar']},
  {key:'linjestatus',  name:'Linjestatus',             w:12, els:['#line-status-card']},
  {key:'kpi-nedetid',  name:'Nedetid i dag',           w:2,  els:['#k-today^.kpi']},
  {key:'kpi-oee',      name:'OEE i dag',               w:2,  els:['#k-oee^.kpi']},
  {key:'kpi-eff',      name:'Effektivitet i dag',      w:2,  els:['#k-eff^.kpi']},
  {key:'kpi-oee-wtd',  name:'OEE denne uken',          w:2,  els:['#k-oee-wtd^.kpi']},
  {key:'kpi-oee-mtd',  name:'OEE denne måneden',       w:2,  els:['#k-oee-mtd^.kpi']},
  {key:'kpi-hendelser',name:'Hendelser denne uke',     w:2,  els:['#k-week^.kpi']},
  {key:'oee-utvikling',name:'OEE-utvikling',           w:6,  els:['#oee-tabs','#oee-card']},
  {key:'produksjon',   name:'Produksjon',              w:6,  els:['#prod-tabs','#pv-main']},
  {key:'nd-daily',     name:'Nedetid per time i dag',  w:12, els:['#cp-daily']},
  {key:'nd-weekly',    name:'Nedetid per dag i uken',  w:6,  els:['#cp-weekly']},
  {key:'nd-causes',    name:'Årsaker og maskinfordeling',w:12,els:['#cp-causes']},
  {key:'nd-maskiner',  name:'Maskinliste',             w:6,  els:['#cp-maskiner']},
  {key:'nd-heatmap',   name:'Heatmap',                 w:12, els:['#cp-heatmap']},
  {key:'plan',         name:'Plan mot faktisk',        w:6,  els:['#pva-body^.card']},
  {key:'effektivitet', name:'Effektivitet over tid',   w:12, els:['#ch-eff-trend^.card']},
  {key:'registrer',    name:'Registrer hendelse',      w:6,  els:['#f-line^.card']},
  {key:'siste',        name:'Siste hendelser',         w:6,  els:['#hist^.card']},
  {key:'slettesok',    name:'Slettesøknader',        w:12, els:['#dreq-card'], staff:true},
  {key:'logg',         name:'Hendelseslogg',           w:12, els:['#tbl^.card']}
];
function stdWidgets(){const o={};WIDGETS.forEach((w,i)=>{o[w.key]={on:true,order:i,w:w.w};});return o;}
/* Tåler både nye maler og maler uten alle nøkler */
function normWidgets(cfg){
  const src=(cfg&&cfg.widgets)||{};
  return WIDGETS.map((w,i)=>{
    const c=src[w.key]||{};
    return{key:w.key,name:w.name,
      on:c.on!==false,
      order:(typeof c.order==='number')?c.order:i,
      w:(typeof c.w==='number'&&c.w>0&&c.w<=GRID_COLS)?c.w:w.w,
      h:(typeof c.h==='number'&&c.h>=MIN_H)?c.h:0};
  }).sort((a,b)=>a.order-b.order);
}
