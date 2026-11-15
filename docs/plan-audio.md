# Hilos del Tiempo — Plan de audio (Fase 6a, adelantada)

Estado: diseño aprobado por Andrés el 2026-11-15. Falta que Claude Code presente su plan de archivos y riesgos y Andrés lo apruebe **antes de tocar código** (regla de una fase por sesión).

Este plan adelanta la parte de sonido de la Fase 6 de `ROADMAP.md`. Al terminar, actualizar `CLAUDE.md` (estructura, decisiones, pendientes) y marcar en `ROADMAP.md` que el sonido ya está hecho.

## 1. Objetivo

1. Una pantalla de entrada con nubes ("Toca para comenzar") que desbloquea el audio con un gesto del usuario y da paso a la portada actual con música y sonido.
2. Un motor de audio propio, sin dependencias, con efectos sintetizados y música.
3. Controles de sonido en el Menú y en la portada, con persistencia.
4. Dejar listo el sistema para sumar música de archivo (Fase B) sin tocar el resto del código.

Fuera de alcance: cambiar reglas del juego, `logic.js`, `ai.js` o `data/`. La huella de `test/golden.js` debe quedar idéntica.

## 2. Decisiones ya tomadas (Andrés, 2026-11-15)

| Tema | Decisión |
|---|---|
| Frecuencia de la pantalla de entrada | En cada carga fría de la página. Se omite si el jugador dejó **música y efectos desactivados** (guardado). |
| Texto del botón | "Toca para comenzar". |
| Entrar sin audio | Enlace pequeño "Sin sonido" bajo el botón. Entra sin audio y **guarda** música y efectos como desactivados (propuesta: confirmar con Andrés al aprobar el plan). Se reactivan desde el Menú. |
| Look de las nubes | Azul noche con luz tenue, coherente con "mesa de noche" y el fondo `#0e1322`. |
| Sonido por defecto | Activado, volumen moderado. |
| Archivos de audio (excepción a la regla 8) | Aprobada: archivos aparte en `art/web/audio/`, cargados al usarse. Tope **1,5 MB en total** para esta fase. El HTML sigue con tope de 450 KB comprimido. |
| Intro | Pasa a empezar **después** del toque. Ese toque no cuenta como "saltar intro". |
| Música | Andrés aún no tiene fuente. Mientras tanto, música **generativa por código** (Fase A). La música de archivo es la Fase B. |

## 3. Reparto del trabajo

### Claude Code
- Pantalla de entrada con nubes (HTML/CSS/SVG, sin imágenes).
- `src/audio.js`: motor, efectos sintetizados, música generativa, mezcla, persistencia, pausa en segundo plano.
- Interruptores en el Menú y botón de altavoz en la portada.
- Integración con los eventos de `ui.js` y `campana-ui.js`.
- `tools/sonidos.html` (banco de sonidos para escuchar y ajustar).
- Cambios en `build.py`, tests nuevos y `docs/creditos.md`.
- Verificación en el navegador: estado del `AudioContext`, errores de consola, red, layout a 375×812 y 375×667.

### Andrés
- **Escuchar y aprobar** los sonidos en `tools/sonidos.html` (Claude Code no puede oír; esto no se delega).
- Probar en un iPhone real (desbloqueo con el toque, interruptor de silencio, volver de segundo plano).
- Fase B: conseguir la música, verificar su licencia y entregar los archivos con la prueba de licencia.
- Aprobar este plan y, después, los volúmenes por defecto.

## 4. Fase A — Entrada, motor, efectos y música generativa

Claude Code debe **leer el código real** antes de planificar (no se escribió este plan viendo `ui.js`): el guion al inicio de `shell.html`, `showHome()`, `Platform.storage`, cómo se arma el Menú, `startCampaignDuel` y dónde se abre `#dialogo`.

### 4.1 Pantalla de entrada (`#scr-entrada`)

- Va **dentro de `shell.html`**, antes que todo lo demás, para pintarse en el primer render (en 3G simulado la portada se pinta a ~1,5 s).
- Contenido: nubes en 3 o 4 capas con deriva lenta (40–70 s), degradado de `#0e1322` a un azul noche más claro, luz tenue arriba, el texto "Toca para comenzar" con pulso lento **solo de opacidad**, y el enlace "Sin sonido" con área táctil de al menos 44 px. Sin título del juego: la portada debe llegar como revelación.
- Rendimiento: solo `transform` y `opacity`. Evitar `filter: blur` (costoso en gama baja); usar `radial-gradient` para dar blandura.
- `prefers-reduced-motion`: nubes estáticas y sin pulso.
- Accesibilidad: el área de toque es un `<button>` a pantalla completa con `aria-label`; en escritorio funciona con clic, Enter y Espacio.
- Si el sonido estaba desactivado (clave `duelo-nodos-sonido`), no se muestra y todo sigue como hoy. Leer `localStorage` en un `try/catch` desde el guion inicial, porque `Platform` aún no existe en ese punto.

