// Plantilla de criaturas: formato de las ruletas, reparto por tipo y rareza, equipos posibles y efectos de dorado.
const assert = require('assert');
const D = require('../src/logic.js');
let ok = 0;
const t = (nombre, fn) => { fn(); ok++; console.log('OK ', nombre); };

t('cada ruleta suma 96, tiene 4 a 6 segmentos y el Fallo nunca es el segmento más pesado', () => {
  for (const c of D.CREATURES) {
    assert.strictEqual(c.wheel.reduce((a, s) => a + s.w, 0), 96, c.id);
    assert.ok(c.wheel.length >= 4 && c.wheel.length <= 6, c.id + ' segmentos');
    const maxOtro = Math.max(...c.wheel.filter(s => s.t !== 'r').map(s => s.w));
    const fallo = c.wheel.filter(s => s.t === 'r').reduce((a, s) => a + s.w, 0);
    // Si el Fallo fuera el más pesado, la parálisis no le haría nada a esa figura
    assert.ok(fallo <= maxOtro, c.id + ': el Fallo pesa más que cualquier otro segmento');
    for (const s of c.wheel) {
      if (s.t === 'w' || s.t === 'g') assert.ok(s.dmg > 0 && s.dmg <= 120, c.id + ' daño ' + s.name);
      if (s.t === 'p') { assert.ok(D.STATUS[s.st], c.id + ' estado'); assert.ok(s.stars >= 1 && s.stars <= 3, c.id + ' estrellas'); }
      if (s.t === 'g' && s.fx) assert.ok(D.FX[s.fx], c.id + ' efecto ' + s.fx);
    }
  }
});

t('ids y nombres únicos, ids sin tildes', () => {
  const ids = D.CREATURES.map(c => c.id), nombres = D.CREATURES.map(c => c.name);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.strictEqual(new Set(nombres).size, nombres.length);
  ids.forEach(id => assert.ok(/^[a-z]+$/.test(id), id));
});

t('25 criaturas: 5 por tipo, 2 comunes, 2 raras y 1 épica en cada tipo', () => {
  assert.strictEqual(D.CREATURES.length, 25);
  for (const ty of D.TYPE_ORDER) {
    const del = D.CREATURES.filter(c => c.type === ty);
    assert.strictEqual(del.length, 5, ty);
    const cuenta = r => del.filter(c => c.rarity === r).length;
    assert.deepStrictEqual([cuenta('c'), cuenta('r'), cuenta('e')], [2, 2, 1], ty);
    assert.ok(del.some(c => c.mp === 1) && del.some(c => c.mp === 3), ty + ': falta mp 1 o mp 3');
  }
});

t('los efectos de área, curación y efectos nuevos solo están en raras o épicas, con peso 8 a 12', () => {
  for (const c of D.CREATURES) for (const s of c.wheel) if (s.fx) {
    assert.ok(c.rarity !== 'c', c.id);
    assert.ok(s.w >= 8 && s.w <= 12, c.id + ' peso del efecto');
  }
});

t('randomBalancedTeam arma equipos válidos con la plantilla completa', () => {
  const r = D.mulberry32(7); const vistas = new Set();
  for (let i = 0; i < 500; i++) {
    const eq = D.randomBalancedTeam(r);
    const tipos = new Set(eq.map(id => D.CREATURE[id].type));
    const mp = eq.reduce((a, id) => a + D.CREATURE[id].mp, 0);
    assert.ok(eq.length === 6 && tipos.size >= 4 && mp >= 10 && mp <= 12, eq.join());
    assert.ok(eq.filter(id => D.CREATURE[id].rarity === 'e').length <= 1);
    eq.forEach(id => vistas.add(id));
  }
  assert.strictEqual(vistas.size, 25, 'alguna criatura nunca sale en los equipos al azar');
});

