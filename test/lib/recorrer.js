/* Recorre una lección o duelo guiado con el motor real, igual que la interfaz: turno de la CPU según
   el guion, pasos del jugador y ruletas fijas. Lanza si una jugada del guion es ilegal o un combate no
   da el resultado anunciado. Devuelve { s, g } (estado final y guía). Lo usan test/tutorial.js y test/campana.js. */
'use strict';
const assert = require('assert');
const D = require('../../src/logic.js');
const T = require('../../src/tutorial.js');

const legal = (s, a) => D.legalActions(s).find(x => T.sameAct(x, a));

function combate(s, guide, fig, target, esperado, donde) {
  const sp = guide.takeSpin(s, fig, target);
  assert(sp, donde + ': el combate no tiene ruleta fija');
  const r = D.applyAction(s, { type: 'attack', fig, target, spin: sp });
  if (esperado) {
    assert.strictEqual(r.battle.outcome, esperado.outcome, donde + ': resultado ' + r.battle.outcome + ', se esperaba ' + esperado.outcome);
    if ('winner' in esperado) assert.strictEqual(r.battle.winner, esperado.winner, donde + ': ganó ' + r.battle.winner);
  }
  return r.state;
}

function turnoCpu(s, guide, L) {
  let n = 0;
  while (s.current === 1 && s.winner === null) {
    const a = guide.cpuAction(s);
    const donde = L.id + ' / CPU #' + guide.cpuIdx;
    assert(a, donde + ': la CPU tiene jugadas y el guion no dice cuál');
    if (a.type === 'pass') { assert(!D.legalActions(s).length, donde + ': pasa teniendo jugadas'); s = D.applyAction(s, a).state; }
    else {
      assert(legal(s, a), donde + ': jugada ilegal ' + JSON.stringify(a));
      if (a.type === 'attack') s = combate(s, guide, a.fig, a.target, L.cpu[guide.cpuIdx - 1].spin, donde);
      else s = D.applyAction(s, legal(s, a)).state;
    }
    assert.deepStrictEqual(D.validate(s), []);
    assert(++n < 10, donde + ': bucle');
  }
  return s;
}

function recorrer(L) {
  const g = T.createGuide(L);
  let s = g.start();
  while (!g.done && s.winner === null) {
    s = turnoCpu(s, g, L);
    if (s.winner !== null) break;
    const st = g.step; const donde = L.id + ' / paso ' + (g.i + 1);
    assert(st.text && st.text.length > 10, donde + ': sin texto');
    if (st.info) {
      if (st.expect) assert.strictEqual(s.figs[st.expect.fig].loc, st.expect.loc, donde + ': la figura ' + st.expect.fig + ' está en ' + s.figs[st.expect.fig].loc);
      assert(g.next());
    } else if (st.tap) {
      const f = s.figs[st.tap.fig];
      assert.strictEqual(f.owner, 0, donde + ': se pide tocar una figura rival');
      assert(D.legalActions(s).some(a => a.fig === f.id), donde + ': la figura no tiene jugadas');
      assert(g.allowsFig(f.id) && g.tapped(f.id));
    } else if (st.act) {
      const a = st.act;
      if (a.type === 'attack') {
        assert(g.allowsFig(a.fig) && g.allowsFig(a.target), donde);
        if (s.awaitAttack === a.fig) assert(legal(s, a), donde + ': ataque ilegal');
        else { assert(legal(s, { type: 'stay', fig: a.fig }), donde + ': no puede atacar sin moverse'); assert(D.adjacentRivals(s, s.figs[a.fig]).includes(a.target), donde + ': el objetivo no está al lado'); }
        assert(g.allowsAct({ type: 'attack', fig: a.fig, target: a.target }));
        if (s.awaitAttack !== a.fig) s = D.applyAction(s, { type: 'stay', fig: a.fig }).state;
        s = combate(s, g, a.fig, a.target, st.spin, donde);
      } else {
        const la = legal(s, a);
        assert(la, donde + ': jugada ilegal ' + JSON.stringify(a));
        if (a.to !== undefined) assert(g.allowsNode(a.to));
        assert(!g.allowsAct({ ...la, to: -1 }), donde + ': deja pasar una jugada distinta');
        assert(g.allowsAct(la));
        s = D.applyAction(s, la).state;
      }
      // tras moverse junto a un rival queda un ataque opcional: el guion debe resolverlo
      if (s.awaitAttack !== null && s.current === 0) {
        const sig = g.step;
        assert(sig && sig.act && (sig.act.type === 'attack' || sig.act.type === 'end'), donde + ': queda un ataque pendiente que el guion no resuelve');
      }
    }
    assert.deepStrictEqual(D.validate(s), []);
  }
  assert.strictEqual(g.cpuIdx, L.cpu.length, L.id + ': sobran jugadas de la CPU en el guion');
  return { s, g };
}

module.exports = { recorrer };
