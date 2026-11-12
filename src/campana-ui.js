/* ===================== CAMPAÑA: INTERFAZ =====================
   Mapa de duelos, pantalla de diálogo, armado del equipo y exportar/importar progreso.
   La lógica de la campaña está en campana.js (sin DOM); las partidas las lanza ui.js
   (DuelUI.api.startCampaignDuel / startCampaignGuided) y avisan al terminar con onEnd(resultado).
   Retratos y fondos se cargan como archivos (art/web/...); si faltan, círculo con la inicial y fondo liso. */
(function () {
  'use strict';
  const C = window.DuelCampana, D = window.Duel, P = window.Platform;
  const U = window.DuelUI && window.DuelUI.api;
  if (!C || !U) return;
  const $ = s => document.querySelector(s);
  const esc = U.esc;
  let prog = null;
  let dlg = null; // diálogo abierto: { resolve, cola, ... }

  const cargar = () => { prog = C.leer(P.storage); return prog; };
  const guardar = () => C.guardar(P.storage, prog);
  // *texto* del guion -> cursiva
  const conCursiva = t => esc(t).replace(/\*(.+?)\*/g, '<em>$1</em>');

  /* ---------- Entrada ---------- */
  async function abrir() {
    if (!cargar()) {
      const v = await U.openModal('Campaña: el Gran Telar', '<p>Cinco épocas, catorce duelos y un telar por reparar. ¿Cómo te llamas?</p>' +
        '<input id="camp-nombre" class="campo" maxlength="16" autocomplete="off" value="Ari" aria-label="Tu nombre">' +
        '<p class="note">Por ahora están disponibles el prólogo y el Arco 1 (duelos 1 a 4).</p>',
        [{ label: 'Cancelar', value: null }, { label: 'Empezar', value: 'ok', primary: true }]);
      if (v !== 'ok') return;
      prog = C.nuevo($('#camp-nombre').value); guardar();
    }
    mapa();
  }

  /* ---------- Mapa ---------- */
  const ESTADO = { ganado: '✓ Ganado', abierto: 'Jugar', bloqueado: 'Bloqueado', proximamente: 'Próximamente' };
  function mini(id) {
    const per = C.personaje(id); const r = C.retrato(id, 'neutral');
    const ini = esc((C.conJugador(per.nombre, prog) || '?').trim().charAt(0).toUpperCase());
    return '<span class="mini" style="background:' + per.color + '">' + (r ? '<img src="' + r + '" alt="" data-ini="' + ini + '">' : ini) + '</span>';
  }
  function mapa() {
    U.hideScreens(); $('#scr-camp').hidden = false; window.scrollTo(0, 0);
    $('#camp-head').innerHTML = '<span>Tejedor/a: <b>' + esc(prog.jugador) + '</b></span><span>· Sellos <b>' + prog.sellos.length + '/5</b></span>' +
      (prog.figuras.length ? '<span>· Figuras</span><span class="figs">' + prog.figuras.map(k => U.creatureImg(D.CREATURE[k], 'token')).join('') + '</span>' : '');
    let html = '';
    C.CAMPANA.capitulos.forEach(cap => {
      const ds = C.DUELOS.filter(d => d.capitulo === cap.id);
      html += '<h2 class="camp-cap">' + esc(cap.titulo) + '</h2>';
      ds.forEach(d => {
        const e = C.estado(prog, d);
        html += '<button type="button" class="camp-duel ' + e + '" data-id="' + d.id + '"' + (e === 'ganado' || e === 'abierto' ? '' : ' disabled') + '>' +
          '<span class="num">' + d.num + '</span>' + mini(d.rival) +
          '<span class="tx"><b>' + esc(d.titulo) + (d.jefe ? ' · jefe' : '') + '</b>' + (d.subtitulo ? '<small>' + esc(d.subtitulo) + '</small>' : '') + '</span>' +
          '<span class="est">' + ESTADO[e] + '</span></button>';
      });
    });
    $('#camp-list').innerHTML = html;
    $('#camp-list').querySelectorAll('.camp-duel').forEach(b => b.addEventListener('click', () => jugar(C.duelo(b.dataset.id), false)));
  }

  /* ---------- Jugar un duelo ---------- */
  function contexto(id) {
    if (!prog) cargar();
    const d = C.duelo(id);
    return d && prog ? { id, onEnd: (r, motivo) => terminar(d, r, motivo) } : null;
  }
  async function jugar(d, reintento) {
    if (!reintento) await escenas(d.antes || [], d);
    if (d.aviso) await U.openModal(esc(d.titulo), '<p>' + esc(d.aviso) + '</p>', [{ label: 'Entendido', primary: true }]);
    if (d.guiado) { U.startCampaignGuided(C.guiado(d.guiado), contexto(d.id)); return; }
    const equipo = await elegirEquipo(d);
    if (!equipo) { mapa(); return; }
    U.startCampaignDuel(C.configDuelo(d), equipo, contexto(d.id));
  }
  async function terminar(d, r, motivo) {
    if (r === 'exit') { mapa(); return; }
    if (r === 'win') {
      const antes = prog.figuras.slice();
      prog = C.ganar(prog, d.id); guardar();
      await escenas(d.despues || [], d);
      const nuevas = prog.figuras.filter(k => !antes.includes(k));
      const rec = d.recompensa || {};
      await U.openModal('¡Ganaste a ' + esc(C.conJugador(C.personaje(d.rival).nombre, prog)) + '!',
        '<p><b>Recompensa:</b> ' + esc(rec.texto || '—') + '</p>' +
        (nuevas.length ? '<div class="camp-head"><span class="figs">' + nuevas.map(k => U.creatureImg(D.CREATURE[k], 'token')).join('') + '</span><span>' + nuevas.map(k => esc(D.CREATURE[k].name)).join(', ') + '</span></div>' : '') +
        (C.siguiente(prog) ? '' : '<p class="note">Por ahora la campaña llega hasta aquí: el Arco 2 viene en la próxima versión.</p>'),
        [{ label: 'Al mapa', primary: true }]);
      mapa(); return;
    }
    if (d.reintento) await escenas([d.reintento], d);
    const v = await U.openModal(r === 'draw' ? 'Empate' : 'Perdiste', '<p>' + esc(motivo || '') + '</p>',
      [{ label: 'Al mapa', value: 'mapa' }, { label: 'Reintentar', value: 'otra', primary: true }]);
    if (v === 'otra') jugar(d, true); else mapa();
  }

  /* ---------- Equipo (6 figuras de las desbloqueadas; se pueden repetir) ---------- */
  async function elegirEquipo(d) {
    let eq = C.equipoPorDefecto(prog);
    const pintar = () => {
      $('#modal-body').innerHTML = '<p>Arma tu equipo de 6 con tus figuras. Puedes repetir. Toca una ranura para vaciarla.</p>' +
        '<div class="equipo-slots">' + Array.from({ length: C.TAM_EQUIPO }, (_, i) => eq[i]
          ? '<button type="button" class="lleno" data-i="' + i + '" aria-label="Quitar ' + esc(D.CREATURE[eq[i]].name) + '">' + U.creatureImg(D.CREATURE[eq[i]], 'token') + '</button>'
          : '<button type="button" data-i="' + i + '" aria-label="Ranura vacía"></button>').join('') + '</div>' +
        '<div class="equipo-pool">' + prog.figuras.map(k => '<button type="button" data-k="' + k + '" aria-label="Agregar ' + esc(D.CREATURE[k].name) + '">' + U.creatureImg(D.CREATURE[k], 'token') + '</button>').join('') + '</div>';
      $('#modal-body').querySelectorAll('.equipo-slots button').forEach(b => b.addEventListener('click', () => { eq.splice(+b.dataset.i, 1); pintar(); }));
      $('#modal-body').querySelectorAll('.equipo-pool button').forEach(b => b.addEventListener('click', () => { if (eq.length < C.TAM_EQUIPO) { eq.push(b.dataset.k); pintar(); } else U.nudge(); }));
      const jugarBtn = [...document.querySelectorAll('#modal-actions .btn')].find(x => x.textContent === 'Jugar');
      if (jugarBtn) jugarBtn.disabled = eq.length !== C.TAM_EQUIPO;
    };
    const p = U.openModal('Tu equipo contra ' + esc(C.conJugador(C.personaje(d.rival).nombre, prog)), '', [{ label: 'Cancelar', value: null }, { label: 'Jugar', value: 'ok', primary: true }]);
    pintar();
    const v = await p;
    if (v !== 'ok' || !C.equipoValido(eq, prog)) return null;
    prog.equipo = eq.slice(); guardar();
    return eq;
  }

  /* ---------- Diálogo ---------- */
  async function escenas(ids, d) {
    for (const id of ids) await dialogo(C.escena(id, d, prog));
  }
  function dialogo(e) {
    return new Promise(resolve => {
      const cola = [];
      if (e.escenario) cola.push({ narracion: true, texto: e.escenario, quien: 'narracion' });
      e.lineas.forEach(l => cola.push(l));
      dlg = { resolve, cola, i: -1, esperando: false };
      const el = $('#dialogo'); el.hidden = false;
      const fondo = el.querySelector('.dlg-fondo');
      fondo.style.backgroundImage = '';
      if (e.fondo) { const img = new Image(); img.onload = () => { fondo.style.backgroundImage = 'url("' + e.fondo + '")'; }; img.src = e.fondo; }
      el.querySelector('.dlg-escena').textContent = e.titulo;
      avanzar();
    });
  }
  function mostrar(l) {
    const el = $('#dialogo');
    const caja = el.querySelector('.dlg-caja'), ret = el.querySelector('.dlg-retrato');
    caja.className = 'dlg-caja ' + (l.narracion ? 'narr' : (l.lado || 'der'));
    ret.className = 'dlg-retrato ' + (l.lado || 'der');
    const nom = el.querySelector('.dlg-nombre');
    nom.hidden = !!l.narracion || !l.nombre;
    nom.textContent = l.nombre || ''; nom.style.color = l.color || '';
    if (l.narracion) ret.innerHTML = '';
    else if (l.retrato) {
      ret.innerHTML = '<img alt="" src="' + l.retrato + '">';
      ret.querySelector('img').addEventListener('error', () => { ret.innerHTML = inicial(l); });
    } else ret.innerHTML = inicial(l);
    el.querySelector('.dlg-accion').innerHTML = l.accion ? '(' + conCursiva(l.accion) + ')' : '';
    el.querySelector('.dlg-texto').innerHTML = conCursiva(l.texto || '');
    const ops = el.querySelector('.dlg-opciones'); ops.innerHTML = '';
    el.querySelector('.dlg-sigue').hidden = !!l.opciones;
    if (l.opciones) {
      dlg.esperando = true;
      l.opciones.forEach(o => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = o.texto;
        b.addEventListener('click', ev => { ev.stopPropagation(); dlg.esperando = false; dlg.cola.splice(dlg.i + 1, 0, o.respuesta); avanzar(); });
        ops.appendChild(b);
      });
    }
  }
  function inicial(l) {
    return '<span class="ini" style="background:' + (l.color || '#9ba6c9') + '">' + esc((l.nombre || '?').trim().charAt(0).toUpperCase()) + '</span>';
  }
  function avanzar() {
    if (!dlg || dlg.esperando) return;
    dlg.i++;
    if (dlg.i >= dlg.cola.length) { cerrarDialogo(); return; }
    mostrar(dlg.cola[dlg.i]);
  }
  function cerrarDialogo() {
    if (!dlg) return;
    const r = dlg.resolve; dlg = null;
    $('#dialogo').hidden = true;
    r();
  }

  /* ---------- Opciones: exportar, importar, borrar ---------- */
  async function opciones() {
    const v = await U.openModal('Progreso de campaña', '<p>Tu avance se guarda en este navegador. Para no perderlo (o pasarlo a otro teléfono), copia el código y guárdalo.</p>',
      [{ label: 'Exportar', value: 'exp' }, { label: 'Importar', value: 'imp' }, { label: 'Borrar', value: 'del', danger: true }, { label: 'Cerrar', value: null, primary: true }]);
    if (v === 'exp') {
      const code = C.exportar(prog);
      const p = U.openModal('Exportar progreso', '<p>Copia este código y guárdalo donde quieras (un mensaje, una nota).</p><textarea id="camp-code" class="codigo" readonly>' + esc(code) + '</textarea>',
        [{ label: 'Copiar', keep: true, onClick: copiar }, { label: 'Listo', primary: true }]);
      await p;
    } else if (v === 'imp') {
      const r = await U.openModal('Importar progreso', '<p>Pega el código. Reemplaza el progreso de este navegador.</p><textarea id="camp-code" class="codigo" spellcheck="false" placeholder="HT1...."></textarea><p id="camp-err" class="warn"></p>',
        [{ label: 'Cancelar', value: null }, { label: 'Importar', value: 'ok', primary: true }]);
      if (r === 'ok') {
        try { prog = C.importar($('#camp-code').value); guardar(); await U.openModal('Listo', '<p>Progreso de <b>' + esc(prog.jugador) + '</b> importado: ' + prog.ganados.length + ' duelos ganados.</p>'); }
        catch (e) { await U.openModal('No se pudo importar', '<p>' + esc(e.message) + '</p>'); }
      }
    } else if (v === 'del') {
      const r = await U.openModal('¿Borrar la campaña?', '<p>Se pierde el avance de este navegador (exporta antes si quieres conservarlo).</p>', [{ label: 'Cancelar', value: null }, { label: 'Borrar', value: 'ok', danger: true }]);
      if (r === 'ok') { P.storage.del(C.KEY); prog = null; U.showTeamScreen(); return; }
    }
    if (prog) mapa();
  }
  function copiar() {
    const t = $('#camp-code'); if (!t) return;
    const ok = () => { const b = [...document.querySelectorAll('#modal-actions .btn')].find(x => x.textContent.startsWith('Copiar')); if (b) b.textContent = 'Copiado ✓'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(ok, () => { t.select(); });
    else { t.select(); try { document.execCommand('copy'); ok(); } catch (e) { /* seleccionado para copiar a mano */ } }
  }

  // Botón atrás (Android): salta la escena o vuelve del mapa a la pantalla inicial
  function onBack() {
    if (dlg) { cerrarDialogo(); return true; }
    if (!$('#scr-camp').hidden) { U.showTeamScreen(); return true; }
    return false;
  }

  function init() {
    const el = $('#dialogo');
    el.addEventListener('click', ev => { if (ev.target.closest('.dlg-opciones')) return; avanzar(); });
    el.querySelector('.dlg-saltar').addEventListener('click', ev => { ev.stopPropagation(); cerrarDialogo(); });
    $('#btn-camp-back').addEventListener('click', () => U.showTeamScreen());
    $('#btn-camp-menu').addEventListener('click', opciones);
    // retrato pequeño del mapa que no carga: inicial
    document.addEventListener('error', ev => {
      const t = ev.target;
      if (t && t.tagName === 'IMG' && t.dataset.ini !== undefined && t.parentElement && t.parentElement.classList.contains('mini')) t.parentElement.textContent = t.dataset.ini;
    }, true);
  }

  window.DuelCampanaUI = { abrir, contexto, onBack, get abierto() { return !!dlg; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
