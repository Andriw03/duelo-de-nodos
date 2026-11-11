# Duelo de Nodos

Juego de estrategia por turnos para celular, contra la CPU. Tablero de 29 nodos, 12 criaturas originales, ruletas de combate y 3 niveles de dificultad. Funciona como página web (un solo archivo HTML, sin conexión: las fuentes Lilita One y Nunito, licencia OFL, van incluidas) y como app de Android con Capacitor.

**Jugar en el navegador:** https://andriw03.github.io/duelo-de-nodos/

## Estructura
- `index.html`: build de la web. Es lo que publica GitHub Pages: **no se edita a mano**.
- `src/logic.js`: reglas puras, sin DOM. `src/ai.js`: IA de la CPU.
- `data/boards/*.json`: tableros (cruces, caminos, metas, entradas). `data/duels/*.json`: configuraciones de duelo (tablero, equipos, IA, reglas especiales, victoria). `build.py` los incrusta en el HTML.
- `src/ui.js`, `src/style.css`, `src/shell.html`: interfaz. `src/fonts.css` y `src/fonts/`: fuentes.
- `src/platform.js`: única capa que conoce Capacitor (guardado nativo, vibración, botón atrás, splash). En la web no hace nada nuevo.
- `build.py`: une `src/` en un HTML.
- `android/`: proyecto nativo generado por Capacitor (se versiona). `capacitor.config.json`: configuración de la app.
- `test/`: simulaciones CPU contra CPU en node.
- `scripts/apk.js`: genera el APK de prueba.

## Web
```bash
python3 build.py        # index.html con las fuentes incrustadas (en Windows: python build.py)
npm test                # las tres pruebas de abajo; correr después de tocar logic.js, ai.js o data/
```
- `node test/run.js`: simulaciones CPU contra CPU (resultados por nivel).
- `node test/golden.js`: huella de cada jugada de esas partidas; detecta cualquier cambio de comportamiento. `--update` solo si el cambio de juego es deliberado.
- `node test/reglas.js`: tableros, configuración de duelo, partidas guardadas antiguas y ganchos para reglas de jefe.

Se publica fusionando en `main`: GitHub Pages sirve `index.html` (puede tardar unos 10 minutos en verse por la caché).

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
npm test                # run.js + golden.js + reglas.js
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
