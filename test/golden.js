/* Huella de partidas: juega las mismas 220 partidas CPU vs CPU que test/run.js (mismas semillas)
   y resume CADA jugada (acción, resultado de las ruletas y eventos) en un hash por serie.
   Sirve para refactorizar el motor sin cambiar el juego: si una sola decisión cambia, el hash cambia.

   node test/golden.js            compara con test/golden-ref.json (sale con código 1 si difiere)
   node test/golden.js --update   reescribe la referencia (solo si el cambio de juego es deliberado) */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const D = require('../src/logic.js');
const AI = require('../src/ai.js');

const REF = path.join(__dirname, 'golden-ref.json');

function huellaPartida(seed, l0, l1, h) {
  const r = D.mulberry32(seed);
  let s = D.newGame(D.randomBalancedTeam(r), D.randomBalancedTeam(r), seed % 2);
  let steps = 0;
  while (s.winner === null) {
    const a = AI.choose(s, s.current === 0 ? l0 : l1, r);
    const res = D.applyAction(s, a, r);
    const b = res.battle ? [res.battle.ai, res.battle.di, res.battle.outcome] : null;
    h.update(JSON.stringify([a.type, a.fig, a.to, a.target, b, res.events.map(e => e.type + ':' + (e.fig ?? ''))]) + '\n');
    s = res.state;
    if (++steps > 5000) throw new Error('bucle');
  }
  h.update('fin ' + s.winner + ' ' + s.turn + ' ' + s.winReason + '\n');
}

const SERIES = [['normal', 'normal', 60], ['dificil', 'facil', 40], ['facil', 'dificil', 40], ['dificil', 'normal', 40], ['normal', 'dificil', 40]];
const out = {};
for (const [l0, l1, n] of SERIES) {
  const h = crypto.createHash('sha256');
  for (let i = 0; i < n; i++) huellaPartida(1000 + i, l0, l1, h);
  out[l0 + ' vs ' + l1] = h.digest('hex').slice(0, 16);
}

if (process.argv.includes('--update')) {
  fs.writeFileSync(REF, JSON.stringify(out, null, 2) + '\n');
  console.log('Referencia actualizada:', out);
} else {
  const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
  let ok = true;
  for (const k of Object.keys(out)) {
    const igual = ref[k] === out[k];
    ok = ok && igual;
    console.log((igual ? 'OK     ' : 'DISTINTO') + ' ' + k + '  ' + out[k] + (igual ? '' : '  (referencia ' + ref[k] + ')'));
  }
  if (!ok) { console.log('La huella cambió: alguna jugada es distinta a la referencia.'); process.exit(1); }
  console.log('Huella idéntica a la referencia.');
}
