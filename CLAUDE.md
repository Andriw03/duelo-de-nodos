# Duelo de Nodos — contexto para Claude Code

Juego de estrategia por turnos para celular, contra la CPU. Es web (un HTML generado desde `src/`, publicado en GitHub Pages) y app Android con **Capacitor** (Fase 0 terminada). El objetivo es ampliarlo a juego completo con campaña, historia y lore siguiendo `ROADMAP.md` (una fase por sesión, con plan aprobado antes de tocar código).

- Repo: https://github.com/Andriw03/duelo-de-nodos
- Demo (GitHub Pages, se mantiene viva para que amigos la prueben): https://andriw03.github.io/duelo-de-nodos/
- Biblia de historia y niveles (campaña, lore, 14 duelos, jefes): https://claude.ai/artifact/SbGD4Vmu45sqBeSCWywnim
- Dueño: Andrés (Chile). Idioma de la UI, textos y comentarios: **español**.

## Estructura actual
- `src/logic.js`: reglas puras, sin DOM (patrón UMD: `(function(root){...})`, se usa con `require` en node y como global en el navegador).
- `src/ai.js`: IA de la CPU (niveles `facil`, `normal`, `dificil`).
- `src/ui.js`, `src/style.css`, `src/shell.html`: interfaz. `shell.html` tiene los marcadores `/*FONTS*/`, `/*CSS*/`, `/*LOGIC*/`, `/*AI*/`, `<!--CAPACITOR-->`, `/*PLATFORM*/`, `/*UI*/`.
- `src/platform.js`: **única capa que conoce Capacitor** (`window.Platform`): guardado con respaldo nativo, vibración, botón atrás, splash, minimizar. En la web cae a `localStorage` y no hace nada nuevo. `ui.js` solo habla con `Platform`, nunca con Capacitor.
- `src/fonts.css` + `src/fonts/`: Lilita One y Nunito (woff2, subconjunto latino, OFL). Nunito es variable (un archivo, pesos 200–1000).
- `build.py`: une `src/` en un HTML. **`index.html` es el build que publica GitHub Pages: no se edita a mano.**
  - `python3 build.py` → `index.html` con fuentes en base64 (archivo único, funciona sin conexión).
  - `python3 build.py --out www` → `www/index.html` + `www/fonts/` + `www/capacitor.js` (copiado de `@capacitor/core`, para registrar plugins sin bundler). Requiere `npm install`.
  - Lee y escribe UTF-8 con LF (el build sale igual en Windows y Linux).
- `android/`: proyecto nativo de Capacitor 8 (se versiona). Cambios propios: orientación vertical (`AndroidManifest.xml`), splash y fondo `#0e1322` (`styles.xml`, `colors_noche.xml`), `android.overridePathCheck=true` (`gradle.properties`, por la tilde en la ruta local).
- `capacitor.config.json`: appId, color de fondo, `SystemBars` (íconos claros, insets por CSS) y `SplashScreen`.
- `scripts/apk.js` (`npm run apk`): build de `www`, `cap sync` y `assembleDebug`; deja `dist/duelo-de-nodos-<versión>-debug.apk`. Busca solo un JDK 17+ (el de Android Studio si `JAVA_HOME` es viejo) y el SDK.
- `test/run.js`: simulaciones CPU vs CPU en node (`node test/run.js` o `npm test`). `test/tune.js`, `test/len2.js`: apoyo para afinar.
- No se versionan: `www/`, `dist/`, `node_modules/`, builds de Android.

## Reglas de trabajo (importante)
1. **No cambiar reglas del juego sin preguntar.** Las decisiones de abajo son deliberadas.
2. La lógica sigue siendo pura (sin DOM, sin `window`, sin Capacitor). Todo lo nativo vive en la capa de UI/plataforma.
3. Después de tocar `logic.js` o `ai.js`, correr `node test/run.js` y comparar con los números de referencia (ver "IA").
4. No romper la demo web: GitHub Pages sirve `index.html` desde la raíz. El build de Capacitor debe ser un paso aparte.
5. Todo original: criaturas, nombres y arte sin relación con Pokémon ni Nintendo. No introducir nombres, diseños ni sonidos de esa franquicia.
6. Sin frameworks ni TypeScript por ahora. Si la campaña lo justifica, proponerlo antes (Vite sería el siguiente paso razonable), no imponerlo.
7. Commits pequeños y en español, un tema por commit.

