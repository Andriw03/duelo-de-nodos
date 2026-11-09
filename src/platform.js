/* ===================== PLATAFORMA (web / app nativa) =====================
   Única capa que conoce Capacitor. En la web (GitHub Pages) no existe window.Capacitor
   y todo cae en el comportamiento de siempre: localStorage y sin vibración.
   En la app, build.py --out www agrega capacitor.js (de @capacitor/core) antes de este archivo. */
(function () {
  'use strict';
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.registerPlugin);
  const plug = name => (native && Cap.isPluginAvailable(name)) ? Cap.registerPlugin(name) : null;
  const App = plug('App'), Haptics = plug('Haptics'), Prefs = plug('Preferences'), Splash = plug('SplashScreen');
  const ignore = () => {};
  const VIBRA_KEY = 'duelo-nodos-vibra';

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }
  };

  /* Guardado: lectura y escritura síncronas en localStorage (lo que la UI ya usaba) y, en la app,
     copia en Preferences (almacenamiento nativo), que el sistema no borra como puede pasar con el
     almacenamiento web. Al arrancar, restore() recupera desde Preferences lo que falte. */
  const storage = {
    get: ls.get,
    set(k, v) { ls.set(k, v); if (Prefs) Prefs.set({ key: k, value: v }).catch(ignore); },
    del(k) { ls.del(k); if (Prefs) Prefs.remove({ key: k }).catch(ignore); }
  };
  function restore(keys) {
    if (!Prefs) return Promise.resolve();
    const work = Promise.all(keys.map(k => Prefs.get({ key: k }).then(r => {
      const local = ls.get(k);
      if (local === null && r && r.value != null) ls.set(k, r.value);        // web borrado: recuperar
      else if (local !== null && (!r || r.value !== local)) Prefs.set({ key: k, value: local }).catch(ignore); // primera vez: respaldar
    }).catch(ignore)));
    return Promise.race([work, new Promise(r => setTimeout(r, 1500))]);     // nunca bloquear el arranque
  }

  /* Vibración: solo en la app y si el jugador no la desactivó. */
  let vibra = ls.get(VIBRA_KEY) !== '0';
  function haptic(kind) {
    if (!Haptics || !vibra) return;
    const p = kind === 'win' ? Haptics.notification({ type: 'SUCCESS' })
      : kind === 'lose' ? Haptics.notification({ type: 'ERROR' })
      : Haptics.impact({ style: kind === 'hit' ? 'MEDIUM' : 'LIGHT' });
    p.catch(ignore);
  }

  window.Platform = {
    native,
    canVibrate: !!Haptics,
    storage,
    restore,
    haptic,
    get vibra() { return vibra; },
    setVibra(v) { vibra = !!v; ls.set(VIBRA_KEY, vibra ? '1' : '0'); if (vibra) haptic('tap'); },
    /* Botón "atrás" de Android. Al registrarlo, Capacitor deja de cerrar la app por su cuenta. */
    onBack(fn) { if (App) App.addListener('backButton', fn); },
    /* Mandar la app a segundo plano (como el botón de inicio) en vez de cerrarla. */
    minimize() { if (App) App.minimizeApp().catch(ignore); },
    hideSplash() { if (Splash) Splash.hide().catch(ignore); }
  };
})();
