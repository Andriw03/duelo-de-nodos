# Hilos del Tiempo

(Antes «Duelo de Nodos»: el repositorio, la dirección de la web y la app de Android conservan ese nombre por ahora.)

Juego de estrategia por turnos para celular, contra la CPU, con una campaña en el Gran Telar del Tiempo. Tablero de 29 nodos, 25 criaturas originales, ruletas de combate y 3 niveles de dificultad. Funciona como página web (un solo archivo HTML, sin conexión: las fuentes Lilita One y Nunito, licencia OFL, van incluidas) y como app de Android con Capacitor.

**Jugar en el navegador:** https://andriw03.github.io/duelo-de-nodos/

## Estructura
- `index.html`: build de la web. Es lo que publica GitHub Pages: **no se edita a mano**.
- `src/logic.js`: reglas puras, sin DOM. `src/ai.js`: IA de la CPU.
- `data/boards/*.json`: tableros (cruces, caminos, metas, entradas). `data/duels/*.json`: configuraciones de duelo (tablero, equipos, IA, reglas especiales, victoria). `data/tutorial/*.json`: lecciones del tutorial (posición inicial, pasos, jugadas de la CPU y ruletas fijas). `build.py` incrusta todo `data/` en el HTML.
- `src/tutorial.js`: motor de pasos del tutorial, sin DOM (el modo guiado de la interfaz vive en `src/ui.js`).
- `src/ui.js`, `src/style.css`, `src/shell.html`: interfaz. `src/fonts.css` y `src/fonts/`: fuentes.
- `src/platform.js`: única capa que conoce Capacitor (guardado nativo, vibración, botón atrás, splash). En la web no hace nada nuevo.
- `build.py`: une `src/` en un HTML.
- `android/`: proyecto nativo generado por Capacitor (se versiona). `capacitor.config.json`: configuración de la app.
- `test/`: simulaciones CPU contra CPU en node.
- `scripts/apk.js`: genera el APK de prueba.
- `data/campaign/`: campaña (`campana.json` capítulos y duelos, `personajes.json`, `guiados/` duelos guiados, `escenas.json` generado desde `docs/guion.md`). `src/campana.js` (lógica, sin DOM) y `src/campana-ui.js` (mapa, diálogo, equipo).
- `scripts/guion-a-escenas.py`: convierte `docs/guion.md` en `data/campaign/escenas.json`.
- `scripts/procesar-arte.py`: procesa el arte de las criaturas, retratos y fondos (ver abajo). `art/web/`: arte listo para el juego. `data/art.json`: qué archivo usa cada criatura.

## Web
```bash
python3 build.py        # index.html con las fuentes incrustadas (en Windows: python build.py)
npm test                # las pruebas de abajo; correr después de tocar logic.js, ai.js o data/
```
- `node test/run.js`: simulaciones CPU contra CPU (resultados por nivel).
- `node test/golden.js`: huella de cada jugada de esas partidas; detecta cualquier cambio de comportamiento. `--update` solo si el cambio de juego es deliberado.
- `node test/reglas.js`: tableros, configuración de duelo, partidas guardadas antiguas y ganchos para reglas de jefe.
- `node test/tutorial.js`: recorre las 5 lecciones con el motor; falla si una jugada del guion es ilegal o una lección no se puede terminar.
- `node test/campana.js`: escenas del guion completas, personajes, retratos y fondos existentes, duelos jugables, duelos guiados, progreso y código de exportación.

Se publica fusionando en `main`: GitHub Pages sirve `index.html` (puede tardar unos 10 minutos en verse por la caché).

### Arte de las criaturas
1. Guardar cada criatura en `art/source/<id>.png` (o `.jpg`), con fondo magenta `#FF00FF` plano; `id` es el de `src/logic.js` (por ejemplo `tejonrock`). `art/source/` no se sube al repo: guarda una copia aparte.
2. Procesar (solo necesita Pillow):
```bash
python scripts/procesar-arte.py
```
   Quita el fondo, recorta y genera en `art/web/` el token (128 px), la ficha (512 px) y la ficha web (256 px) en WebP, más `prueba-40.png` (las criaturas a 40 px, como se ven en el tablero) y `hoja.png` (para revisar bordes y estilo). Escribe `data/art.json` e informa el peso de cada archivo.
3. `python build.py`: incrusta el token y la ficha web en el HTML e informa el peso (tope 600 KB). Si una criatura no tiene arte, se ve su emoji.

### Retratos, fondos y diálogos de la campaña
- Retratos en `art/retratos/<personaje>-<expresion>.png` (fondo magenta) y fondos en `art/fondos/<id>.png`; ninguna de las dos carpetas se sube al repo.
```bash
python scripts/procesar-arte.py retratos fondos
```
  Genera `art/web/retratos/*.webp` (lado mayor 512 px, sin fondo) y `art/web/fondos/*.webp` (hasta 1080 px de ancho, sin agrandar). **No van dentro del HTML**: el juego los carga como archivos (si faltan, círculo con la inicial y fondo liso). `personajes.json` dice qué archivo usa cada expresión.
- Diálogos: se escriben en `docs/guion.md` y se convierten con
```bash
python scripts/guion-a-escenas.py
```
  (avisa de cualquier línea que no entienda; "Ari" pasa a ser el nombre que elige el jugador).

### Versión y comentarios
- La versión visible en el juego (pantalla de equipo y menú) sale de `"version"` en `package.json`. Subirla en cada publicación.
- El botón "Enviar comentarios" aparece solo si `src/config.json` tiene `feedbackUrl` (un link `https://`, por ejemplo el "enlace rellenado previamente" de Google Forms). Dentro del link, `{version}` se reemplaza por la versión del juego.

## App Android
Requisitos: Node 22+, Python 3 y Android Studio (trae el JDK 21 y el SDK de Android). Una vez:
```bash
npm install
```

Generar el APK de prueba (build de `www/`, `cap sync` y compilación):
```bash
npm run apk             # deja dist/duelo-de-nodos-<versión>-debug.apk
```
`npm run apk` usa el JDK de Android Studio si `JAVA_HOME` apunta a uno anterior al 17, y busca el SDK en la ruta por defecto si no está definido `ANDROID_HOME`.

Otros comandos:
```bash
npm run sync            # build de www/ + npx cap sync android (después de cambiar src/)
npm run android         # abre el proyecto en Android Studio (para correr en emulador o depurar)
npm test                # run.js + golden.js + reglas.js + tutorial.js + campana.js
```

`www/`, `dist/`, `node_modules/` y las carpetas de build de Android no se versionan.

### Instalar el APK en un teléfono
1. Pasar el `.apk` al teléfono (cable, Drive, mensaje).
2. Abrirlo y permitir "instalar apps desconocidas" para la app desde la que se abre.
3. Las actualizaciones se instalan encima sin perder la partida, siempre que el APK se haya compilado en el mismo PC (va firmado con la clave de depuración de ese equipo).

Notas:
- `appId`: `cl.andres.nodostelar` (provisorio; se fija definitivamente al publicar en Google Play).
- Si la ruta del proyecto tiene tildes (por ejemplo `Programación`), Gradle la rechaza en Windows; `android/gradle.properties` lleva `android.overridePathCheck=true` para permitirla.

Criaturas, nombres y arte originales. Sin relación con Pokémon ni Nintendo.
