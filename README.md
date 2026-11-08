# Duelo de Nodos

Juego de estrategia por turnos para celular, contra la CPU. Tablero de 29 nodos, 12 criaturas originales, ruletas de combate y 3 niveles de dificultad. Un solo archivo HTML, sin dependencias salvo Google Fonts.

**Jugar:** https://andriw03.github.io/duelo-de-nodos/

## Estructura
- `index.html`: build final (lo que se publica).
- `src/logic.js`: reglas puras, sin DOM. `src/ai.js`: IA de la CPU. `src/ui.js` y `src/style.css`: interfaz.
- `build.py`: une `src/` en `index.html` (`python3 build.py`).
- `test/`: simulaciones en node (`node test/run.js`).

Criaturas, nombres y arte originales. Sin relación con Pokémon ni Nintendo.