**Orden de arranque y desbloqueo del audio** (punto crítico, sobre todo en iOS):
1. El HTML es un solo archivo y `audio.js` queda lejos del inicio, así que el toque puede llegar antes de que cargue el motor. Por eso el **script mínimo del inicio** debe, dentro del propio manejador del toque, crear o reanudar un `AudioContext` y reproducir un buffer silencioso. Lo guarda en una variable global (por ejemplo `window.__ctxAudio`).
2. Cuando `audio.js` carga, **adopta ese contexto**. No crea otro.
3. El mismo toque cierra la pantalla con un fundido de ~500 ms, pone `body.ini-anim` (la intro de 2,85 s empieza ahora y no al cargar) y pide `Sonido.musica('portada')` con fade-in de ~1,5 s. Si el motor aún no cargó, la música entra cuando esté listo.
4. El manejador de "saltar intro" no debe recibir ese mismo toque (`stopPropagation` o registrarlo en el siguiente frame). Criterio: tras el toque, la intro corre completa si no hay un segundo toque.
5. "Sin sonido": no crea `AudioContext`, guarda desactivado y sigue el flujo normal (intro incluida).
6. Si la intro ya se vio en la sesión (`sessionStorage` `hilos-intro`), la pantalla de entrada igual aparece (el audio la necesita), pero tras el toque se salta la intro y entra directo a la portada con la música.
7. Botón atrás de Android en la entrada: manda la app a segundo plano, igual que en la portada.

### 4.2 Motor (`src/audio.js`)

- Global `window.DuelSonido` (**no** `Audio`: choca con el constructor nativo). Patrón UMD como `logic.js`, sin DOM. Todo lo nativo (pausa en segundo plano de la app) va en la capa `Platform`.
- API mínima:
  - `desbloquear()`, `adoptar(ctx)`
  - `efecto(id)` y `musica(id | null, {fade})`
  - `config()` / `fijar({musica, efectos, volMusica, volEfectos})`
  - `bajarMusica(true|false)` (ducking: la música baja a ~40 % durante diálogos y ruleta)
- Mezcla: nodos maestros separados para música y efectos, con un compresor suave al final para evitar picos.
- Polifonía: máximo ~8 efectos simultáneos. Cada efecto crea y destruye sus nodos; sin fugas.
- Ciclo de vida:
  - `visibilitychange` oculto → `suspend()`; visible → `resume()` solo si el jugador no silenció.
  - Estado `interrupted` (iOS, llamadas, bloqueo de pantalla): reintentar `resume()` en el siguiente toque.
  - Si `AudioContext` no existe o falla, el juego sigue en silencio sin errores.
- Persistencia vía `Platform.storage`, clave `duelo-nodos-sonido`: `{musica, efectos, volMusica, volEfectos}`. Valores por defecto: ambos activos, música ~0,35 y efectos ~0,6 (ajustar tras escuchar).
- Respetar `navigator.connection.saveData`: no descargar archivos de audio (Fase B) y usar solo lo generativo.

### 4.3 Efectos de sonido (sintetizados con Web Audio)

Presupuesto: **máximo 18 sonidos distintos**. Lo repetitivo debe ser muy corto y bajo, o quedar en silencio. Estilo: madera, cuerda pulsada (kalimba, arpa), hilo que se tensa; nada de bleeps de arcade y nada que recuerde a Nintendo o Pokémon (regla 5).

| id | Momento | Notas de diseño |
|---|---|---|
| `toque` | Botones genéricos | El más frecuente: muy corto y suave. |
| `elegir` | Elegir una figura | Pulso breve y ascendente. |
| `meter` | Entrar al tablero | Nota con carácter de madera. |
| `mover` | Mover una figura | Muy discreto, un solo "tac". |
| `ruleta-giro` | Empieza a girar | Barrido ascendente corto. |
| `ruleta-tic` | Pasa un segmento | **Limitar** a 1 cada ≥60 ms y atenuar al final. |
| `ruleta-alto` | La ruleta se detiene | "Clac" seco con resonancia breve. |
| `combate-gana` | Gana quien ataca | Nota ascendente. |
| `combate-pierde` | Pierde quien ataca | Nota descendente. |
| `combate-anula` | Azul anula el combate | Tono neutro, hueco. |
| `estado` | Veneno, parálisis, sueño o congelación | Un solo sonido; opcional variar el tono por estado. |
| `enfermeria` | Una figura va a la enfermería | Descenso suave. |
| `nudo` | Una figura se enreda (Hebras) | Hilo que se tensa. |
| `error` | Toque bloqueado o inválido | Muy breve y bajo. |
| `dialogo` | Avanzar texto en escenas | Casi inaudible. Puede omitirse si cansa. |
| `sello` | Recompensa o sello de campaña | Arpegio corto y brillante. |
| `victoria` | Ganar un duelo | Motivo corto, original. |
| `derrota` | Perder un duelo | Motivo corto, original. |