// Partida mínima para probar un combate: a (jugador 0) ataca a b (jugador 1) en cruces vecinos.
function combate(atacante, defensor, extra) {
  const s = D.newGame([atacante, 'pulpiza', 'pulpiza', 'pulpiza', 'pulpiza', 'pulpiza'], [defensor, 'pulpiza', 'pulpiza', 'pulpiza', 'pulpiza', 'pulpiza'], 0);
  const B = D.boardOf(s);
  const n = B.nodes.findIndex(x => x.kind === 'n' && B.adj[x.id].length >= 2 && B.adj[x.id].every(m => B.nodes[m].kind === 'n'));
  const m = B.adj[n][0];
  s.figs[0].loc = 'board'; s.figs[0].node = n;
  s.figs[6].loc = 'board'; s.figs[6].node = m;
  if (extra) extra(s, B, n, m);
  return { s, n, m, B };
}
const idx = (id, nombre) => D.CREATURE[id].wheel.findIndex(x => x.name === nombre);

t('Remiendo: la ganadora saca de la enfermería a la figura propia con más turnos pendientes', () => {
  const { s } = combate('cascoriza', 'pulpiza', s => {
    s.figs[1].loc = 'ko'; s.figs[1].koLeft = 1; s.figs[1].koAt = 0;
    s.figs[2].loc = 'ko'; s.figs[2].koLeft = 2; s.figs[2].koAt = 0;
  });
  const fallo = D.CREATURE.pulpiza.wheel.findIndex(x => x.t === 'r');
  // resolveBattle: el combate solo, sin el fin de turno (que descuenta la enfermería)
  const r = D.resolveBattle(s, 0, 6, idx('cascoriza', 'Llamado del nido'), fallo);
  assert.strictEqual(r.state.figs[6].loc, 'ko');
  assert.strictEqual(r.state.figs[2].loc, 'bench', 'vuelve la de 2 turnos');
  assert.strictEqual(r.state.figs[1].loc, 'ko', 'la otra sigue en la enfermería');
  assert.ok(/saca a Pulpiza de la enfermería/.test(r.battle.text), r.battle.text);
  assert.deepStrictEqual(D.validate(r.state), []);
});

t('Remiendo sin figuras en la enfermería no hace nada más', () => {
  const { s } = combate('cascoriza', 'pulpiza');
  const fallo = D.CREATURE.pulpiza.wheel.findIndex(x => x.t === 'r');
  const r = D.applyAction(s, { type: 'attack', fig: 0, target: 6, spin: { ai: idx('cascoriza', 'Llamado del nido'), di: fallo } });
  assert.ok(/pero no tiene figuras propias/.test(r.battle.text), r.battle.text);
  assert.deepStrictEqual(D.validate(r.state), []);
});

t('Embestida: la ganadora avanza al cruce que deja el rival', () => {
  const { s, m } = combate('columnero', 'pulpiza');
  const fallo = D.CREATURE.pulpiza.wheel.findIndex(x => x.t === 'r');
  const r = D.applyAction(s, { type: 'attack', fig: 0, target: 6, spin: { ai: idx('columnero', 'Carga de carnero'), di: fallo } });
  assert.strictEqual(r.state.figs[6].loc, 'ko');
  assert.strictEqual(r.state.figs[0].node, m);
  assert.deepStrictEqual(D.validate(r.state), []);
});

t('Embestida también vale si gana la defensora, y nunca entra a una meta', () => {
  // la defensora (Columnero, jugador 1) gana y avanza
  const a = combate('pulpiza', 'columnero');
  const fallo = D.CREATURE.pulpiza.wheel.findIndex(x => x.t === 'r');
  let r = D.applyAction(a.s, { type: 'attack', fig: 0, target: 6, spin: { ai: fallo, di: idx('columnero', 'Carga de carnero') } });
  assert.strictEqual(r.state.figs[0].loc, 'ko');
  assert.strictEqual(r.state.figs[6].node, a.n);
  // si la perdedora estaba en su meta, la ganadora se queda donde estaba
  const b = combate('columnero', 'pulpiza', (s, B) => {
    const g = B.goal[1]; s.figs[6].node = g; s.figs[0].node = B.adj[g][0];
  });
  const desde = b.s.figs[0].node;
  r = D.applyAction(b.s, { type: 'attack', fig: 0, target: 6, spin: { ai: idx('columnero', 'Carga de carnero'), di: fallo } });
  assert.strictEqual(r.state.figs[0].node, desde);
  assert.strictEqual(r.state.winner, null);
  assert.ok(/no puede avanzar a una meta/.test(r.battle.text), r.battle.text);
});

console.log('\n' + ok + ' pruebas de criaturas OK');
