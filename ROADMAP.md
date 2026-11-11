# Duelo de Nodos — hoja de ruta para Claude Code

Cómo usar este archivo: una fase por sesión de Claude Code. Al empezar, pedir un plan (modo plan) y aprobarlo antes de tocar código. Al terminar cada fase: tests en verde, commits pequeños, actualizar `CLAUDE.md` (decisiones nuevas y pendientes) y publicar en la web para que la prueben.

**Plataforma de desarrollo: la web.** El juego se termina como página (GitHub Pages) porque cualquiera la abre con un link, en Android, iPhone o computador, sin instalar nada. La app Android ya funciona (Fase 0) y queda en pausa hasta la publicación (Fase 7).

Regla de alcance: primero un **corte vertical** (fases 1 a 4: tutorial + Arco 1 completo con su jefe). Solo si se siente bien de jugar, se produce el resto de la campaña.

## Cómo se publica cada avance
- Se trabaja en una rama. Cuando la fase (o una parte jugable) está lista y probada, se fusiona en `main` y GitHub Pages la publica en https://andriw03.github.io/duelo-de-nodos/.
- `main` debe estar siempre jugable: nada a medias llega a los testers. Si algo grande necesita probarse antes de estar listo, se esconde detrás de una opción que no aparece por defecto.
- La versión visible en el juego cambia con cada publicación, para que los testers digan qué versión probaron.

## Fase 0 — Empaquetado Android (terminada, en pausa)
Capacitor 8 en Android: app probada en emulador, fuentes locales, `npm run apk`, tests sin regresiones. La capa `src/platform.js` sigue en uso (en la web cae a `localStorage`), así que no se borra. No hace falta compilar ni probar la app en cada fase.

## Fase 0b — Web lista para testers
Objetivo: que mandar el link baste para que alguien juegue y cuente qué le pasó.
- Fusionar `capacitor-android` en `main` (la web gana fuentes sin conexión y el menú arreglado).
- Versión visible (por ejemplo en el menú y en la pantalla de equipo).
- Botón "Enviar comentarios" que abra un formulario externo (Google Forms o similar) con la versión ya escrita. Andrés crea el formulario.
- Probar en Chrome de Android, Safari de iPhone y un navegador de computador: toque, tamaño de pantalla, partida guardada al cerrar la pestaña.
- Opcional (decidir antes): hacerla instalable desde el navegador ("Agregar a la pantalla de inicio") y jugable sin conexión (manifiesto web + service worker). Sirve a quien juegue seguido, pero agrega caché que hay que invalidar en cada versión.
- Criterio de salida: 2 o 3 personas juegan desde el link en sus teléfonos y el formulario recibe sus comentarios.

## Fase 1 — Motor dirigido por datos (terminada)
Objetivo: que tableros, duelos y reglas especiales sean datos y no código.
- Sacar el tablero de 29 nodos a un formato de datos (`data/boards/*.json`) y hacer que `logic.js` lo reciba como parámetro (hoy asume uno solo).
- Definir la "configuración de duelo": tablero, equipo del jugador (libre o fijo), equipo rival (fijo o aleatorio), dificultad de IA, reglas especiales activas y condición de victoria.
- Añadir al motor ganchos para reglas de jefe: cruces marcados y cruces enlazados (ver biblia). Cada regla es opcional y está apagada por defecto.
- Los datos tienen que llegar al HTML único de la web (incrustados por `build.py`), sin depender de un servidor.
- Criterio de salida: la partida normal se comporta igual que hoy (mismos resultados con `node test/run.js` y la misma semilla).

## Fase 2 — Tutorial interactivo (terminada)
Objetivo: que alguien que nunca vio el juego entienda las reglas en 5 minutos, sin leer el "Cómo jugar".
- Motor de **escenarios guiados**: estado inicial fijo y semilla del azar fija (ya existe `mulberry32`), una lista de pasos con texto, casilla o botón resaltado, y bloqueo de toda acción que no sea la del paso.
- Lecciones sugeridas (cada una de 1 a 2 minutos):
  1. Entrar al tablero y moverse hacia la meta.
  2. Atacar: la ruleta y los colores (azul anula; dorado > morado > blanco > rojo).
  3. Tipos: el ciclo Fuego › Planta › Tierra › Rayo › Agua › Fuego y los indicadores ▲ / ▼.
  4. Estados y enfermería: qué pasa al perder un combate.
  5. Ganar: llegar a la meta y la regla de acción obligatoria.
