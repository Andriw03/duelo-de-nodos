"""Convierte docs/guion.md en data/campaign/escenas.json (lo que muestra la pantalla de diálogo).

    python scripts/guion-a-escenas.py          (en Windows: python, no python3)

El guion es la única fuente de los textos: si se corrige, se vuelve a correr este script.
Formato que entiende (el de docs/guion.md):
  ## Capítulo                     ### Escena N: Título  |  ### Duelo N: Rival  |  ### Interludio ... (tras el Arco N)
  **Antes** / **Después** / **Si pierdes (reintento)** / **Pasos guiados**   (bloques dentro de un duelo)
  *Descripción de la escena*      (línea en cursiva sola: el escenario)
  - **Personaje:** *(acción)* texto
  - **Elección de Ari:**  seguido de  "  - «opción» → **Personaje:** respuesta"
  1. **Título.** «texto»          (pasos guiados)
  > **Recompensa:** texto
"Ari" se reemplaza por {jugador} (nombre elegible). Avisa de cada línea que no entiende."""
import json
import pathlib
import re
import sys
import unicodedata

RAIZ = pathlib.Path(__file__).resolve().parent.parent
GUION = RAIZ / 'docs' / 'guion.md'
SALIDA = RAIZ / 'data' / 'campaign' / 'escenas.json'
OMITIR = ('cómo leerlo', 'orden del guion', 'variantes del epílogo')


def slug(t):
    t = unicodedata.normalize('NFD', t.lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def jugador(t):
    return re.sub(r'\bAri\b', '{jugador}', t)


def quien(nombre):
    if nombre == 'Ari':
        return 'jugador'
    return slug(nombre)


def linea(nombre, resto):
    """Línea de diálogo: acción inicial en cursiva aparte; otras cursivas quedan como *...* en el texto."""
    resto = resto.strip()
    accion = ''
    m = re.match(r'^\*\((.*?)\)\*\s*(.*)$', resto)
    if m:
        accion, resto = m.group(1).strip(), m.group(2).strip()
    out = {'quien': quien(nombre), 'nombre': jugador(nombre), 'texto': jugador(resto)}
    if accion:
        out['accion'] = jugador(accion)
    return out


def id_seccion(titulo):
    m = re.match(r'^(Escena|Duelo)\s+(\w+)\s*:\s*(.*)$', titulo)
    if m:
        return m.group(1).lower() + '-' + m.group(2).lower(), m.group(3).strip()
    m = re.match(r'^Interludio.*Arco\s+(\d+)', titulo)
    if m:
        return 'interludio-' + m.group(1), titulo
    return slug(titulo), titulo


def main():
    lineas = GUION.read_text(encoding='utf-8').replace('\r\n', '\n').split('\n')
    escenas = {}; avisos = []
    capitulo = None; base = None; actual = None; omitir = False
    contadas = 0; esperadas = 0

    def escena(eid, titulo):
        if eid not in escenas:
            escenas[eid] = {'titulo': jugador(titulo), 'capitulo': capitulo, 'lineas': []}
        return escenas[eid]

    for n, raw in enumerate(lineas, 1):
        l = raw.rstrip()
        if not l.strip():
            continue
        if l.startswith('# '):
            continue
        if l.startswith('## '):
            titulo = l[3:].strip()
            omitir = titulo.lower().startswith(OMITIR)
            capitulo = titulo
            base = slug(titulo.split(':')[0]); actual = None
            if base == 'epilogo':
                actual = escena('epilogo', titulo)
            continue
        if l.startswith('### '):
            titulo = l[4:].strip()
            omitir = titulo.lower().startswith(OMITIR) or capitulo is None or capitulo.lower().startswith(OMITIR)
            if omitir:
                continue
            base, nombre = id_seccion(titulo)
            actual = escena(base, nombre)
            continue
        if omitir or base is None:
            continue
        if l.startswith('- **') and not l.startswith('- **Elección'):
            esperadas += 1
        elif l.startswith('- **Elección'):
            esperadas += 1
        bloque = re.match(r'^\*\*(Antes|Después|Si pierdes \(reintento\)|Pasos guiados)\*\*', l)
        if bloque:
            sufijo = {'Antes': 'antes', 'Después': 'despues', 'Si pierdes (reintento)': 'reintento', 'Pasos guiados': 'pasos'}[bloque.group(1)]
            titulo_base = escenas.get(base, {}).get('titulo', base)
            actual = escena(base + '-' + sufijo, titulo_base)
            if sufijo == 'pasos':
                actual['pasos'] = []
            continue
        m = re.match(r'^\*([^*].*)\*$', l.strip())
        if m and not l.startswith('-'):
            texto = m.group(1).strip()
            if texto.startswith('Supuesto de gui'):
                continue
            if texto.lower().startswith('regla de tablero'):
                escenas[base]['nota'] = jugador(texto)
            else:
                actual.setdefault('escenario', jugador(texto))
            continue
        if l.startswith('*Supuesto de gui'):
            continue
        m = re.match(r'^- \*\*Elección de Ari:\*\*\s*$', l)
        if m:
            actual['lineas'].append({'quien': 'jugador', 'nombre': '{jugador}', 'opciones': []}); contadas += 1
            continue
        m = re.match(r'^\s+- «(.*?)»\s*→\s*\*\*(.+?):\*\*\s*(.*)$', l)
        if m and actual['lineas'] and 'opciones' in actual['lineas'][-1]:
            actual['lineas'][-1]['opciones'].append({'texto': jugador(m.group(1)), 'respuesta': linea(m.group(2), m.group(3))})
            continue
        m = re.match(r'^- \*\*(.+?):\*\*\s*(.*)$', l)
        if m:
            actual['lineas'].append(linea(m.group(1), m.group(2))); contadas += 1
            continue
        m = re.match(r'^\d+\.\s+\*\*(.+?)\*\*\s*«(.*)»\s*$', l)
        if m and 'pasos' in actual:
            actual['pasos'].append({'titulo': m.group(1).rstrip('.'), 'texto': jugador(m.group(2))})
            continue
        m = re.match(r'^>\s*\*\*Recompensa:\*\*\s*(.*)$', l)
        if m:
            escenas[base]['recompensa'] = jugador(m.group(1).strip())
            continue
        avisos.append('l. %d sin entender: %s' % (n, l[:90]))

    # limpiar escenas vacías (las cabeceras de duelo sin texto propio)
    escenas = {k: v for k, v in escenas.items() if v['lineas'] or v.get('pasos') or v.get('nota') or v.get('recompensa') or v.get('escenario')}
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps({
        '_fuente': 'Generado desde docs/guion.md por scripts/guion-a-escenas.py. No editar a mano: corregir el guion y volver a generar.',
        'escenas': escenas}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8', newline='\n')
    hablantes = sorted({l['quien'] for e in escenas.values() for l in e['lineas']} |
                       {o['respuesta']['quien'] for e in escenas.values() for l in e['lineas'] for o in l.get('opciones', [])})
    print('Escenas: %d · líneas: %d de %d en el guion · pasos guiados: %d' % (
        len(escenas), contadas, esperadas, sum(len(e.get('pasos', [])) for e in escenas.values())))
    print('Hablantes: ' + ', '.join(hablantes))
    for a in avisos:
        print('AVISO ' + a)
    if contadas != esperadas:
        sys.exit('Faltan líneas: revisa los avisos.')


if __name__ == '__main__':
    main()
