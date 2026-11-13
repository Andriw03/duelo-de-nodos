/* Pruebas del motor dirigido por datos (Fase 1): tableros como datos, configuración de duelo,
   compatibilidad con partidas guardadas y ganchos para reglas de jefe.
   Las reglas "prueba-*" existen solo aquí: sirven para comprobar que los ganchos funcionan,
   no son reglas del juego.   node test/reglas.js */
'use strict';
const assert = require('assert');
const D = require('../src/logic.js');
const AI = require('../src/ai.js');

let n = 0;
function prueba(nombre, fn) { fn(); n++; console.log('OK  ' + nombre); }

// Juega una partida CPU vs CPU validando cada paso; devuelve el estado final
function jugar(s, rng, lv) {
  let steps = 0;
  while (s.winner === null) {
    const a = AI.choose(s, lv || 'normal', rng);
    const legal = D.legalActions(s);
    if (a.type !== 'pass') assert(legal.some(x => x.type === a.type && x.fig === a.fig && x.to === a.to && x.target === a.target), 'acción ilegal ' + JSON.stringify(a));
    s = D.applyAction(s, a, rng).state;
    const errs = D.validate(s); assert.deepStrictEqual(errs, [], errs.join('; '));
    assert(++steps < 5000, 'bucle');
  }
  return s;
}
const equipo = r => D.randomBalancedTeam(r);

/* ---------- Tableros ---------- */
prueba('el tablero clásico sale de data/boards/clasico.json igual que antes', () => {
  const B = D.BOARDS.clasico;
  assert.strictEqual(B, D.BOARD);
  assert.strictEqual(B.nodes.length, 29);
  assert.strictEqual(B.edges.length, 38);
  assert.deepStrictEqual(B.goal, [26, 2]);
  assert.deepStrictEqual(B.entries, [[24, 28], [0, 4]]);
  assert.strictEqual(B.dist[24][2], 7);
  assert.strictEqual(B.nodes[26].kind, 'goal');
  assert.strictEqual(B.nodes[0].owner, 1);
});

prueba('compileBoard rechaza tableros mal formados', () => {
  const base = () => ({ id: 'x', nodes: [{}, {}, {}], edges: [[0, 1], [1, 2]], goals: [0, 2], entries: [[1], [1]] });
  assert.throws(() => D.compileBoard(base()), /usado dos veces/);
  const t = base(); t.entries = [[1], [0]]; assert.throws(() => D.compileBoard(t), /usado dos veces/);
  const u = base(); u.edges = [[0, 1]]; u.entries = [[1], [2]]; u.goals = [0, 2]; u.nodes.push({}); u.edges.push([2, 3]);
  u.entries = [[1], [3]]; assert.throws(() => D.compileBoard(u), /desconectados/);
  const v = base(); v.edges.push([0, 1]); assert.throws(() => D.compileBoard(v), /repetida/);
  const w = base(); w.edges.push([0, 9]); assert.throws(() => D.compileBoard(w), /inválida/);
  const x = base(); x.goals = [0, 0]; assert.throws(() => D.compileBoard(x), /metas/);
});

// Tablero de prueba: un pasillo de 9 cruces con un desvío. Metas en los extremos.
const PASILLO = {
  id: 'prueba-pasillo', width: 100, height: 100,
  nodes: Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: 0 })),
  edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [3, 9], [9, 5]],
  goals: [8, 0], entries: [[7], [1]], marked: [4], links: [[2, 6]]
};
D.registerBoard(PASILLO);

prueba('una partida se juega entera en otro tablero (motor e IA)', () => {
  const r = D.mulberry32(3);
  const s = jugar(D.newGame(equipo(r), equipo(r), 0, { board: 'prueba-pasillo', victory: { type: 'goal', turnLimit: 120 } }), r);
  assert.strictEqual(s.boardId, 'prueba-pasillo');
  assert(s.winner !== null);
  assert.deepStrictEqual(D.BOARDS['prueba-pasillo'].marked, [{ node: 4 }]);
  assert.deepStrictEqual(D.BOARDS['prueba-pasillo'].links, [{ a: 2, b: 6 }]);
});