La intro de la portada puede añadir un sonido de "hilo que se dibuja" (`hilo`) sincronizado con la animación; es opcional y cuenta dentro del tope de 18.

Cada sonido se define como **datos** (osciladores, envolventes, filtros), no como código suelto, para poder ajustarlo desde el banco de sonidos.

### 4.4 Música generativa (provisional)

- Dos ajustes del mismo motor: `portada` (calmo, disperso) y `duelo` (algo más pulsado, sin tensión alta). Un tercero (`jefe`) queda para después.
- Voz principal: pluck tipo kalimba (triángulo o seno con decaimiento rápido y un parcial desafinado). Base: pad grave con dos osciladores levemente desafinados y filtro con LFO lento.
- Notas de una escala pentatónica o dórica, con probabilidad por pulso y semilla pseudoaleatoria (reutilizar `mulberry32`; no hace falta que sea reproducible).
- Reverb sintetizada: respuesta al impulso generada por código con ruido decreciente, sin archivos.
- Programación de notas con ventana de anticipación sobre el reloj del `AudioContext`, no con `setTimeout` directo.
- Loop infinito sin costura, sin peso y sin licencia. Tiene un techo de calidad: sirve de música ambiente, no de tema memorable. Por eso se diseña detrás de `musica(id)`: la Fase B puede sustituirla sin tocar a quien la llama.

### 4.5 Interruptores y botón de portada

- Menú: dos interruptores, "Música" y "Efectos", junto al de vibración. Visibles en web y app.
- Portada: botón de altavoz discreto que silencia o reactiva todo (persistente). No debe desplazar el layout (ya se midió con PerformanceObserver).
- Reactivar el sonido desde el Menú cuenta como un gesto: ahí se crea o reanuda el contexto si no existía.
- Al desactivar ambos, la próxima carga omite la pantalla de entrada (ver 4.1).

### 4.6 Banco de sonidos (`tools/sonidos.html`)

- Carga el `src/audio.js` real. Un botón por sonido, sliders para ajustar sus parámetros y volumen maestro, "reproducir todos en secuencia" y los dos ajustes de música.
- Botón "Copiar parámetros" que deja el JSON en el portapapeles para que Andrés lo pegue en el chat y Claude Code lo aplique.
- Es solo de desarrollo. Pages lo serviría desde `/tools/`, pero no se enlaza desde el juego ni entra al HTML.

### 4.7 Build, peso y tests

- `build.py`: nuevo marcador `/*AUDIO*/` en `shell.html`, antes de `/*UI*/`. Copiar `art/web/audio/` con `--out www` (Fase B). Mantener la medición gzip con tope de 450 KB; esta fase debería sumar solo unos pocos KB comprimidos.
- `test/audio.js` (se suma a `npm test`):
  - Cada id de la tabla de eventos existe como sonido definido.
  - Se respeta el tope de 18 sonidos.
  - Con un `AudioContext` falso mínimo, cada sonido se programa sin lanzar errores y deja ≤8 voces vivas.
  - `require('src/audio.js')` en node no falla ni toca el DOM.
- Confirmar que `test/golden.js` y `test/run.js` quedan idénticos.

## 5. Fase B — Música de archivo (cuando Andrés tenga fuente)

- Pistas iniciales: `portada` y `duelo`; opcional `mapa`. Instrumentales, **loop de 60 a 120 s**. Portada: cuerda pulsada, kalimba, arpa y pads suaves, sin percusión fuerte. Duelo: tempo medio (~90–100 bpm), pulso suave, tensión baja.
- Formato: AAC (`.m4a`) como principal. Probar la costura del loop (padding del codificador); usar `loopStart` y `loopEnd` si hace falta. **Andrés valida la costura de oído.**
- Carga perezosa: después de la pantalla de entrada y cuando el juego ya responde, nunca en la ruta de arranque. Mientras no cargue (o si falla, o con `saveData`), suena la versión generativa.
- Peso: tope total de 1,5 MB (por ejemplo 2 loops de 500–700 KB). Los archivos finales van en `art/web/audio/`; los originales no se versionan (igual que `art/source/`).
- Licencia: cada archivo se registra en `docs/creditos.md` con título, autor, fuente (URL), fecha, licencia y, si aplica, texto de atribución. Si la licencia exige atribución, añadir una pantalla de créditos. Verificar los términos vigentes en el momento de descargar y guardar una captura o copia de la licencia.
- Dónde buscar (sin IA): bibliotecas de música libre con licencia clara para juegos, filtrando por CC0 o CC-BY, o paquetes de audio de juegos con licencia comercial explícita. Palabras de búsqueda: "ambient", "kalimba", "harp", "fantasy", "night", "loop", "instrumental". Si más adelante usa una herramienta de IA, comprobar que su plan incluya uso comercial; Claude puede escribir los prompts.

