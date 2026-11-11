"""Une src/ en un solo HTML.

  python3 build.py            -> index.html en la raíz (demo de GitHub Pages).
                                 Fuentes incrustadas en base64: archivo único, funciona sin conexión.
  python3 build.py --out www  -> www/index.html + www/fonts/ + www/capacitor.js (web de la app Capacitor).
                                 Fuentes como archivos aparte: HTML más liviano. Requiere npm install.
"""
import argparse
import base64
import json
import pathlib
import re
import shutil

RAIZ = pathlib.Path(__file__).parent
SRC = RAIZ / 'src'


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
    else:
        destino = RAIZ
        fonts_css = fuentes_incrustadas(fonts_css)

    s = leer('shell.html')
    for marca, contenido in [('/*FONTS*/', fonts_css), ('/*CSS*/', leer('style.css')),
                             ('/*LOGIC*/', leer('logic.js')), ('/*AI*/', leer('ai.js')),
                             ('<!--CAPACITOR-->\n', capacitor + '\n' if capacitor else ''),
                             ('/*CONFIG*/', config_js()),
                             ('/*PLATFORM*/', leer('platform.js')), ('/*UI*/', leer('ui.js'))]:
        assert marca in s, 'falta el marcador ' + marca
        s = s.replace(marca, contenido)

    salida = destino / 'index.html'
    salida.write_text(s, encoding='utf-8', newline='\n')
    print(salida, len(s.encode('utf-8')), 'bytes')


if __name__ == '__main__':
    main()
