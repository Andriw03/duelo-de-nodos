# Duelo de Nodos — contexto para Claude Code

Juego de estrategia por turnos para celular, contra la CPU. Es web (un HTML generado desde `src/`, publicado en GitHub Pages) y app Android con **Capacitor** (Fase 0 terminada, en pausa). El objetivo es ampliarlo a juego completo con campaña, historia y lore siguiendo `ROADMAP.md` (una fase por sesión, con plan aprobado antes de tocar código).

**El juego se completa y se prueba en la web** (decidido 2026-11-11): cualquiera lo abre con el link, sin instalar nada. Android se retoma en la publicación (Fase 7). Cada fase se verifica en el navegador; no hace falta compilar la app.

- Repo: https://github.com/Andriw03/duelo-de-nodos
- Demo (GitHub Pages, se mantiene viva para que amigos la prueben): https://andriw03.github.io/duelo-de-nodos/
- Biblia de historia y niveles (campaña, lore, 14 duelos, jefes): **`docs/biblia.md`** (copia del Doc https://claude.ai/artifact/SbGD4Vmu45sqBeSCWywnim, exportada por Andrés el 2026-11-11).
- Guion y diálogos de los 14 duelos, prólogo, interludios y epílogo: **`docs/guion.md`**. Los textos de la campaña salen de estos dos archivos; no inventar personajes, reglas ni fechas.
- Dueño: Andrés (Chile). Idioma de la UI, textos y comentarios: **español**.

## Estructura actual
- `src/logic.js`: reglas puras, sin DOM (patrón UMD: `(function(root){...})`, se usa con `require` en node y como global en el navegador). **El tablero sale siempre de la partida: `D.boardOf(s)`**; `D.BOARD` es solo el clásico, para código sin partida.
- `data/boards/*.json`: tableros (`nodes` con x/y, `edges`, `goals`, `entries`, `marked`, `links`). **El orden de `edges` define el orden de vecinos y con eso las decisiones de la IA**: no reordenar sin revisar `test/golden.js`. `compileBoard` valida (aristas, metas, entradas, conexión).
- `data/duels/*.json`: configuración de duelo (`board`, `player.team`/`rival.team` = `free`/`random`/lista fija, `ai`, `rules`, `victory` = `{type: 'goal', turnLimit}`). Hoy solo existe `libre` (la partida de siempre). `newGame(team0, team1, primero, duelo)`.
- `data/tutorial/*.json` + `src/tutorial.js` (`window.DuelTutorial`, sin DOM): lecciones como partidas reales con posición fija, pasos (`info`, `tap`, `act`), jugadas de la CPU en orden (`cpu`) y ruletas fijas (`spin`: índices de segmento; `outcome`/`winner` los comprueba el test). Figuras: las del jugador son 0, 1…, las de la CPU siguen la numeración. El modo guiado está en `ui.js` (`ui.guide`): bloquea toques fuera del paso, resalta, usa el guion de la CPU y las ruletas fijas, y **no guarda** (nunca pisa la partida guardada). Progreso en `Platform.storage`, clave `duelo-nodos-tutorial` (`hechas`, `ofrecido`).
- En el navegador los datos llegan como `window.DUEL_DATA` (marcador `/*DATA*/`, lo arma `build.py`); en node `logic.js` lee `data/` del disco.
- Campaña: `data/campaign/campana.json` (capítulos, 14 duelos, escenas antes/después/reintento, recompensas, fondos y expresiones por escena), `personajes.json` (id → nombre, color, expresiones → archivo de retrato), `guiados/duelo-1|2.json` (duelos guiados con el motor del tutorial; el texto de cada paso sale del "Pasos guiados" del guion con `paso: N`), `escenas.json` (**generado** por `scripts/guion-a-escenas.py` desde `docs/guion.md`: no editar a mano). Duelos jugables en `data/duels/c03.json`, `c04.json`.
- `src/campana.js` (`window.DuelCampana`, sin DOM): progreso en `Platform.storage` clave `duelo-nodos-campana` (`jugador`, `ganados`, `sellos`, `figuras`, `equipo`), desbloqueo lineal, recompensas, equipo de 6 **con repetidas** de las figuras desbloqueadas, código de exportación `HT1.` + base64, escenas con `{jugador}`. `src/campana-ui.js` (`window.DuelCampanaUI`): mapa (`#scr-camp`), diálogo (`#dialogo`), armado de equipo y menú exportar/importar/borrar. `ui.js` expone `DuelUI.api` y lanza los duelos (`startCampaignDuel`, `startCampaignGuided`); la partida guardada recuerda `campana` (id del duelo) para retomarla.
- `src/ai.js`: IA de la CPU (niveles `facil`, `normal`, `dificil`).
- `src/ui.js`, `src/style.css`, `src/shell.html`: interfaz. `shell.html` tiene los marcadores `/*FONTS*/`, `/*CSS*/`, `/*LOGIC*/`, `/*AI*/`, `<!--CAPACITOR-->`, `/*CONFIG*/`, `/*PLATFORM*/`, `/*UI*/`.
- `/*CONFIG*/` → `window.DUEL_CONFIG = {version, feedbackUrl}`: la versión sale de `package.json` (única fuente) y `feedbackUrl` de `src/config.json` (`{version}` dentro del link se reemplaza; solo `https://`; vacío = sin botón de comentarios).
- `src/platform.js`: **única capa que conoce Capacitor** (`window.Platform`): guardado con respaldo nativo, vibración, botón atrás, splash, minimizar. En la web cae a `localStorage` y no hace nada nuevo. `ui.js` solo habla con `Platform`, nunca con Capacitor.
- Arte de criaturas: `art/source/<id>.png|jpg` (fondo magenta, **no se versiona**) → `scripts/procesar-arte.py` (Pillow) → `art/web/<id>-token.webp` (128), `<id>-ficha.webp` (512, no va al HTML), `<id>-ficha-web.webp` (256) + `prueba-40.png` + `hoja.png` (ignorada) y `data/art.json`. `build.py` incrusta solo el token como `window.DUEL_ART` (marcador `/*ART*/`); la ficha-web va como ruta a `art/web/` y se descarga al abrir la ficha (si falla, se usa el token). `--out www` copia las fichas. Ni `logic.js` ni los tests leen `data/art.json`. En `ui.js`, `creatureImg(c, 'token'|'ficha')` y `<image>` en el tablero; si falta el arte o la imagen falla, vuelve el emoji.
- Íconos propios en SVG (`<symbol>` en `shell.html`): estados `st-poison`, `st-para`, `st-sleep`, `st-freeze` (reemplazan ☠ ϟ z ❄; el campo `icon` de `logic.js` ya no se usa en la interfaz) y tipos `ty-fuego`… `ty-agua`. Se usan con `icon(id)` en `ui.js`.
- Patrones de segmento (accesibilidad): rojo rayas, dorado puntos, morado cuadrícula, azul ondas, blanco liso; en el canvas (`segPattern`) y en las leyendas (`.sq.seg-<t>` en `style.css`).
- `src/fonts.css` + `src/fonts/`: Lilita One y Nunito (woff2, subconjunto latino, OFL). Nunito es variable (un archivo, pesos 200–1000).
- `build.py`: une `src/` en un HTML. **`index.html` es el build que publica GitHub Pages: no se edita a mano.**
  - `python3 build.py` → `index.html` con fuentes en base64 (archivo único, funciona sin conexión).
  - `python3 build.py --out www` → `www/index.html` + `www/fonts/` + `www/capacitor.js` (copiado de `@capacitor/core`, para registrar plugins sin bundler). Requiere `npm install`.
  - Lee y escribe UTF-8 con LF (el build sale igual en Windows y Linux).
- `android/`: proyecto nativo de Capacitor 8 (se versiona). Cambios propios: orientación vertical (`AndroidManifest.xml`), splash y fondo `#0e1322` (`styles.xml`, `colors_noche.xml`), `android.overridePathCheck=true` (`gradle.properties`, por la tilde en la ruta local).
- `capacitor.config.json`: appId, color de fondo, `SystemBars` (íconos claros, insets por CSS) y `SplashScreen`.
- `scripts/apk.js` (`npm run apk`): build de `www`, `cap sync` y `assembleDebug`; deja `dist/duelo-de-nodos-<versión>-debug.apk`. Busca solo un JDK 17+ (el de Android Studio si `JAVA_HOME` es viejo) y el SDK.
- `test/run.js`: simulaciones CPU vs CPU en node. `test/golden.js`: huella de cada jugada de esas 220 partidas (referencia en `test/golden-ref.json`). `test/reglas.js`: tableros, duelos, partida guardada antigua (`test/fixtures/partida-0.2.0.json`) y ganchos. `test/tutorial.js`: recorre las 5 lecciones con el motor. `test/campana.js`: campaña (10 pruebas). `test/criaturas.js`: plantilla de 25. `test/lib/recorrer.js`: recorrido de lecciones que comparten tutorial y campaña. `npm test` corre las seis. `test/tune.js`, `test/len2.js`, `test/sim-jefe.js` (equipo del jugador contra un duelo de campaña: `DUELO=c04 node test/sim-jefe.js 400`; variables `VARIANTES`, `RIVAL`, `IA`): apoyo para afinar.
- No se versionan: `www/`, `dist/`, `node_modules/`, builds de Android.

## Reglas de trabajo (importante)
1. **No cambiar reglas del juego sin preguntar.** Las decisiones de abajo son deliberadas.
2. La lógica sigue siendo pura (sin DOM, sin `window`, sin Capacitor). Todo lo nativo vive en la capa de UI/plataforma.
3. Después de tocar `logic.js`, `ai.js` o `data/`, correr `npm test`. Si la huella de `test/golden.js` cambia, el juego cambió: solo se acepta (`--update`) si el cambio es deliberado y aprobado.
4. No romper la demo web: GitHub Pages sirve `index.html` desde la raíz de `main`. `main` siempre jugable: se trabaja en ramas y se fusiona cuando está probado. El build de Capacitor es un paso aparte.
8. Juego, datos, diálogos y arte de criaturas van en el HTML único de la web, sin servidor. **Excepción (Fase 3, aprobada):** retratos y fondos de escenas son archivos en `art/web/retratos|fondos/` que se cargan al mostrarse (Pages los sirve, `build.py --out www` los copia a la app); si faltan, círculo con inicial y fondo liso. **Excepción (plantilla de 25, aprobada 2026-11-13):** la ficha de criatura (256 px) también es archivo (`art/web/<id>-ficha-web.webp`); en el HTML solo va el token, que se usa si la ficha no carga. Guardar progreso siempre vía `Platform.storage`, para que la app lo herede. `build.py` mide el HTML comprimido (gzip, lo que sirve Pages): tope 450 KB.
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
- Salida de referencia medida el 2026-11-09 con 12 criaturas (con 25, ver "Plantilla de 25"; se repite igual en cada corrida; compararla línea por línea):
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
- Decisiones de Andrés anotadas en `docs/biblia.md` (2026-11-11):
  - Nombre del juego: **Hilos del Tiempo**. Aplicado (0.7.0) en `<title>`, pantalla de inicio y README. Siguen con el nombre viejo: repositorio, URL de Pages, claves de guardado `duelo-nodos-*` (no cambiarlas: se perderían partidas), `capacitor.config.json`, `package.json` y appId (Fase 7).
  - "›" del ciclo significa "vence a" (confirmado).
  - Datos históricos de la biblia: verificados por Andrés.
  - Protagonista: **nombre elegible** (el guion usa `Ari` y deja `{jugador}` listo).
  - **Final único**: la sección "Variantes del epílogo" de `docs/guion.md` queda descartada.
- Reglas de jefe definidas en la biblia (sección "Jefes") y en el guion (cada jefe explica la suya): Hebras enredadas, Pesas, Pedales, Lanzadera, Caldera y Tarjetas perforadas. Se implementan sobre los ganchos de `logic.js` en las Fases 4 y 5, con aprobación (cambian el juego).

## Pendientes conocidos
- Partidas CPU vs CPU que llegan al límite de 300 turnos (bloqueo de entradas): se anotó ~8 %, pero la salida de referencia da 24 de 220 (~11 %) y ~16 % en los cruces Normal/Difícil. Revisar antes de ajustar la IA.
- **Re-giro del combate:** el resultado de las ruletas se aplica al tocar "Continuar". Si la app se cierra (o se recarga la web) mientras giran, al volver se puede atacar otra vez con otro sorteo. Arreglarlo toca el flujo del combate: preguntar antes.
- Ícono de la app y del splash: siguen los de Capacitor por defecto (Fase 6).
- Vibración sin probar en un teléfono real (el emulador no vibra).
- Formulario de comentarios sin la versión del juego: si Andrés agrega una pregunta "Versión", poner en `src/config.json` el link "rellenado previamente" con `{version}`.
- Sira (duelo 3, Fácil) se gana ~96 % con el equipo inicial (IA Normal de jugador): intencional por ahora, revisar con testers.
- Vocabulario del mundo frente al de la interfaz: el guion dice "rodillo" (meta), "lizo" (entrada), "calada" (carril central), "remiendo" (enfermería), "cruce" (nodo); la UI y el tutorial dicen META, entrada y enfermería. Decidir si la interfaz adopta el vocabulario del telar.
- El guion trata a Ari en masculino ("hijo", "forastero", "sorprendido") y la biblia decide nombre elegible: si el jugador también elige cómo se le trata, hay que neutralizar o variar esas líneas.
- Los duelos 1 y 2 del guion son tutoriales guiados con Maru y Teo; ya existe el tutorial genérico de la Fase 2. Decidir en la Fase 3 si se reemplaza, se reutiliza su motor con los textos del guion o conviven.
- Posibles erratas en `docs/guion.md` (sin corregir; decide Andrés): "debi" (l. 32), "lizó" (l. 52), "Enseñame" (l. 209), "Lévalo" (l. 321), "Yo también eso digo" (l. 364), "en la fría" (l. 444), "huyí" (l. 458); y en la l. 500 "Si ganas, decide el hilo. Si pierdo, decide la tarjeta" dice lo mismo dos veces (¿"Si gano, decide la tarjeta"?).

## Entorno local (PC de Andrés, Windows 11)
- La ruta del proyecto tiene tilde (`Programación`): ver `overridePathCheck` arriba.
- `JAVA_HOME` apunta a JDK 1.8; Android usa el JDK 21 de Android Studio (`C:\Program Files\Android\Android Studio\jbr`). `npm run apk` lo resuelve solo; para `gradlew` a mano, fijar `JAVA_HOME` en ese comando, sin cambiar el del sistema.
- En Windows, `python3` es el acceso directo de la Microsoft Store y no funciona: usar `python`.
- `core.autocrlf=true`: el árbol de trabajo tiene CRLF; el repo, LF.
- Emulador disponible: `Medium_Phone_API_36.0`.

## Fase 0 (empaquetado Android): terminada 2026-11-11, en pausa
Rama `capacitor-android` (en GitHub). App probada en emulador: toque, splash, zonas seguras, atrás, rotación, segundo plano y partida guardada. APK de prueba con `npm run apk`.

## Fase 0b (web para testers): en curso, rama `web-testers`
- Hecho: `capacitor-android` fusionada en `main` y publicada (2026-11-11). Versión visible 0.2.0 (pantalla de equipo y Menú). Botón "Enviar comentarios" (pantalla de equipo y Menú), oculto mientras `feedbackUrl` esté vacío.
- Probado: navegador de computador, teléfono simulado 375×812 y Chrome 133 real en el emulador (toques, partida, guardado al cerrar y reabrir; sin errores en consola).
- PWA (instalable y sin conexión): descartada por ahora; se retoma si los testers lo piden.
- Falta: prueba en Safari de iPhone (alguien con iPhone), fusionar `web-testers` en `main` y que 2–3 personas jueguen desde el link.
- Lista para probar en iPhone: abrir el link en Safari; que se vean las fuentes redondeadas; elegir equipo y jugar 3–4 turnos tocando; que nada quede bajo el notch ni la barra inferior; abrir Menú, Historial y "Cómo jugar"; cerrar Safari, reabrir el link y usar "Continuar partida guardada".
- Probar Chrome en el emulador: `adb reverse tcp:8765 tcp:8765` y abrir `http://localhost:8765/` (por `10.0.2.2` la descarga se cortaba a medias). Para saltar la bienvenida de Chrome sin aceptar nada: archivo `/data/local/tmp/chrome-command-line` con `_ --disable-fre --no-first-run` + `am set-debug-app --persistent com.android.chrome` (deshacer al terminar).

## Fase 1 (motor dirigido por datos): terminada 2026-11-11, rama `fase1-datos`
- Tablero clásico en `data/boards/clasico.json` (generado desde el código anterior, mismo orden de vecinos) y duelo `libre` en `data/duels/libre.json`.
- La partida guarda `boardId`, `rules`, `turnLimit` y `duelId`. Partidas guardadas sin esos campos (≤ 0.2.0) se tratan como clásico, sin reglas y 300 turnos.
- Ganchos para reglas de jefe en `logic.js` (`registerRule`): `neighbors`, `afterLand`, `endTurn`, `wheel` y (Fase 4) `afterAttack`. Estado de las reglas en `s.ruleState` (lo copia `clone`; viaja en la partida guardada). Regla real: `hebras` (Fase 4). Los tableros ya aceptan `marked` y `links` como datos.
- Condición de victoria: solo `goal` (llegar a la meta) con `turnLimit`; otro tipo falla al crear la partida.
- Verificado: huella idéntica en las 5 series, `run.js` igual a la referencia, 13 pruebas de `reglas.js`, web y `www/` sin errores, partida 0.2.0 recuperada con "Continuar".
- Sin cambios visibles para el jugador. Publicar en `main` cuando Andrés lo pida (subir la versión).

## Fase 2 (tutorial): terminada 2026-11-11, rama `fase2-tutorial`, publicada como 0.3.0
- 5 lecciones: entrar y moverse, atacar (blanco › rojo y azul anula), tipos (▲/▼ y +10), estados y enfermería, cómo ganar. Textos escritos por Claude a partir de las reglas: Andrés debe revisarlos.
- Se ofrece una vez al abrir el juego sin partida guardada; se repite desde "Cómo jugar" → "Tutorial" (no durante el turno de la CPU). "Salir" siempre visible (no durante animaciones).
- Verificado: `npm test` (huella intacta y 5 lecciones), las 5 jugadas en el navegador con clics, toque equivocado bloqueado, salir a mitad sin tocar la partida guardada, teléfono 375 px sin scroll horizontal.
- Falta (Andrés): probar con 2–3 personas que no conozcan el juego y anotar dónde se traban.

## Arte de criaturas e íconos: terminado 2026-11-11, rama `arte-criaturas`, publicado como 0.4.0
- 12 criaturas procesadas (3 venían en JPG: `magmuz`, `tejonrock`, `tizonaje`; recortan bien). Recorte por color conectado al borde + huecos casi idénticos al fondo; la flor de Erizarza se conserva.
- Peso del HTML: 183 KB → 575 KB (arte 287 KB en WebP, 384 KB en base64). Ficha web a 256 px y calidad 74 para quedar bajo el tope de 600 KB.
- Verificado: `npm test` idéntico; en el navegador a 375 px sin scroll horizontal; figuras de 38×38 px en el tablero (prueba de 40 px); íconos de estado en tablero y ficha; patrones distinguibles en escala de grises; respaldo con emoji si una imagen falla.
- Pendiente (Andrés): revisar `art/web/prueba-40.png` y `hoja.png`. Los retratos (`ari-*.png`) van en `art/retratos/`, no en `art/source/` (el script los ignora con aviso).

## Fase 3 (estructura de campaña): terminada 2026-11-11, rama `fase3-campana`, publicada como 0.5.0
- Jugable: prólogo y Arco 1 (duelos 1 a 4) con escenas, retratos, fondos, elecciones, recompensas y Sello de Lino. Duelos 5 a 14 en el mapa como "Próximamente" (sus escenas ya están convertidas).
- Decisiones (aprobadas): arte de escenas como archivos aparte; equipos de campaña con repetidas; duelos 1 y 2 guiados con el motor del tutorial y los textos del guion.
- Propuesto por Claude, **revisar**: equipos rivales de Sira y Madre Lino (`c03`, `c04`), la "figura de reserva" de Teo (Zumbiza), colores de acento de personajes y qué expresión usa cada uno por escena (`campana.json` → `expresiones`).
- El duelo 4 se juega **sin** "Hebras enredadas" (aviso antes del duelo): la regla es de la Fase 4.
- Peso: HTML 575 → 666 KB sin comprimir; **380 → 405 KB comprimido** (lo que se descarga). Retratos (20, 757 KB) y fondos (3, 336 KB) se bajan por escena.
- Fondos de 852 px de ancho (menos de los 1080 pedidos): no se agrandan.
- Verificado: `npm test` (lo anterior idéntico + 8 de campaña); en el navegador los 4 duelos de punta a punta, derrota con reintento, retomar un duelo tras recargar, exportar/importar/borrar, respaldo con inicial; capturas en Chrome del emulador.

## Plantilla de 25 criaturas: 2026-11-13, rama `criaturas-25`, publicada como 0.6.0
- 13 nuevas (diseño aprobado por Andrés): Brasapo, Lanaflama (Fuego); Picobuzo, Velaguja (Agua); Cestacol, Hormihoja, Cascoriza (Planta); Capiganso, Pinzánfora, Columnero (Tierra); Crestrayo, Campanala, Jabatrueno (Rayo). Cada tipo: 2 comunes, 2 raras, 1 épica (total 10/10/5).
- Efectos de dorado nuevos (aprobados): `remiendo` (Cascoriza: la figura propia con más turnos de enfermería vuelve a la banca) y `embestida` (Columnero: la ganadora pasa al cruce que deja la perdedora, nunca a una meta; llama al gancho `afterLand`). En la interfaz la figura aparece en el cruce nuevo sin animación.
- Reglas de diseño que comprueba `test/criaturas.js`: suma 96, 4–6 segmentos, daño ≤ 120, el Fallo nunca pesa más que el segmento más pesado (si no, la parálisis no le hace nada), efectos solo en raras/épicas con peso 8–12, 5 por tipo con al menos un mp 1 y un mp 3, y que los equipos al azar usan las 25.
- Balance medido (2.400 partidas Normal vs Normal, equipos al azar): los equipos con cada criatura nueva ganan entre 45 y 54 %; las 12 de antes, entre 45 y 57 %. Difícil vs Normal (500 partidas): Difícil gana el 60 % de las decididas (antes 52 %). Partidas por límite: ~8 % en Normal vs Normal, ~13 % en los cruces Normal/Difícil (antes ~10 %): vigilar.
- La huella de `test/golden.js` cambió a propósito (más criaturas en los equipos al azar). `test/run.js` ahora gira 100.000 veces por ruleta (desvío máx. 0,36 pp; antes fallaba por azar).
- Salida de referencia nueva de `node test/run.js`: normal vs normal J0 28 · J1 31 · empates 1 · por límite 1; dificil vs facil J0 38 · J1 1 · empates 1 · por límite 1; facil vs dificil J0 5 · J1 35 · por límite 0; dificil vs normal J0 18 · J1 21 · empates 1 · por límite 2; normal vs dificil J0 16 · J1 23 · empates 1 · por límite 2.
- Peso: HTML 412 → 207 KB comprimido con las 12 artes actuales (la ficha salió del HTML). Cada token nuevo suma ~10 KB.
- Arte de las 13 y recompensas del Arco 1: hechos en 0.7.0 (ver abajo). Falta repartir las de Tierra, Rayo y Agua en los arcos 2 a 5.

## Arco 1 para testers + Fase 4 (Madre Lino): 2026-11-13, rama `arco1-testers`, publicada como 0.7.0
- **Arte:** las 25 procesadas; `data/art.json` con todas. HTML: 206 → 303 KB comprimido (tope 450). A 40 px, Cascoriza y Hormihoja se ven delgadas pero se reconocen.
- **Recompensas** (aprobadas): d01 Fuego ×5 (suma Brasapo y Lanaflama); d03 las 4 de Planta (Erizarza, Musgoso, Cestacol, Hormihoja; ninguna otra época da Planta); d04 Sello de Lino + Cascoriza (la biblia pone las figuras de linaje en el rival previo al jefe: es una extensión, no un choque). `normalizar` entrega a progresos viejos lo que se sumó a duelos ya ganados.
- **Sira (c03, Fácil):** Erizarza, Cestacol, Musgoso, Hormihoja, Erizarza, Cestacol.
- **Hebras enredadas** (interpretación aprobada): llegar a un cruce marcado (entrar, moverse o embestida) enreda; en el siguiente turno de su dueño no se mueve, sí ataca; quedarse no re-enreda; afecta a los dos bandos; una figura de Fuego que ataca desde un cruce vecino quema esa marca para todo el duelo (gane o pierda) y suelta a la enredada. Cruces 8, 12, 16, 20. Se apaga con `"rules": []` en `data/duels/c04.json`.
- **Madre Lino (c04, Normal):** Hormihoja ×3, Erizarza ×2, Cascoriza (decidido por simulación). Con IA Normal de jugador, 400 partidas: gana 70 % con 5 Fuego + Zumbiza, 61 % mixto, 35 % sin Fuego. Con Planta lenta (mp 9 contra 14) el Fuego ganaba ~85 %. La regla casi no cambia el % (la IA la sortea): su peso es de decisión para una persona.
- **Interfaz:** nudo (`#mk-knot`, color `--knot`) en cada marca activa, insignia en la figura enredada, aviso en la ficha y al tocarla, textos de la regla en el historial y en el mensaje; aviso antes del duelo con la regla y la contramedida.
- **Carga:** precarga de retratos y fondos (próximo duelo desde el mapa, tramo completo de escenas, escenas de después al empezar un duelo). Con 3G simulado (50 KB/s, 300 ms) el HTML tarda ~6,3 s, la pantalla se ve a ~1,5 s y el juego queda listo 9 ms después de llegar; mientras tanto `body.cargando` atenúa los botones y dice "Cargando criaturas…".
- **Formulario** en `src/config.json` (botón "Enviar comentarios" visible). **Nombre** Hilos del Tiempo aplicado.
- Verificado: `npm test` (huella idéntica, 17 de reglas, 10 de campaña, 9 de criaturas), `run.js` igual a la referencia; en el navegador a 375 px: duelo 4 con nudos, enredo, aviso, partida guardada con la figura enredada, recompensa de d01, progreso viejo con figuras nuevas, sin errores en consola.

## Siguiente
Testers del Arco 1 (link, iPhone). Después, Fase 5 de `ROADMAP.md`.

## Después (no empezar sin pedirlo)
- Fases 2 a 7 de `ROADMAP.md`. Multijugador online (requiere servidor autoritativo; versión 2).
