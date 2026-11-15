#!/usr/bin/env node
/* Genera wiki/index.html (bestiario) a partir de los datos reales del juego.
   Uso: node scripts/wiki.js            (o: npm run wiki)
        node scripts/wiki.js --check    (solo valida, no escribe; lo corre npm test)
   - Criaturas, tipos, segmentos y estados: src/logic.js (única fuente de las cifras).
   - Descripciones: data/wiki/criaturas.json (texto a mano; falla si falta alguna).
   - Arte: ../art/web/<id>-ficha-web.webp (256 px, cuadrícula y detalle; la de 512 pesa
     ~4 veces más y en el diálogo se ve igual), ruta relativa: funciona en GitHub Pages
     (/wiki/) y abriendo el archivo desde el repo.
   wiki/index.html es generado: no se edita a mano. */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const D = require(path.join(RAIZ, 'src', 'logic.js'));
const desc = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'wiki', 'criaturas.json'), 'utf8'));
const version = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).version;

// Validación: toda criatura con descripción y arte; ninguna descripción huérfana.
const errores = [];
D.CREATURES.forEach(c => {
  const d = desc[c.id];
  if (!d || !d.descripcion || !d.juego) errores.push('Falta descripción/juego de ' + c.id);
  const f = path.join(RAIZ, 'art', 'web', c.id + '-ficha-web.webp');
  if (!fs.existsSync(f)) errores.push('Falta arte: ' + path.relative(RAIZ, f));
  const suma = c.wheel.reduce((a, s) => a + s.w, 0);
  if (suma !== 96) errores.push(c.id + ': la ruleta suma ' + suma + ', no 96');
});
Object.keys(desc).forEach(id => { if (!id.startsWith('_') && !D.CREATURE[id]) errores.push('Descripción huérfana: ' + id); });
if (errores.length) { console.error(errores.join('\n')); process.exit(1); }
if (process.argv.includes('--check')) {
  console.log('Wiki OK: ' + D.CREATURES.length + ' criaturas con descripción, arte y ruleta de 96');
  process.exit(0);
}

const datos = {
  tipos: D.TYPES, orden: D.TYPE_ORDER, seg: D.SEG, estados: D.STATUS, fx: D.FX, rareza: D.RARITY,
  criaturas: D.CREATURES.map(c => ({
    id: c.id, nombre: c.name, tipo: c.type, mp: c.mp, rareza: c.rarity,
    ruleta: c.wheel, ...desc[c.id]
  }))
};
const json = JSON.stringify(datos).replace(/</g, '\\u003c');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Bestiario · Hilos del Tiempo</title>
<meta name="description" content="Las 25 criaturas de Hilos del Tiempo: arte, descripción y ruleta de combate.">
<style>
@font-face{font-family:'Lilita One';font-weight:400;font-display:swap;src:url(../src/fonts/lilita-one-latin.woff2) format('woff2')}
@font-face{font-family:'Nunito';font-weight:200 1000;font-display:swap;src:url(../src/fonts/nunito-latin.woff2) format('woff2')}
:root{--bg:#0e1322;--panel:#171e35;--panel2:#1e2745;--line:#2c3860;--txt:#e9edff;--mut:#9aa6cf;--acc:#3ddbc4;--gold:#e8b730}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--txt);font-family:'Nunito',system-ui,sans-serif;line-height:1.5;
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
h1,h2,h3{font-family:'Lilita One','Nunito',sans-serif;font-weight:400;margin:0;letter-spacing:.2px}
a{color:var(--acc)}
.wrap{max-width:1080px;margin:0 auto;padding:20px 16px 48px}
header.top{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 16px;margin-bottom:14px}
header.top h1{font-size:clamp(28px,6vw,40px);color:var(--gold)}
header.top p{margin:0;color:var(--mut);flex:1 1 260px}
.controls{position:sticky;top:0;z-index:5;background:linear-gradient(var(--bg) 82%,transparent);padding:8px 0 12px}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}
.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--panel);color:var(--txt);
  border-radius:999px;padding:6px 12px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;min-height:36px}
