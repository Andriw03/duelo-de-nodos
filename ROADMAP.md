# Duelo de Nodos — hoja de ruta para Claude Code

Cómo usar este archivo: una fase por sesión de Claude Code. Al empezar, pedir un plan (modo plan) y aprobarlo antes de tocar código. Al terminar cada fase: tests en verde, commits pequeños y actualizar `CLAUDE.md` (decisiones nuevas y pendientes).

Regla de alcance: primero un **corte vertical** (fases 1 a 4: tutorial + Arco 1 completo con su jefe). Solo si se siente bien de jugar, se produce el resto de la campaña.

## Fase 0 — Empaquetado (en curso)
Capacitor en Android según `CLAUDE.md`. Cerrar con: app corriendo, fuentes locales, tests sin regresiones.

## Fase 1 — Motor dirigido por datos
Objetivo: que tableros, duelos y reglas especiales sean datos y no código.
- Sacar el tablero de 29 nodos a un formato de datos (`data/boards/*.json`) y hacer que `logic.js` lo reciba como parámetro (hoy asume uno solo).
- Definir la "configuración de duelo": tablero, equipo del jugador (libre o fijo), equipo rival (fijo o aleatorio), dificultad de IA, reglas especiales activas y condición de victoria.
- Añadir al motor ganchos para reglas de jefe: cruces marcados y cruces enlazados (ver biblia). Cada regla es opcional y está apagada por defecto.
- Criterio de salida: la partida normal se comporta igual que hoy (mismos resultados con `node test/run.js` y la misma semilla).

## Fase 2 — Tutorial interactivo
Objetivo: que alguien que nunca vio el juego entienda las reglas en 5 minutos, sin leer el "Cómo jugar".
- Motor de **escenarios guiados**: estado inicial fijo y semilla del azar fija (ya existe `mulberry32`), una lista de pasos con texto, casilla o botón resaltado, y bloqueo de toda acción que no sea la del paso.
- Lecciones sugeridas (cada una de 1 a 2 minutos):
  1. Entrar al tablero y moverse hacia la meta.
  2. Atacar: la ruleta y los colores (azul anula; dorado > morado > blanco > rojo).
  3. Tipos: el ciclo Fuego › Planta › Tierra › Rayo › Agua › Fuego y los indicadores ▲ / ▼.
  4. Estados y enfermería: qué pasa al perder un combate.
  5. Ganar: llegar a la meta y la regla de acción obligatoria.
- Se ofrece al primer inicio, se puede saltar, y se reabre desde "Cómo jugar". Se guarda cuál lección se completó.
- Criterio de salida: probar con 2 o 3 personas que no conozcan el juego y anotar dónde se traban.

## Fase 3 — Estructura de campaña
- Pantalla de mapa de épocas (5 arcos) con desbloqueo lineal de los 14 duelos.
- Progreso guardado (duelos ganados, estrellas o nota por duelo, criaturas desbloqueadas) con la misma capa de persistencia que use la partida guardada.
- Pantalla de diálogo simple (retrato, nombre, texto, avanzar al tocar) antes y después de cada duelo.
- Datos de campaña en `data/campaign/*.json`; los textos salen de la biblia, no se inventan nuevos sin avisar.
- Criterio de salida: Arco 1 (Neolítico/Planta) jugable de punta a punta con diálogos provisionales.

## Fase 4 — Primer jefe y reglas de tablero
- Implementar al jefe del Arco 1 con su regla de tablero (cruces marcados o enlazados, según la biblia).
- Simulaciones específicas para este duelo: que sea ganable pero no trivial (apuntar a 40–60 % de victorias de un jugador medio contra la IA Normal; ajustar con los tests).
- Playtest con amigos del corte vertical (tutorial + Arco 1). **Decisión de continuar aquí.**

## Fase 5 — Resto de la campaña
- Arcos 2 a 5, un arco por sesión: duelos, diálogos, jefe y regla propia. Reutilizar lo de las fases 1 a 4.
- Final contra el Patrón (Orsolo Venn).
- Verificar los datos históricos de cada época antes de fijarlos en texto.

## Fase 6 — Pulido
- **Accesibilidad:** los segmentos de la ruleta se distinguen por color (rojo, dorado, morado, azul, blanco). Agregar icono o patrón a cada tipo para quien no distinga colores.
- Ajustes: sonido, vibración, borrar progreso.
- Animaciones de movimiento y combate, sonido y música originales (o con licencia clara).
- Arte propio para criaturas, jefes y retratos; íconos de la app y pantalla de carga.
- Rendimiento y consumo en un teléfono de gama baja.

## Fase 7 — Publicación
- Nombre definitivo (hoy "Duelo de Nodos"; ya no encaja con el Telar) y `appId` final.
- Política de privacidad (aunque no se recojan datos), capturas, ficha de tienda en español e inglés.
- Google Play: prueba cerrada antes de producción. Verificar en la documentación oficial los requisitos vigentes para cuentas personales nuevas (número mínimo de testers y días), porque cambian.
- iOS al final y solo si hay Mac y presupuesto.

## Cómo pedir cada fase a Claude Code (plantilla)
> Lee CLAUDE.md y ROADMAP.md. Trabajemos la Fase N. Primero dame un plan con los archivos que vas a tocar y los riesgos; no escribas código hasta que lo apruebe. Al terminar: corre `node test/run.js`, haz commits pequeños en español y actualiza CLAUDE.md con lo decidido.

## Antes de empezar la Fase 3
Exportar la biblia de historia (Doc de Claude) a Markdown y guardarla en `docs/biblia.md` dentro del repo. Claude Code no puede abrir el link del Doc, así que sin esto inventaría texto.
