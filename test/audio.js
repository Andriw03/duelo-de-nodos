// Sonido: catálogo de efectos, tope de sonidos y de voces, y que el motor funcione sin DOM y con un AudioContext falso.
const assert = require('assert');
let ok = 0;
const t = (nombre, fn) => { fn(); ok++; console.log('OK ', nombre); };

t('require en node no falla ni toca el DOM; sin AudioContext queda mudo', () => {
  assert.strictEqual(typeof globalThis.document, 'undefined');
  const S = require('../src/audio.js');
  assert.strictEqual(S.estado(), 'sin-audio');
  assert.strictEqual(S.efecto('toque'), false);
  S.musica('portada'); S.desbloquear(); S.bajarMusica(true); S.reanudar(); S.visible(false); S.visible(true);
  assert.strictEqual(S.pista, null);
});

const S = require('../src/audio.js');

t('cada evento del juego tiene su sonido y se respeta el tope de 18', () => {
  const ids = Object.keys(S.SONIDOS);
  assert.ok(ids.length <= S.MAX_SONIDOS, ids.length + ' sonidos');
  S.EVENTOS.forEach(id => assert.ok(S.SONIDOS[id], 'falta el sonido ' + id));
  ids.forEach(id => {
    const def = S.SONIDOS[id];
    assert.ok(Array.isArray(def.voces) && def.voces.length, id);
    def.voces.forEach(v => {
      assert.ok(['sine', 'triangle', 'square', 'sawtooth', 'ruido'].includes(v.onda), id + ' onda ' + v.onda);
      if (v.onda !== 'ruido') assert.ok(v.f > 20 && v.f < 20000, id + ' frecuencia');
      assert.ok(v.vol > 0 && v.vol <= 0.5, id + ' volumen');
      assert.ok((v.t || 0) + (v.a || 0) + (v.d || 0) < 3, id + ' dura demasiado');
    });
  });
});

/* AudioContext falso mínimo: registra nodos creados y desconectados */
function ctxFalso() {
  const creados = [], soltados = new Set();
  const param = v => ({ value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(x) { if (!(x > 0)) throw new Error('rampa exponencial a ' + x); }, setTargetAtTime() {}, cancelScheduledValues() {} });
  const ctx = {
    currentTime: 0, sampleRate: 8000, state: 'running', destination: { connect() {} },
    resume() { this.state = 'running'; return Promise.resolve(); }, suspend() { this.state = 'suspended'; return Promise.resolve(); }
  };
  const nodo = extra => { const n = Object.assign({ connect() {}, disconnect() { soltados.add(n); } }, extra); creados.push(n); return n; };
  const fuente = extra => nodo(Object.assign({ onended: null, start() {}, stop(t) { this.fin = t; } }, extra));
  ctx.createGain = () => nodo({ gain: param(1) });
  ctx.createOscillator = () => fuente({ type: 'sine', frequency: param(440), detune: param(0) });
  ctx.createBufferSource = () => fuente({ buffer: null, loop: false });
  ctx.createBuffer = (ch, n) => { const d = Array.from({ length: ch }, () => new Float32Array(n)); return { getChannelData: i => d[i] }; };
  ctx.createBiquadFilter = () => nodo({ type: 'lowpass', frequency: param(1000), Q: param(1) });
  ctx.createConvolver = () => nodo({ buffer: null });
  ctx.createDynamicsCompressor = () => nodo({ threshold: param(0), knee: param(0), ratio: param(1), attack: param(0), release: param(0) });
  return { ctx, creados, soltados };
}
const memoria = () => { const m = {}; return { get: k => (k in m ? m[k] : null), set: (k, v) => { m[k] = String(v); }, del: k => { delete m[k]; }, m }; };

t('preferencias: valores por defecto, se guardan y se leen al iniciar', () => {
  const st = memoria();
  S.iniciar(st);
  assert.deepStrictEqual(S.config(), S.DEF);
  S.fijar({ musica: false, volEfectos: 2 });
  assert.strictEqual(S.config().volEfectos, 1);
  assert.strictEqual(JSON.parse(st.m[S.KEY]).musica, false);
  st.m[S.KEY] = '{roto';
  S.iniciar(st);
  assert.deepStrictEqual(S.config(), S.DEF);
});

t('con un AudioContext falso cada sonido se programa sin errores y nunca hay más de 8 voces vivas', () => {
  const { ctx, creados, soltados } = ctxFalso();
  S.iniciar(memoria());
  S.musica(null);   // sin música: aquí solo se miden los efectos
  S.adoptar(ctx);
  S.desbloquear();
  Object.keys(S.SONIDOS).forEach((id, i) => {
    ctx.currentTime = i * 0.001;
    assert.ok(S.efecto(id, { tono: 2, vol: 0.5 }), 'no sonó ' + id);
    assert.ok(S.vivos() <= S.MAX_VOCES, 'voces vivas: ' + S.vivos());
  });
  // ruleta-tic: como máximo uno cada 60 ms
  ctx.currentTime = 10; assert.ok(S.efecto('ruleta-tic'));
  ctx.currentTime = 10.03; assert.strictEqual(S.efecto('ruleta-tic'), false);
  ctx.currentTime = 10.07; assert.ok(S.efecto('ruleta-tic'));
  // al terminar, todas las fuentes sueltan sus nodos
  creados.filter(n => typeof n.onended === 'function').forEach(n => n.onended());
  ctx.currentTime = 100;
  assert.strictEqual(S.vivos(), 0);
  const sinSoltar = creados.filter(n => n.start && !soltados.has(n));
  assert.strictEqual(sinSoltar.length, 0, sinSoltar.length + ' fuentes sin soltar');
  // efectos apagados: no suena
  S.fijar({ efectos: false });
  assert.strictEqual(S.efecto('toque'), false);
  S.fijar({ efectos: true });
  // oculto: se suspende; al volver, se reanuda
  S.visible(false); assert.strictEqual(ctx.state, 'suspended');
  S.visible(true); assert.strictEqual(ctx.state, 'running');
});

t('música: suena la pedida, se cambia, se apaga con el interruptor y se detiene', () => {
  const { ctx } = ctxFalso();
  S.iniciar(memoria());
  S.adoptar(ctx); S.desbloquear();
  S.musica('portada', { fade: 0 });
  assert.strictEqual(S.pista, 'portada');
  ctx.currentTime = 5; S.musica('duelo');
  assert.strictEqual(S.pista, 'duelo');
  S.fijar({ musica: false }); assert.strictEqual(S.pista, null);
  S.fijar({ musica: true }); assert.strictEqual(S.pista, 'duelo');
  S.musica('no-existe'); assert.strictEqual(S.pista, null);
});

console.log('\n' + ok + ' pruebas de sonido OK');
// los temporizadores de la música (ya detenida) no deben dejar el proceso abierto mucho más
setTimeout(() => process.exit(0), 50);
