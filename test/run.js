const D = require('../src/logic.js');
const AI = require('../src/ai.js');

// 1) Topología
console.log('nodos', D.BOARD.nodes.length, 'aristas', D.BOARD.edges.length);
console.log('dist entrada jugador -> meta CPU', D.BOARD.dist[D.BOARD.entries[0][0]][D.BOARD.goal[1]]);

// 2) 1.000 giros por ruleta
const rng = D.mulberry32(42);
let worst = 0;
for (const c of D.CREATURES) {
  const n = 1000, cnt = new Array(c.wheel.length).fill(0);
  for (let i = 0; i < n; i++) cnt[D.pickIndex(c.wheel, rng)]++;
  const tot = c.wheel.reduce((a, s) => a + s.w, 0);
  if (tot !== 96) console.log('PESO != 96', c.name, tot);
  c.wheel.forEach((s, i) => { const dev = Math.abs(cnt[i] / n - s.w / tot) * 100; worst = Math.max(worst, dev); if (dev > 3) console.log('DESVÍO', c.name, s.name, dev.toFixed(2)); });
}
console.log('máx desvío en 1000 giros (pp):', worst.toFixed(2));

// 3) Partidas CPU vs CPU
function play(seed, l0, l1) {
  const r = D.mulberry32(seed);
  let s = D.newGame(D.randomBalancedTeam(r), D.randomBalancedTeam(r), seed % 2);
  let maxMs = 0, steps = 0;
  while (s.winner === null) {
    const lvl = s.current === 0 ? l0 : l1;
    const t0 = process.hrtime.bigint();
    const a = AI.choose(s, lvl, r);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6; maxMs = Math.max(maxMs, ms);
    const legal = D.legalActions(s);
    if (a.type !== 'pass' && !legal.some(x => x.type === a.type && x.fig === a.fig && x.to === a.to && x.target === a.target)) throw new Error('acción ilegal ' + JSON.stringify(a));
    if (a.type === 'pass' && legal.length) throw new Error('pasa teniendo jugadas');
    s = D.applyAction(s, a, r).state;
    const errs = D.validate(s); if (errs.length) throw new Error(errs.join('; '));
    if (++steps > 5000) throw new Error('bucle');
  }
  return { winner: s.winner, turns: s.turn, maxMs, reason: s.winReason };
}
function series(l0, l1, n) {
  const w = { 0: 0, 1: 0, draw: 0 }; let turns = 0, maxMs = 0, limit = 0;
  for (let i = 0; i < n; i++) { const r = play(1000 + i, l0, l1); w[r.winner]++; turns += r.turns; maxMs = Math.max(maxMs, r.maxMs); if (r.reason.startsWith('Límite')) limit++; }
  console.log(`${l0} vs ${l1}: J0 ${w[0]} · J1 ${w[1]} · empates ${w.draw} · turnos prom ${(turns / n).toFixed(0)} · por límite ${limit} · máx ms/turno ${maxMs.toFixed(1)}`);
}
series('normal', 'normal', 60);
series('dificil', 'facil', 40);
series('facil', 'dificil', 40);
series('dificil', 'normal', 40);
series('normal', 'dificil', 40);