## Decisiones de diseño ya tomadas

### Tabla de prioridad del combate (propia, documentada en "Cómo jugar")
- Azul anula el combate contra cualquier color.
- Dorado > Morado > Blanco > Rojo.
- Mismo color: blanco/dorado gana el mayor daño; morado gana más estrellas; rojo vs rojo empata.
- Gana blanco o dorado: el rival va a la enfermería. Gana morado: el rival recibe el estado.

### Reglas que el diseño original dejaba abiertas
- **Meter** = colocar en una entrada libre, sin avanzar más (con avance extra la CPU ganaba en ~5 turnos).
- **Acción obligatoria:** no se puede pasar el turno a voluntad; hay que entrar, moverse o atacar. Atacar sin moverse está permitido siempre y no se puede cancelar una vez elegido. Después de moverse, atacar es opcional. Si ninguna figura puede moverse, el ataque es obligatorio; sin acciones posibles, el turno se pasa solo. (Se descartó exigir moverse si hay casillas libres: bloqueaba atacar a rivales adyacentes.)
- Veneno y parálisis duran 3 turnos del dueño; sueño 2; congelación 3. Sueño y congelación despiertan al ser atacados y cuentan como fallo al defender.
- Enfermería: 2 turnos del dueño. Un turno = la acción de un jugador (límite de 300 en total).
- Rodear: solo se revisan las figuras rivales del jugador que actúa.

### Tablero e interfaz
- 29 nodos, carril central directo entre metas (6 pasos), 2 entradas por bando junto a la meta.
- Ciclo de tipos (fijo en pantalla): Fuego › Planta › Tierra › Rayo › Agua › Fuego.
- Al tocar una figura, los rivales muestran ▲ (ventaja de la figura tocada) o ▼ (ventaja del rival).
- Estética: "mesa de noche", jugador turquesa, CPU rosa; fuentes Lilita One y Nunito. Layout de una columna, controles al alcance del pulgar.

### IA (valores de referencia con `node test/run.js`)
- Fácil: ruido alto y 25 % de jugadas al azar. Normal: agresiva. Difícil: más posicional.
- Normal gana ~82 % a Fácil; Difícil gana ~56 % a Normal; máx. ~30 ms por turno.
- Salida de referencia medida el 2026-11-09 (se repite igual en cada corrida; compararla línea por línea):
  - desvío en 1000 giros 2,73 pp
  - normal vs normal: J0 34 · J1 25 · empates 1 · por límite 10
  - dificil vs facil: J0 35 · J1 5 · por límite 0 · facil vs dificil: J0 4 · J1 36 · por límite 1
  - dificil vs normal: J0 26 · J1 13 · empates 1 · por límite 6 · normal vs dificil: J0 16 · J1 23 · empates 1 · por límite 7
  - máx. ~2–5 ms por turno en este PC.
- `run.js` no enfrenta Normal contra Fácil, así que el ~82 % no se mide hoy.

### App Android (Fase 0, decidido 2026-11-09)
- Capacitor 8.6 (core, cli, android) + plugins `app`, `haptics`, `preferences`, `splash-screen`, versiones fijas. Sin plugin de barra de estado: Capacitor 8 dibuja borde a borde y el fondo `#0e1322` del juego queda detrás de las barras.
- `appId` **provisorio** `cl.andres.nodostelar` (se puede cambiar hasta la primera publicación en Google Play). Versión 0.1.0 (`android/app/build.gradle` y `package.json`).
- Guardado: `localStorage` síncrono como siempre + copia en Preferences; al arrancar, `Platform.restore` recupera si el almacenamiento web se borró (probado borrando `app_webview` en el emulador).
- Botón atrás: cierra la ventana abierta; durante el combate no hace nada; en partida abre el Menú; en la elección de equipo manda la app a segundo plano (no la cierra).
- Vibración: toque suave al elegir figura, media al resolver un combate con ganador, éxito/error al terminar. Interruptor en el Menú, visible solo en la app.
- Zonas seguras: `--sat`/`--sab` en `:root` usan `--safe-area-inset-*` (inyectadas por Capacitor) con `env()` de respaldo para la web.
- Botones de los diálogos: máximo 3 por fila.
- APK de prueba firmado con la clave de depuración de **este PC**: las actualizaciones para amigos deben compilarse aquí, o tendrán que desinstalar (y pierden la partida).

