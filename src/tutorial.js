/* ===================== TUTORIAL: MOTOR DE PASOS (sin DOM) =====================
   Una lección (data/tutorial/*.json) es una partida real del motor con:
   - posición inicial fija ("player", "rival", "first", "setup"),
   - pasos para el jugador ("steps"): "info" (texto y botón Siguiente), "tap" (tocar una figura)
     o "act" (hacer una acción concreta: enter, move, attack o end),
   - jugadas de la CPU en orden ("cpu"), en vez de la IA,
   - resultados fijos de las ruletas ("spin": índices de segmento de atacante y defensor).
   La interfaz pregunta aquí qué toques permite y qué ruleta usar; test/tutorial.js recorre
   cada lección con el motor para comprobar que todo el guion es legal y se puede terminar. */
(function (root) {
  'use strict';
  const D = root.Duel || (typeof require !== 'undefined' ? require('./logic.js') : null);

  function loadLessons() {
    let raw = null;
    if (root.DUEL_DATA && root.DUEL_DATA.tutorial) raw = root.DUEL_DATA.tutorial;
    else if (typeof require === 'function' && typeof __dirname === 'string') {
      const fs = require('fs'), path = require('path');
      const base = path.join(__dirname, '..', 'data', 'tutorial'); raw = {};
      fs.readdirSync(base).filter(f => f.endsWith('.json')).forEach(f => { const j = JSON.parse(fs.readFileSync(path.join(base, f), 'utf8')); raw[j.id] = j; });
    }
    return Object.values(raw || {}).sort((a, b) => a.orden - b.orden);
  }
  const LESSONS = loadLessons();

  // Partida inicial de una lección
  function buildState(lesson) {
    const s = D.newGame(lesson.player, lesson.rival, lesson.first || 0, {
      id: 'tutorial-' + lesson.id, board: lesson.board || 'clasico', rules: [], victory: { type: 'goal', turnLimit: 300 }
    });
    (lesson.setup || []).forEach(p => {
      const f = s.figs[p.fig];
      if (!f) throw new Error('Lección ' + lesson.id + ': no existe la figura ' + p.fig);
      if (p.node !== undefined) { f.loc = 'board'; f.node = p.node; }
      if (p.status) f.status = { k: p.status, left: p.left || D.STATUS[p.status].dur, at: 0 };
    });
    const errs = D.validate(s);
    if (errs.length) throw new Error('Lección ' + lesson.id + ': ' + errs.join('; '));
    return s;
  }

  // ¿La acción a coincide con la esperada e? (los campos que e no fija no importan)
  function sameAct(a, e) {
    if (!a || !e || a.type !== e.type) return false;
    for (const k of ['fig', 'to', 'target']) if (e[k] !== undefined && a[k] !== e[k]) return false;
    return true;
  }

  function createGuide(lesson) {
    const g = {
      lesson, i: 0, cpuIdx: 0, pendingSpin: null, finished: false,
      start() { return buildState(lesson); },
      get step() { return lesson.steps[g.i] || null; },
      get isLast() { return g.i >= lesson.steps.length - 1; },
      text() { const st = g.step; return st ? st.text : ''; },
      // Figuras y cruces que la interfaz debe resaltar en el paso actual
      highlights() {
        const st = g.step; const out = { figs: [], nodes: [], button: null };
        if (!st) return out;
        if (st.tap) out.figs.push(st.tap.fig);
        if (st.act) {
          if (st.act.fig !== undefined) out.figs.push(st.act.fig);
          if (st.act.target !== undefined) out.figs.push(st.act.target);
          if (st.act.to !== undefined) out.nodes.push(st.act.to);
          if (st.act.type === 'end') out.button = 'end';
        }
        if (st.info) out.button = 'next';
        return out;
      },
      // Toques permitidos: solo los que llevan a la acción del paso
      allowsFig(id) {
        const st = g.step; if (!st) return false;
        if (st.tap) return st.tap.fig === id;
        if (st.act) return st.act.fig === id || st.act.target === id;
        return false;
      },
      allowsNode(n) { const st = g.step; return !!(st && st.act && st.act.to === n); },
      // Acción que el jugador va a ejecutar: solo pasa la del paso. Si pasa, el guion avanza.
      allowsAct(a) {
        const st = g.step;
        if (!st || !st.act || !sameAct(a, st.act)) return false;
        g.pendingSpin = st.spin || null;
        g.i++;
        return true;
      },
      // Tocar la figura pedida en un paso "tap" lo completa
      tapped(id) { const st = g.step; if (st && st.tap && st.tap.fig === id) { g.i++; return true; } return false; },
      next() { const st = g.step; if (st && st.info) { g.i++; return true; } return false; },
      get done() { return g.i >= lesson.steps.length; },
      // Jugada de la CPU según el guion; sin guion, pasa (solo si no tiene jugadas)
      cpuAction(s) {
        const a = (lesson.cpu || [])[g.cpuIdx];
        if (!a) return D.legalActions(s).length ? null : { type: 'pass' };
        g.cpuIdx++;
        const act = { ...a }; delete act.spin;
        if (act.type === 'move' || act.type === 'enter') {
          const legal = D.legalActions(s).find(x => sameAct(x, act));
          if (legal) act.path = legal.path;
        }
        g.pendingSpin = a.spin || null;
        return act;
      },
      // Resultado fijo de la ruleta para el combate que empieza (o null para sortear)
      takeSpin(s, aId, dId) {
        const sp = g.pendingSpin; g.pendingSpin = null;
        if (!sp) return null;
        const A = s.figs[aId], T = s.figs[dId];
        return { ai: sp.ai, di: sp.di, wa: D.effectiveWheel(A, T, s), wd: D.effectiveWheel(T, A, s) };
      }
    };
    return g;
  }

  /* ---------- Progreso (qué lecciones se completaron) ---------- */
  const KEY = 'duelo-nodos-tutorial';
  function readProgress(storage) {
    try { const r = storage.get(KEY); const p = r ? JSON.parse(r) : {}; return { hechas: p.hechas || [], ofrecido: !!p.ofrecido }; }
    catch (e) { return { hechas: [], ofrecido: false }; }
  }
  function writeProgress(storage, p) { storage.set(KEY, JSON.stringify(p)); }

  const api = { LESSONS, buildState, createGuide, sameAct, readProgress, writeProgress, KEY };
  root.DuelTutorial = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
