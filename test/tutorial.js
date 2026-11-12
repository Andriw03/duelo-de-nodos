/* Recorre las lecciones del tutorial (data/tutorial) con el motor real, igual que la interfaz:
   turno de la CPU según el guion, pasos del jugador y ruletas fijas. Falla si una jugada del guion
   es ilegal, si un combate no da el resultado anunciado o si una lección no se puede terminar.
   node test/tutorial.js */
'use strict';
const assert = require('assert');
const T = require('../src/tutorial.js');
const { recorrer } = require('./lib/recorrer.js');

let total = 0;
assert.strictEqual(T.LESSONS.length, 5, 'deben ser 5 lecciones');
T.LESSONS.forEach((L, k) => {
  assert.strictEqual(L.orden, k + 1);
  const { s, g } = recorrer(L);
  if (L.id === 'ganar') assert.strictEqual(s.winner, 0, L.id + ': no termina con victoria');
  else { assert(g.done, L.id + ': quedaron pasos sin hacer'); assert.strictEqual(s.winner, null, L.id + ': la partida terminó antes'); }
  assert(L.fin && L.titulo, L.id + ': falta título o texto final');
  total++;
  console.log('OK  lección ' + L.orden + ': ' + L.titulo + ' (' + L.steps.length + ' pasos, ' + L.cpu.length + ' jugadas CPU)');
});

// Progreso guardado
const mem = {}; const storage = { get: k => mem[k] || null, set: (k, v) => { mem[k] = v; } };
assert.deepStrictEqual(T.readProgress(storage), { hechas: [], ofrecido: false });
T.writeProgress(storage, { hechas: ['entrar'], ofrecido: true });
assert.deepStrictEqual(T.readProgress(storage), { hechas: ['entrar'], ofrecido: true });
mem[T.KEY] = '{roto'; assert.deepStrictEqual(T.readProgress(storage), { hechas: [], ofrecido: false });
console.log('OK  progreso guardado');

console.log('\n' + total + ' lecciones OK');
