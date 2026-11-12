"""Une src/ en un solo HTML.

  python3 build.py            -> index.html en la raíz (demo de GitHub Pages).
                                 Fuentes incrustadas en base64: archivo único, funciona sin conexión.
  python3 build.py --out www  -> www/index.html + www/fonts/ + www/capacitor.js (web de la app Capacitor).
                                 Fuentes como archivos aparte: HTML más liviano. Requiere npm install.
"""
import argparse
import base64
import gzip
import json
import pathlib
import re
import shutil

RAIZ = pathlib.Path(__file__).parent
SRC = RAIZ / 'src'
TOPE_GZ_KB = 450   # tope de lo que se descarga: GitHub Pages sirve el HTML comprimido con gzip


def leer(nombre):
    # UTF-8 explícito y saltos de línea normalizados: el build sale igual en Windows y Linux.
    return (SRC / nombre).read_text(encoding='utf-8').replace('\r\n', '\n')


def fuentes_incrustadas(css):
    def a_base64(m):
        datos = (SRC / m.group(1)).read_bytes()
        return 'url(data:font/woff2;base64,' + base64.b64encode(datos).decode('ascii') + ')'
    return re.sub(r'url\((fonts/[^)]+\.woff2)\)', a_base64, css)


def config_js():
    """window.DUEL_CONFIG con la versión (package.json) y el link de comentarios (src/config.json)."""
    version = json.loads((RAIZ / 'package.json').read_text(encoding='utf-8'))['version']
    url = json.loads(leer('config.json')).get('feedbackUrl', '').strip()
    if url and not url.startswith('https://'):
        raise SystemExit('src/config.json: feedbackUrl debe empezar con https://')
    datos = json.dumps({'version': version, 'feedbackUrl': url}, ensure_ascii=False)
    return 'window.DUEL_CONFIG = ' + datos.replace('</', '<\\/') + ';'


def data_js():
    """window.DUEL_DATA con data/boards, data/duels, data/tutorial y data/campaign (la web no tiene servidor: van dentro del HTML).
    Los retratos y fondos de la campaña NO van dentro: se cargan como archivos desde art/web/ (Fase 3)."""
    datos = {}
    camp = RAIZ / 'data' / 'campaign'
    rd = lambda f: json.loads(f.read_text(encoding='utf-8'))
    datos['campaign'] = {
        'campana': rd(camp / 'campana.json'), 'escenas': rd(camp / 'escenas.json')['escenas'],
        'personajes': rd(camp / 'personajes.json')['personajes'],
        'guiados': {j['id']: j for j in (rd(f) for f in sorted((camp / 'guiados').glob('*.json')))}}
    for carpeta in ('boards', 'duels', 'tutorial'):
        datos[carpeta] = {}
        for f in sorted((RAIZ / 'data' / carpeta).glob('*.json')):
            j = json.loads(f.read_text(encoding='utf-8'))
            if j.get('id') in datos[carpeta]:
                raise SystemExit('id repetido en data/' + carpeta + ': ' + str(j.get('id')))
            datos[carpeta][j['id']] = j
    texto = json.dumps(datos, ensure_ascii=False, separators=(',', ':'))
    return 'window.DUEL_DATA = ' + texto.replace('</', '<\\/') + ';'


def art_js():
    """window.DUEL_ART: arte de las criaturas (data/art.json) incrustado como data URI.
    Solo van el token (128 px) y la ficha-web (256 px); la ficha de 512 px queda en art/web/."""
    ruta = RAIZ / 'data' / 'art.json'
    if not ruta.exists():
        return 'window.DUEL_ART = {};', 0
    art = json.loads(ruta.read_text(encoding='utf-8')).get('criaturas', {})
    out = {}; peso = 0
    for cid, archivos in sorted(art.items()):
        out[cid] = {}
        for clave, nombre in (('token', 'token'), ('ficha', 'ficha-web')):
            f = RAIZ / archivos[nombre]
            if not f.exists():
                raise SystemExit('data/art.json apunta a un archivo que no existe: ' + archivos[nombre])
            datos = f.read_bytes(); peso += len(datos)
            out[cid][clave] = 'data:image/webp;base64,' + base64.b64encode(datos).decode('ascii')
    return 'window.DUEL_ART = ' + json.dumps(out, separators=(',', ':')) + ';', peso


def main():
    ap = argparse.ArgumentParser(description='Build de Duelo de Nodos')
    ap.add_argument('--out', help='carpeta destino (p. ej. www). Sin esto: index.html en la raíz')
    args = ap.parse_args()

    fonts_css = leer('fonts.css')
    capacitor = ''
    if args.out:
        destino = pathlib.Path(args.out)
        destino.mkdir(parents=True, exist_ok=True)
        (destino / 'fonts').mkdir(exist_ok=True)
        for f in (SRC / 'fonts').iterdir():
            shutil.copy2(f, destino / 'fonts' / f.name)
        # Runtime de Capacitor (registerPlugin) para usar plugins sin bundler. Solo en la app.
        core = RAIZ / 'node_modules' / '@capacitor' / 'core' / 'dist' / 'capacitor.js'
        if not core.exists():
            raise SystemExit('Falta ' + str(core) + ': corre "npm install" antes de --out')
        shutil.copy2(core, destino / 'capacitor.js')
        capacitor = '<script src="capacitor.js"></script>'
        # Retratos y fondos de las escenas van como archivos (no dentro del HTML)
        for sub in ('retratos', 'fondos'):
            origen = RAIZ / 'art' / 'web' / sub
            if origen.is_dir():
                shutil.copytree(origen, destino / 'art' / 'web' / sub, dirs_exist_ok=True)
    else:
        destino = RAIZ
        fonts_css = fuentes_incrustadas(fonts_css)

    arte, peso_arte = art_js()
    s = leer('shell.html')
    for marca, contenido in [('/*FONTS*/', fonts_css), ('/*CSS*/', leer('style.css')), ('/*DATA*/', data_js()),
                             ('/*LOGIC*/', leer('logic.js')), ('/*AI*/', leer('ai.js')), ('/*TUTORIAL*/', leer('tutorial.js')),
                             ('/*CAMPANA*/', leer('campana.js')), ('/*CAMPANA_UI*/', leer('campana-ui.js')),
                             ('<!--CAPACITOR-->\n', capacitor + '\n' if capacitor else ''),
                             ('/*CONFIG*/', config_js()), ('/*ART*/', arte),
                             ('/*PLATFORM*/', leer('platform.js')), ('/*UI*/', leer('ui.js'))]:
        assert marca in s, 'falta el marcador ' + marca
        s = s.replace(marca, contenido)

    salida = destino / 'index.html'
    salida.write_text(s, encoding='utf-8', newline='\n')
    total = len(s.encode('utf-8'))
    comprimido = len(gzip.compress(s.encode('utf-8'), 9))
    print(salida, total, 'bytes (%.0f KB; %.0f KB comprimido, lo que se descarga)' % (total / 1024, comprimido / 1024))
    print('  arte de criaturas: %.0f KB en WebP (%.0f KB dentro del HTML, en base64)' % (peso_arte / 1024, len(arte) / 1024))
    if comprimido > TOPE_GZ_KB * 1024:
        print('  AVISO: el HTML comprimido pesa %.0f KB, más que el tope de %d KB.' % (comprimido / 1024, TOPE_GZ_KB))


if __name__ == '__main__':
    main()