/* ---------- Configuración de duelo ---------- */
prueba('el duelo libre es la partida de siempre', () => {
  const L = D.DUELS.libre;
  assert.strictEqual(L.board, 'clasico');
  const s = D.newGame(['tizonaje', 'pulpiza', 'erizarza', 'tejonrock', 'zumbiza', 'musgoso'], ['magmuz', 'cetamar', 'musgoso', 'corazamba', 'chispabuho', 'pavorasa'], 1, L);
  assert.strictEqual(s.boardId, 'clasico');
  assert.strictEqual(s.turnLimit, 300);
  assert.deepStrictEqual(s.rules, []);
  assert.strictEqual(s.duelId, 'libre');
  assert.strictEqual(s.current, 1);
});

prueba('límite de turnos configurable', () => {
  const r = D.mulberry32(11);
  const s = jugar(D.newGame(equipo(r), equipo(r), 0, { victory: { type: 'goal', turnLimit: 6 } }), r);
  assert(s.turn <= 6);
  if (s.winReason.startsWith('Límite')) assert(s.winReason.startsWith('Límite de 6 turnos'));
});

prueba('configuraciones inválidas fallan al crear la partida', () => {
  assert.throws(() => D.newGame(equipo(), equipo(), 0, { board: 'no-existe' }), /Tablero desconocido/);
  assert.throws(() => D.newGame(equipo(), equipo(), 0, { victory: { type: 'sobrevivir' } }), /no implementada/);
  assert.throws(() => D.newGame(equipo(), equipo(), 0, { rules: [{ type: 'no-registrada' }] }), /Regla desconocida/);
});

/* ---------- Partidas guardadas antes de la Fase 1 ---------- */
prueba('una partida guardada de la 0.2.0 (sin boardId) sigue cargando y se puede terminar', () => {
  const sv = require('./fixtures/partida-0.2.0.json');
  assert.strictEqual(sv.state.boardId, undefined);
  assert.deepStrictEqual(D.validate(sv.state), []);
  assert.strictEqual(D.boardOf(sv.state), D.BOARDS.clasico);
  assert.strictEqual(D.turnLimitOf(sv.state), 300);
  const s = jugar(JSON.parse(JSON.stringify(sv.state)), D.mulberry32(5));
  assert(s.winner !== null);
});

/* ---------- Ganchos de reglas (reglas de mentira, solo para estas pruebas) ---------- */
// neighbors: enlaza dos cruces como si fueran vecinos para moverse
D.registerRule('prueba-enlace', {
  neighbors(s, node, list, r) { return node === r.a ? list.concat([r.b]) : node === r.b ? list.concat([r.a]) : list; }
});
// afterLand: quien llega a un cruce marcado queda envenenado
D.registerRule('prueba-marca', {
  afterLand(s, f, events, r) { if (f.node === r.node) { f.status = { k: 'poison', left: 3, at: s.turn }; events.push({ type: 'prueba-marca', fig: f.id }); } }
});
// endTurn: deja constancia de cada fin de turno
D.registerRule('prueba-fin', {
  endTurn(s, player, events) { events.push({ type: 'prueba-fin', player }); }
});
// wheel: todas las ruletas del jugador 1 quedan en "Azul" (anula cualquier combate)
D.registerRule('prueba-ruleta', {
  wheel(s, f, opp, wheel) { return f.owner === 1 ? [{ t: 'b', name: 'Escudo de prueba', w: 96, mods: ['prueba'] }] : wheel; }
});

function conFiguras(rules, colocar) {
  const s = D.newGame(['magmuz', 'pulpiza', 'erizarza', 'tejonrock', 'zumbiza', 'musgoso'], ['magmuz', 'cetamar', 'musgoso', 'corazamba', 'chispabuho', 'pavorasa'], 0, { rules });
  colocar(s); return s;
}

prueba('gancho neighbors: un enlace abre un camino nuevo al moverse', () => {
  // Magmuz (1 de movimiento) en la entrada 24: sin enlace solo llega a sus vecinos
  const poner = s => { s.figs[0].loc = 'board'; s.figs[0].node = 24; };
  const sin = conFiguras([], poner), con = conFiguras([{ type: 'prueba-enlace', a: 24, b: 14 }], poner);
  const destinos = s => D.legalActions(s).filter(a => a.fig === 0 && a.type === 'move').map(a => a.to).sort((x, y) => x - y);
  assert(!destinos(sin).includes(14));
  assert(destinos(con).includes(14));
});