- Se ofrece al primer inicio, se puede saltar, y se reabre desde "Cómo jugar". Se guarda cuál lección se completó.
- Criterio de salida: publicado en la web y probado con 2 o 3 personas que no conozcan el juego; anotar dónde se traban (el formulario ayuda).

## Fase 3 — Estructura de campaña
- Pantalla de mapa de épocas (5 arcos) con desbloqueo lineal de los 14 duelos.
- Progreso guardado (duelos ganados, estrellas o nota por duelo, criaturas desbloqueadas) con la misma capa de persistencia que la partida guardada (`Platform.storage`).
- En la web el progreso vive en el navegador: se pierde si se borran los datos del sitio o se cambia de teléfono. Agregar "Exportar / importar progreso" (un código para copiar y pegar) para que los testers no pierdan avance.
- Pantalla de diálogo simple (retrato, nombre, texto, avanzar al tocar) antes y después de cada duelo.
- Datos de campaña en `data/campaign/*.json`; los textos salen de la biblia, no se inventan nuevos sin avisar.
- Criterio de salida: Arco 1 (Neolítico/Planta) jugable de punta a punta en la web con diálogos provisionales.

## Fase 4 — Primer jefe y reglas de tablero
- Implementar al jefe del Arco 1 con su regla de tablero (cruces marcados o enlazados, según la biblia).
- Simulaciones específicas para este duelo: que sea ganable pero no trivial (apuntar a 40–60 % de victorias de un jugador medio contra la IA Normal; ajustar con los tests).
- Playtest con amigos del corte vertical (tutorial + Arco 1) desde el link. **Decisión de continuar aquí.**

## Fase 5 — Resto de la campaña
- Arcos 2 a 5, un arco por sesión: duelos, diálogos, jefe y regla propia. Reutilizar lo de las fases 1 a 4. Publicar cada arco al terminarlo.
- Final contra el Patrón (Orsolo Venn).
- Verificar los datos históricos de cada época antes de fijarlos en texto.

## Fase 6 — Pulido
- **Accesibilidad:** los segmentos de la ruleta se distinguen por color (rojo, dorado, morado, azul, blanco). Agregar icono o patrón a cada tipo para quien no distinga colores.
- Ajustes: sonido, vibración (solo app), borrar progreso.
- Animaciones de movimiento y combate, sonido y música originales (o con licencia clara). Cuidar el peso: la web se descarga entera en cada visita sin caché.
- Arte propio para criaturas, jefes y retratos; íconos (web y app) y pantalla de carga.
- Rendimiento y consumo en un teléfono de gama baja (navegador y app).

## Fase 7 — Publicación
- Nombre definitivo (hoy "Duelo de Nodos"; ya no encaja con el Telar) y `appId` final (hoy provisorio `cl.andres.nodostelar`).
- **Web pública:** dominio o página propia si hace falta; opcionalmente itch.io como vitrina. Página de privacidad simple.
- **Android:** retomar la Fase 0: `npm install`, `npm run apk`, probar en emulador y teléfono (vibración, atrás, guardado), ícono y splash propios. Google Play: prueba cerrada antes de producción. Verificar en la documentación oficial los requisitos vigentes para cuentas personales nuevas (número mínimo de testers y días), porque cambian. Capturas y ficha de tienda en español e inglés.
- iOS al final y solo si hay Mac y presupuesto (en iPhone ya se puede jugar desde la web).

## Cómo pedir cada fase a Claude Code (plantilla)
> Lee CLAUDE.md y ROADMAP.md. Trabajemos la Fase N. Primero dame un plan con los archivos que vas a tocar y los riesgos; no escribas código hasta que lo apruebe. Al terminar: corre `node test/run.js`, prueba la web en el navegador, haz commits pequeños en español, actualiza CLAUDE.md con lo decidido y avísame cuando esté listo para publicar en `main`.

## Antes de empezar la Fase 3
Exportar la biblia de historia (Doc de Claude) a Markdown y guardarla en `docs/biblia.md` dentro del repo. Claude Code no puede abrir el link del Doc, así que sin esto inventaría texto.
