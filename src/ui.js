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

  /* ---------- Guardado opcional ---------- */
  const SAVE_KEY = 'duelo-nodos-v1';
  const store = {
    get() { try { const r = localStorage.getItem(SAVE_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nada */ } }
  };

  const ui = {
    level: 'normal', team: [], cpuTeam: [], state: null,
    sel: null, info: null, confirm: null, busy: false, fast: false,
    lastCpuMs: null, log: [], figEls: new Map(), msg: ''
  };
  const wait = ms => new Promise(r => setTimeout(r, reduced ? Math.min(ms, 120) : (ui.fast ? ms * 0.45 : ms)));

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
      ctx.lineWidth = Math.max(1.2, size / 80); ctx.strokeStyle = '#0e1322'; ctx.stroke();
      if (opts.labels && a1 - a0 > 0.22) {
        ctx.save(); ctx.rotate((a0 + a1) / 2);
        ctx.fillStyle = D.SEG[s.t].ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.font = '800 ' + Math.round(size / 11) + 'px Nunito, system-ui, sans-serif';
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
    return '<span class="lbl" aria-hidden="true">⚔</span>' + order.map((t, i) => '<span class="t"><span class="dot" style="background:' + D.TYPES[t].color + '"></span>' + D.TYPES[t].name + '</span>' + (i < order.length - 1 ? '<span class="arr">›</span>' : '')).join('');
  }
  function cycleSVG() {
    const R = 78, cx = 130, cy = 104, pts = D.TYPE_ORDER.map((t, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return { t, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
    let g = '<svg class="cycle-svg" viewBox="0 0 260 210" role="img" aria-label="Ciclo de tipos"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#9ba6c9"/></marker></defs>';
    pts.forEach((p, i) => { const q = pts[(i + 1) % 5]; const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy), k = 27 / L;
      g += '<line x1="' + (p.x + dx * k).toFixed(1) + '" y1="' + (p.y + dy * k).toFixed(1) + '" x2="' + (q.x - dx * k).toFixed(1) + '" y2="' + (q.y - dy * k).toFixed(1) + '" stroke="#9ba6c9" stroke-width="2.5" marker-end="url(#ah)"/>'; });
    pts.forEach(p => { g += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="24" fill="' + D.TYPES[p.t].color + '"/><text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" style="fill:#10172b">' + D.TYPES[p.t].name + '</text>'; });
    return g + '</svg>';
  }
  function typeChip(t) { const T = D.TYPES[t]; return '<span class="chip"><span class="dot" style="background:' + T.color + '"></span>' + T.name + '</span>'; }
  function segRows(wheel) {
    return wheel.map(s => '<tr><td><span class="sq" style="background:' + D.SEG[s.t].color + '"></span></td><td class="n">' + esc(s.name) +
      (s.t === 'g' && s.fx ? ' <span class="note">(' + esc(D.FX[s.fx]) + ')</span>' : '') +
      (s.t === 'p' ? ' <span class="note">' + D.STATUS[s.st].name.toLowerCase() + '</span>' : '') +
      '</td><td class="v">' + shortVal(s) + '</td><td class="pc">' + pct(s.w) + '</td></tr>').join('');
  }
  function statusText(f) {
    if (!f || !f.status) return '';
    const S = D.STATUS[f.status.k];
    return '<span class="chip" style="box-shadow:inset 0 0 0 1.5px ' + S.color + '">' + S.icon + ' ' + S.name + ' · ' + f.status.left + ' t</span>';
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
    box.innerHTML = '<div class="head"><strong>' + c.emoji + ' ' + esc(c.name) + '</strong>' + typeChip(c.type) +
      '<span class="chip up">Vence a ' + D.TYPES[D.TYPES[c.type].beats].name + '</span><span class="chip down">Débil ante ' + D.TYPES[weakTo(c.type)].name + '</span>' +
      '<span class="chip">MP ' + c.mp + '</span>' +
      (f ? '<span class="chip" style="color:var(--p' + f.owner + ')">' + (f.owner === 0 ? 'Tuya' : 'CPU') + '</span>' : '') +
      statusText(f) + locText(f) + '</div><canvas aria-label="Ruleta de ' + esc(c.name) + '"></canvas><table class="segs">' + segRows(c.wheel) + '</table>';
    const cv = box.querySelector('canvas'); prepCanvas(cv, 80); drawWheel(cv, c.wheel, 0);
  }
  function bigFichaHTML(c) {
    return '<div class="big-ficha"><div>' + typeChip(c.type) + ' <span class="chip">MP ' + c.mp + '</span> <span class="chip">' + D.RARITY[c.rarity] + '</span> <span class="chip">Vence a ' + D.TYPES[D.TYPES[c.type].beats].name + '</span></div>' +
      '<canvas></canvas><table class="segs">' + segRows(c.wheel) + '</table></div>';
  }
  function showCreature(id) {
    const c = D.CREATURE[id];
    openModal(c.emoji + ' ' + c.name, bigFichaHTML(c), [{ label: 'Cerrar', primary: true }]);
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
    const seg = t => '<span class="k"><span class="sq" style="background:' + D.SEG[t].color + '"></span>' + D.SEG[t].name + '</span>';
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
      '<li><b>Límite:</b> a los ' + D.MAX_TURNS + ' turnos (contando los de ambos) gana quien tenga más figuras en el tablero.</li></ul>';
  }

  /* ---------- Pantalla de equipo ---------- */
  function renderTeam() {
    $('#type-strip-t').innerHTML = typeStripHTML();
    const grid = $('#team-grid'); grid.innerHTML = '';
    D.CREATURES.forEach(c => {
      const on = ui.team.includes(c.id);
      const card = el('div', 'card' + (on ? ' on' : ''));
      card.innerHTML = '<span class="check">' + (on ? ui.team.indexOf(c.id) + 1 : '') + '</span>' +
        '<button type="button" class="pick" aria-pressed="' + on + '"><span class="em">' + c.emoji + '</span><span class="nm">' + esc(c.name) + '</span>' +
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
    svg.setAttribute('viewBox', '0 0 ' + D.BOARD.width + ' ' + D.BOARD.height);
    const gE = svgEl('g', {}); const gN = svgEl('g', {});
    D.BOARD.edges.forEach(([a, b]) => { const A = D.BOARD.nodes[a], B = D.BOARD.nodes[b]; gE.appendChild(svgEl('line', { class: 'edge', x1: A.x, y1: A.y, x2: B.x, y2: B.y })); });
    D.BOARD.nodes.forEach(n => {
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
    D.BOARD.nodes.forEach(n => { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < bd) { bd = d; best = n.id; } });
    if (best >= 0) nodeTapped(best);
  }
  function figGroup(f) {
    let g = ui.figEls.get(f.id);
    if (!g) {
      g = svgEl('g', { class: 'fig p' + f.owner, 'data-id': f.id });
      const c = D.creatureOf(f);
      g.appendChild(svgEl('circle', { class: 'ring', r: 27 }));
      g.appendChild(svgEl('circle', { class: 'fb', r: 20 }));
      const t = svgEl('text', { class: 'fe', y: 1 }); t.textContent = c.emoji; g.appendChild(t);
      g.appendChild(svgEl('circle', { class: 'ft', cx: 15, cy: 15, r: 6, fill: D.TYPES[c.type].color }));
      const st = svgEl('g', { class: 'fs' }); st.appendChild(svgEl('circle', { cx: 16, cy: -16, r: 8.5 })); st.appendChild(svgEl('text', { x: 16, y: -15.5 })); g.appendChild(st);
      const av = svgEl('g', { class: 'fa' }); av.appendChild(svgEl('circle', { cx: -16, cy: -16, r: 8.5 })); av.appendChild(svgEl('text', { x: -16, y: -15.5 })); g.appendChild(av);
      g.style.opacity = '0';
      $('#figs').appendChild(g); ui.figEls.set(f.id, g);
      const n = D.BOARD.nodes[f.node]; g.style.transform = 'translate(' + n.x + 'px,' + n.y + 'px)';
      requestAnimationFrame(() => { g.style.opacity = '1'; });
    }
    return g;
  }
  function placeFig(g, nodeId) { const n = D.BOARD.nodes[nodeId]; g.style.transform = 'translate(' + n.x + 'px,' + n.y + 'px)'; }
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
      if (f.status) { const S = D.STATUS[f.status.k]; st.style.display = ''; st.querySelector('circle').setAttribute('fill', S.color); st.querySelector('text').textContent = S.icon; }
      else st.style.display = 'none';
      const av = g.querySelector('.fa'); const rel = advOf(f);
      if (rel) { av.style.display = ''; av.querySelector('circle').setAttribute('fill', rel > 0 ? 'var(--go)' : 'var(--hit)'); av.querySelector('text').textContent = rel > 0 ? '▲' : '▼'; }
      else av.style.display = 'none';
    });
    for (const [id, g] of ui.figEls) if (!alive.has(id)) { g.remove(); ui.figEls.delete(id); }
    // resaltados
    const hl = $('#hl'); hl.innerHTML = '';
    if (ui.sel) {
      for (const [n] of ui.sel.dest) { const N = D.BOARD.nodes[n]; hl.appendChild(svgEl('circle', { class: 'hl-go', cx: N.x, cy: N.y, r: 16 })); hl.appendChild(svgEl('circle', { class: 'hl-go-ring', cx: N.x, cy: N.y, r: 19 })); }
    }
    targetIds().forEach(id => { const N = D.BOARD.nodes[s.figs[id].node]; hl.appendChild(svgEl('circle', { class: 'hl-hit', cx: N.x, cy: N.y, r: 27 })); });
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
        const b = el('button', 'slot ' + f.loc + (ui.sel && ui.sel.fig === f.id ? ' sel' : '') + (rel > 0 ? ' up' : rel < 0 ? ' down' : ''));
        b.type = 'button';
        b.innerHTML = c.emoji + '<span class="tdot" style="background:' + D.TYPES[c.type].color + '"></span>';
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
        acts = [{ label: 'Volver', onClick: () => { ui.confirm = null; refresh(); } }, { label: 'Atacar', primary: true, onClick: doAttack }];
      } else if (s.awaitAttack !== null) {
        if (s.forcedAttack) msg = '<b>Ataque obligatorio:</b> toca un rival marcado en rojo.';
        else { msg = 'Puedes atacar: toca un rival marcado en rojo.'; acts = [{ label: 'No atacar', onClick: () => commit({ type: 'end' }) }]; }
      } else if (ui.sel) {
        acts = [{ label: 'Cancelar', onClick: () => { ui.sel = null; ui.msg = ''; refresh(); } }];
        if (!msg) msg = ui.sel.dest.size && ui.sel.targets.length ? 'Toca una casilla verde para moverte o un rival en rojo para atacar sin moverte.'
          : ui.sel.dest.size ? 'Toca una casilla verde.'
          : ui.sel.targets.length ? (D.mustAttack(s) ? '<b>Ninguna figura puede moverse:</b> debes atacar. ' : 'No puede moverse, pero puede atacar. ') + 'Toca un rival en rojo.'
          : 'Esta figura no tiene jugadas. Elige otra.';
      } else if (!msg) msg = D.mustAttack(s) ? '<b>Ninguna figura puede moverse:</b> el ataque es obligatorio. Toca una figura tuya junto a un rival.'
          : 'Tu turno: mueve una figura o ataca con una que tenga un rival al lado.';
    }
    $('#msg').innerHTML = msg || '';
    setActions(acts);
    const pill = $('#turn-pill');
    if (s.winner !== null) { pill.className = 'pill'; pill.innerHTML = 'Partida terminada'; }
    else { pill.className = 'pill p' + s.current; pill.innerHTML = (s.current === 0 ? 'Tu turno' : 'Turno CPU') + ' <small>· ' + s.turn + '/' + D.MAX_TURNS + '</small>'; }
  }
  function refresh() { renderBoard(); renderBenches(); renderPanel(); renderFicha(); }
  function say(t) { ui.msg = t; }
  function logEvents(events, who) {
    events.forEach(e => { if (e.text) ui.log.unshift({ turn: ui.state ? ui.state.turn : 0, text: e.text }); });
    if (who) ui.log.unshift({ turn: ui.state.turn, text: who });
    ui.log.length = Math.min(ui.log.length, 80);
  }
  function save() {
    if (!ui.state) return;
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
  }
  function slotTapped(id) {
    const f = ui.state.figs[id];
    if (canAct() && f.owner === 0 && f.loc === 'bench' && ui.state.awaitAttack === null) {
      if (ui.sel && ui.sel.fig === id) { ui.sel = null; ui.msg = ''; } else selectFig(id);
    } else { ui.info = { fig: id }; }
    refresh();
  }
  function nodeTapped(n) {
    const s = ui.state; const occ = D.occupancy(s); const fid = occ[n];
    const f = fid !== -1 ? s.figs[fid] : null;
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
    if (f && f.owner === 0) { if (ui.sel && ui.sel.fig === fid) { ui.sel = null; ui.msg = ''; } else selectFig(fid); }
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
    ui.confirm = null;
    if (c.stay) ui.state = D.applyAction(ui.state, { type: 'stay', fig: c.fig }).state;
    await runBattle(c.fig, c.target);
    afterAction();
  }

  /* ---------- Combate a pantalla completa ---------- */
  function runBattle(aId, dId) {
    ui.busy = true; refresh();
    const s = ui.state;
    const sp = D.spinBattle(s, aId, dId, Math.random);
    const preview = D.resolveBattle(s, aId, dId, sp.ai, sp.di);
    const A = s.figs[aId], Df = s.figs[dId];
    const top = A.owner === 1 ? A : Df, bot = A.owner === 1 ? Df : A;
    const sides = [[top, top === A ? sp.wa : sp.wd, top === A ? sp.ai : sp.di, '#bf-top'], [bot, bot === A ? sp.wa : sp.wd, bot === A ? sp.ai : sp.di, '#bf-bot']];
    const size = Math.max(120, Math.min(190, Math.floor((window.innerHeight - 300) / 2), window.innerWidth - 200));
    const anims = sides.map(([f, wheel, idx, sel], k) => {
      const box = $(sel); const c = D.creatureOf(f);
      box.className = 'fighter p' + f.owner;
      const mods = [...new Set(wheel.flatMap(x => x.mods || []))];
      box.querySelector('.fn').innerHTML = c.emoji + ' ' + esc(c.name);
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
          a.box.querySelector('.res').innerHTML = '<span class="sq" style="background:' + D.SEG[seg.t].color + '"></span>' + esc(D.segLabel(seg));
        });
        const w = preview.battle.winner;
        if (w !== null) (w === top.id ? anims[0] : anims[1]).box.classList.add('win');
        $('#battle-text').textContent = preview.battle.text;
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

  async function cpuTurn() {
    ui.busy = true; ui.sel = null; ui.confirm = null;
    const prev = ui.msg;
    renderBoard(); renderBenches(); renderPanel();
    $('#msg').innerHTML = (prev ? prev + '<br>' : '') + 'La CPU está pensando…'; setActions([]);
    await wait(prev ? 900 : 500);
    let t0 = performance.now();
    let act = AI.choose(ui.state, ui.level);
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
      const a2 = AI.choose(ui.state, ui.level);
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
    store.del();
    const s = ui.state;
    const title = s.winner === 0 ? '¡Ganaste!' : s.winner === 1 ? 'Ganó la CPU' : 'Empate';
    const choice = await openModal(title, '<p>' + esc(s.winReason) + '</p><p class="note">Partida de ' + s.turn + ' turnos en nivel ' + AI.LEVELS[ui.level].name + '.</p>',
      [{ label: 'Cambiar equipo', value: 'team' }, { label: 'Revancha', value: 'again', primary: true }]);
    if (choice === 'again') startGame(ui.team, ui.cpuTeam); else showTeamScreen();
  }

  /* ---------- Inicio ---------- */
  function startGame(team, cpuTeam) {
    ui.team = team.slice(); ui.cpuTeam = cpuTeam || D.randomBalancedTeam();
    const first = Math.random() < 0.5 ? 0 : 1;
    ui.state = D.newGame(ui.team, ui.cpuTeam, first);
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
      rows += '<tr><td>' + c.emoji + ' ' + esc(c.name) + '</td><td>' + worst.toFixed(1).replace('.', ',') + ' pp</td><td class="' + (over ? 'warn' : 'ok') + '">' + (over ? over + ' fuera' : 'OK') + '</td><td class="' + (stopFails ? 'warn' : 'ok') + '">' + (stopFails ? stopFails : 'OK') + '</td></tr>';
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
    openModal('Menú', '<p>Nivel: <b>' + AI.LEVELS[ui.level].name + '</b>. Último turno de la CPU: <b>' + ms + '</b> de cálculo (sin animaciones).</p>', [
      { label: 'Historial', onClick: () => setTimeout(openLog, 0) },
      { label: 'Prueba de ruletas', onClick: () => setTimeout(openWheelTest, 0) },
      { label: ui.fast ? 'Animación normal' : 'Animación rápida', onClick: () => { ui.fast = !ui.fast; } },
      { label: 'Abandonar partida', danger: true, onClick: () => setTimeout(confirmQuit, 0) },
      { label: 'Seguir jugando', primary: true }
    ]);
  }
  async function confirmQuit() {
    const v = await openModal('¿Abandonar la partida?', '<p>Se pierde la partida en curso y vuelves a elegir equipo.</p>', [{ label: 'Cancelar', value: 'no' }, { label: 'Abandonar', value: 'yes', danger: true }]);
    if (v === 'yes') { store.del(); ui.busy = false; showTeamScreen(); }
  }

  /* ---------- Arranque ---------- */
  function init() {
    document.querySelectorAll('#diff button').forEach(b => b.addEventListener('click', () => { ui.level = b.dataset.lv; renderTeam(); }));
    $('#btn-random').addEventListener('click', () => { ui.team = D.randomBalancedTeam(); renderTeam(); });
    $('#btn-play').addEventListener('click', () => { if (ui.team.length === 6) startGame(ui.team); });
    $('#btn-continue').addEventListener('click', () => { const sv = store.get(); if (sv && sv.state && Array.isArray(sv.state.figs) && sv.state.figs.length === 12 && !D.validate(sv.state).length) resumeGame(sv); else { store.del(); renderTeam(); } });
    $('#btn-rules-t').addEventListener('click', () => openModal('Cómo jugar', rulesHTML()));
    $('#btn-rules-g').addEventListener('click', () => openModal('Cómo jugar', rulesHTML()));
    $('#btn-menu').addEventListener('click', openMenu);
    ui.team = ['tizonaje', 'pulpiza', 'erizarza', 'tejonrock', 'zumbiza', 'musgoso'];
    renderTeam();
  }
  window.DuelUI = { get state() { return ui.state; }, get busy() { return ui.busy; }, setFast(v) { ui.fast = v; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