prueba('gancho afterLand: llegar a un cruce marcado aplica el efecto', () => {
  const s = conFiguras([{ type: 'prueba-marca', node: 21 }], s => { s.figs[0].loc = 'board'; s.figs[0].node = 24; });
  const mov = D.legalActions(s).find(a => a.fig === 0 && a.type === 'move' && a.to === 21);
  assert(mov, '24 -> 21 debe ser legal');
  const r = D.applyAction(s, mov);
  assert.strictEqual(r.state.figs[0].status.k, 'poison');
  assert(r.events.some(e => e.type === 'prueba-marca'));
});

prueba('gancho endTurn: se llama al terminar cada turno', () => {
  const r0 = D.mulberry32(8);
  let s = D.newGame(equipo(r0), equipo(r0), 0, { rules: [{ type: 'prueba-fin' }] });
  const a = D.legalActions(s).find(x => x.type === 'enter');
  const r = D.applyAction(s, a);
  assert(r.events.some(e => e.type === 'prueba-fin' && e.player === 0));
});

prueba('gancho wheel: la regla cambia la ruleta efectiva y el combate', () => {
  const s = conFiguras([{ type: 'prueba-ruleta' }], s => {
    s.figs[0].loc = 'board'; s.figs[0].node = 19;   // Magmuz del jugador
    s.figs[6].loc = 'board'; s.figs[6].node = 14;   // Magmuz de la CPU, al lado
  });
  assert.strictEqual(D.effectiveWheel(s.figs[6], s.figs[0], s)[0].t, 'b');
  assert.strictEqual(D.effectiveWheel(s.figs[6], s.figs[0])[0].t, 'w'); // sin partida: ruleta normal
  const o = D.battleOdds(s, 0, 6);
  assert.strictEqual(o.tie, 1);
  const r = D.applyAction(s, { type: 'attack', fig: 0, target: 6 }, D.mulberry32(1));
  assert.strictEqual(r.battle.winner, null);
});

prueba('la IA juega partidas completas con todas las reglas de prueba activas', () => {
  for (let i = 0; i < 6; i++) {
    const r = D.mulberry32(200 + i);
    const s = jugar(D.newGame(equipo(r), equipo(r), i % 2, {
      rules: [{ type: 'prueba-enlace', a: 24, b: 14 }, { type: 'prueba-marca', node: 12 }, { type: 'prueba-fin' }],
      victory: { type: 'goal', turnLimit: 300 }
    }), r, i % 2 ? 'dificil' : 'normal');
    assert(s.winner !== null);
  }
});

prueba('las reglas viajan en la partida guardada (JSON)', () => {
  const s = D.newGame(equipo(), equipo(), 0, { rules: [{ type: 'prueba-marca', node: 12 }], victory: { type: 'goal', turnLimit: 50 } });
  const copia = JSON.parse(JSON.stringify(s));
  assert.deepStrictEqual(copia.rules, [{ type: 'prueba-marca', node: 12 }]);
  assert.strictEqual(copia.turnLimit, 50);
  assert.deepStrictEqual(D.validate(copia), []);
});

/* ---------- Hebras enredadas (Madre Lino, regla real) ---------- */
const HEBRAS = [{ type: 'hebras', nodes: [8, 12, 16, 20] }];
const fallo = k => D.CREATURE[k].wheel.findIndex(x => x.t === 'r');
const empate = (a, b) => ({ ai: fallo(a), di: fallo(b) }); // rojo contra rojo: nadie gana
// Un turno cualquiera del jugador actual sin tocar a la figura `menos` (mete una figura y termina)
function turnoDeRelleno(s, menos) {
  const a = D.legalActions(s).find(x => x.type === 'enter' && x.fig !== menos);
  assert(a, 'no hay figura para meter');
  s = D.applyAction(s, a).state;
  if (s.awaitAttack !== null && s.winner === null) s = D.applyAction(s, { type: 'end' }).state;
  return s;
}
const mueve = (s, fig) => D.legalActions(s).filter(a => a.fig === fig && a.type === 'move');

