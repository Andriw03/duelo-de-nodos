/* ===================== CAMPAÑA (sin DOM) =====================
   Datos: data/campaign/campana.json (capítulos y duelos), escenas.json (generado desde docs/guion.md),
   personajes.json, guiados/*.json (duelos guiados) y data/duels/c*.json (configuración de cada duelo).
   Progreso en Platform.storage, clave "duelo-nodos-campana":
     { v, jugador, ganados: [id], sellos: [id], figuras: [criatura], equipo: [6 criaturas] }
   Reglas de la campaña: desbloqueo lineal; el equipo se arma con las criaturas desbloqueadas y
   se pueden repetir (decidido en la Fase 3). */
(function (root) {
  'use strict';
  const D = root.Duel || (typeof require !== 'undefined' ? require('./logic.js') : null);
  const KEY = 'duelo-nodos-campana';
  const TAM_EQUIPO = 6;

  function loadData() {
    if (root.DUEL_DATA && root.DUEL_DATA.campaign) return root.DUEL_DATA.campaign;
    if (typeof require === 'function' && typeof __dirname === 'string') {
      const fs = require('fs'), path = require('path');
      const base = path.join(__dirname, '..', 'data', 'campaign');
      const rd = f => JSON.parse(fs.readFileSync(path.join(base, f), 'utf8'));
      const guiados = {};
      fs.readdirSync(path.join(base, 'guiados')).filter(f => f.endsWith('.json')).forEach(f => { const j = rd('guiados/' + f); guiados[j.id] = j; });
      return { campana: rd('campana.json'), escenas: rd('escenas.json').escenas, personajes: rd('personajes.json').personajes, guiados };
    }
    throw new Error('Faltan los datos de la campaña');
  }
  const DATA = loadData();
  const CAMPANA = DATA.campana, ESCENAS = DATA.escenas, PERSONAJES = DATA.personajes, GUIADOS = DATA.guiados;
  const DUELOS = CAMPANA.duelos;
  const duelo = id => DUELOS.find(d => d.id === id) || null;
  const capitulo = id => CAMPANA.capitulos.find(c => c.id === id) || null;

  /* ---------- Progreso ---------- */
  function limpiarNombre(n) {
    n = String(n == null ? '' : n).replace(/[<>&"{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
    return n || 'Ari';
  }
  function nuevo(nombre) { return { v: 1, jugador: limpiarNombre(nombre), ganados: [], sellos: [], figuras: [], equipo: [] }; }
  // Valida y normaliza un progreso (de storage o de un código importado); lanza si no sirve
  function normalizar(p) {
    if (!p || typeof p !== 'object' || p.v !== 1) throw new Error('No es un progreso de campaña válido');
    const ids = new Set(DUELOS.map(d => d.id));
    const out = nuevo(p.jugador);
    out.ganados = (Array.isArray(p.ganados) ? p.ganados : []).filter(id => ids.has(id));
    out.sellos = (Array.isArray(p.sellos) ? p.sellos : []).filter(s => typeof s === 'string').slice(0, 5);
    out.figuras = (Array.isArray(p.figuras) ? p.figuras : []).filter(k => D.CREATURE[k]);
    out.equipo = (Array.isArray(p.equipo) ? p.equipo : []).filter(k => out.figuras.includes(k)).slice(0, TAM_EQUIPO);
    return out;
  }
  function leer(storage) {
    try { const r = storage.get(KEY); return r ? normalizar(JSON.parse(r)) : null; } catch (e) { return null; }
  }
  function guardar(storage, p) { storage.set(KEY, JSON.stringify(p)); }

  // Estado de un duelo para el mapa: ganado, abierto (el siguiente por jugar), bloqueado o proximamente
  function estado(p, d) {
    if (p.ganados.includes(d.id)) return 'ganado';
    if (d.disponible === false) return 'proximamente';
    const i = DUELOS.indexOf(d);
    return DUELOS.slice(0, i).every(x => p.ganados.includes(x.id)) ? 'abierto' : 'bloqueado';
  }
  function siguiente(p) { return DUELOS.find(d => estado(p, d) === 'abierto') || null; }

  // Victoria: suma el duelo, las figuras y el sello de la recompensa (sin repetir). Devuelve un progreso nuevo.
  function ganar(p, id) {
    const d = duelo(id); if (!d) throw new Error('Duelo desconocido: ' + id);
    const q = normalizar(JSON.parse(JSON.stringify(p)));
    if (!q.ganados.includes(id)) q.ganados.push(id);
    const r = d.recompensa || {};
    (r.figuras || []).forEach(k => { if (!q.figuras.includes(k)) q.figuras.push(k); });
    if (r.sello && !q.sellos.includes(r.sello)) q.sellos.push(r.sello);
    return q;
  }

  /* ---------- Equipo (se permiten repetidas) ---------- */
  function equipoValido(team, p) { return Array.isArray(team) && team.length === TAM_EQUIPO && team.every(k => p.figuras.includes(k)); }
  function equipoPorDefecto(p) {
    if (equipoValido(p.equipo, p)) return p.equipo.slice();
    if (!p.figuras.length) return [];
    return Array.from({ length: TAM_EQUIPO }, (_, i) => p.figuras[i % p.figuras.length]);
  }

  /* ---------- Exportar / importar (un código para copiar y pegar) ---------- */
  const PREFIJO = 'HT1.';
  function b64enc(s) { return typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64'); }
  function b64dec(s) { return typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8'); }
  function exportar(p) { return PREFIJO + b64enc(JSON.stringify(normalizar(p))); }
  function importar(code) {
    code = String(code || '').replace(/\s+/g, '');
    if (!code.startsWith(PREFIJO)) throw new Error('El código no empieza con ' + PREFIJO);
    let p; try { p = JSON.parse(b64dec(code.slice(PREFIJO.length))); } catch (e) { throw new Error('El código está incompleto o dañado'); }
    return normalizar(p);
  }

  /* ---------- Escenas y personajes ---------- */
  const conJugador = (t, p) => String(t || '').split('{jugador}').join(p ? p.jugador : 'Ari');
  function personaje(id) { return PERSONAJES[id] || { nombre: id, color: '#9ba6c9', expresiones: {} }; }
  // Archivo del retrato (o null: la interfaz muestra un círculo con la inicial)
  function retrato(id, expr) {
    const e = personaje(id).expresiones || {};
    const f = e[expr] || e.neutral;
    return f ? 'art/web/retratos/' + f + '.webp' : null;
  }
  // Escena lista para mostrar: líneas con nombre, color, retrato y lado
  function escena(id, d, p) {
    const e = ESCENAS[id]; if (!e) throw new Error('Escena desconocida: ' + id);
    const expr = (CAMPANA.expresiones || {})[id] || {};
    const cap = d ? capitulo(d.capitulo) : null;
    const fondo = (CAMPANA.fondos || {})[id] || (cap && cap.fondo) || null;
    const armar = l => {
      const per = personaje(l.quien);
      return {
        quien: l.quien, nombre: conJugador(l.nombre, p), color: per.color, narracion: !!per.narracion,
        retrato: per.narracion ? null : retrato(l.quien, expr[l.quien] || 'neutral'),
        lado: l.quien === 'jugador' ? 'izq' : 'der',
        texto: conJugador(l.texto, p), accion: conJugador(l.accion, p),
        opciones: l.opciones ? l.opciones.map(o => ({ texto: conJugador(o.texto, p), respuesta: armar(o.respuesta) })) : null
      };
    };
    return { id, titulo: conJugador(e.titulo, p), escenario: conJugador(e.escenario, p), fondo: fondo ? 'art/web/fondos/' + fondo + '.webp' : null, lineas: e.lineas.map(armar) };
  }

  // Duelo guiado (lección) con los textos del "Pasos guiados" del guion
  function guiado(id) {
    const g = GUIADOS[id]; if (!g) throw new Error('Duelo guiado desconocido: ' + id);
    const pasos = (ESCENAS[id + '-pasos'] || {}).pasos || [];
    const lesson = JSON.parse(JSON.stringify(g));
    lesson.steps.forEach(st => {
      const ps = pasos[st.paso - 1]; if (!ps) throw new Error(id + ': no existe el paso ' + st.paso + ' en el guion');
      st.text = ps.titulo + ': ' + ps.texto;
    });
    return lesson;
  }
  function configDuelo(d) { const c = D.DUELS[d.duelo]; if (!c) throw new Error('Falta data/duels/' + d.duelo + '.json'); return c; }

  const api = {
    KEY, TAM_EQUIPO, CAMPANA, ESCENAS, PERSONAJES, GUIADOS, DUELOS, duelo, capitulo,
    nuevo, normalizar, leer, guardar, estado, siguiente, ganar, equipoValido, equipoPorDefecto,
    exportar, importar, limpiarNombre, conJugador, personaje, retrato, escena, guiado, configDuelo
  };
  root.DuelCampana = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
