/* ===================== INTERFAZ (DOM) ===================== */
(function () {
  'use strict';
  const D = window.Duel, AI = window.DuelAI;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pct = w => (w / 96 * 100).toFixed(1).replace('.', ',') + '%';

  /* ---------- Guardado opcional (localStorage en la web; con respaldo nativo en la app, ver platform.js) ---------- */
  const P = window.Platform;
  const SAVE_KEY = 'duelo-nodos-v1';
  const store = {
    get() { try { const r = P.storage.get(SAVE_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
    set(v) { P.storage.set(SAVE_KEY, JSON.stringify(v)); },
    del() { P.storage.del(SAVE_KEY); }
  };

  const ui = {
    level: 'normal', team: [], cpuTeam: [], state: null,
    sel: null, info: null, confirm: null, busy: false, fast: false,
    lastCpuMs: null, log: [], figEls: new Map(), msg: '',
    guide: null // tutorial en curso (DuelTutorial.createGuide) o null
  };
  /* ---------- Versión y comentarios (los inyecta build.py desde package.json y src/config.json) ---------- */
  const CFG = window.DUEL_CONFIG || { version: 'dev', feedbackUrl: '' };
  const feedbackUrl = CFG.feedbackUrl ? CFG.feedbackUrl.split('{version}').join(encodeURIComponent(CFG.version)) : '';
  function openFeedback() { if (feedbackUrl) window.open(feedbackUrl, '_blank', 'noopener'); }

  const TUT = window.DuelTutorial;

  // Tablero de la partida en curso (la partida guarda su boardId; ver logic.js)
  const brd = () => D.boardOf(ui.state);
  // Duelo que se juega desde la pantalla de equipo
  const DUEL_LIBRE = D.DUELS.libre;

  const wait = ms => new Promise(r => setTimeout(r, reduced ? Math.min(ms, 120) : (ui.fast ? ms * 0.45 : ms)));

  /* ---------- Arte de criaturas e íconos ----------
     DUEL_ART (lo incrusta build.py desde data/art.json): { id: { token, ficha } } como data URI.
     Si una criatura no tiene arte, o la imagen falla, se muestra su emoji. */
  const ART = window.DUEL_ART || {};
  const STATUS_ICON = { poison: 'st-poison', para: 'st-para', sleep: 'st-sleep', freeze: 'st-freeze' };
  const icon = (id, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  const typeIcon = t => icon('ty-' + t);
  function creatureImg(c, kind, cls) {
    const a = ART[c.id];
    if (!a || !a[kind]) return '<span class="emo">' + c.emoji + '</span>';
    return '<img class="art' + (cls ? ' ' + cls : '') + '" src="' + a[kind] + '" alt="" data-emoji="' + c.emoji + '" draggable="false">';
  }
  // Respaldo: si una imagen del arte no carga, vuelve el emoji (HTML) o el texto (tablero SVG)
  document.addEventListener('error', e => {
    const el = e.target;
    if (el && el.tagName === 'IMG' && el.classList.contains('art')) {
      const sp = document.createElement('span'); sp.className = 'emo'; sp.textContent = el.dataset.emoji || '';
      el.replaceWith(sp);
    } else if (el && el.tagName && el.tagName.toLowerCase() === 'image' && el.dataset.emoji) {
      const t = svgEl('text', { class: 'fe', y: 1 }); t.textContent = el.dataset.emoji; el.replaceWith(t);
    }
  }, true);

  /* ---------- Ruletas en canvas ---------- */
  function prepCanvas(cv, size) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.dataset.size = size;
  }
  function shortVal(s) {
    if (s.forced) return '✕';
    if (s.t === 'w' || s.t === 'g') return String(s.dmg);
    if (s.t === 'p') return '★'.repeat(s.stars);
    if (s.t === 'b') return 'Esq';
    return '✕';
  }
  // Patrón de cada color de segmento, para quien no distingue colores (se dibuja con la tinta del segmento)
  const patternCache = {};
  function segPattern(ctx, t, dpr) {
    if (t === 'w') return null;
    const key = t + '@' + dpr;
    if (!patternCache[key]) {
      const n = t === 'b' ? 10 : 7; const tile = document.createElement('canvas');
      tile.width = tile.height = Math.round(n * dpr);
      const c = tile.getContext('2d'); c.scale(dpr, dpr);
      c.strokeStyle = c.fillStyle = t === 'g' ? 'rgba(58,42,0,.5)' : 'rgba(255,255,255,.42)'; c.lineWidth = 1.3;
      if (t === 'r') { c.beginPath(); c.moveTo(-1, n + 1); c.lineTo(n + 1, -1); c.moveTo(-1, 1); c.lineTo(1, -1); c.moveTo(n - 1, n + 1); c.lineTo(n + 1, n - 1); c.stroke(); }
      else if (t === 'g') { c.beginPath(); c.arc(n / 2, n / 2, 1.5, 0, Math.PI * 2); c.fill(); }
      else if (t === 'p') { c.lineWidth = 1.1; c.beginPath(); c.moveTo(0, .5); c.lineTo(n, .5); c.moveTo(.5, 0); c.lineTo(.5, n); c.stroke(); }
      else if (t === 'b') { c.beginPath(); c.moveTo(0, n * .6); c.quadraticCurveTo(n / 4, n * .15, n / 2, n * .6); c.quadraticCurveTo(n * .75, n * 1.05, n, n * .6); c.stroke(); }
      patternCache[key] = tile;
    }
    const p = ctx.createPattern(patternCache[key], 'repeat');
    if (p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix().scale(1 / dpr));
    return p;
  }
  function drawWheel(cv, wheel, rot, opts) {
    opts = opts || {};
    const size = +cv.dataset.size; const ctx = cv.getContext('2d');
    const dpr = cv.width / size; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const TAU = Math.PI * 2, cx = size / 2, cy = size / 2;
    const R = size / 2 - (opts.pointer ? 8 : 2);
    const fr = D.wheelFractions(wheel);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot || 0);
    wheel.forEach((s, i) => {
      const a0 = -Math.PI / 2 + TAU * fr[i][0], a1 = -Math.PI / 2 + TAU * fr[i][1];
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a1); ctx.closePath();
      ctx.fillStyle = D.SEG[s.t].color; ctx.fill();
      const pat = segPattern(ctx, s.t, dpr); if (pat) { ctx.fillStyle = pat; ctx.fill(); }
      ctx.lineWidth = Math.max(1.2, size / 80); ctx.strokeStyle = '#0e1322'; ctx.stroke();
      if (opts.labels && a1 - a0 > 0.22) {
        ctx.save(); ctx.rotate((a0 + a1) / 2);
        ctx.fillStyle = D.SEG[s.t].ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.font = '800 ' + Math.round(size / 11) + 'px Nunito, system-ui, sans-serif';
        // contorno del color del segmento: el número se lee sobre el patrón
        ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = D.SEG[s.t].color; ctx.strokeText(shortVal(s), R - 7, 0);
        ctx.fillText(shortVal(s), R - 7, 0); ctx.restore();
      }
    });
    ctx.beginPath(); ctx.arc(0, 0, R * 0.16, 0, TAU); ctx.fillStyle = '#0e1322'; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
    if (opts.pointer) {
      ctx.beginPath(); ctx.moveTo(cx - 10, 0); ctx.lineTo(cx + 10, 0); ctx.lineTo(cx, 22); ctx.closePath();
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#0e1322'; ctx.stroke();
    }
  }

  /* ---------- Fichas ---------- */
  // Relación de tipo de a frente a b: 1 = a tiene ventaja, -1 = b tiene ventaja, 0 = neutro
  function typeRel(a, b) { if (D.TYPES[a].beats === b) return 1; if (D.TYPES[b].beats === a) return -1; return 0; }
  function weakTo(t) { return D.TYPE_ORDER.find(x => D.TYPES[x].beats === t); }
  function typeStripHTML() {
    const order = D.TYPE_ORDER.concat([D.TYPE_ORDER[0]]);
    return '<span class="lbl" aria-hidden="true">⚔</span>' + order.map((t, i) => '<span class="t"><span style="color:' + D.TYPES[t].color + '">' + typeIcon(t) + '</span>' + D.TYPES[t].name + '</span>' + (i < order.length - 1 ? '<span class="arr">›</span>' : '')).join('');
  }
  function cycleSVG() {
    const R = 78, cx = 130, cy = 104, pts = D.TYPE_ORDER.map((t, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return { t, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
    let g = '<svg class="cycle-svg" viewBox="0 0 260 210" role="img" aria-label="Ciclo de tipos"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#9ba6c9"/></marker></defs>';
    pts.forEach((p, i) => { const q = pts[(i + 1) % 5]; const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy), k = 27 / L;
      g += '<line x1="' + (p.x + dx * k).toFixed(1) + '" y1="' + (p.y + dy * k).toFixed(1) + '" x2="' + (q.x - dx * k).toFixed(1) + '" y2="' + (q.y - dy * k).toFixed(1) + '" stroke="#9ba6c9" stroke-width="2.5" marker-end="url(#ah)"/>'; });
    pts.forEach(p => { g += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="24" fill="' + D.TYPES[p.t].color + '"/><use href="#ty-' + p.t + '" x="' + (p.x - 7).toFixed(1) + '" y="' + (p.y - 17).toFixed(1) + '" width="14" height="14" style="color:#10172b"/><text x="' + p.x.toFixed(1) + '" y="' + (p.y + 7).toFixed(1) + '" style="fill:#10172b">' + D.TYPES[p.t].name + '</text>'; });
    return g + '</svg>';
  }
  function typeChip(t) { const T = D.TYPES[t]; return '<span class="chip"><span style="color:' + T.color + '">' + typeIcon(t) + '</span>' + T.name + '</span>'; }
  function segRows(wheel) {
    return wheel.map(s => '<tr><td><span class="sq seg-' + s.t + '" style="background-color:' + D.SEG[s.t].color + '"></span></td><td class="n">' + esc(s.name) +
      (s.t === 'g' && s.fx ? ' <span class="note">(' + esc(D.FX[s.fx]) + ')</span>' : '') +
      (s.t === 'p' ? ' <span class="note">' + D.STATUS[s.st].name.toLowerCase() + '</span>' : '') +
      '</td><td class="v">' + shortVal(s) + '</td><td class="pc">' + pct(s.w) + '</td></tr>').join('');
  }
  function statusText(f) {
    if (!f || !f.status) return '';
    const S = D.STATUS[f.status.k];
    return '<span class="chip" style="box-shadow:inset 0 0 0 1.5px ' + S.color + '"><span style="color:' + S.color + '">' + icon(STATUS_ICON[f.status.k], 'st') + '</span>' + S.name + ' · ' + f.status.left + ' t</span>';
  }
  function locText(f) {
    if (!f) return '';
    if (f.loc === 'bench') return '<span class="chip">Banca</span>';
    if (f.loc === 'ko') return '<span class="chip" style="color:var(--hit)">Enfermería · ' + f.koLeft + ' t</span>';
    return '';
  }
  function renderFicha() {
    const box = $('#ficha');
    const info = ui.info;
    if (!info) {
      box.className = 'ficha empty';
      box.innerHTML = 'Toca cualquier figura (tuya o de la CPU) para ver su ruleta y el porcentaje de cada segmento.';
      return;
    }
    const f = info.fig !== undefined ? ui.state.figs[info.fig] : null;
    const c = D.CREATURE[f ? f.kind : info.kind];
    box.className = 'ficha';
    box.innerHTML = '<div class="head">' + creatureImg(c, 'token') + '<strong>' + esc(c.name) + '</strong>' + typeChip(c.type) +
      '<span class="chip up">Vence a ' + D.TYPES[D.TYPES[c.type].beats].name + '</span><span class="chip down">Débil ante ' + D.TYPES[weakTo(c.type)].name + '</span>' +
      '<span class="chip">MP ' + c.mp + '</span>' +
      (f ? '<span class="chip" style="color:var(--p' + f.owner + ')">' + (f.owner === 0 ? 'Tuya' : 'CPU') + '</span>' : '') +
      statusText(f) + locText(f) + '</div><canvas aria-label="Ruleta de ' + esc(c.name) + '"></canvas><table class="segs">' + segRows(c.wheel) + '</table>';
    const cv = box.querySelector('canvas'); prepCanvas(cv, 80); drawWheel(cv, c.wheel, 0);
  }
  function bigFichaHTML(c) {
    return '<div class="big-ficha">' + creatureImg(c, 'ficha', 'big') + '<div>' + typeChip(c.type) + ' <span class="chip">MP ' + c.mp + '</span> <span class="chip">' + D.RARITY[c.rarity] + '</span> <span class="chip">Vence a ' + D.TYPES[D.TYPES[c.type].beats].name + '</span></div>' +
      '<canvas></canvas><table class="segs">' + segRows(c.wheel) + '</table></div>';
  }
  function showCreature(id) {
    const c = D.CREATURE[id];
    openModal(esc(c.name), bigFichaHTML(c), [{ label: 'Cerrar', primary: true }]);
    const cv = $('#modal-body canvas'); prepCanvas(cv, 170); drawWheel(cv, c.wheel, 0, { labels: true });
  }

  /* ---------- Modal ---------- */
  let modalResolve = null;
  function openModal(title, html, actions) {
    $('#modal-title').innerHTML = title;
    $('#modal-body').innerHTML = html;
    const acts = $('#modal-actions'); acts.innerHTML = '';
    return new Promise(res => {
      modalResolve = res;
      (actions || [{ label: 'Cerrar', primary: true }]).forEach(a => {
        const b = el('button', 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), esc(a.label));
        b.type = 'button';
        b.addEventListener('click', () => { if (a.keep) { a.onClick && a.onClick(); return; } closeModal(a.value); a.onClick && a.onClick(); });
        acts.appendChild(b);
      });
      $('#modal').hidden = false;
      const first = acts.querySelector('.btn.primary') || acts.querySelector('.btn'); if (first) first.focus({ preventScroll: true });
      $('#modal .sheet').scrollTop = 0;
    });
  }
  function closeModal(v) { $('#modal').hidden = true; if (modalResolve) { const r = modalResolve; modalResolve = null; r(v); } }

  /* ---------- Reglas ---------- */
  function rulesHTML() {
    const seg = t => '<span class="k"><span class="sq seg-' + t + '" style="background-color:' + D.SEG[t].color + '"></span>' + D.SEG[t].name + '</span>';
    const cycle = D.TYPE_ORDER.map(t => D.TYPES[t].name).join(' → ') + ' → ' + D.TYPES[D.TYPE_ORDER[0]].name;
    return '<p><b>Objetivo:</b> deja una figura sobre la <b>meta rival</b> (el círculo grande del otro lado).</p>' +
      '<h3>Tu turno</h3><ol>' +
      '<li><b>Meter</b> una figura de tu banca por una de tus 2 entradas libres. La entrada cuenta como el primer paso de su MP.</li>' +
      '<li>O <b>mover</b> una figura del tablero hasta su MP (1 a 3) por casillas libres unidas por líneas. No se salta sobre nadie.</li>' +
      '<li>Si después queda junto a un rival, puede <b>atacar</b> (opcional).</li>' +
      '<li>O <b>atacar sin moverte</b>: toca tu figura y luego un rival que tenga al lado.</li></ol>' +
      '<p><b>No se puede pasar el turno.</b> Siempre hay que entrar, moverse o atacar. Si eliges atacar sin moverte, ya no puedes cancelar el ataque. Si ninguna figura puede moverse, el ataque es obligatorio; si tampoco puedes atacar, el turno se pasa solo.</p>' +
      '<h3>Combate</h3><p>Las dos figuras giran su ruleta. El tamaño de cada segmento es su probabilidad.</p>' +
      '<div class="prio">' +
      seg('b') + '<span>Anula el combate: nadie pierde.</span>' +
      seg('g') + '<span>Le gana a Morado, Blanco y Rojo. Entre dorados, más daño.</span>' +
      seg('p') + '<span>Le gana a Blanco y Rojo. Entre morados, más estrellas.</span>' +
      seg('w') + '<span>Le gana a Rojo. Entre blancos, más daño.</span>' +
      seg('r') + '<span>Fallo: pierde contra todo. Rojo contra rojo es empate.</span></div>' +
      '<p style="margin-top:8px">Si gana un ataque <b>blanco o dorado</b>, el rival va a la <b>enfermería</b> 2 turnos tuyos y luego vuelve a la banca. Si gana un <b>morado</b>, el rival queda con ese estado. Cualquiera de las dos figuras puede perder.</p>' +
      '<h3>Estados</h3><ul>' +
      '<li>☠ <b>Veneno</b> (3 turnos): −20 a sus blancos.</li>' +
      '<li>ϟ <b>Parálisis</b> (3 turnos): su segmento más grande cuenta como fallo.</li>' +
      '<li>z <b>Sueño</b> (2 turnos): no se mueve ni ataca; si la atacan cuenta como fallo y despierta.</li>' +
      '<li>❄ <b>Congelación</b> (3 turnos): igual que el sueño, pero dura más.</li></ul>' +
      '<p class="note">Los turnos de un estado o de la enfermería se cuentan en los turnos de su dueño.</p>' +
      '<h3>Más reglas</h3><ul>' +
      '<li><b>Rodear:</b> si todas las casillas vecinas de una figura quedan ocupadas por rivales, va a la enfermería sin girar.</li>' +
      '<li><b>Tipos:</b> cada uno vence al siguiente: ' + cycle + '. La ventaja suma +10 a los blancos. Al tocar una figura, los rivales muestran ▲ si ella tiene ventaja y ▼ si la tienen ellos.</li></ul>' + cycleSVG() + '<ul>' +
      '<li><b>Límite:</b> a los ' + D.turnLimitOf(ui.state) + ' turnos (contando los de ambos) gana quien tenga más figuras en el tablero.</li></ul>';
  }

  /* ---------- Pantalla de equipo ---------- */
  function renderTeam() {
    $('#type-strip-t').innerHTML = typeStripHTML();
    const grid = $('#team-grid'); grid.innerHTML = '';
    D.CREATURES.forEach(c => {
      const on = ui.team.includes(c.id);
      const card = el('div', 'card' + (on ? ' on' : ''));
      card.innerHTML = '<span class="check">' + (on ? ui.team.indexOf(c.id) + 1 : '') + '</span>' +
        '<button type="button" class="pick" aria-pressed="' + on + '"><span class="em">' + creatureImg(c, 'token') + '</span><span class="nm">' + esc(c.name) + '</span>' +
        '<span class="meta">' + typeChip(c.type) + '</span><span class="meta"><span>MP ' + c.mp + '</span>·<span>' + D.RARITY[c.rarity] + '</span></span></button>' +
        '<button type="button" class="info" aria-label="Ver ruleta de ' + esc(c.name) + '"><span>i</span></button>';
      card.querySelector('.pick').addEventListener('click', () => {
        const i = ui.team.indexOf(c.id);
        if (i >= 0) ui.team.splice(i, 1); else if (ui.team.length < 6) ui.team.push(c.id);
        renderTeam();
      });
      card.querySelector('.info').addEventListener('click', () => showCreature(c.id));
      grid.appendChild(card);
    });
    $('#team-count').textContent = ui.team.length + '/6';
    $('#btn-play').disabled = ui.team.length !== 6;
    document.querySelectorAll('#diff button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.lv === ui.level)));
    const sv = store.get();
    $('#btn-continue').hidden = !(sv && sv.state && sv.state.winner === null);
  }

  /* ---------- Tablero SVG ---------- */
  function buildBoard() {
    $('#type-strip-g').innerHTML = typeStripHTML();
    const svg = $('#board'); svg.innerHTML = '';
    const T = brd();
    svg.setAttribute('viewBox', '0 0 ' + T.width + ' ' + T.height);
    const gE = svgEl('g', {}); const gN = svgEl('g', {});
    T.edges.forEach(([a, b]) => { const A = T.nodes[a], B = T.nodes[b]; gE.appendChild(svgEl('line', { class: 'edge', x1: A.x, y1: A.y, x2: B.x, y2: B.y })); });
    T.nodes.forEach(n => {
      const r = n.kind === 'goal' ? 24 : 18;
      gN.appendChild(svgEl('circle', { class: 'node-c ' + n.kind + (n.owner !== null ? ' o' + n.owner : ''), cx: n.x, cy: n.y, r }));
      if (n.kind !== 'n') {
        const t = svgEl('text', { class: 'node-t', x: n.x, y: n.y });
        t.textContent = n.kind === 'goal' ? 'META' : (n.owner === 0 ? '▲' : '▼');
        gN.appendChild(t);
      }
    });
    svg.appendChild(gE); svg.appendChild(gN);
    svg.appendChild(svgEl('g', { id: 'hl' }));
    svg.appendChild(svgEl('g', { id: 'figs' }));
    ui.figEls = new Map();
    svg.addEventListener('click', onBoardClick);
  }
  function svgPoint(evt) {
    const svg = $('#board'); const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: -999, y: -999 };
  }
  function onBoardClick(evt) {
    const p = svgPoint(evt); let best = -1, bd = 31;
    brd().nodes.forEach(n => { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < bd) { bd = d; best = n.id; } });
    if (best >= 0) nodeTapped(best);
  }
  function figGroup(f) {
    let g = ui.figEls.get(f.id);
    if (!g) {
      g = svgEl('g', { class: 'fig p' + f.owner, 'data-id': f.id });
      const c = D.creatureOf(f);
      g.appendChild(svgEl('circle', { class: 'ring', r: 27 }));
      g.appendChild(svgEl('circle', { class: 'fb', r: 20 }));
      const a = ART[c.id];
      if (a && a.token) {
        const im = svgEl('image', { class: 'fi', href: a.token, x: -19, y: -19, width: 38, height: 38 });
        im.dataset.emoji = c.emoji; g.appendChild(im);
      } else { const t = svgEl('text', { class: 'fe', y: 1 }); t.textContent = c.emoji; g.appendChild(t); }
      g.appendChild(svgEl('circle', { class: 'ft', cx: 15, cy: 15, r: 7, fill: D.TYPES[c.type].color }));
      g.appendChild(svgEl('use', { href: '#ty-' + c.type, x: 10.5, y: 10.5, width: 9, height: 9, class: 'fti' }));
      const st = svgEl('g', { class: 'fs' }); st.appendChild(svgEl('circle', { cx: 16, cy: -16, r: 8.5 })); st.appendChild(svgEl('use', { x: 10.5, y: -21.5, width: 11, height: 11 })); g.appendChild(st);
      const av = svgEl('g', { class: 'fa' }); av.appendChild(svgEl('circle', { cx: -16, cy: -16, r: 8.5 })); av.appendChild(svgEl('text', { x: -16, y: -15.5 })); g.appendChild(av);
      g.style.opacity = '0';
      $('#figs').appendChild(g); ui.figEls.set(f.id, g);
      const n = brd().nodes[f.node]; g.style.transform = 'translate(' + n.x + 'px,' + n.y + 'px)';
      requestAnimationFrame(() => { g.style.opacity = '1'; });
    }
    return g;
  }
  function placeFig(g, nodeId) { const n = brd().nodes[nodeId]; g.style.transform = 'translate(' + n.x + 'px,' + n.y + 'px)'; }
  function renderBoard() {
    const s = ui.state;
    const alive = new Set();
    s.figs.forEach(f => {
      if (f.loc !== 'board') return;
      alive.add(f.id);
      const g = figGroup(f);
      if (!g.dataset.anim) placeFig(g, f.node);
      g.classList.toggle('sel', !!(ui.sel && ui.sel.fig === f.id));
      const st = g.querySelector('.fs');
      if (f.status) { const S = D.STATUS[f.status.k]; st.style.display = ''; st.querySelector('circle').setAttribute('fill', S.color); st.querySelector('use').setAttribute('href', '#' + STATUS_ICON[f.status.k]); }
      else st.style.display = 'none';
      const av = g.querySelector('.fa'); const rel = advOf(f);
      if (rel) { av.style.display = ''; av.querySelector('circle').setAttribute('fill', rel > 0 ? 'var(--go)' : 'var(--hit)'); av.querySelector('text').textContent = rel > 0 ? '▲' : '▼'; }
      else av.style.display = 'none';
    });
    for (const [id, g] of ui.figEls) if (!alive.has(id)) { g.remove(); ui.figEls.delete(id); }
    // resaltados
    const hl = $('#hl'); hl.innerHTML = '';
    if (ui.sel) {
      for (const [n] of ui.sel.dest) { const N = brd().nodes[n]; hl.appendChild(svgEl('circle', { class: 'hl-go', cx: N.x, cy: N.y, r: 16 })); hl.appendChild(svgEl('circle', { class: 'hl-go-ring', cx: N.x, cy: N.y, r: 19 })); }
    }
    targetIds().forEach(id => { const N = brd().nodes[s.figs[id].node]; hl.appendChild(svgEl('circle', { class: 'hl-hit', cx: N.x, cy: N.y, r: 27 })); });
    if (ui.guide && canAct()) {
      const h = ui.guide.highlights();
      const ring = n => { const N = brd().nodes[n]; hl.appendChild(svgEl('circle', { class: 'hl-guide', cx: N.x, cy: N.y, r: 31 })); };
      h.nodes.forEach(ring);
      h.figs.forEach(id => { const f = s.figs[id]; if (f && f.loc === 'board') ring(f.node); });
    }
  }
  // Figura de referencia para las marcas de ventaja: la seleccionada o la última tocada
  function advRef() {
    const s = ui.state;
    const id = ui.confirm ? ui.confirm.fig
      : (s.awaitAttack !== null && s.current === 0) ? s.awaitAttack
      : ui.sel ? ui.sel.fig : (ui.info && ui.info.fig !== undefined ? ui.info.fig : null);
    return id === null ? null : s.figs[id];
  }
  function advOf(f) {
    const ref = advRef();
    if (!ref || f.owner === ref.owner) return 0;
    return typeRel(D.creatureOf(ref).type, D.creatureOf(f).type);
  }
  function targetIds() {
    const s = ui.state;
    if (ui.busy || s.current !== 0 || s.winner !== null) return [];
    if (s.awaitAttack !== null) return D.adjacentRivals(s, s.figs[s.awaitAttack]);
    return ui.sel ? ui.sel.targets : [];
  }

  /* ---------- Bancas ---------- */
  function renderBenches() {
    [0, 1].forEach(o => {
      const box = $('#bench-' + o); box.innerHTML = '<span class="who">' + (o === 0 ? 'Tú' : 'CPU') + '</span>';
      box.className = 'bench p' + o;
      ui.state.figs.filter(f => f.owner === o).sort((a, b) => a.slot - b.slot).forEach(f => {
        const c = D.creatureOf(f);
        const rel = advOf(f);
        const guided = ui.guide && canAct() && f.loc === 'bench' && ui.guide.highlights().figs.includes(f.id);
        const b = el('button', 'slot ' + f.loc + (ui.sel && ui.sel.fig === f.id ? ' sel' : '') + (rel > 0 ? ' up' : rel < 0 ? ' down' : '') + (guided ? ' guide' : ''));
        b.type = 'button';
        b.innerHTML = creatureImg(c, 'token') + '<span class="tic" style="background:' + D.TYPES[c.type].color + '">' + typeIcon(c.type) + '</span>';
        if (f.loc === 'ko') b.dataset.ko = f.koLeft;
        b.setAttribute('aria-label', c.name + (f.loc === 'bench' ? ' en la banca' : f.loc === 'ko' ? ' en la enfermería' : ' en el tablero'));
        b.addEventListener('click', () => slotTapped(f.id));
        box.appendChild(b);
      });
    });
  }

  /* ---------- Panel y mensajes ---------- */
  function setActions(list) {
    const box = $('#actions'); box.innerHTML = '';
    (list || []).forEach(a => {
      const b = el('button', 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), esc(a.label));
      b.type = 'button'; b.addEventListener('click', a.onClick); box.appendChild(b);
    });
  }
  function renderPanel() {
    const s = ui.state; let msg = ui.msg; let acts = [];
    if (s.winner === null && !ui.busy && s.current === 0) {
      if (ui.confirm) {
        const o = D.battleOdds(s, ui.confirm.fig, ui.confirm.target);
        const p = x => Math.round(x * 100) + '%';
        const rel = typeRel(D.creatureOf(s.figs[ui.confirm.fig]).type, D.creatureOf(s.figs[ui.confirm.target]).type);
        msg = '¿Atacar a <b>' + esc(D.creatureOf(s.figs[ui.confirm.target]).name) + '</b>? Ganas ' + p(o.win) + ' · empate ' + p(o.tie) + ' · pierdes ' + p(o.lose) +
          (rel > 0 ? '<br>▲ Tienes ventaja de tipo (+10 a tus blancos).' : rel < 0 ? '<br>▼ El rival tiene ventaja de tipo (+10 a sus blancos).' : '');
        acts = [{ kind: 'back', label: 'Volver', onClick: () => { ui.confirm = null; refresh(); } }, { kind: 'attack', label: 'Atacar', primary: true, onClick: doAttack }];
      } else if (s.awaitAttack !== null) {
        if (s.forcedAttack) msg = '<b>Ataque obligatorio:</b> toca un rival marcado en rojo.';
        else { msg = 'Puedes atacar: toca un rival marcado en rojo.'; acts = [{ kind: 'end', label: 'No atacar', onClick: () => commit({ type: 'end' }) }]; }
      } else if (ui.sel) {
        acts = [{ kind: 'cancel', label: 'Cancelar', onClick: () => { ui.sel = null; ui.msg = ''; refresh(); } }];
        if (!msg) msg = ui.sel.dest.size && ui.sel.targets.length ? 'Toca una casilla verde para moverte o un rival en rojo para atacar sin moverte.'
          : ui.sel.dest.size ? 'Toca una casilla verde.'
          : ui.sel.targets.length ? (D.mustAttack(s) ? '<b>Ninguna figura puede moverse:</b> debes atacar. ' : 'No puede moverse, pero puede atacar. ') + 'Toca un rival en rojo.'
          : 'Esta figura no tiene jugadas. Elige otra.';
      } else if (!msg) msg = D.mustAttack(s) ? '<b>Ninguna figura puede moverse:</b> el ataque es obligatorio. Toca una figura tuya junto a un rival.'
          : 'Tu turno: mueve una figura o ataca con una que tenga un rival al lado.';
    }
    // Tutorial: el texto del paso reemplaza al mensaje y solo quedan los botones que sirven al paso
    if (ui.guide && s.winner === null && !ui.busy && s.current === 0 && ui.guide.step) {
      const g = ui.guide, st = g.step;
      msg = '<span class="guide-t">' + esc(st.text) + '</span>' + (ui.confirm ? '<br><span class="guide-odds">' + msg + '</span>' : '');
      acts = acts.filter(a => a.kind === 'attack' || a.kind === 'back' || (a.kind === 'end' && st.act && st.act.type === 'end'));
      if (st.info) acts = [{ label: g.isLast ? 'Terminar' : 'Siguiente', primary: true, onClick: guideNext }];
    }
    $('#msg').innerHTML = msg || '';
    setActions(acts);
    const pill = $('#turn-pill');
    if (s.winner !== null) { pill.className = 'pill'; pill.innerHTML = 'Partida terminada'; }
    else { pill.className = 'pill p' + s.current; pill.innerHTML = (s.current === 0 ? 'Tu turno' : 'Turno CPU') + ' <small>· ' + s.turn + '/' + D.turnLimitOf(s) + '</small>'; }
  }
  function refresh() { renderBoard(); renderBenches(); renderPanel(); renderFicha(); }
  function say(t) { ui.msg = t; }
  function logEvents(events, who) {
    events.forEach(e => { if (e.text) ui.log.unshift({ turn: ui.state ? ui.state.turn : 0, text: e.text }); });
    if (who) ui.log.unshift({ turn: ui.state.turn, text: who });
    ui.log.length = Math.min(ui.log.length, 80);
  }
  function save() {
    if (!ui.state || ui.guide) return;
    if (ui.state.winner !== null) { store.del(); return; }
    store.set({ v: 1, state: ui.state, level: ui.level, team: ui.team, cpuTeam: ui.cpuTeam, log: ui.log.slice(0, 40) });
  }

  /* ---------- Interacción del jugador ---------- */
  function canAct() { return ui.state && ui.state.winner === null && !ui.busy && ui.state.current === 0; }
  function selectFig(id) {
    const s = ui.state; const f = s.figs[id];
    ui.info = { fig: id }; ui.confirm = null; ui.msg = '';
    if (D.isImmobile(f)) { ui.sel = null; say(D.creatureOf(f).name + ' está ' + D.STATUS[f.status.k].adj + ' y no puede actuar.'); return; }
    const acts = D.legalActions(s).filter(a => a.fig === id);
    const dest = new Map();
    acts.forEach(a => { if (a.type === 'move' || a.type === 'enter') dest.set(a.to, a); });
    const targets = acts.some(a => a.type === 'stay') ? D.adjacentRivals(s, f) : [];
    if (f.loc === 'bench' && !dest.size) { ui.sel = null; say('Tus dos entradas están ocupadas.'); return; }
    ui.sel = { fig: id, dest, targets };
    P.haptic('tap');
  }
  // Tutorial: ¿el toque (figura o cruce) es parte del paso actual? Si no, se ignora y se avisa.
  function guideBlocks(kind, id) {
    const g = ui.guide; if (!g || g.done || !canAct()) return false;
    const ok = kind === 'fig' ? g.allowsFig(id) : g.allowsNode(id);
    if (!ok) nudge();
    return !ok;
  }
  // Tras un toque permitido: si el paso pedía tocar esa figura, se avanza
  function guideAfterTap(id) { if (ui.guide && ui.sel && ui.sel.fig === id) ui.guide.tapped(id); }
  function nudge() { const m = $('#msg'); m.classList.remove('nudge'); void m.offsetWidth; m.classList.add('nudge'); }

  function slotTapped(id) {
    if (guideBlocks('fig', id)) return;
    const f = ui.state.figs[id];
    if (canAct() && f.owner === 0 && f.loc === 'bench' && ui.state.awaitAttack === null) {
      if (ui.sel && ui.sel.fig === id) { ui.sel = null; ui.msg = ''; } else selectFig(id);
    } else { ui.info = { fig: id }; }
    guideAfterTap(id);
    refresh();
  }
  function nodeTapped(n) {
    const s = ui.state; const occ = D.occupancy(s); const fid = occ[n];
    const f = fid !== -1 ? s.figs[fid] : null;
    if (guideBlocks(f ? 'fig' : 'node', f ? fid : n)) return;
    if (!canAct()) { if (f) { ui.info = { fig: fid }; renderBoard(); renderBenches(); renderFicha(); } return; }
    if (s.awaitAttack !== null) {
      if (f && targetIds().includes(fid)) { ui.confirm = { fig: s.awaitAttack, target: fid, stay: false }; ui.info = { fig: fid }; }
      else if (f) ui.info = { fig: fid };
      refresh(); return;
    }
    if (ui.sel) {
      const act = ui.sel.dest.get(n);
      if (act) { commit(act); return; }
      if (f && ui.sel.targets.includes(fid)) { ui.confirm = { fig: ui.sel.fig, target: fid, stay: true }; ui.info = { fig: fid }; refresh(); return; }
    }
    if (f && f.owner === 0) { if (ui.sel && ui.sel.fig === fid) { ui.sel = null; ui.msg = ''; } else selectFig(fid); guideAfterTap(fid); }
    else if (f) { ui.info = { fig: fid }; }
    else { ui.sel = null; ui.msg = ''; }
    ui.confirm = null;
    refresh();
  }

  async function animateMove(act) {
    const s = ui.state; const f = s.figs[act.fig];
    const path = act.path || [act.to];
    const tmp = { ...f, loc: 'board', node: path[0] };
    const g = figGroup(tmp); g.dataset.anim = '1';
    if (act.type === 'enter') { placeFig(g, path[0]); await wait(200); }
    for (let i = 1; i < path.length; i++) { placeFig(g, path[i]); await wait(150); }
    await wait(60);
    delete g.dataset.anim;
  }

  async function commit(act) {
    if (ui.busy) return;
    if (ui.guide && !ui.guide.allowsAct(act)) { nudge(); return; }
    ui.busy = true; ui.sel = null; ui.confirm = null; ui.msg = '';
    if (act.type === 'enter' || act.type === 'move') await animateMove(act);
    const r = D.applyAction(ui.state, act);
    ui.state = r.state; logEvents(r.events);
    const extra = r.events.filter(e => e.type === 'surround' || e.type === 'heal' || e.type === 'cure').map(e => e.text).join(' ');
    say(extra);
    ui.busy = false;
    save();
    afterAction();
  }

  async function doAttack() {
    const c = ui.confirm; if (!c || ui.busy) return;
    if (ui.guide && !ui.guide.allowsAct({ type: 'attack', fig: c.fig, target: c.target })) { nudge(); return; }
    ui.confirm = null;
    if (c.stay) ui.state = D.applyAction(ui.state, { type: 'stay', fig: c.fig }).state;
    await runBattle(c.fig, c.target);
    afterAction();
  }

  /* ---------- Combate a pantalla completa ---------- */
  function runBattle(aId, dId) {
    ui.busy = true; refresh();
    const s = ui.state;
    const sp = (ui.guide && ui.guide.takeSpin(s, aId, dId)) || D.spinBattle(s, aId, dId, Math.random);
    const preview = D.resolveBattle(s, aId, dId, sp.ai, sp.di);
    const A = s.figs[aId], Df = s.figs[dId];
    const top = A.owner === 1 ? A : Df, bot = A.owner === 1 ? Df : A;
    const sides = [[top, top === A ? sp.wa : sp.wd, top === A ? sp.ai : sp.di, '#bf-top'], [bot, bot === A ? sp.wa : sp.wd, bot === A ? sp.ai : sp.di, '#bf-bot']];
    const size = Math.max(120, Math.min(190, Math.floor((window.innerHeight - 300) / 2), window.innerWidth - 200));
    const anims = sides.map(([f, wheel, idx, sel], k) => {
      const box = $(sel); const c = D.creatureOf(f);
      box.className = 'fighter p' + f.owner;
      const mods = [...new Set(wheel.flatMap(x => x.mods || []))];
      box.querySelector('.fn').innerHTML = creatureImg(c, 'token') + esc(c.name);
      box.querySelector('.fr').innerHTML = (f.id === aId ? 'Ataca' : 'Defiende') + ' · ' + (f.owner === 0 ? 'Tú' : 'CPU') + ' · ' + D.TYPES[c.type].name + (mods.length ? '<br>' + esc(mods.join(' · ')) : '');
      box.querySelector('.res').innerHTML = '';
      const cv = box.querySelector('canvas'); prepCanvas(cv, size);
      const target = D.targetRotation(wheel, idx, 4 + k, Math.random, 0);
      drawWheel(cv, wheel, 0, { labels: true, pointer: true });
      return { box, cv, wheel, idx, target, dur: (reduced ? 350 : (ui.fast ? 1100 : 2100)) + k * (reduced ? 0 : 450) };
    });
    $('#battle-title').textContent = 'Combate';
    $('#battle-text').textContent = 'Girando…';
    const go = $('#battle-go'); go.disabled = true; go.textContent = 'Continuar';
    $('#battle').hidden = false;
    return new Promise(resolve => {
      let skip = false; const t0 = performance.now();
      const ease = t => 1 - Math.pow(1 - t, 3);
      const onSkip = () => { skip = true; };
      $('#battle').addEventListener('pointerdown', onSkip);
      function frame(now) {
        let done = true;
        anims.forEach(a => {
          const t = skip ? 1 : Math.min(1, (now - t0) / a.dur);
          drawWheel(a.cv, a.wheel, a.target * ease(t), { labels: true, pointer: true });
          if (t < 1) done = false;
        });
        if (!done) { requestAnimationFrame(frame); return; }
        $('#battle').removeEventListener('pointerdown', onSkip);
        anims.forEach(a => {
          const seg = a.wheel[a.idx];
          a.box.querySelector('.res').innerHTML = '<span class="sq seg-' + seg.t + '" style="background-color:' + D.SEG[seg.t].color + '"></span>' + esc(D.segLabel(seg));
        });
        const w = preview.battle.winner;
        if (w !== null) (w === top.id ? anims[0] : anims[1]).box.classList.add('win');
        $('#battle-text').textContent = preview.battle.text;
        if (w !== null) P.haptic('hit');
        go.disabled = false; go.focus();
        go.onclick = () => {
          go.onclick = null;
          $('#battle').hidden = true;
          const r = D.applyAction(ui.state, { type: 'attack', fig: aId, target: dId, spin: sp });
          ui.state = r.state; logEvents(r.events);
          const extra = r.events.filter(e => e.type === 'surround').map(e => e.text).join(' ');
          say(preview.battle.text + (extra ? ' ' + extra : ''));
          ui.busy = false; save(); resolve(r);
        };
      }
      requestAnimationFrame(frame);
    });
  }

  /* ---------- Flujo de turnos ---------- */
  function afterAction() {
    const s = ui.state;
    refresh();
    if (s.winner !== null) { gameOver(); return; }
    if (s.current === 1) { cpuTurn(); return; }
    if (s.awaitAttack === null && !D.legalActions(s).length) {
      ui.busy = true; say('No tienes jugadas posibles: pasas el turno.'); refresh();
      setTimeout(() => { const r = D.applyAction(ui.state, { type: 'pass' }); ui.state = r.state; logEvents(r.events); ui.busy = false; save(); afterAction(); }, 1100);
    }
  }

  // En el tutorial la CPU sigue el guion de la lección; si no hay guion, juega la IA
  const cpuPick = s => (ui.guide && ui.guide.cpuAction(s)) || AI.choose(s, ui.level);

  async function cpuTurn() {
    ui.busy = true; ui.sel = null; ui.confirm = null;
    const prev = ui.msg;
    renderBoard(); renderBenches(); renderPanel();
    $('#msg').innerHTML = (prev ? prev + '<br>' : '') + 'La CPU está pensando…'; setActions([]);
    await wait(prev ? 900 : 500);
    let t0 = performance.now();
    let act = cpuPick(ui.state);
    ui.lastCpuMs = performance.now() - t0;
    let moved = null;
    if (act.type === 'pass') {
      const r = D.applyAction(ui.state, act); ui.state = r.state; logEvents(r.events, 'La CPU no tiene jugadas y pasa.');
      say('La CPU no tiene jugadas y pasa.'); ui.busy = false; save(); afterAction(); return;
    }
    if (act.type === 'enter' || act.type === 'move') {
      await animateMove(act);
      const r = D.applyAction(ui.state, act); ui.state = r.state;
      moved = D.creatureOf(ui.state.figs[act.fig]).name;
      logEvents(r.events, (act.type === 'enter' ? 'La CPU metió a ' : 'La CPU movió a ') + moved + '.');
      say((act.type === 'enter' ? 'La CPU metió a <b>' : 'La CPU movió a <b>') + esc(moved) + '</b>. ' + r.events.filter(e => e.type === 'surround').map(e => e.text).join(' '));
      refresh();
      if (ui.state.winner !== null) { ui.busy = false; save(); afterAction(); return; }
    } else if (act.type === 'stay') {
      ui.state = D.applyAction(ui.state, act).state;
    }
    if (ui.state.awaitAttack !== null && ui.state.current === 1) {
      t0 = performance.now();
      const a2 = cpuPick(ui.state);
      ui.lastCpuMs += performance.now() - t0;
      if (a2.type === 'attack') {
        const nA = D.creatureOf(ui.state.figs[a2.fig]).name, nT = D.creatureOf(ui.state.figs[a2.target]).name;
        $('#msg').innerHTML = '<b>' + esc(nA) + '</b> (CPU) ataca a <b>' + esc(nT) + '</b>.';
        await wait(700);
        await runBattle(a2.fig, a2.target);
      } else {
        const r = D.applyAction(ui.state, { type: 'end' }); ui.state = r.state; logEvents(r.events);
      }
    }
    ui.busy = false; save(); afterAction();
  }

  async function gameOver() {
    if (ui.guide) { finishLesson(); return; } // en el tutorial no se toca la partida guardada
    store.del();
    const s = ui.state;
    const title = s.winner === 0 ? '¡Ganaste!' : s.winner === 1 ? 'Ganó la CPU' : 'Empate';
    P.haptic(s.winner === 0 ? 'win' : 'lose');
    const choice = await openModal(title, '<p>' + esc(s.winReason) + '</p><p class="note">Partida de ' + s.turn + ' turnos en nivel ' + AI.LEVELS[ui.level].name + '.</p>',
      [{ label: 'Cambiar equipo', value: 'team' }, { label: 'Revancha', value: 'again', primary: true }]);
    if (choice === 'again') startGame(ui.team, ui.cpuTeam); else showTeamScreen();
  }

  /* ---------- Inicio ---------- */
  function startGame(team, cpuTeam) {
    ui.team = team.slice(); ui.cpuTeam = cpuTeam || D.randomBalancedTeam();
    const first = Math.random() < 0.5 ? 0 : 1;
    ui.state = D.newGame(ui.team, ui.cpuTeam, first, DUEL_LIBRE);
    ui.log = []; ui.sel = null; ui.info = null; ui.confirm = null; ui.busy = false;
    $('#scr-team').hidden = true; $('#scr-game').hidden = false;
    buildBoard();
    say(first === 0 ? 'Sorteo: <b>empiezas tú</b>. Toca una figura de tu banca para meterla.' : 'Sorteo: <b>empieza la CPU</b>.');
    logEvents([], first === 0 ? 'Empiezas tú.' : 'Empieza la CPU.');
    save(); afterAction();
  }
  function resumeGame(sv) {
    ui.level = sv.level || 'normal'; ui.team = sv.team; ui.cpuTeam = sv.cpuTeam; ui.state = sv.state; ui.log = sv.log || [];
    ui.sel = null; ui.info = null; ui.confirm = null; ui.busy = false;
    $('#scr-team').hidden = true; $('#scr-game').hidden = false;
    buildBoard(); say('Partida recuperada.'); afterAction();
  }
  function showTeamScreen() {
    $('#scr-game').hidden = true; $('#scr-team').hidden = false;
    renderTeam(); window.scrollTo(0, 0);
  }

  /* ---------- Menú, historial y prueba de ruletas ---------- */
  function wheelTestHTML() {
    const N = 1000; let rows = ''; let worstAll = 0, overAll = 0, segsAll = 0;
    D.CREATURES.forEach(c => {
      const cnt = new Array(c.wheel.length).fill(0);
      for (let i = 0; i < N; i++) cnt[D.pickIndex(c.wheel, Math.random)]++;
      let worst = 0, over = 0;
      c.wheel.forEach((s, i) => { const d = Math.abs(cnt[i] / N - s.w / 96) * 100; worst = Math.max(worst, d); if (d > 3) over++; });
      // la animación debe detenerse en el segmento sorteado
      let stopFails = 0;
      c.wheel.forEach((s, i) => { for (let k = 0; k < 50; k++) if (D.segmentAtRotation(c.wheel, D.targetRotation(c.wheel, i, 4, Math.random, 0)) !== i) stopFails++; });
      worstAll = Math.max(worstAll, worst); overAll += over; segsAll += c.wheel.length;
      rows += '<tr><td>' + creatureImg(c, 'token') + ' ' + esc(c.name) + '</td><td>' + worst.toFixed(1).replace('.', ',') + ' pp</td><td class="' + (over ? 'warn' : 'ok') + '">' + (over ? over + ' fuera' : 'OK') + '</td><td class="' + (stopFails ? 'warn' : 'ok') + '">' + (stopFails ? stopFails : 'OK') + '</td></tr>';
    });
    let big = 0; const M = 100000;
    D.CREATURES.forEach(c => { const cnt = new Array(c.wheel.length).fill(0); for (let i = 0; i < M; i++) cnt[D.pickIndex(c.wheel, Math.random)]++; c.wheel.forEach((s, i) => big = Math.max(big, Math.abs(cnt[i] / M - s.w / 96) * 100)); });
    return '<p>1.000 giros por ruleta con el mismo sorteo del juego. Desvío = diferencia entre la frecuencia observada y el peso del segmento (tolerancia ±3 puntos).</p>' +
      '<table class="test-t"><tr><th>Criatura</th><th>Peor desvío</th><th>±3 pp</th><th>Parada</th></tr>' + rows + '</table>' +
      '<p style="margin-top:10px"><b>Resumen:</b> ' + (segsAll - overAll) + ' de ' + segsAll + ' segmentos dentro de ±3 pp (peor ' + worstAll.toFixed(1).replace('.', ',') + ' pp). Con 100.000 giros por ruleta el peor desvío baja a ' + big.toFixed(2).replace('.', ',') + ' pp.</p>' +
      '<p class="note">Con solo 1.000 giros, el azar normal mueve un segmento de 30% en ±1,5 pp aprox.; que alguno pase de 3 pp de vez en cuando es esperable. "Parada" verifica que la animación cae dentro del segmento sorteado.</p>';
  }
  function openWheelTest() {
    openModal('Prueba de ruletas', wheelTestHTML(), [{ label: 'Repetir', keep: true, onClick: () => { $('#modal-body').innerHTML = wheelTestHTML(); } }, { label: 'Cerrar', primary: true }]);
  }
  function openLog() {
    const items = ui.log.length ? ui.log.map(l => '<li><span>T' + l.turn + '</span>' + l.text.replace(/<[^>]+>/g, '') + '</li>').join('') : '<li>Sin jugadas todavía.</li>';
    openModal('Historial', '<ul class="log">' + items + '</ul>', [{ label: 'Cerrar', primary: true }]);
  }
  function openMenu() {
    const ms = ui.lastCpuMs === null ? '—' : ui.lastCpuMs.toFixed(0) + ' ms';
    openModal('Menú', '<p>Nivel: <b>' + AI.LEVELS[ui.level].name + '</b>. Último turno de la CPU: <b>' + ms + '</b> de cálculo (sin animaciones).</p><p class="note">Versión ' + esc(CFG.version) + '</p>', [
      { label: 'Historial', onClick: () => setTimeout(openLog, 0) },
      { label: 'Prueba de ruletas', onClick: () => setTimeout(openWheelTest, 0) },
      { label: ui.fast ? 'Animación normal' : 'Animación rápida', onClick: () => { ui.fast = !ui.fast; } },
    ].concat(feedbackUrl ? [{ label: 'Enviar comentarios', onClick: openFeedback }] : []).concat(P.canVibrate ? [{ label: P.vibra ? 'Vibración: sí' : 'Vibración: no', onClick: () => P.setVibra(!P.vibra) }] : []).concat([
      ui.guide ? { label: 'Salir del tutorial', danger: true, onClick: () => setTimeout(requestExitTutorial, 0) }
        : { label: 'Abandonar partida', danger: true, onClick: () => setTimeout(confirmQuit, 0) },
      { label: 'Seguir jugando', primary: true }
    ]));
  }
  async function confirmQuit() {
    const v = await openModal('¿Abandonar la partida?', '<p>Se pierde la partida en curso y vuelves a elegir equipo.</p>', [{ label: 'Cancelar', value: 'no' }, { label: 'Abandonar', value: 'yes', danger: true }]);
    if (v === 'yes') { store.del(); ui.busy = false; showTeamScreen(); }
  }

  /* ---------- Tutorial ---------- */
  function startLesson(L) {
    ui.guide = TUT.createGuide(L);
    ui.state = ui.guide.start();
    ui.log = []; ui.sel = null; ui.info = null; ui.confirm = null; ui.busy = false;
    $('#scr-team').hidden = true; $('#scr-game').hidden = false;
    $('#guide-bar').hidden = false;
    $('#guide-title').textContent = 'Tutorial · ' + L.orden + ' de ' + TUT.LESSONS.length + ': ' + L.titulo;
    buildBoard(); say(''); afterAction();
  }
  function guideNext() {
    ui.guide.next();
    if (ui.guide.done) finishLesson(); else refresh();
  }
  async function finishLesson() {
    const L = ui.guide.lesson; ui.busy = true; refresh();
    const p = TUT.readProgress(P.storage);
    if (!p.hechas.includes(L.id)) p.hechas.push(L.id);
    p.ofrecido = true; TUT.writeProgress(P.storage, p);
    P.haptic('win');
    const next = TUT.LESSONS[TUT.LESSONS.indexOf(L) + 1];
    const v = await openModal(next ? '¡Lección completada!' : '¡Terminaste el tutorial!', '<p>' + esc(L.fin) + '</p>',
      next ? [{ label: 'Salir', value: 'exit' }, { label: 'Siguiente: ' + next.titulo, value: 'next', primary: true }]
        : [{ label: 'Elegir equipo', value: 'exit', primary: true }]);
    if (v === 'next') startLesson(next); else exitTutorial();
  }
  // Salir a pedido del jugador: no mientras la CPU juega o hay un combate (seguirían sobre otra partida)
  function requestExitTutorial() { if (ui.busy) { nudge(); return; } exitTutorial(); }
  function exitTutorial() {
    ui.guide = null; ui.busy = false; ui.state = null;
    $('#guide-bar').hidden = true;
    showTeamScreen();
  }
  function openTutorialList() {
    const p = TUT.readProgress(P.storage);
    const html = '<p>Lecciones cortas con el tablero de verdad. Puedes salir cuando quieras.</p><div class="lessons">' +
      TUT.LESSONS.map((L, i) => '<button type="button" class="btn lesson" data-i="' + i + '"><span>' + L.orden + '. ' + esc(L.titulo) + '</span><small>' +
        (p.hechas.includes(L.id) ? '✓ hecha' : esc(L.duracion)) + '</small></button>').join('') + '</div>';
    openModal('Tutorial', html, [{ label: 'Cerrar', primary: true }]);
    document.querySelectorAll('#modal-body .lesson').forEach(b => b.addEventListener('click', () => { closeModal(); startLesson(TUT.LESSONS[+b.dataset.i]); }));
  }
  // "Cómo jugar" con acceso al tutorial (no durante el turno de la CPU o un combate)
  function openRules() {
    openModal('Cómo jugar', rulesHTML(), (ui.busy ? [] : [{ label: 'Tutorial', onClick: () => setTimeout(openTutorialList, 0) }]).concat([{ label: 'Cerrar', primary: true }]));
  }
  // Primera vez que se abre el juego (sin partida guardada): ofrecer el tutorial una sola vez
  async function offerTutorial() {
    const p = TUT.readProgress(P.storage);
    if (p.ofrecido || store.get()) return;
    p.ofrecido = true; TUT.writeProgress(P.storage, p);
    const v = await openModal('¿Aprender a jugar?', '<p>' + TUT.LESSONS.length + ' lecciones cortas, unos 6 minutos, con el tablero de verdad. Puedes salir cuando quieras y repetirlas desde «Cómo jugar».</p>',
      [{ label: 'Saltar', value: 'skip' }, { label: 'Empezar', value: 'go', primary: true }]);
    if (v === 'go') startLesson(TUT.LESSONS[0]);
  }

  /* ---------- Botón "atrás" (Android) ---------- */
  function onBack() {
    if (!$('#modal').hidden) { closeModal(); return; }   // cierra la ventana abierta
    if (!$('#battle').hidden) return;                     // el combate se cierra con "Continuar"
    if (!$('#scr-game').hidden) { openMenu(); return; }  // en partida: abre el menú (la partida ya está guardada)
    P.minimize();                                         // en la elección de equipo: a segundo plano, sin cerrar
  }

  /* ---------- Arranque ---------- */
  function init() {
    P.onBack(onBack);
    document.querySelectorAll('#diff button').forEach(b => b.addEventListener('click', () => { ui.level = b.dataset.lv; renderTeam(); }));
    $('#btn-random').addEventListener('click', () => { ui.team = D.randomBalancedTeam(); renderTeam(); });
    $('#btn-play').addEventListener('click', () => { if (ui.team.length === 6) startGame(ui.team); });
    $('#btn-continue').addEventListener('click', () => { const sv = store.get(); if (sv && sv.state && Array.isArray(sv.state.figs) && sv.state.figs.length === 12 && !D.validate(sv.state).length) resumeGame(sv); else { store.del(); renderTeam(); } });
    $('#btn-rules-t').addEventListener('click', openRules);
    $('#btn-rules-g').addEventListener('click', openRules);
    $('#btn-guide-exit').addEventListener('click', requestExitTutorial);
    $('#btn-menu').addEventListener('click', openMenu);
    $('#version-t').textContent = 'Versión ' + CFG.version + (feedbackUrl ? ' ·' : '');
    $('#btn-feedback-t').hidden = !feedbackUrl;
    $('#btn-feedback-t').addEventListener('click', openFeedback);
    ui.team = ['tizonaje', 'pulpiza', 'erizarza', 'tejonrock', 'zumbiza', 'musgoso'];
    renderTeam();
    P.hideSplash();
    offerTutorial();
  }
  window.DuelUI = {
    get state() { return ui.state; }, get busy() { return ui.busy; }, setFast(v) { ui.fast = v; },
    // solo lectura, para pruebas: lección y paso del tutorial en curso
    get guide() { return ui.guide && { lesson: ui.guide.lesson.id, step: ui.guide.i, done: ui.guide.done }; }
  };
  const start = () => P.restore([SAVE_KEY]).then(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