prueba('hebras: llegar a un cruce marcado enreda (no se mueve en su próximo turno, sí ataca) y después suelta', () => {
  let s = conFiguras(HEBRAS, s => {
    s.figs[4].loc = 'board'; s.figs[4].node = 21;   // Zumbiza del jugador, junto a la marca 16
    s.figs[7].loc = 'board'; s.figs[7].node = 13;   // Cetamar de la CPU, vecina de 16
  });
  assert.deepStrictEqual(D.markedNodes(s), [8, 12, 16, 20]);
  let r = D.applyAction(s, mueve(s, 4).find(a => a.to === 16));
  assert(r.events.some(e => e.type === 'hebras' && e.fig === 4));
  s = r.state;
  assert.strictEqual(s.awaitAttack, 4, 'queda junto a Cetamar');
  s = D.applyAction(s, { type: 'end' }).state;
  s = turnoDeRelleno(s, 7);                          // turno de la CPU
  assert.strictEqual(mueve(s, 4).length, 0, 'enredada: no puede moverse');
  assert(D.legalActions(s).some(a => a.fig === 4 && a.type === 'stay'), 'enredada: puede atacar');
  s = D.applyAction(s, { type: 'stay', fig: 4 }).state;
  s = D.applyAction(s, { type: 'attack', fig: 4, target: 7, spin: empate('zumbiza', 'cetamar') }).state;
  assert.deepStrictEqual(D.validate(s), []);
  s = turnoDeRelleno(s, 7);
  assert(mueve(s, 4).length > 0, 'quedarse y atacar en la marca no la vuelve a enredar');
});

prueba('hebras: el rival también se enreda, y una figura que cae al remiendo queda suelta', () => {
  let s = conFiguras(HEBRAS, s => { s.figs[10].loc = 'board'; s.figs[10].node = 7; s.current = 1; }); // Chispabúho de la CPU
  s = D.applyAction(s, mueve(s, 10).find(a => a.to === 12)).state;
  assert(s.figs[10].enredo);
  s = turnoDeRelleno(s);
  assert.strictEqual(mueve(s, 10).length, 0);
  const k = D.clone(s); k.figs[10].loc = 'ko'; k.figs[10].node = null; k.figs[10].koLeft = 2; k.figs[10].koAt = k.turn;
  const t = D.applyAction(k, D.legalActions(k).find(a => a.type === 'enter')).state;
  assert(!t.figs[10].enredo, 'fuera del tablero no sigue enredada');
});

prueba('hebras: una figura de Fuego que ataca junto a una marca la quema y suelta a la enredada', () => {
  const colocar = atacante => s => {
    s.figs[atacante].loc = 'board'; s.figs[atacante].node = 13;   // 13 es vecino de las marcas 8 y 16
    s.figs[7].loc = 'board'; s.figs[7].node = 16; s.figs[7].enredo = 1; // Cetamar enredada en 16
  };
  // Magmuz (Fuego) quema las dos marcas vecinas de 13, gane o pierda
  let s = conFiguras(HEBRAS, colocar(0));
  s = D.applyAction(s, { type: 'stay', fig: 0 }).state;
  let r = D.applyAction(s, { type: 'attack', fig: 0, target: 7, spin: empate('magmuz', 'cetamar') });
  assert(r.events.some(e => e.type === 'hebras-quema'));
  assert.deepStrictEqual(D.markedNodes(r.state), [12, 20]);
  assert(!r.state.figs[7].enredo, 'la de la marca quemada queda suelta');
  assert(mueve(r.state, 7).length > 0);
  // Pulpiza (Agua) no quema nada
  s = conFiguras(HEBRAS, colocar(1));
  s = D.applyAction(s, { type: 'stay', fig: 1 }).state;
  r = D.applyAction(s, { type: 'attack', fig: 1, target: 7, spin: empate('pulpiza', 'cetamar') });
  assert.deepStrictEqual(D.markedNodes(r.state), [8, 12, 16, 20]);
  // las marcas quemadas viajan en la partida guardada
  const g = JSON.parse(JSON.stringify(D.applyAction(conFiguras(HEBRAS, colocar(0)), { type: 'stay', fig: 0 }).state));
  const q = D.applyAction(g, { type: 'attack', fig: 0, target: 7, spin: empate('magmuz', 'cetamar') }).state;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(q)).ruleState.hebras, [12, 20]);
});

prueba('hebras: la IA juega partidas completas con la regla (Normal y Difícil)', () => {
  for (let i = 0; i < 8; i++) {
    const r = D.mulberry32(300 + i);
    const s = jugar(D.newGame(equipo(r), equipo(r), i % 2, { rules: HEBRAS, victory: { type: 'goal', turnLimit: 300 } }), r, i % 2 ? 'dificil' : 'normal');
    assert(s.winner !== null);
  }
});

console.log('\n' + n + ' pruebas OK');