### Campaña (decidida, aún sin implementar)
- Ambientación: **el Gran Telar del Tiempo**. Los nodos pasan a ser "cruces" del telar. Se descartaron "Red de Nodos" como mundo y el Cartógrafo como villano.
- Cinco épocas, una por arco y por linaje: Neolítico/Planta, Edad Antigua/Tierra, Edad Media/Rayo, Edad Moderna/Agua, Edad Contemporánea/Fuego.
- Villano: el Patrón (Orsolo Venn), dueño del Taller de Tarjetas (tarjetas perforadas tipo Jacquard); quiere automatizar el Telar y eliminar el azar.
- Campaña lineal de 14 duelos: un jefe por época y un final. Los jefes necesitan reglas de tablero nuevas (cruces marcados, cruces enlazados).

## Pendientes conocidos
- Partidas CPU vs CPU que llegan al límite de 300 turnos (bloqueo de entradas): se anotó ~8 %, pero la salida de referencia da 24 de 220 (~11 %) y ~16 % en los cruces Normal/Difícil. Revisar antes de ajustar la IA.
- **Re-giro del combate:** el resultado de las ruletas se aplica al tocar "Continuar". Si la app se cierra (o se recarga la web) mientras giran, al volver se puede atacar otra vez con otro sorteo. Arreglarlo toca el flujo del combate: preguntar antes.
- Ícono de la app y del splash: siguen los de Capacitor por defecto (Fase 6).
- Vibración sin probar en un teléfono real (el emulador no vibra).
- La prueba "±3 % en 1.000 giros" de `test/run.js` es estadísticamente frágil (falla por azar en ~60 % de las corridas completas aunque el sorteo es correcto). Con 100k giros el desvío es <0,4 pp: subir el tamaño de muestra o cambiar el criterio.
- Nombre definitivo del juego (hoy "Duelo de Nodos", que ya no encaja con el Telar).
- Confirmar que "›" del ciclo significa "vence a"; verificar datos históricos antes de ponerlos en la campaña.
- Antes de la Fase 3: exportar la biblia a `docs/biblia.md` (Claude Code no puede abrir el link del Doc).

## Entorno local (PC de Andrés, Windows 11)
- La ruta del proyecto tiene tilde (`Programación`): ver `overridePathCheck` arriba.
- `JAVA_HOME` apunta a JDK 1.8; Android usa el JDK 21 de Android Studio (`C:\Program Files\Android\Android Studio\jbr`). `npm run apk` lo resuelve solo; para `gradlew` a mano, fijar `JAVA_HOME` en ese comando, sin cambiar el del sistema.
- En Windows, `python3` es el acceso directo de la Microsoft Store y no funciona: usar `python`.
- `core.autocrlf=true`: el árbol de trabajo tiene CRLF; el repo, LF.
- Emulador disponible: `Medium_Phone_API_36.0`.

## Fase 0 (empaquetado): terminada 2026-11-11
Rama `capacitor-android` (subida a GitHub, sin fusionar en `main`). App probada en emulador: toque, splash, zonas seguras, atrás, rotación, segundo plano y partida guardada. APK de prueba con `npm run apk`.
Pendiente de Andrés: fusionar en `main` (la demo solo cambia en fuentes incluidas y el Menú en dos filas) y pasar el APK a los amigos.

## Siguiente: Fase 1 de `ROADMAP.md` (motor dirigido por datos)
Empezar con un plan aprobado. Criterio de salida: la partida normal se comporta igual (misma salida de `node test/run.js`).

## Después (no empezar sin pedirlo)
- Fases 2 a 7 de `ROADMAP.md`. Multijugador online (requiere servidor autoritativo; versión 2).