## 6. Criterios de aceptación (Fase A)

1. Carga fría con sonido activado: aparece la entrada de nubes; el toque la cierra, empieza la intro completa (2,85 s) y entra la música con fade-in. El toque no salta la intro.
2. "Sin sonido": no se crea `AudioContext`, la intro corre normal y la preferencia queda guardada.
3. Con música y efectos desactivados en el Menú: la próxima carga no muestra la entrada.
4. El `AudioContext` queda en `running` tras el toque (Chrome emulando móvil) y no hay errores en consola.
5. Un toque temprano en 3G simulado (50 KB/s, 300 ms) funciona: el audio se desbloquea y la música entra cuando carga el motor.
6. Todos los sonidos de la tabla suenan en su evento; `ruleta-tic` respeta el límite de frecuencia; con ≥8 efectos simultáneos no hay chasquidos ni errores.
7. Música y efectos tienen volumen y activación independientes y se guardan al recargar.
8. Al ocultar la pestaña el audio se suspende; al volver se reanuda (si no se silenció). Tras `interrupted`, el siguiente toque lo recupera.
9. A 375×812 y 375×667: sin scroll horizontal, sin desplazamiento de layout (PerformanceObserver), sin errores. Con `prefers-reduced-motion` las nubes no se animan.
10. HTML comprimido ≤450 KB. `npm test` verde con la huella de `golden.js` idéntica.
11. Prueba humana de Andrés: aprueba los sonidos en `tools/sonidos.html` y confirma el desbloqueo en iPhone real y el efecto del interruptor de silencio.

## 7. Riesgos y puntos a decidir

- **iOS:** el desbloqueo debe ocurrir dentro del manejador del toque; si se difiere a un `await` o a un `setTimeout`, no funciona. El interruptor físico de silencio mutea Web Audio: avisar a los testers.
- **Calidad percibida de lo sintetizado:** el oído de Andrés decide. Si un sonido no convence, pasa a muestra (archivo corto) dentro del tope de peso.
- **Fatiga auditiva:** más sonido no es mejor. Si `dialogo` o `mover` cansan, se retiran.
- **Música generativa:** es provisional; no sobredimensionar su desarrollo.
- **Fuera del repo:** los textos ya conocidos de iPhone (Safari) y Android (WebView con autoplay) se prueban en la fase de publicación; aquí basta el gesto.

## 8. Archivos previstos

- Nuevos: `src/audio.js`, `test/audio.js`, `tools/sonidos.html`, `docs/creditos.md` (vacío con plantilla en la Fase A).
- Modificados: `src/shell.html` (entrada, guion inicial, marcador `/*AUDIO*/`), `src/style.css`, `src/ui.js`, `src/campana-ui.js`, `src/platform.js` (pausa en segundo plano), `build.py`, `package.json` (script de test), `CLAUDE.md`, `ROADMAP.md`.
- No se tocan: `src/logic.js`, `src/ai.js`, `data/`.

## 9. Trabajo y cierre

- Rama `audio` desde `main`; `main` siempre jugable. Subir la versión (0.9.0) solo cuando Andrés lo pida.
- Commits pequeños en español, un tema cada uno: entrada con nubes, motor de audio, efectos sintetizados, interruptores, música generativa, banco de sonidos, tests y créditos.
- Al terminar: `npm test`, `node test/run.js`, actualizar `CLAUDE.md` con lo decidido y los pendientes que queden.

## 10. Prompt para Claude Code

> Lee CLAUDE.md, ROADMAP.md y docs/plan-audio.md. Trabajemos la Fase 6a (audio), parte A. Antes de planificar, lee `ui.js`, `shell.html`, `platform.js` y `campana-ui.js` para confirmar los puntos de integración que el plan supone. Dame un plan con los archivos que vas a tocar, el orden de arranque exacto de la pantalla de entrada y los riesgos; no escribas código hasta que lo apruebe. Al terminar: `npm test`, `node test/run.js`, commits pequeños en español y actualiza CLAUDE.md. Recuerda que no puedes oír: déjame `tools/sonidos.html` para aprobar los sonidos yo.
