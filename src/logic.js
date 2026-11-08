/* ===================== LÓGICA PURA (sin DOM) ===================== */
(function (root) {
  'use strict';

  const MAX_TURNS = 300;
  const KO_TURNS = 2;

  const TYPES = {
    fuego:  { name: 'Fuego',  color: '#ff7a45', beats: 'planta' },
    planta: { name: 'Planta', color: '#4fc46a', beats: 'tierra' },
    tierra: { name: 'Tierra', color: '#c8955a', beats: 'rayo' },
    rayo:   { name: 'Rayo',   color: '#f2c94c', beats: 'agua' },
    agua:   { name: 'Agua',   color: '#4aa8ff', beats: 'fuego' }
  };
  const TYPE_ORDER = ['fuego', 'planta', 'tierra', 'rayo', 'agua'];

  const STATUS = {
    poison: { name: 'Veneno',      adj: 'envenenada', icon: '☠', dur: 3, color: '#9b5de5' },
    para:   { name: 'Parálisis',   adj: 'paralizada', icon: 'ϟ', dur: 3, color: '#e0b100' },
    sleep:  { name: 'Sueño',       adj: 'dormida',    icon: 'z', dur: 2, color: '#7aa2ff' },
    freeze: { name: 'Congelación', adj: 'congelada',  icon: '❄', dur: 3, color: '#7fe3ff' }
  };

  // Tipos de segmento. rank: orden de prioridad (azul se trata aparte).
  const SEG = {
    g: { name: 'Dorado', rank: 3, color: '#e8b730', ink: '#3a2a00' },
    p: { name: 'Morado', rank: 2, color: '#8e5ce6', ink: '#ffffff' },
    w: { name: 'Blanco', rank: 1, color: '#f3f1ea', ink: '#1d2030' },
    r: { name: 'Rojo',   rank: 0, color: '#e5484d', ink: '#ffffff' },
    b: { name: 'Azul',   rank: -1, color: '#3d8bfd', ink: '#ffffff' }
  };

  const FX = {
    cure:       'y se cura de su estado',
    area_para:  'y paraliza a los rivales que tenga al lado',
    area_sleep: 'y duerme a los rivales que tenga al lado'
  };

  const RARITY = { c: 'Común', r: 'Rara', e: 'Épica' };

  // Constructores de segmentos (los pesos de cada ruleta suman 96)
  const W = (name, dmg, w) => ({ t: 'w', name, dmg, w });
  const G = (name, dmg, w, fx) => ({ t: 'g', name, dmg, w, fx: fx || null });
  const P = (name, stars, st, w) => ({ t: 'p', name, stars, st, w });
  const B = (name, w) => ({ t: 'b', name, w });
  const R = (w) => ({ t: 'r', name: 'Fallo', w });

  const CREATURES = [
    { id: 'tizonaje', name: 'Tizonaje', emoji: '🦂', type: 'fuego', mp: 2, rarity: 'c',
      wheel: [W('Aguijón ígneo', 60, 28), W('Pinza ardiente', 40, 24), P('Toxina candente', 1, 'poison', 16), G('Llamarada', 50, 12), B('Esquiva', 8), R(8)] },
    { id: 'magmuz', name: 'Magmuz', emoji: '🦬', type: 'fuego', mp: 1, rarity: 'r',
      wheel: [W('Embestida volcánica', 110, 32), W('Pisotón', 80, 24), G('Erupción', 100, 8, 'area_para'), B('Coraza de magma', 12), R(20)] },
    { id: 'pavorasa', name: 'Pavorasa', emoji: '🦚', type: 'fuego', mp: 3, rarity: 'e',
      wheel: [W('Abanico de brasas', 70, 24), G('Danza solar', 90, 12, 'cure'), P('Destello hipnótico', 2, 'sleep', 16), W('Picotazo', 30, 20), B('Vuelo', 12), R(12)] },
    { id: 'pulpiza', name: 'Pulpiza', emoji: '🐙', type: 'agua', mp: 2, rarity: 'c',
      wheel: [W('Tentáculo', 50, 28), P('Tinta paralizante', 2, 'para', 20), W('Chorro', 30, 20), B('Nube de tinta', 16), R(12)] },
    { id: 'cetamar', name: 'Cetamar', emoji: '🐋', type: 'agua', mp: 1, rarity: 'e',
      wheel: [W('Ola gigante', 120, 28), G('Canto abisal', 80, 12, 'area_sleep'), P('Escarcha marina', 3, 'freeze', 12), B('Inmersión', 16), R(28)] },
    { id: 'lodocaiman', name: 'Lodocaimán', emoji: '🐊', type: 'agua', mp: 2, rarity: 'c',
      wheel: [W('Mordisco', 80, 32), W('Coletazo', 50, 24), P('Lodo tóxico', 2, 'poison', 12), B('Sumergirse', 12), R(16)] },
    { id: 'erizarza', name: 'Erizarza', emoji: '🦔', type: 'planta', mp: 2, rarity: 'c',
      wheel: [W('Púas', 50, 32), P('Espinas venenosas', 2, 'poison', 20), B('Bola de espinas', 20), W('Rodada', 30, 12), R(12)] },
    { id: 'musgoso', name: 'Musgoso', emoji: '🦥', type: 'planta', mp: 1, rarity: 'r',
      wheel: [P('Esporas', 3, 'sleep', 24), W('Garra musgosa', 70, 28), G('Fotosíntesis', 60, 12, 'cure'), B('Camuflaje', 16), R(16)] },
    { id: 'tejonrock', name: 'Tejonrock', emoji: '🦡', type: 'tierra', mp: 2, rarity: 'r',
      wheel: [W('Excavar', 70, 28), W('Zarpazo', 90, 20), G('Terremoto', 80, 8, 'area_para'), B('Madriguera', 16), R(24)] },
    { id: 'corazamba', name: 'Corazamba', emoji: '🪲', type: 'tierra', mp: 1, rarity: 'c',
      wheel: [W('Cornada', 60, 28), B('Caparazón', 28), P('Polvo aturdidor', 1, 'para', 16), W('Rodar', 40, 12), R(12)] },
    { id: 'zumbiza', name: 'Zumbiza', emoji: '🐝', type: 'rayo', mp: 3, rarity: 'c',
      wheel: [W('Aguijón eléctrico', 40, 32), P('Zumbido paralizante', 2, 'para', 16), B('Vuelo zigzag', 16), W('Picada', 20, 16), R(16)] },
    { id: 'chispabuho', name: 'Chispabúho', emoji: '🦉', type: 'rayo', mp: 2, rarity: 'r',
      wheel: [W('Garra voltaica', 70, 28), G('Relámpago', 90, 12), P('Ojos hipnóticos', 2, 'sleep', 12), W('Picotazo', 30, 12), B('Planeo', 16), R(16)] }
  ];
  const CREATURE = {};
  CREATURES.forEach((c, i) => { c.index = i; CREATURE[c.id] = c; });

  /* ---------- Tablero: red de 29 nodos ----------
     Fila 0 = lado CPU (jugador 1), fila 6 = lado jugador (jugador 0).
     Filas pares: 5 nodos encadenados. Filas impares: columnas 0, 2 y 4.
     El nodo central (2,3) se une en diagonal a (1,2),(3,2),(1,4),(3,4). */
  const BOARD = (function () {
    const layout = [[0, 1, 2, 3, 4], [0, 2, 4], [0, 1, 2, 3, 4], [0, 2, 4], [0, 1, 2, 3, 4], [0, 2, 4], [0, 1, 2, 3, 4]];
    const nodes = []; const at = {};
    layout.forEach((cols, r) => cols.forEach(c => {
      const id = nodes.length;
      nodes.push({ id, c, r, x: 40 + c * 70, y: 34 + r * 58, kind: 'n', owner: null });
      at[c + ',' + r] = id;
    }));
    const adj = nodes.map(() => []);
    const link = (a, b) => { const A = at[a], Bn = at[b]; if (A === undefined || Bn === undefined) throw new Error('nodo ' + a + '/' + b); adj[A].push(Bn); adj[Bn].push(A); };
    [0, 2, 4, 6].forEach(r => { for (let c = 0; c < 4; c++) link(c + ',' + r, (c + 1) + ',' + r); });
    for (let r = 0; r < 6; r++) [0, 2, 4].forEach(c => link(c + ',' + r, c + ',' + (r + 1)));
    link('2,3', '1,2'); link('2,3', '3,2'); link('2,3', '1,4'); link('2,3', '3,4');
    const goal = [at['2,6'], at['2,0']];
    const entries = [[at['0,6'], at['4,6']], [at['0,0'], at['4,0']]];
    goal.forEach((g, p) => { nodes[g].kind = 'goal'; nodes[g].owner = p; });
    entries.forEach((es, p) => es.forEach(e => { nodes[e].kind = 'entry'; nodes[e].owner = p; }));
    const edges = [];
    adj.forEach((ns, a) => ns.forEach(b => { if (a < b) edges.push([a, b]); }));
    // distancias estáticas (sin ocupación)
    const dist = nodes.map((_, s) => {
      const d = new Array(nodes.length).fill(99); d[s] = 0; const q = [s];
      while (q.length) { const u = q.shift(); adj[u].forEach(v => { if (d[v] > d[u] + 1) { d[v] = d[u] + 1; q.push(v); } }); }
      return d;
    });
    return { nodes, adj, edges, goal, entries, dist, width: 360, height: 416 };
  })();

  /* ---------- Utilidades ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clone(s) {
    return {
      turn: s.turn, current: s.current, winner: s.winner, winReason: s.winReason,
      awaitAttack: s.awaitAttack, forcedAttack: !!s.forcedAttack, firstPlayer: s.firstPlayer,
      figs: s.figs.map(f => ({ ...f, status: f.status ? { ...f.status } : null }))
    };
  }

  function newGame(team0, team1, firstPlayer) {
    const figs = [];
    [team0, team1].forEach((team, owner) => team.forEach((kind, slot) => {
      if (!CREATURE[kind]) throw new Error('Criatura desconocida: ' + kind);
      figs.push({ id: figs.length, owner, slot, kind, loc: 'bench', node: null, status: null, koLeft: 0, koAt: 0 });
    }));
    return { turn: 1, current: firstPlayer || 0, firstPlayer: firstPlayer || 0, winner: null, winReason: '', awaitAttack: null, forcedAttack: false, figs };
  }

  const creatureOf = f => CREATURE[f.kind];
  const rivalGoal = p => BOARD.goal[1 - p];
  const isImmobile = f => !!(f.status && (f.status.k === 'sleep' || f.status.k === 'freeze'));

  function occupancy(s) {
    const occ = new Array(BOARD.nodes.length).fill(-1);
    s.figs.forEach(f => { if (f.loc === 'board') occ[f.node] = f.id; });
    return occ;
  }

  // BFS por casillas libres. No se atraviesa la meta rival (llegar ahí termina la partida).
  function reachable(s, start, steps, owner, occ) {
    occ = occ || occupancy(s);
    const goalR = rivalGoal(owner);
    const prev = new Map(); const dist = new Map();
    dist.set(start, 0); prev.set(start, null);
    const q = [start];
    while (q.length) {
      const u = q.shift(); const d = dist.get(u);
      if (d >= steps) continue;
      if (u === goalR && u !== start) continue;
      for (const v of BOARD.adj[u]) {
        if (dist.has(v) || occ[v] !== -1) continue;
        dist.set(v, d + 1); prev.set(v, u); q.push(v);
      }
    }
    const pathTo = n => { const p = []; let c = n; while (c !== null && c !== undefined) { p.unshift(c); c = prev.get(c); } return p; };
    return { dist, pathTo };
  }

  function adjacentRivals(s, fig, occ) {
    occ = occ || occupancy(s);
    if (fig.loc !== 'board') return [];
    return BOARD.adj[fig.node].map(n => occ[n]).filter(id => id !== -1 && s.figs[id].owner !== fig.owner);
  }

  /* ---------- Acciones legales ----------
     Movimiento obligatorio: si alguna figura puede entrar o moverse, el turno debe ser un movimiento
     (después de moverse, atacar es opcional). Solo si ninguna puede moverse se ataca sin moverse,
     y en ese caso el ataque es obligatorio. Si tampoco hay ataques, se pasa. */
  function legalActions(s) {
    if (s.winner !== null) return [];
    const p = s.current; const occ = occupancy(s);
    if (s.awaitAttack !== null) {
      const f = s.figs[s.awaitAttack];
      const atk = adjacentRivals(s, f, occ).map(t => ({ type: 'attack', fig: f.id, target: t }));
      return s.forcedAttack && atk.length ? atk : atk.concat([{ type: 'end' }]);
    }
    const acts = [];
    for (const f of s.figs) {
      if (f.owner !== p) continue;
      const mp = creatureOf(f).mp;
      if (f.loc === 'bench') {
        const seen = new Set();
        for (const e of BOARD.entries[p]) {
          if (occ[e] !== -1) continue;
          // meter = colocar la figura en una entrada libre (después puede atacar si queda junto a un rival)
          if (!seen.has(e)) { seen.add(e); acts.push({ type: 'enter', fig: f.id, to: e, path: [e] }); }
        }
      } else if (f.loc === 'board' && !isImmobile(f)) {
        const r = reachable(s, f.node, mp, p, occ);
        for (const [n] of r.dist) if (n !== f.node) acts.push({ type: 'move', fig: f.id, to: n, path: r.pathTo(n) });
        if (adjacentRivals(s, f, occ).length) acts.push({ type: 'stay', fig: f.id });
      }
    }
    const moves = acts.filter(a => a.type !== 'stay');
    return moves.length ? moves : acts;
  }

  // true si al jugador actual no le queda otra que atacar sin moverse
  function mustAttack(s) {
    const acts = legalActions(s);
    return s.awaitAttack === null && acts.length > 0 && acts.every(a => a.type === 'stay');
  }

  /* ---------- Rodear ---------- */
  // Se eliminan las figuras rivales del jugador que actúa cuyas casillas vecinas están todas ocupadas por él.
  function surroundCheck(s, acting, events) {
    const occ = occupancy(s);
    const victims = s.figs.filter(f => f.owner !== acting && f.loc === 'board' &&
      BOARD.adj[f.node].every(n => occ[n] !== -1 && s.figs[occ[n]].owner === acting));
    victims.forEach(f => { knockOut(s, f); events.push({ type: 'surround', fig: f.id, text: creatureOf(f).name + ' quedó rodeada y va a la enfermería.' }); });
    return victims.length;
  }

  function knockOut(s, f) {
    f.loc = 'ko'; f.node = null; f.status = null; f.koLeft = KO_TURNS; f.koAt = s.turn;
  }

  function setStatus(s, f, k) {
    f.status = { k, left: STATUS[k].dur, at: s.turn };
  }

  /* ---------- Fin de turno ---------- */
  function endTurn(s, events) {
    const p = s.current;
    for (const f of s.figs) {
      if (f.owner !== p) continue;
      if (f.status && f.status.at !== s.turn) {
        f.status.left--;
        if (f.status.left <= 0) { events.push({ type: 'cure', fig: f.id, text: creatureOf(f).name + ' ya no está ' + STATUS[f.status.k].adj + '.' }); f.status = null; }
      }
      if (f.loc === 'ko' && f.koAt !== s.turn) {
        f.koLeft--;
        if (f.koLeft <= 0) { f.loc = 'bench'; f.koLeft = 0; events.push({ type: 'heal', fig: f.id, text: creatureOf(f).name + ' vuelve a la banca.' }); }
      }
    }
    s.awaitAttack = null; s.forcedAttack = false;
    if (s.turn >= MAX_TURNS) {
      const c = [0, 1].map(o => s.figs.filter(f => f.owner === o && f.loc === 'board').length);
      s.winner = c[0] === c[1] ? 'draw' : (c[0] > c[1] ? 0 : 1);
      s.winReason = 'Límite de ' + MAX_TURNS + ' turnos: ' + c[0] + ' contra ' + c[1] + ' figuras en el tablero.';
      events.push({ type: 'limit', text: s.winReason });
      return;
    }
    s.turn++;
    s.current = 1 - p;
  }

  function checkGoal(s, f, events) {
    if (f.loc === 'board' && f.node === rivalGoal(f.owner)) {
      s.winner = f.owner;
      s.winReason = creatureOf(f).name + ' llegó a la meta rival.';
      events.push({ type: 'win', fig: f.id, text: s.winReason });
      return true;
    }
    return false;
  }

  /* ---------- Aplicar acción (pura: devuelve un estado nuevo) ---------- */
  function applyAction(s0, act, rng) {
    const s = clone(s0); const events = [];
    if (s.winner !== null) return { state: s, events };
    if (act.type === 'pass') { events.push({ type: 'pass', text: 'Sin jugadas posibles: se pasa el turno.' }); endTurn(s, events); return { state: s, events }; }
    if (act.type === 'end') { endTurn(s, events); return { state: s, events }; }
    if (act.type === 'stay') { s.awaitAttack = act.fig; s.forcedAttack = true; return { state: s, events }; }
    if (act.type === 'enter' || act.type === 'move') {
      const f = s.figs[act.fig];
      const from = f.loc === 'board' ? f.node : null;
      f.loc = 'board'; f.node = act.to;
      events.push({ type: act.type, fig: f.id, from, to: act.to, path: act.path });
      if (checkGoal(s, f, events)) return { state: s, events };
      surroundCheck(s, s.current, events);
      if (adjacentRivals(s, f).length) { s.awaitAttack = f.id; s.forcedAttack = false; } else endTurn(s, events);
      return { state: s, events };
    }
    if (act.type === 'attack') {
      const sp = act.spin || spinBattle(s, act.fig, act.target, rng || Math.random);
      const r = resolveBattle(s, act.fig, act.target, sp.ai, sp.di);
      r.events.forEach(e => events.push(e));
      surroundCheck(r.state, r.state.current, events);
      endTurn(r.state, events);
      return { state: r.state, events, battle: r.battle };
    }
    throw new Error('Acción desconocida: ' + act.type);
  }

  /* ---------- Ruletas ---------- */
  function pickIndex(wheel, rng) {
    const total = wheel.reduce((a, s) => a + s.w, 0);
    let x = rng() * total;
    for (let i = 0; i < wheel.length; i++) { x -= wheel[i].w; if (x < 0) return i; }
    return wheel.length - 1;
  }

  // Ruleta efectiva de una figura frente a un rival (aplica estados y ventaja de tipo)
  function effectiveWheel(f, opp) {
    const c = creatureOf(f);
    if (isImmobile(f)) {
      return [{ t: 'r', name: STATUS[f.status.k].name + ': no gira', w: 96, forced: true, mods: [STATUS[f.status.k].name + ' (cuenta como fallo)'] }];
    }
    const adv = opp && TYPES[c.type].beats === creatureOf(opp).type;
    const poison = f.status && f.status.k === 'poison';
    const para = f.status && f.status.k === 'para';
    const maxW = Math.max(...c.wheel.map(x => x.w));
    return c.wheel.map(seg => {
      const e = { ...seg, base: seg.dmg, mods: [] };
      if (para && seg.w === maxW) { e.t = 'r'; e.origT = seg.t; e.mods.push('Parálisis'); return e; }
      if (e.t === 'w') {
        if (adv) { e.dmg += 10; e.mods.push('Ventaja +10'); }
        if (poison) { e.dmg = Math.max(0, e.dmg - 20); e.mods.push('Veneno −20'); }
      }
      return e;
    });
  }

  // >0 gana a, <0 gana b, 0 empate. Prioridad: Azul anula · Dorado > Morado > Blanco > Rojo
  function compareSegs(a, b) {
    if (a.t === 'b' || b.t === 'b') return 0;
    const ra = SEG[a.t].rank, rb = SEG[b.t].rank;
    if (ra !== rb) return ra > rb ? 1 : -1;
    if (a.t === 'w' || a.t === 'g') return Math.sign(a.dmg - b.dmg);
    if (a.t === 'p') return Math.sign(a.stars - b.stars);
    return 0;
  }

  function spinBattle(s, aId, dId, rng) {
    const A = s.figs[aId], D = s.figs[dId];
    const wa = effectiveWheel(A, D), wd = effectiveWheel(D, A);
    return { ai: pickIndex(wa, rng), di: pickIndex(wd, rng), wa, wd };
  }

  function segLabel(seg) {
    if (seg.t === 'w' || seg.t === 'g') return seg.name + ' (' + seg.dmg + ')';
    if (seg.t === 'p') return seg.name + ' (' + '★'.repeat(seg.stars) + ')';
    return seg.name;
  }

  function battleOdds(s, aId, dId) {
    const A = s.figs[aId], D = s.figs[dId];
    const wa = effectiveWheel(A, D), wd = effectiveWheel(D, A);
    const ta = wa.reduce((x, y) => x + y.w, 0), td = wd.reduce((x, y) => x + y.w, 0);
    let win = 0, lose = 0;
    for (const a of wa) for (const d of wd) {
      const c = compareSegs(a, d); const p = (a.w / ta) * (d.w / td);
      if (c > 0) win += p; else if (c < 0) lose += p;
    }
    return { win, lose, tie: 1 - win - lose };
  }

  function resolveBattle(s0, aId, dId, ai, di) {
    const s = clone(s0); const events = [];
    const A = s.figs[aId], D = s.figs[dId];
    const wa = effectiveWheel(A, D), wd = effectiveWheel(D, A);
    const sa = wa[ai], sd = wd[di];
    const c = compareSegs(sa, sd);
    const nA = creatureOf(A).name, nD = creatureOf(D).name;
    const defenderWasAsleep = isImmobile(D);
    // al ser atacada, una figura dormida o congelada despierta (después de girar)
    if (defenderWasAsleep) D.status = null;
    let text; let winner = null; let outcome = 'tie';
    if (c === 0) {
      if (sa.t === 'b' || sd.t === 'b') {
        const who = sa.t === 'b' ? nA : nD;
        text = who + ' usó ' + (sa.t === 'b' ? sa.name : sd.name) + ': el combate se anula.';
      } else {
        text = 'Empate: ' + segLabel(sa) + ' contra ' + segLabel(sd) + '. No pasa nada.';
      }
    } else {
      const Wf = c > 0 ? A : D, Lf = c > 0 ? D : A;
      const ws = c > 0 ? sa : sd, ls = c > 0 ? sd : sa;
      winner = Wf.id;
      const nW = creatureOf(Wf).name, nL = creatureOf(Lf).name;
      if (ws.t === 'p') {
        setStatus(s, Lf, ws.st); outcome = 'status';
        text = nW + ' gana con ' + segLabel(ws) + ' sobre ' + segLabel(ls) + ': ' + nL + ' queda ' + STATUS[ws.st].adj + '.';
      } else {
        const wNode = Wf.node;
        knockOut(s, Lf); outcome = 'ko';
        text = nW + ' gana con ' + segLabel(ws) + ' sobre ' + segLabel(ls) + ': ' + nL + ' va a la enfermería';
        if (ws.t === 'g' && ws.fx) {
          text += ' ' + FX[ws.fx];
          if (ws.fx === 'cure') Wf.status = null;
          else {
            const k = ws.fx === 'area_para' ? 'para' : 'sleep';
            const occ = occupancy(s);
            BOARD.adj[wNode].forEach(n => { const id = occ[n]; if (id !== -1 && s.figs[id].owner !== Wf.owner) setStatus(s, s.figs[id], k); });
          }
        }
        text += '.';
      }
    }
    if (defenderWasAsleep && D.loc === 'board' && !(D.status && (D.status.k === 'sleep' || D.status.k === 'freeze')) && outcome !== 'ko') {
      text += ' ' + nD + ' despierta.';
    }
    events.push({ type: 'battle', text, attacker: aId, defender: dId });
    return { state: s, events, battle: { wa, wd, ai, di, winner, outcome, text } };
  }

  /* ---------- Geometría de la ruleta (pura, para poder probarla) ----------
     Los segmentos se dibujan en sentido horario desde arriba; el puntero está arriba.
     Girar la ruleta un ángulo θ (horario) deja bajo el puntero la fracción f = (-θ/2π) mod 1. */
  function wheelFractions(wheel) {
    const tot = wheel.reduce((a, s) => a + s.w, 0); let acc = 0;
    return wheel.map(s => { const a = acc / tot; acc += s.w; return [a, acc / tot]; });
  }
  function segmentAtRotation(wheel, theta) {
    const TAU = Math.PI * 2;
    const f = (((-theta / TAU) % 1) + 1) % 1;
    const fr = wheelFractions(wheel);
    for (let i = 0; i < fr.length; i++) if (f >= fr[i][0] && f < fr[i][1]) return i;
    return fr.length - 1;
  }
  // Rotación final para que la ruleta se detenga dentro del segmento idx (nunca en el borde)
  function targetRotation(wheel, idx, turns, rng, from) {
    const TAU = Math.PI * 2;
    const [a, b] = wheelFractions(wheel)[idx];
    const f = a + (b - a) * (0.18 + 0.64 * (rng ? rng() : 0.5));
    const base = Math.ceil((from || 0) / TAU) * TAU;
    return base + TAU * (turns || 4) + (TAU - TAU * f) % TAU;
  }

  /* ---------- Equipo CPU equilibrado ---------- */
  function randomBalancedTeam(rng, exclude) {
    rng = rng || Math.random;
    const ids = CREATURES.map(c => c.id);
    for (let tries = 0; tries < 2000; tries++) {
      const pool = ids.slice();
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const team = pool.slice(0, 6);
      const types = new Set(team.map(id => CREATURE[id].type));
      const epics = team.filter(id => CREATURE[id].rarity === 'e').length;
      const mp = team.reduce((a, id) => a + CREATURE[id].mp, 0);
      if (types.size >= 4 && epics <= 1 && mp >= 10 && mp <= 12) return team;
    }
    return ids.slice(0, 6);
  }

  /* ---------- Validaciones ---------- */
  function validate(s) {
    const errs = []; const occ = {};
    s.figs.forEach(f => {
      if (f.loc === 'board') {
        if (f.node === null || f.node < 0 || f.node >= BOARD.nodes.length) errs.push('nodo inválido ' + f.id);
        if (occ[f.node] !== undefined) errs.push('dos figuras en el nodo ' + f.node);
        occ[f.node] = f.id;
      } else if (f.node !== null) errs.push('figura fuera del tablero con nodo ' + f.id);
      if (f.loc === 'ko' && (f.koLeft < 1 || f.koLeft > KO_TURNS)) errs.push('contador de enfermería raro ' + f.id);
      if (f.loc !== 'board' && f.status) errs.push('estado fuera del tablero ' + f.id);
      if (f.status && (f.status.left < 1 || f.status.left > STATUS[f.status.k].dur)) errs.push('duración de estado rara ' + f.id);
    });
    if (s.forcedAttack && s.awaitAttack === null) errs.push('ataque obligatorio sin figura atacante');
    return errs;
  }

  const api = {
    MAX_TURNS, KO_TURNS, TYPES, TYPE_ORDER, STATUS, SEG, FX, RARITY, CREATURES, CREATURE, BOARD,
    mulberry32, clone, newGame, occupancy, reachable, adjacentRivals, legalActions, applyAction,
    pickIndex, effectiveWheel, compareSegs, spinBattle, battleOdds, resolveBattle, segLabel,
    randomBalancedTeam, validate, mustAttack, wheelFractions, segmentAtRotation, targetRotation, creatureOf, isImmobile, rivalGoal
  };
  root.Duel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
