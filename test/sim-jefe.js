/* Apoyo para afinar duelos de campaña (no corre en npm test).
   Juega el equipo del jugador (IA Normal, como sustituto de una persona) contra el rival de un duelo,
   con quién empieza al azar como en la interfaz, y cuenta victorias del jugador.
   node test/sim-jefe.js [partidas] [semilla]
   Las variantes (marcas, equipos) se editan abajo; los datos reales salen de data/duels. */
'use strict';
const D = require('../src/logic.js');
const AI = require('../src/ai.js');

const N = +(process.argv[2] || 200), SEED = +(process.argv[3] || 1);

function partida(team, cfg, seed, nivelJugador) {
  const r = D.mulberry32(seed);
  let s = D.newGame(team, cfg.rival.team, r() < 0.5 ? 0 : 1, cfg);
  let ms = 0;
  while (s.winner === null) {
    const t0 = Date.now();
    const a = AI.choose(s, s.current === 0 ? nivelJugador : cfg.ai, r);
    ms = Math.max(ms, Date.now() - t0);
    s = D.applyAction(s, a, r).state;
  }
  return { winner: s.winner, turns: s.turn, limit: /Límite/.test(s.winReason), ms };
}

function serie(nombre, team, cfg, nivelJugador) {
  let g = 0, p = 0, e = 0, lim = 0, turnos = 0, ms = 0;
  for (let i = 0; i < N; i++) {
    const o = partida(team, cfg, SEED * 100000 + i, nivelJugador || 'normal');
    if (o.winner === 0) g++; else if (o.winner === 1) p++; else e++;
    if (o.limit) lim++; turnos += o.turns; ms = Math.max(ms, o.ms);
  }
  const pct = x => (100 * x / N).toFixed(0).padStart(3) + ' %';
  console.log(nombre.padEnd(46) + ' gana ' + pct(g) + ' · pierde ' + pct(p) + ' · empate ' + pct(e) + ' · por límite ' + pct(lim) + ' · turnos ' + (turnos / N).toFixed(0) + ' · máx ' + ms + ' ms');
}

const base = D.DUELS[process.env.DUELO || "c04"];
const con = (cambios) => Object.assign(JSON.parse(JSON.stringify(base)), cambios);

// Equipos del jugador al llegar al duelo 4 (figuras: Fuego x5, Zumbiza y las 4 de Planta)
const EQUIPOS = {
  'por defecto (5 Fuego + Zumbiza)': ['tizonaje', 'magmuz', 'pavorasa', 'brasapo', 'lanaflama', 'zumbiza'],
  'mixto (3 Fuego, Zumbiza, 2 Planta)': ['tizonaje', 'magmuz', 'brasapo', 'zumbiza', 'erizarza', 'hormihoja'],
  'sin Fuego (Zumbiza + Planta)': ['zumbiza', 'zumbiza', 'erizarza', 'musgoso', 'cestacol', 'hormihoja']
};
const VARIANTES = (process.env.VARIANTES || (base.rules.length ? "sin,A" : "sin")).split(',');
const MARCAS = { A: [8, 12, 16, 20], B: [5, 7, 21, 23], C: [13, 15, 8, 20] };

for (const v of VARIANTES) {
  const cfg = v === 'sin' ? con({ rules: [] }) : con({ rules: [{ type: 'hebras', nodes: MARCAS[v] }] });
  if (process.env.RIVAL) cfg.rival.team = process.env.RIVAL.split(' ');
  if (process.env.IA) cfg.ai = process.env.IA;
  console.log('— regla: ' + (v === 'sin' ? 'sin Hebras' : 'Hebras ' + MARCAS[v].join(',')) + ' · rival ' + cfg.rival.team.join(' ') + ' · IA ' + cfg.ai);
  for (const [n, t] of Object.entries(EQUIPOS)) serie(n, t, cfg);
}
