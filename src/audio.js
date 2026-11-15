/* ===================== SONIDO (Web Audio, sin DOM) =====================
   window.DuelSonido. Efectos sintetizados y música generativa, sin archivos ni dependencias.
   - El AudioContext solo se crea dentro de un gesto del jugador (desbloquear). El guion del principio de
     shell.html lo crea en el toque de la entrada y lo deja en window.__ctxAudio: aquí se adopta, no se crea otro.
   - Sin AudioContext (node, navegador viejo, error) todo queda mudo y nada falla.
   - Preferencias en la clave duelo-nodos-sonido, con el almacenamiento que pasa iniciar() (Platform.storage).
   - Cada sonido es DATOS (voces con onda, frecuencia, envolvente y filtro): tools/sonidos.html los ajusta.
   - La música se pide por nombre (musica('portada')): la Fase B puede cambiar lo generativo por archivos sin
     tocar a quien la llama. */
(function (root) {
  'use strict';

  const KEY = 'duelo-nodos-sonido';
  const DEF = { musica: true, efectos: true, volMusica: 0.35, volEfectos: 0.6 };
  const MAX_VOCES = 8;          // efectos sonando a la vez; el más viejo se corta
  const MAX_SONIDOS = 18;       // presupuesto de sonidos distintos (lo comprueba test/audio.js)

  /* ---------- Definición de los efectos ----------
     Voz: { onda: sine|triangle|square|sawtooth|ruido, f (Hz), fFin (glissando), glide (s), t (inicio, s),
            a (ataque, s), d (caída, s), vol, filtro: { tipo, f, q } }.
     Sonido: { voces: [...], rev (envío a la reverb, 0-1), minGap (s entre dos disparos) }. */
  // Cuerda pulsada tipo kalimba: fundamental + un parcial desafinado que se apaga rápido
  const pulsada = (f, t, d, vol) => [
    { onda: 'sine', f, t, a: 0.003, d, vol },
    { onda: 'sine', f: f * 5.4, t, a: 0.002, d: d * 0.22, vol: vol * 0.22 },
    { onda: 'triangle', f: f * 2, t, a: 0.003, d: d * 0.4, vol: vol * 0.15 }
  ];
  // Golpe de madera: seno grave con parcial inarmónico (2,76) y un chasquido de ruido filtrado
  const madera = (f, t, d, vol) => [
    { onda: 'sine', f, t, a: 0.002, d, vol },
    { onda: 'sine', f: f * 2.76, t, a: 0.001, d: d * 0.35, vol: vol * 0.35 },
    { onda: 'ruido', t, a: 0.001, d: 0.018, vol: vol * 0.3, filtro: { tipo: 'bandpass', f: f * 4, q: 4 } }
  ];

  const SONIDOS = {
    toque: { voces: [
      { onda: 'sine', f: 1320, fFin: 1100, glide: 0.04, a: 0.002, d: 0.045, vol: 0.1 },
      { onda: 'ruido', a: 0.001, d: 0.012, vol: 0.04, filtro: { tipo: 'bandpass', f: 2600, q: 3 } }] },
    elegir: { voces: [
      { onda: 'triangle', f: 587, fFin: 880, glide: 0.07, a: 0.004, d: 0.12, vol: 0.14 },
      { onda: 'sine', f: 1174, t: 0.03, a: 0.003, d: 0.1, vol: 0.05 }] },
    meter: { voces: madera(392, 0, 0.16, 0.24), rev: 0.15 },
    mover: { voces: madera(523, 0, 0.06, 0.1) },
    'ruleta-giro': { voces: [
      { onda: 'triangle', f: 220, fFin: 660, glide: 0.35, a: 0.02, d: 0.38, vol: 0.09, filtro: { tipo: 'lowpass', f: 1600, q: 1 } },
      { onda: 'ruido', a: 0.06, d: 0.3, vol: 0.035, filtro: { tipo: 'bandpass', f: 900, q: 2 } }] },
    'ruleta-tic': { minGap: 0.06, voces: [
      { onda: 'ruido', a: 0.001, d: 0.012, vol: 0.07, filtro: { tipo: 'bandpass', f: 3000, q: 6 } },
      { onda: 'sine', f: 1760, a: 0.001, d: 0.02, vol: 0.025 }] },
    'ruleta-alto': { rev: 0.3, voces: [
      { onda: 'ruido', a: 0.001, d: 0.03, vol: 0.12, filtro: { tipo: 'bandpass', f: 1400, q: 3 } }].concat(madera(330, 0, 0.35, 0.15)) },
    'combate-gana': { rev: 0.35, voces: [].concat(pulsada(587, 0, 0.5, 0.15), pulsada(740, 0.09, 0.5, 0.14), pulsada(880, 0.18, 0.7, 0.15)) },
    'combate-pierde': { rev: 0.3, voces: [
      { onda: 'triangle', f: 440, a: 0.004, d: 0.4, vol: 0.13, filtro: { tipo: 'lowpass', f: 1800, q: 1 } },
      { onda: 'triangle', f: 370, t: 0.11, a: 0.004, d: 0.4, vol: 0.12, filtro: { tipo: 'lowpass', f: 1600, q: 1 } },
      { onda: 'triangle', f: 294, t: 0.22, a: 0.004, d: 0.6, vol: 0.12, filtro: { tipo: 'lowpass', f: 1400, q: 1 } }] },
    'combate-anula': { rev: 0.4, voces: [
      { onda: 'sine', f: 392, a: 0.012, d: 0.5, vol: 0.09, filtro: { tipo: 'bandpass', f: 700, q: 1.5 } },
      { onda: 'sine', f: 523, a: 0.012, d: 0.5, vol: 0.07, filtro: { tipo: 'bandpass', f: 700, q: 1.5 } }] },
    estado: { rev: 0.3, voces: [
      { onda: 'triangle', f: 494, fFin: 440, glide: 0.4, a: 0.01, d: 0.5, vol: 0.11 },
      { onda: 'sine', f: 740, t: 0.05, a: 0.01, d: 0.4, vol: 0.05 }] },
    enfermeria: { rev: 0.3, voces: [
      { onda: 'sine', f: 523, fFin: 262, glide: 0.55, a: 0.01, d: 0.7, vol: 0.13, filtro: { tipo: 'lowpass', f: 1200, q: 1 } }] },
    nudo: { rev: 0.25, voces: [
      { onda: 'sawtooth', f: 196, fFin: 392, glide: 0.25, a: 0.03, d: 0.32, vol: 0.06, filtro: { tipo: 'bandpass', f: 900, q: 8 } }].concat(pulsada(784, 0.25, 0.3, 0.09)) },
    error: { voces: [{ onda: 'square', f: 160, a: 0.003, d: 0.07, vol: 0.045, filtro: { tipo: 'lowpass', f: 600, q: 1 } }] },
    dialogo: { voces: [{ onda: 'sine', f: 1046, a: 0.002, d: 0.03, vol: 0.03 }] },
    sello: { rev: 0.5, voces: [].concat(pulsada(587, 0, 0.6, 0.11), pulsada(740, 0.07, 0.6, 0.11), pulsada(880, 0.14, 0.6, 0.11), pulsada(1174, 0.21, 0.6, 0.11), pulsada(1480, 0.28, 0.9, 0.1)) },
    victoria: { rev: 0.5, voces: [
      { onda: 'triangle', f: 294, a: 0.05, d: 1.4, vol: 0.07 }].concat(pulsada(587, 0, 0.5, 0.14), pulsada(880, 0.14, 0.5, 0.13), pulsada(740, 0.28, 0.5, 0.13), pulsada(1174, 0.42, 1.2, 0.14)) },
    derrota: { rev: 0.4, voces: [
      { onda: 'triangle', f: 440, a: 0.006, d: 0.45, vol: 0.12, filtro: { tipo: 'lowpass', f: 1500, q: 1 } },
      { onda: 'triangle', f: 392, t: 0.2, a: 0.006, d: 0.45, vol: 0.11, filtro: { tipo: 'lowpass', f: 1400, q: 1 } },
      { onda: 'triangle', f: 349, t: 0.4, a: 0.006, d: 0.45, vol: 0.11, filtro: { tipo: 'lowpass', f: 1300, q: 1 } },
      { onda: 'triangle', f: 294, t: 0.6, a: 0.006, d: 1.2, vol: 0.11, filtro: { tipo: 'lowpass', f: 1200, q: 1 } }] }
  };
  // Eventos del juego que deben tener sonido (lo comprueba test/audio.js)
  const EVENTOS = ['toque', 'elegir', 'meter', 'mover', 'ruleta-giro', 'ruleta-tic', 'ruleta-alto', 'combate-gana', 'combate-pierde',
    'combate-anula', 'estado', 'enfermeria', 'nudo', 'error', 'dialogo', 'sello', 'victoria', 'derrota'];

  /* ---------- Música generativa (provisional hasta la Fase B) ----------
     Melodía en cuerda pulsada sobre una escala, con probabilidad por corchea; pad grave de dos osciladores
     desafinados con filtro y LFO lento; acordes que cambian cada pocos compases. */
  const MUSICA = {
    portada: { bpm: 64, base: 62, escala: [0, 3, 5, 7, 10], prob: 0.26, probFuerte: 0.5, pulsoVol: 0.09, notaDur: 1.6,
      padBase: 38, acordes: [0, 3, -2, 5], compases: 4, padVol: 0.05, padFiltro: 520, bajo: 0, rev: 0.55 },
    duelo: { bpm: 92, base: 62, escala: [0, 2, 3, 5, 7, 9, 10], prob: 0.34, probFuerte: 0.6, pulsoVol: 0.08, notaDur: 0.9,
      padBase: 38, acordes: [0, -2, 3, -4], compases: 2, padVol: 0.04, padFiltro: 650, bajo: 0.09, rev: 0.4 }
  };

  const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  const nada = () => {};

  /* ---------- Estado ---------- */
  let cfg = Object.assign({}, DEF);
  let store = null;
  let ctx = null, bus = null;    // bus: nodos maestros (se arman al primer uso)
  let oculto = false;
  let deseada = null;            // música pedida (suena si la música está activa y hay contexto)
  let sesion = null;             // música sonando
  let agachada = false;
  const vivos = [];              // efectos sonando: { g, envio, voces, fin }
  const ultimo = {};             // último disparo por sonido (minGap)
  let ruidoBuf = null;

  function AC() { return root.AudioContext || root.webkitAudioContext || null; }
  function guardar() { if (store) try { store.set(KEY, JSON.stringify(cfg)); } catch (e) { /* sin almacenamiento */ } }
  function leer() {
    let o = null;
    try { o = store && JSON.parse(store.get(KEY) || 'null'); } catch (e) { o = null; }
    const c = Object.assign({}, DEF);
    if (o && typeof o === 'object') {
      if (typeof o.musica === 'boolean') c.musica = o.musica;
      if (typeof o.efectos === 'boolean') c.efectos = o.efectos;
      ['volMusica', 'volEfectos'].forEach(k => { if (typeof o[k] === 'number' && isFinite(o[k])) c[k] = Math.max(0, Math.min(1, o[k])); });
    }
    return c;
  }

  function impulso(seg, caida) {
    const sr = ctx.sampleRate, n = Math.max(1, Math.floor(sr * seg)), b = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, caida); }
    return b;
  }
  function ruido() {
    if (!ruidoBuf) { const n = ctx.sampleRate; ruidoBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = ruidoBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    return ruidoBuf;
  }
  // Mezcla: efectos y música por separado, juntos a un compresor suave al final (evita picos)
  function armar() {
    if (bus || !ctx) return !!bus;
    try {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
      comp.connect(ctx.destination);
      const fx = ctx.createGain(), mus = ctx.createGain(), duck = ctx.createGain();
      fx.connect(comp); duck.connect(mus); mus.connect(comp);
      const fxRev = ctx.createConvolver(); fxRev.buffer = impulso(1.2, 3); fxRev.connect(fx);
      const musRev = ctx.createConvolver(); musRev.buffer = impulso(2.6, 2.5); musRev.connect(duck);
      bus = { comp, fx, mus, duck, fxRev, musRev };
      aplicarVolumen();
      return true;
    } catch (e) { bus = null; return false; }
  }
  function aplicarVolumen() {
    if (!bus) return;
    const t = ctx.currentTime;
    bus.fx.gain.setTargetAtTime(cfg.efectos ? cfg.volEfectos : 0, t, 0.03);
    bus.mus.gain.setTargetAtTime(cfg.musica ? cfg.volMusica : 0, t, 0.08);
    bus.duck.gain.setTargetAtTime(agachada ? 0.4 : 1, t, 0.15);
  }
  const activo = () => cfg.musica || cfg.efectos;
  function listo() { return !!ctx && !oculto && armar(); }

  /* ---------- Voces ---------- */
  function voz(v, t0, dest, mult) {
    const t = t0 + (v.t || 0), a = Math.max(0.001, v.a || 0.004), d = Math.max(0.005, v.d || 0.2), vol = Math.max(0.0002, v.vol || 0.1);
    const fin = t + a + d + 0.03;
    let src;
    if (v.onda === 'ruido') { src = ctx.createBufferSource(); src.buffer = ruido(); src.loop = true; }
    else {
      src = ctx.createOscillator(); src.type = v.onda || 'sine';
      src.frequency.setValueAtTime(v.f * mult, t);
      if (v.fFin) src.frequency.exponentialRampToValueAtTime(v.fFin * mult, t + (v.glide || d));
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    const nodos = [src, g];
    let n = src;
    if (v.filtro) { const f = ctx.createBiquadFilter(); f.type = v.filtro.tipo; f.frequency.value = v.filtro.f * (v.onda === 'ruido' ? 1 : mult); f.Q.value = v.filtro.q || 1; src.connect(f); n = f; nodos.push(f); }
    n.connect(g); g.connect(dest);
    src.start(t); src.stop(fin);
    return { src, nodos, fin };
  }
  function soltar(voces, alFinal) {
    let pend = voces.length;
    voces.forEach(x => { x.src.onended = () => { x.nodos.forEach(n => { try { n.disconnect(); } catch (e) { /* ya suelto */ } }); if (--pend === 0 && alFinal) alFinal(); }; });
  }
  function limpiar(ahora) { for (let i = vivos.length - 1; i >= 0; i--) if (vivos[i].fin <= ahora) vivos.splice(i, 1); }
  function cortar(inst, ahora) {
    try { inst.g.gain.cancelScheduledValues(ahora); inst.g.gain.setValueAtTime(inst.g.gain.value, ahora); inst.g.gain.linearRampToValueAtTime(0, ahora + 0.03); } catch (e) { /* nada */ }
    inst.voces.forEach(x => { try { x.src.stop(ahora + 0.04); } catch (e) { /* ya detenida */ } });
  }

  /* Efecto: id de SONIDOS; op = { vol (multiplicador), tono (semitonos) }. Devuelve true si sonó. */
  function efecto(id, op) {
    op = op || {};
    const def = SONIDOS[id];
    if (!def || !cfg.efectos || !listo()) return false;
    const ahora = ctx.currentTime;
    if (def.minGap && ultimo[id] !== undefined && ahora - ultimo[id] < def.minGap) return false;
    ultimo[id] = ahora;
    try {
      limpiar(ahora);
      while (vivos.length >= MAX_VOCES) cortar(vivos.shift(), ahora);
      const mult = Math.pow(2, (op.tono || 0) / 12);
      const g = ctx.createGain(); g.gain.value = op.vol === undefined ? 1 : Math.max(0, op.vol); g.connect(bus.fx);
      let envio = null;
      if (def.rev) { envio = ctx.createGain(); envio.gain.value = def.rev; g.connect(envio); envio.connect(bus.fxRev); }
      const voces = def.voces.map(v => voz(v, ahora + 0.005, g, mult));
      const inst = { g, envio, voces, fin: Math.max.apply(null, voces.map(x => x.fin)) };
      soltar(voces, () => { try { g.disconnect(); if (envio) envio.disconnect(); } catch (e) { /* nada */ } });
      vivos.push(inst);
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Música ---------- */
  function crearSesion(id, fade) {
    const P = MUSICA[id]; if (!P) return null;
    const t0 = ctx.currentTime;
    const out = ctx.createGain(); out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(1, t0 + fade); out.connect(bus.duck);
    const envio = ctx.createGain(); envio.gain.value = P.rev; out.connect(envio); envio.connect(bus.musRev);
    const padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = P.padFiltro; padF.Q.value = 0.7; padF.connect(out);
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.06; lfoG.gain.value = P.padFiltro * 0.45;
    lfo.connect(lfoG); lfoG.connect(padF.frequency); lfo.start(t0);
    const s = { id, P, out, envio, padF, lfo, lfoG, pads: [], paso: 0, sig: t0 + 0.1, rng: mulberry32((Math.random() * 1e9) | 0), nota: 2, timer: null };
    s.timer = (root.setInterval || setInterval)(() => programar(s), 50);
    programar(s);
    return s;
  }
  // Ventana de anticipación sobre el reloj del AudioContext (el temporizador solo despierta al programador)
  function programar(s) {
    if (!ctx || sesion !== s) return;
    const P = s.P, corchea = 60 / P.bpm / 2, porAcorde = P.compases * 8;
    const hasta = ctx.currentTime + 0.25;
    while (s.sig < hasta) {
      const t = s.sig, p = s.paso;
      if (p % porAcorde === 0) pad(s, t, P.acordes[(p / porAcorde) % P.acordes.length], porAcorde * corchea);
      if (P.bajo && p % 4 === 0) pulso(s, midiHz(P.padBase + 12 + P.acordes[Math.floor(p / porAcorde) % P.acordes.length]), t, 0.5, P.bajo);
      const fuerte = p % 4 === 0;
      if (s.rng() < (fuerte ? P.probFuerte : P.prob)) {
        s.nota = Math.max(0, Math.min(P.escala.length * 2 - 1, s.nota + Math.floor(s.rng() * 5) - 2));
        const m = P.base + P.escala[s.nota % P.escala.length] + 12 * Math.floor(s.nota / P.escala.length);
        pulso(s, midiHz(m), t, P.notaDur * (0.7 + s.rng() * 0.6), P.pulsoVol * (fuerte ? 1 : 0.75));
      }
      s.paso++; s.sig += corchea;
    }
  }
  function pulso(s, f, t, d, vol) {
    try { soltar(pulsada(f, 0, d, vol).map(v => voz(v, t, s.out, 1))); } catch (e) { /* nada */ }
  }
  function pad(s, t, grado, dur) {
    try {
      const P = s.P, g = ctx.createGain(), fin = t + dur + 3;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(P.padVol, t + 2.5);
      g.gain.setValueAtTime(P.padVol, t + dur); g.gain.linearRampToValueAtTime(0, fin);
      g.connect(s.padF);
      const oscs = [];
      [0, 7, 12].forEach(iv => [-7, 7].forEach(cents => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiHz(P.padBase + grado + iv); o.detune.value = cents;
        o.connect(g); o.start(t); o.stop(fin + 0.05); oscs.push(o);
      }));
      let pend = oscs.length;
      oscs.forEach(o => { o.onended = () => { try { o.disconnect(); } catch (e) { /* nada */ } if (--pend === 0) try { g.disconnect(); } catch (e) { /* nada */ } }; });
      s.pads.push({ g, oscs });
      if (s.pads.length > 3) s.pads.shift();
    } catch (e) { /* nada */ }
  }
  function pararSesion(s, fade) {
    if (!s) return;
    (root.clearInterval || clearInterval)(s.timer);
    const t = ctx.currentTime;
    try {
      s.out.gain.cancelScheduledValues(t); s.out.gain.setValueAtTime(s.out.gain.value, t); s.out.gain.linearRampToValueAtTime(0, t + fade);
      s.pads.forEach(p => p.oscs.forEach(o => { try { o.stop(t + fade + 0.1); } catch (e) { /* nada */ } }));
      s.lfo.stop(t + fade + 0.1);
    } catch (e) { /* nada */ }
    (root.setTimeout || setTimeout)(() => { [s.out, s.envio, s.padF, s.lfo, s.lfoG].forEach(n => { try { n.disconnect(); } catch (e) { /* nada */ } }); }, (fade + 4) * 1000);
  }
  function sonarDeseada(fade) {
    if (!ctx || !cfg.musica || !armar()) return;
    if (sesion && sesion.id === deseada) return;
    const vieja = sesion; sesion = null;
    if (vieja) pararSesion(vieja, fade);
    if (deseada) try { sesion = crearSesion(deseada, fade); } catch (e) { sesion = null; }
  }
  /* musica(id | null, { fade }): pide una pista. Si no hay contexto aún, queda pendiente. */
  function musica(id, op) {
    deseada = id && MUSICA[id] ? id : null;
    const fade = op && op.fade !== undefined ? op.fade : 1.2;
    if (!ctx || !bus) { if (ctx) armar(); else return; }
    if (!cfg.musica || !deseada) { const v = sesion; sesion = null; if (v) pararSesion(v, fade); return; }
    sonarDeseada(fade);
  }
  function bajarMusica(si) { agachada = !!si; aplicarVolumen(); }

  /* ---------- Contexto y ciclo de vida ---------- */
  function adoptar(c) {
    if (!c || ctx === c) return;
    ctx = c; bus = null;
    if (sesion) sesion = null;
  }
  // Solo dentro de un gesto del jugador: crea o reanuda el contexto
  function desbloquear() {
    if (!activo()) return;
    if (ctx && bus && ctx.state === 'running') return;   // ya desbloqueado (se llama en cada toque)
    try {
      if (!ctx) { const A = AC(); if (!A) return; ctx = new A(); }
      if (ctx.state !== 'running' && !oculto && ctx.resume) ctx.resume().catch(nada);
      const src = ctx.createBufferSource(); src.buffer = ctx.createBuffer(1, 1, 22050); src.connect(ctx.destination);
      src.onended = () => { try { src.disconnect(); } catch (e) { /* nada */ } }; src.start(0);   // silencio: desbloquea iOS
      if (armar() && deseada) sonarDeseada(1.5);
    } catch (e) { /* sin audio */ }
  }
  // En cada toque: si el sistema lo interrumpió (iOS, llamada, bloqueo), reanudar
  function reanudar() {
    if (!ctx || oculto || !activo()) return;
    if (ctx.state !== 'running' && ctx.resume) try { ctx.resume().catch(nada); } catch (e) { /* nada */ }
  }
  function visible(v) {
    oculto = !v;
    if (!ctx) return;
    try {
      if (oculto) { if (ctx.state === 'running' && ctx.suspend) ctx.suspend().catch(nada); }
      else reanudar();
    } catch (e) { /* nada */ }
  }

  function iniciar(storage) {
    store = storage || null;
    cfg = leer(); guardar();   // guardar: deja la preferencia también en el respaldo nativo (Platform.storage)
    if (ctx) aplicarVolumen();
  }
  function config() { return Object.assign({}, cfg); }
  function fijar(o) {
    o = o || {};
    if (typeof o.musica === 'boolean') cfg.musica = o.musica;
    if (typeof o.efectos === 'boolean') cfg.efectos = o.efectos;
    ['volMusica', 'volEfectos'].forEach(k => { if (typeof o[k] === 'number' && isFinite(o[k])) cfg[k] = Math.max(0, Math.min(1, o[k])); });
    guardar();
    if (!ctx) return config();
    aplicarVolumen();
    if (!cfg.musica && sesion) { const v = sesion; sesion = null; pararSesion(v, 0.4); }
    else if (cfg.musica && bus) sonarDeseada(1.2);
    try { if (!activo() && ctx.state === 'running' && ctx.suspend) ctx.suspend().catch(nada); } catch (e) { /* nada */ }
    return config();
  }

  const api = {
    KEY, DEF, MAX_VOCES, MAX_SONIDOS, SONIDOS, EVENTOS, MUSICA,
    iniciar, adoptar, desbloquear, reanudar, visible, config, fijar, efecto, musica, bajarMusica,
    estado: () => (ctx ? ctx.state : 'sin-audio'),
    vivos: () => { if (ctx) limpiar(ctx.currentTime); return vivos.length; },
    get pista() { return sesion ? sesion.id : null; }
  };
  root.DuelSonido = api;
  if (root.__ctxAudio) adoptar(root.__ctxAudio);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
