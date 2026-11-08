/* ===================== IA DE LA CPU (puntuación de jugadas) ===================== */
(function (root) {
  'use strict';
  const D = root.Duel || (typeof require !== 'undefined' ? require('./logic.js') : null);
  const { BOARD, STATUS } = D;

  const LEVELS = {
    facil:   { name: 'Fácil',   noise: 70, randomPick: 0.25, threatW: 600,  danger: 0 },
    normal:  { name: 'Normal',  noise: 10, randomPick: 0,    threatW: 4000, danger: 0.35 },
    // Difícil valora más la posición y la seguridad que correr hacia la meta (ajustado por simulación)
    dificil: { name: 'Difícil', noise: 1,  randomPick: 0,    threatW: 4000, danger: 0.35, prog: 4 }
  };

  const goalOfRival = p => BOARD.goal[1 - p];

  // ¿Qué figuras de p pueden pisar la meta rival en su próximo turno?
  function winThreats(s, p, occ) {
    occ = occ || D.occupancy(s);
    const g = goalOfRival(p);
    if (occ[g] !== -1) return [];
    const out = [];
    for (const f of s.figs) {
      if (f.owner !== p || f.loc !== 'board' || D.isImmobile(f)) continue;
      const mp = D.creatureOf(f).mp;
      if (BOARD.dist[f.node][g] > mp) continue;
      if (D.reachable(s, f.node, mp, p, occ).dist.has(g)) out.push(f.id);
    }
    return out;
  }

  // valor de una figura en juego: más cerca de la meta rival, más vale.
  // La urgencia crece con los turnos para evitar partidas estancadas.
  function figWorth(f, turn, lv) {
    if (f.loc !== 'board') return 0;
    const d = BOARD.dist[f.node][goalOfRival(f.owner)];
    const urg = 1 + Math.min(2, (turn || 0) / 120);
    return ((lv && lv.base) || 45) + (8 - d) * ((lv && lv.prog) || 7) * urg;
  }

  // Peligro de que el rival (que juega a continuación) ataque con ventaja
  function attackDanger(s, me, occ) {
    const rival = 1 - me; let worst = 0;
    for (const f of s.figs) {
      if (f.owner !== rival || f.loc !== 'board' || D.isImmobile(f)) continue;
      const r = D.reachable(s, f.node, D.creatureOf(f).mp, rival, occ);
      const targets = new Set();
      for (const [n] of r.dist) for (const m of BOARD.adj[n]) { const id = occ[m]; if (id !== -1 && s.figs[id].owner === me) targets.add(id); }
      for (const t of targets) {
        const o = D.battleOdds(s, f.id, t);
        const ev = o.win * (figWorth(s.figs[t], s.turn) + 30) - o.lose * (figWorth(f, s.turn) + 30);
        if (ev > worst) worst = ev;
      }
    }
    return worst;
  }

  function evaluate(s, me, lv) {
    if (s.winner === me) return 1e6;
    if (s.winner === 1 - me) return -1e6;
    if (s.winner === 'draw') return 0;
    const occ = D.occupancy(s); let score = 0;
    for (const f of s.figs) {
      const sign = f.owner === me ? 1 : -1;
      if (f.loc === 'board') {
        let v = figWorth(f, s.turn, lv);
        if (f.status) v -= { sleep: 18, freeze: 24, para: 12, poison: 8 }[f.status.k];
        // riesgo de quedar rodeada: queda una sola salida y el resto son rivales
        const ns = BOARD.adj[f.node];
        const rivals = ns.filter(n => occ[n] !== -1 && s.figs[occ[n]].owner !== f.owner).length;
        const free = ns.filter(n => occ[n] === -1).length;
        if (free === 1 && rivals === ns.length - 1) v -= f.owner === me ? 70 : 25;
        if (f.owner === me && f.node === BOARD.goal[me]) v += 12;
        score += sign * v;
      } else if (f.loc === 'ko') score -= sign * (lv.koPen || 20);
    }
    const mine = winThreats(s, me, occ).length;
    const theirs = winThreats(s, 1 - me, occ).length;
    if (theirs) score -= lv.threatW + 200 * theirs; // el rival juega ahora: ganaría
    if (mine) score += 90 + 40 * mine;
    if (lv.danger) score -= lv.danger * attackDanger(s, me, occ);
    return score;
  }

  // Valor esperado de atacar: se agrupan los resultados de la ruleta y se evalúa cada uno
  function attackValue(s, aId, tId, me, lv) {
    const A = s.figs[aId], T = s.figs[tId];
    const wa = D.effectiveWheel(A, T), wd = D.effectiveWheel(T, A);
    const ta = wa.reduce((x, y) => x + y.w, 0), td = wd.reduce((x, y) => x + y.w, 0);
    const buckets = new Map();
    wa.forEach((a, i) => wd.forEach((d, j) => {
      const c = D.compareSegs(a, d);
      const key = c > 0 ? 'A' + i : c < 0 ? 'D' + j : 'T';
      const p = (a.w / ta) * (d.w / td);
      const b = buckets.get(key); if (b) b.p += p; else buckets.set(key, { p, i, j });
    }));
    let ev = 0;
    for (const b of buckets.values()) {
      const r = D.applyAction(s, { type: 'attack', fig: aId, target: tId, spin: { ai: b.i, di: b.j } });
      ev += b.p * evaluate(r.state, me, lv);
    }
    return ev;
  }

  // Mejor continuación una vez que la figura ya se movió (atacar o terminar)
  function bestFollowUp(s, me, lv) {
    let best = { score: -Infinity, act: { type: 'end' } };
    for (const a of D.legalActions(s)) {
      const sc = a.type === 'end' ? evaluate(D.applyAction(s, a).state, me, lv) : attackValue(s, a.fig, a.target, me, lv);
      if (sc > best.score) best = { score: sc, act: a };
    }
    return best;
  }

  function choose(s, level, rng) {
    rng = rng || Math.random;
    const lv = LEVELS[level] || LEVELS.normal;
    const me = s.current;
    const acts = D.legalActions(s);
    if (!acts.length) return { type: 'pass' };
    if (s.awaitAttack !== null) {
      if (lv.randomPick && rng() < lv.randomPick) return acts[Math.floor(rng() * acts.length)];
      return bestFollowUp(s, me, lv).act;
    }
    // ganar ya si se puede
    const win = acts.find(a => (a.type === 'move' || a.type === 'enter') && a.to === goalOfRival(me));
    if (win) return win;
    if (lv.randomPick && rng() < lv.randomPick) return acts[Math.floor(rng() * acts.length)];
    const scored = acts.map(a => {
      const r = D.applyAction(s, a);
      let sc = r.state.awaitAttack !== null ? bestFollowUp(r.state, me, lv).score : evaluate(r.state, me, lv);
      if (a.type === 'stay') sc -= 2; // preferir moverse si da igual
      return { a, sc: sc + (rng() * 2 - 1) * lv.noise };
    }).sort((x, y) => y.sc - x.sc);
    return scored[0].a;
  }

  const api = { LEVELS, choose, evaluate, winThreats };
  root.DuelAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
