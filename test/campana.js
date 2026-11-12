/* Pruebas de la campaña (Fase 3): escenas generadas del guion, personajes y retratos, duelos y su
   configuración, duelos guiados (con el motor real), progreso, desbloqueo y código de exportación.
   node test/campana.js */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const D = require('../src/logic.js');
const C = require('../src/campana.js');
const { recorrer } = require('./lib/recorrer.js');

const RAIZ = path.join(__dirname, '..');
let n = 0;
function prueba(nombre, fn) { fn(); n++; console.log('OK  ' + nombre); }

prueba('el guion convertido trae todas las escenas y líneas', () => {
  const guion = fs.readFileSync(path.join(RAIZ, 'docs', 'guion.md'), 'utf8').replace(/\r\n/g, '\n');
  const cuerpo = guion.split('\n## Prólogo')[1].split('### Variantes del epílogo')[0];
  const esperadas = cuerpo.split('\n').filter(l => /^- \*\*/.test(l)).length;
  const lineas = Object.values(C.ESCENAS).reduce((a, e) => a + e.lineas.length, 0);
  assert.strictEqual(lineas, esperadas, 'líneas del guion: ' + esperadas + ', convertidas: ' + lineas);
  assert(Object.keys(C.ESCENAS).length >= 60);
});

prueba('cada hablante tiene ficha en personajes.json', () => {
  Object.entries(C.ESCENAS).forEach(([id, e]) => e.lineas.forEach(l => {
    assert(C.PERSONAJES[l.quien], id + ': falta el personaje ' + l.quien);
    (l.opciones || []).forEach(o => assert(C.PERSONAJES[o.respuesta.quien], id + ': falta ' + o.respuesta.quien));
  }));
});

prueba('los retratos y fondos que se nombran existen en art/web', () => {
  Object.entries(C.PERSONAJES).forEach(([id, p]) => Object.entries(p.expresiones || {}).forEach(([ex]) => {
    const f = path.join(RAIZ, C.retrato(id, ex));
    assert(fs.existsSync(f), 'falta ' + f);
  }));
  C.DUELOS.filter(d => d.disponible !== false).forEach(d => (d.antes || []).concat(d.despues || [], d.reintento ? [d.reintento] : []).forEach(id => {
    const e = C.escena(id, d, C.nuevo('Ari'));
    assert(e.fondo, id + ': sin fondo');
    assert(fs.existsSync(path.join(RAIZ, e.fondo)), 'falta ' + e.fondo);
  }));
});

prueba('14 duelos en orden; los disponibles tienen escenas y un duelo jugable', () => {
  assert.strictEqual(C.DUELOS.length, 14);
  C.DUELOS.forEach((d, i) => assert.strictEqual(d.num, i + 1));
  C.DUELOS.filter(d => d.disponible !== false).forEach(d => {
    (d.antes || []).concat(d.despues || []).forEach(id => assert(C.ESCENAS[id], d.id + ': falta la escena ' + id));
    if (d.reintento) assert(C.ESCENAS[d.reintento]);
    assert(d.guiado || d.duelo, d.id + ': ni guiado ni duelo');
    if (d.duelo) {
      const cfg = C.configDuelo(d);
      assert(D.BOARDS[cfg.board], d.id + ': tablero');
      assert.strictEqual(cfg.rival.team.length, 6);
      cfg.rival.team.forEach(k => assert(D.CREATURE[k], d.id + ': criatura ' + k));
      const s = D.newGame(cfg.rival.team, cfg.rival.team, 0, cfg);
      assert.deepStrictEqual(D.validate(s), []);
    }
    (d.recompensa && d.recompensa.figuras || []).forEach(k => assert(D.CREATURE[k]));
  });
});

prueba('los duelos guiados usan los textos del guion y se pueden terminar', () => {
  ['duelo-1', 'duelo-2'].forEach(id => {
    const L = C.guiado(id);
    const pasos = C.ESCENAS[id + '-pasos'].pasos;
    L.steps.forEach(st => assert.strictEqual(st.text, pasos[st.paso - 1].titulo + ': ' + pasos[st.paso - 1].texto));
    pasos.forEach((p, i) => assert(L.steps.some(st => st.paso === i + 1), id + ': no usa el paso ' + (i + 1)));
    const { s, g } = recorrer(L);
    if (id === 'duelo-1') assert.strictEqual(s.winner, 0, 'duelo-1 termina en la meta');
    else { assert(g.done); assert.strictEqual(s.figs[1].loc, 'ko', 'duelo-2: Erizarza cae al remiendo'); }
  });
});

prueba('progreso: desbloqueo lineal, recompensas y equipo con repetidas', () => {
  let p = C.nuevo('  Lu<na> ');
  assert.strictEqual(p.jugador, 'Luna');
  assert.strictEqual(C.estado(p, C.duelo('d01')), 'abierto');
  assert.strictEqual(C.estado(p, C.duelo('d02')), 'bloqueado');
  assert.strictEqual(C.estado(p, C.duelo('d05')), 'proximamente');
  p = C.ganar(p, 'd01');
  assert.deepStrictEqual(p.figuras, ['tizonaje', 'magmuz', 'pavorasa']);
  assert.strictEqual(C.estado(p, C.duelo('d01')), 'ganado');
  assert.strictEqual(C.siguiente(p).id, 'd02');
  p = C.ganar(C.ganar(p, 'd02'), 'd02');
  assert.strictEqual(p.figuras.filter(k => k === 'zumbiza').length, 1, 'sin repetir recompensas');
  const eq = C.equipoPorDefecto(p);
  assert.strictEqual(eq.length, 6); assert(C.equipoValido(eq, p));
  assert(!C.equipoValido(['cetamar', 'tizonaje', 'tizonaje', 'tizonaje', 'tizonaje', 'tizonaje'], p), 'no deja usar criaturas bloqueadas');
  p = C.ganar(C.ganar(p, 'd03'), 'd04');
  assert.deepStrictEqual(p.sellos, ['lino']);
  assert.strictEqual(C.siguiente(p), null, 'tras el duelo 4 no hay más duelos disponibles');
});

prueba('exportar e importar el progreso', () => {
  const p = C.ganar(C.ganar(C.nuevo('Ñandú'), 'd01'), 'd02');
  const code = C.exportar(p);
  assert(code.startsWith('HT1.'));
  assert.deepStrictEqual(C.importar(' ' + code.slice(0, 20) + '\n' + code.slice(20) + ' '), p);
  assert.throws(() => C.importar('hola'), /no empieza/);
  assert.throws(() => C.importar('HT1.abc'), /dañado|válido/);
});

prueba('las escenas reemplazan {jugador} y arman retratos y lados', () => {
  const p = C.nuevo('Luna');
  const e = C.escena('escena-0', C.duelo('d01'), p);
  assert(e.lineas.some(l => l.quien === 'jugador' && l.nombre === 'Luna' && l.lado === 'izq'));
  assert(!JSON.stringify(e).includes('{jugador}'));
  assert(e.lineas.find(l => l.quien === 'narracion').retrato === null);
  assert(e.lineas.find(l => l.quien === 'maru').retrato.endsWith('maru-neutral.webp'));
  const e3 = C.escena('duelo-3-antes', C.duelo('d03'), p);
  const eleccion = e3.lineas.find(l => l.opciones);
  assert.strictEqual(eleccion.opciones.length, 2);
  assert.strictEqual(C.escena('escena-3', C.duelo('d04'), p).fondo, 'art/web/fondos/neolitico-granero.webp');
});

console.log('\n' + n + ' pruebas de campaña OK');