.chip[aria-pressed=true]{background:var(--panel2);border-color:var(--acc);box-shadow:0 0 0 1px var(--acc) inset}
.chip .dot{width:10px;height:10px;border-radius:50%}
.chip:focus-visible,.card:focus-visible,input:focus-visible,button:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
input[type=search]{flex:1 1 200px;min-width:0;background:var(--panel);border:1px solid var(--line);color:var(--txt);border-radius:999px;
  padding:8px 14px;font:inherit;min-height:40px}
.count{color:var(--mut);font-size:14px;margin-left:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:10px 10px 12px;text-align:center;cursor:pointer;
  color:inherit;font:inherit;display:flex;flex-direction:column;align-items:center;gap:4px;transition:transform .15s,border-color .15s}
.card:hover{transform:translateY(-2px);border-color:var(--acc)}
.card img{width:100%;max-width:150px;aspect-ratio:1;object-fit:contain}
.card .n{font-family:'Lilita One',sans-serif;font-size:18px}
.card .m{font-size:12.5px;color:var(--mut);display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
.card[data-r=e]{border-color:#8a6d16;background:linear-gradient(160deg,#2a2410,var(--panel) 55%)}
.empty{grid-column:1/-1;text-align:center;color:var(--mut);padding:40px 0}
.tag{display:inline-block;border-radius:999px;padding:1px 9px;font-size:12px;font-weight:800;border:1px solid var(--line)}
.tag.e{color:var(--gold);border-color:var(--gold)}.tag.r{color:#9ad0ff;border-color:#4a78a8}
section.ley{margin-top:36px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px}
section.ley h2{font-size:22px;margin-bottom:8px}
.ley ul{margin:6px 0 0;padding-left:20px}.ley li{margin:4px 0}
.cycle{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0}
.sw{display:inline-block;width:18px;height:18px;border-radius:5px;vertical-align:-4px;margin-right:6px;border:1px solid #0006}
footer{margin-top:28px;color:var(--mut);font-size:13px;text-align:center}
/* detalle */
dialog{border:1px solid var(--line);border-radius:20px;background:var(--panel);color:var(--txt);padding:0;width:min(760px,calc(100vw - 20px));
  max-height:calc(100dvh - 20px);overflow:auto}
dialog::backdrop{background:#050810cc}
.det{padding:18px 18px 22px;display:grid;gap:16px;grid-template-columns:1fr}
@media(min-width:640px){.det{grid-template-columns:minmax(0,260px) 1fr}}
.det .art{background:radial-gradient(circle at 50% 40%,var(--panel2),var(--bg));border-radius:16px;padding:8px;align-self:start}
.det .art img{width:100%;aspect-ratio:1;object-fit:contain;display:block}
.det h2{font-size:32px;line-height:1.1}
.det .chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}
.det .chips .tag{padding:3px 10px;font-size:13px}
.det p{margin:0 0 10px}.det .k{color:var(--mut);font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin:12px 0 2px}
.wheelbox{grid-column:1/-1;display:grid;gap:16px;grid-template-columns:1fr;align-items:center;border-top:1px solid var(--line);padding-top:14px}
@media(min-width:640px){.wheelbox{grid-template-columns:200px 1fr}}
.wheelbox svg{width:100%;max-width:220px;margin:0 auto;display:block}
.moves{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.moves li{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:start;background:var(--panel2);border-radius:10px;padding:7px 10px;font-size:14px}
.moves .b{font-weight:800}.moves .s{color:var(--mut);font-size:12.5px;display:block;font-weight:600}
.moves .pc{font-weight:800;color:var(--mut);white-space:nowrap}
.nav{position:sticky;top:0;display:flex;justify-content:space-between;gap:8px;padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--line);z-index:2}
.nav button{background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:999px;padding:6px 14px;font:inherit;font-weight:700;cursor:pointer;min-height:38px}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>Bestiario</h1>
    <p>Las criaturas de <b>Hilos del Tiempo</b>, cosidas con el Gran Telar. Toca una figura para ver su arte, cómo es y su ruleta de combate.</p>
  </header>

  <div class="controls">
    <div class="row" id="f-tipo" role="group" aria-label="Filtrar por tipo"></div>
    <div class="row">
      <span id="f-rareza" class="row" style="margin:0" role="group" aria-label="Filtrar por rareza"></span>
      <input type="search" id="q" placeholder="Buscar criatura…" aria-label="Buscar criatura">
      <span class="count" id="cuenta" aria-live="polite"></span>
    </div>
  </div>

  <div class="grid" id="grid"></div>

  <section class="ley" id="ley">
    <h2>Cómo leer una ficha</h2>
    <ul>
      <li><b>MP</b> es el movimiento: cuántas casillas puede avanzar la figura por turno (1 a 3). Las de MP bajo suelen golpear más fuerte; las de MP alto, más suave.</li>
      <li><b>La ruleta</b> es el combate: cada segmento ocupa un trozo proporcional a su peso (todas suman 96). Se compara el segmento de cada bando según el color:</li>
    </ul>
    <ul id="leg-seg"></ul>
    <ul>
      <li><b>Tipos:</b> cada uno vence al siguiente y la ventaja suma +10 al daño de los segmentos blancos.</li>
    </ul>
    <div class="cycle" id="ciclo"></div>
  </section>

  <footer>Hilos del Tiempo · v${version} · <a href="../">Jugar</a></footer>
</div>

<dialog id="dlg" aria-label="Ficha de criatura"></dialog>

<script id="datos" type="application/json">${json}</script>
<script>
(function(){
'use strict';
var DB = JSON.parse(document.getElementById('datos').textContent);
var C = DB.criaturas, $ = function(s,r){return (r||document).querySelector(s)};
var esc = function(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var ART = '../art/web/';
var filtro = {tipo:null, rareza:null, q:''};

function norm(t){return t.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase()}
function debilAnte(t){return DB.orden.filter(function(x){return DB.tipos[x].beats===t})[0]}

/* ---- filtros ---- */
var ft = $('#f-tipo');
ft.innerHTML = DB.orden.map(function(t){return '<button class="chip" data-t="'+t+'" aria-pressed="false"><span class="dot" style="background:'+DB.tipos[t].color+'"></span>'+DB.tipos[t].name+'</button>'}).join('');
var fr = $('#f-rareza');
fr.innerHTML = ['c','r','e'].map(function(r){return '<button class="chip" data-r="'+r+'" aria-pressed="false">'+DB.rareza[r]+'</button>'}).join('');
function alternar(cont, attr, clave){
  cont.addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    var v = b.getAttribute(attr);
    filtro[clave] = filtro[clave]===v ? null : v;
    [].forEach.call(cont.querySelectorAll('button'), function(x){x.setAttribute('aria-pressed', x.getAttribute(attr)===filtro[clave])});
    pintar();
  });
}
alternar(ft,'data-t','tipo'); alternar(fr,'data-r','rareza');
$('#q').addEventListener('input', function(e){filtro.q = norm(e.target.value.trim()); pintar()});

/* ---- cuadrícula ---- */
function lista(){
  return C.filter(function(c){
    return (!filtro.tipo||c.tipo===filtro.tipo) && (!filtro.rareza||c.rareza===filtro.rareza) &&
      (!filtro.q || norm(c.nombre).indexOf(filtro.q)>=0);
  });
}
function pintar(){
  var l = lista();
  $('#grid').innerHTML = l.length ? l.map(function(c){
    var t = DB.tipos[c.tipo];
    return '<button class="card" data-id="'+c.id+'" data-r="'+c.rareza+'" aria-label="'+esc(c.nombre)+', '+t.name+', '+DB.rareza[c.rareza]+'">'+
      '<img loading="lazy" decoding="async" width="150" height="150" src="'+ART+c.id+'-ficha-web.webp" alt="">'+
      '<span class="n">'+esc(c.nombre)+'</span>'+
      '<span class="m"><span class="chip" style="min-height:0;padding:1px 9px;font-size:12px;cursor:default"><span class="dot" style="background:'+t.color+'"></span>'+t.name+'</span>'+
      '<span class="tag '+c.rareza+'">'+DB.rareza[c.rareza]+'</span><span>MP '+c.mp+'</span></span></button>';
  }).join('') : '<div class="empty">Ninguna criatura coincide con el filtro.</div>';
  $('#cuenta').textContent = l.length+' de '+C.length;
}
$('#grid').addEventListener('click', function(e){var b=e.target.closest('.card'); if(b) abrir(b.getAttribute('data-id'))});

/* ---- ruleta (dona SVG con patrones por color) ---- */
var PAT = {
  r:'<pattern id="p-r" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#e5484d"/><rect width="3" height="8" fill="#0003"/></pattern>',
  g:'<pattern id="p-g" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#e8b730"/><circle cx="4" cy="4" r="1.6" fill="#0004"/></pattern>',
  p:'<pattern id="p-p" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#8e5ce6"/><path d="M0 .5H8M.5 0V8" stroke="#fff4" stroke-width="1"/></pattern>',
  b:'<pattern id="p-b" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="#3d8bfd"/><path d="M0 4Q3 0 6 4T12 4" fill="none" stroke="#fff5" stroke-width="1.2"/></pattern>',
  w:'<pattern id="p-w" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#f3f1ea"/></pattern>'
};
function punto(cx,cy,r,a){return [cx+r*Math.cos(a), cy+r*Math.sin(a)]}
function dona(rul){
  var tot = rul.reduce(function(a,s){return a+s.w},0), a0 = -Math.PI/2, out = '', R=100, r=52, cx=110, cy=110;
  rul.forEach(function(s){
    var a1 = a0 + s.w/tot*2*Math.PI, g = a1-a0>Math.PI?1:0;
    var p1=punto(cx,cy,R,a0), p2=punto(cx,cy,R,a1), p3=punto(cx,cy,r,a1), p4=punto(cx,cy,r,a0);
    out += '<path d="M'+p1+'A'+R+' '+R+' 0 '+g+' 1 '+p2+'L'+p3+'A'+r+' '+r+' 0 '+g+' 0 '+p4+'Z" fill="url(#p-'+s.t+')" stroke="#0e1322" stroke-width="2.5"><title>'+esc(s.name)+'</title></path>';
    a0 = a1;
  });
  return '<svg viewBox="0 0 220 220" role="img" aria-label="Ruleta de combate"><defs>'+Object.keys(PAT).map(function(k){return PAT[k]}).join('')+'</defs>'+out+'</svg>';
}
function detalleSeg(s){
  if(s.t==='w') return 'Daño '+s.dmg;
  if(s.t==='g') return 'Daño '+s.dmg+(s.fx?' '+DB.fx[s.fx]:'');
  if(s.t==='p') return s.stars+(s.stars>1?' estrellas':' estrella')+' · '+DB.estados[s.st].name;
  if(s.t==='b') return 'Anula el combate';
  return 'No pasa nada';
}

/* ---- detalle ---- */
var dlg = $('#dlg'), actual = null;
function abrir(id, sinHash){
  var l = lista(), i = l.findIndex(function(c){return c.id===id});
  if(i<0){ l = C; i = C.findIndex(function(c){return c.id===id}); }
  var c = l[i], t = DB.tipos[c.tipo], tot = c.ruleta.reduce(function(a,s){return a+s.w},0);
  actual = {l:l, i:i};
  var vence = DB.tipos[t.beats], debil = DB.tipos[debilAnte(c.tipo)];
  dlg.innerHTML =
    '<div class="nav"><button data-nav="-1" aria-label="Anterior">‹ Anterior</button><button data-nav="0" aria-label="Cerrar">Cerrar</button><button data-nav="1" aria-label="Siguiente">Siguiente ›</button></div>'+
    '<div class="det"><div class="art"><img src="'+ART+c.id+'-ficha-web.webp" width="256" height="256" alt="'+esc(c.nombre)+'"></div>'+
    '<div><h2>'+esc(c.nombre)+'</h2><div class="chips">'+
      '<span class="tag" style="color:'+t.color+';border-color:'+t.color+'">'+t.name+'</span>'+
      '<span class="tag '+c.rareza+'">'+DB.rareza[c.rareza]+'</span><span class="tag">MP '+c.mp+'</span>'+
      '<span class="tag">Vence a '+vence.name+'</span><span class="tag">Débil ante '+debil.name+'</span></div>'+
      '<div class="k">Cómo es</div><p>'+esc(c.descripcion)+'</p>'+
      (c.guiño?'<div class="k">Guiño de época</div><p>'+esc(c.guiño)+'</p>':'')+
      '<div class="k">En combate</div><p>'+esc(c.juego)+'</p></div>'+
    '<div class="wheelbox">'+dona(c.ruleta)+'<ul class="moves">'+
      c.ruleta.map(function(s){return '<li><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><defs>'+PAT[s.t]+'</defs><rect x="1" y="1" width="20" height="20" rx="5" fill="url(#p-'+s.t+')" stroke="#0e1322"/></svg>'+
        '<span><span class="b">'+esc(s.name)+'</span><span class="s">'+DB.seg[s.t].name+' · '+detalleSeg(s)+'</span></span>'+
        '<span class="pc">'+Math.round(s.w/tot*100)+' %</span></li>'}).join('')+
    '</ul></div></div>';
  if(!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  if(!sinHash) history.replaceState(null,'','#'+id);
}
dlg.addEventListener('click', function(e){
  if(e.target===dlg){dlg.close();return}
  var b = e.target.closest('[data-nav]'); if(!b) return;
  var d = +b.getAttribute('data-nav'); if(d===0){dlg.close();return}
  var n = actual.l.length; abrir(actual.l[(actual.i+d+n)%n].id);
});
dlg.addEventListener('close', function(){history.replaceState(null,'',location.pathname+location.search)});
document.addEventListener('keydown', function(e){
  if(!dlg.open) return;
  if(e.key==='ArrowLeft'){e.preventDefault();var n=actual.l.length;abrir(actual.l[(actual.i-1+n)%n].id)}
  if(e.key==='ArrowRight'){e.preventDefault();var m=actual.l.length;abrir(actual.l[(actual.i+1)%m].id)}
});

/* ---- leyenda ---- */
var SEGTXT = {
  g:'gana a todos los demás colores (salvo azul); algunos traen un efecto extra.',
  p:'gana a blanco y rojo; el rival recibe un estado (veneno, parálisis, sueño o congelación).',
  w:'gana a rojo; el rival va a la enfermería. Entre blancos gana el mayor daño.',
  r:'el Fallo: pierde contra todo, y rojo contra rojo empata.',
  b:'anula el combate contra cualquier color.'
};
$('#leg-seg').innerHTML = ['g','p','w','r','b'].map(function(k){
  return '<li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style="vertical-align:-4px;margin-right:6px"><defs>'+PAT[k]+'</defs><rect x="1" y="1" width="16" height="16" rx="4" fill="url(#p-'+k+')" stroke="#0e1322"/></svg><b>'+DB.seg[k].name+':</b> '+SEGTXT[k]+'</li>';
}).join('');
$('#ciclo').innerHTML = DB.orden.map(function(t){
  return '<span class="chip" style="cursor:default"><span class="dot" style="background:'+DB.tipos[t].color+'"></span>'+DB.tipos[t].name+'</span><span aria-label="vence a">›</span>';
}).join('')+'<span class="chip" style="cursor:default"><span class="dot" style="background:'+DB.tipos[DB.orden[0]].color+'"></span>'+DB.tipos[DB.orden[0]].name+'</span>';

pintar();
function porHash(){ var h = location.hash.slice(1); if(h && C.some(function(c){return c.id===h})) abrir(h,true); }
window.addEventListener('hashchange', porHash);
porHash();
})();
</script>
</body>
</html>
`;
fs.mkdirSync(path.join(RAIZ, 'wiki'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'wiki', 'index.html'), html, 'utf8');
console.log('wiki/index.html: ' + D.CREATURES.length + ' criaturas, ' + Math.round(html.length / 1024) + ' KB');
