"""Procesa el arte del juego: quita el fondo magenta, recorta y exporta WebP.

    python scripts/procesar-arte.py                      todo (criaturas, retratos y fondos)
    python scripts/procesar-arte.py retratos fondos      solo lo indicado
    (en Windows: python, no python3)

CRIATURAS
Entrada:  art/source/<id>.png o .jpg   (id = el de logic.js; fondo magenta #FF00FF plano)
Salida:   art/web/<id>-token.webp      128 px, para el tablero, la banca y las tarjetas
          art/web/<id>-ficha.webp      512 px, original de alta resolución (no va dentro del HTML)
          art/web/<id>-ficha-web.webp  256 px, la que se incrusta en el HTML (se ve a 128 px)
          art/web/prueba-40.png        todas a 40 px sobre #0e1322 (prueba de 40 px)
          art/web/hoja.png             todas juntas, para revisar el estilo y los bordes
          data/art.json                id -> archivos (lo lee build.py, no el motor)
RETRATOS
Entrada:  art/retratos/<personaje>-<expresion>.png  (fondo magenta)
Salida:   art/web/retratos/<mismo nombre>.webp      lado mayor 512 px, con transparencia
FONDOS
Entrada:  art/fondos/<id>.png
Salida:   art/web/fondos/<id>.webp                  hasta 1080 px de ancho (nunca se agranda)
Retratos y fondos NO van dentro del HTML: el juego los carga como archivos (ver build.py).
Requiere solo Pillow.

Recorte: se borra lo que se parece al color del fondo Y está conectado con el borde de la imagen,
así un rosado dentro de la criatura (la flor de Erizarza) no se borra. En el contorno, la
transparencia se calcula según cuánto fondo hay mezclado y se le quita el tinte magenta. """
import json
import pathlib
import re
import sys
from collections import deque

from PIL import Image, ImageDraw, ImageFilter

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTE = RAIZ / 'art' / 'source'
SALIDA = RAIZ / 'art' / 'web'
RETRATOS = RAIZ / 'art' / 'retratos'
FONDOS = RAIZ / 'art' / 'fondos'
LADO_RETRATO = 512
ANCHO_FONDO = 1080
TAM = {'token': 128, 'ficha': 512, 'ficha-web': 256}
CALIDAD = {'token': 85, 'ficha': 82, 'ficha-web': 74}
MAX_TRABAJO = 1024     # lado mayor con el que se trabaja (las fuentes miden ~1500 px)
MARGEN = 0.06          # aire alrededor de la criatura en el cuadrado final
HUECO = 0.86           # en huecos cerrados (entre patas) solo se borra lo casi idéntico al fondo
FONDO_APP = (14, 19, 34)


def ids_del_juego():
    texto = (RAIZ / 'src' / 'logic.js').read_text(encoding='utf-8')
    return re.findall(r"\{ id: '([a-z]+)', name:", texto)


def magenta(p):
    """Cuánto 'magenta' tiene un color: alto si rojo y azul altos y verde bajo."""
    r, g, b = p[:3]
    return min(r, b) - g


def color_fondo(im):
    """Mediana de los píxeles del borde: el magenta real de esta imagen (no siempre es #FF00FF)."""
    w, h = im.size; px = im.load(); muestras = []
    for x in range(0, w, 4): muestras += [px[x, 0], px[x, h - 1]]
    for y in range(0, h, 4): muestras += [px[0, y], px[w - 1, y]]
    return tuple(sorted(c[i] for c in muestras)[len(muestras) // 2] for i in range(3))


def pixeles(im):
    # getdata() queda obsoleto en Pillow 14
    return list(im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata())


def quitar_fondo(im):
    im = im.convert('RGB')
    if max(im.size) > MAX_TRABAJO:
        k = MAX_TRABAJO / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    w, h = im.size
    bg = color_fondo(im)
    kbg = magenta(bg)
    if kbg < 120:
        raise ValueError('el fondo no parece magenta (color del borde %s)' % (bg,))
    datos = pixeles(im)
    # t = fracción de fondo en cada píxel (1 = fondo puro, 0 = nada de fondo)
    t = [max(0.0, min(1.0, magenta(p) / kbg)) for p in datos]
    # Fondo = parecido al magenta y conectado con el borde (búsqueda en anchura)
    es_fondo = bytearray(w * h)
    cola = deque()
    def sembrar(i):
        if not es_fondo[i] and t[i] > 0.55:
            es_fondo[i] = 1; cola.append(i)
    for x in range(w): sembrar(x); sembrar((h - 1) * w + x)
    for y in range(h): sembrar(y * w); sembrar(y * w + w - 1)
    while cola:
        i = cola.popleft(); x = i % w
        if x > 0: sembrar(i - 1)
        if x < w - 1: sembrar(i + 1)
        if i >= w: sembrar(i - w)
        if i < w * (h - 1): sembrar(i + w)
    # Huecos cerrados (fondo encerrado entre patas o tentáculos): solo lo casi idéntico al fondo
    for i in range(w * h):
        if not es_fondo[i] and t[i] > HUECO:
            es_fondo[i] = 1
    # Contorno: la franja de 2 px que toca el fondo recibe transparencia parcial
    mascara = Image.frombytes('L', (w, h), bytes(255 if f else 0 for f in es_fondo))
    franja = pixeles(mascara.filter(ImageFilter.MaxFilter(5)))
    salida = []
    for i, p in enumerate(datos):
        if es_fondo[i]:
            salida.append((0, 0, 0, 0)); continue
        if franja[i] and t[i] > 0.04:
            a = 1.0 - t[i]
            if a < 0.04:
                salida.append((0, 0, 0, 0)); continue
            # quitar la parte de fondo mezclada: color = (pixel - t*fondo) / (1 - t)
            c = tuple(max(0, min(255, round((p[j] - t[i] * bg[j]) / a))) for j in range(3))
            salida.append(c + (round(a * 255),))
        else:
            salida.append(p + (255,))
    out = Image.new('RGBA', (w, h)); out.putdata(salida)
    return out


def cuadrar(im):
    """Recorta a lo visible y lo centra en un cuadrado con margen."""
    caja = im.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    if not caja:
        raise ValueError('la imagen quedó vacía al quitar el fondo')
    im = im.crop(caja)
    lado = round(max(im.size) * (1 + 2 * MARGEN))
    cuad = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    cuad.paste(im, ((lado - im.width) // 2, (lado - im.height) // 2), im)
    return cuad


def criaturas():
    if not FUENTE.is_dir():
        sys.exit('No existe ' + str(FUENTE))
    SALIDA.mkdir(parents=True, exist_ok=True)
    conocidos = ids_del_juego()
    fuentes = {}
    for f in sorted(FUENTE.iterdir()):
        if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'):
            fuentes[f.stem.lower()] = f
    desconocidos = sorted(set(fuentes) - set(conocidos))
    faltan = [i for i in conocidos if i not in fuentes]
    for i in desconocidos: print('AVISO: %s no es una criatura del juego; se ignora.' % i)
    for i in faltan: print('AVISO: falta el arte de %s (seguirá con su emoji).' % i)

    art = {}; total = {k: 0 for k in TAM}; listas = {}
    print('%-11s %-5s %9s %9s %9s' % ('criatura', 'orig', 'token', 'ficha', 'ficha-web'))
    for cid in [i for i in conocidos if i in fuentes]:
        f = fuentes[cid]
        try:
            cuad = cuadrar(quitar_fondo(Image.open(f)))
        except ValueError as e:
            print('ERROR %s: %s' % (cid, e)); continue
        art[cid] = {}; pesos = []
        for nombre, lado in TAM.items():
            destino = SALIDA / ('%s-%s.webp' % (cid, nombre))
            cuad.resize((lado, lado), Image.LANCZOS).save(destino, 'WEBP', quality=CALIDAD[nombre], method=6)
            peso = destino.stat().st_size; total[nombre] += peso; pesos.append(peso)
            art[cid][nombre] = 'art/web/' + destino.name
        listas[cid] = cuad
        print('%-11s %-5s %8.1fK %8.1fK %8.1fK' % (cid, f.suffix[1:], pesos[0] / 1024, pesos[1] / 1024, pesos[2] / 1024))
    print('%-11s %-5s %8.1fK %8.1fK %8.1fK' % ('TOTAL', '', total['token'] / 1024, total['ficha'] / 1024, total['ficha-web'] / 1024))
    print('Dentro del HTML va solo el token: %.0f KB (+33 %% en base64 = ~%.0f KB). La ficha-web (%.0f KB) se descarga aparte.' %
          (total['token'] / 1024, total['token'] * 4 / 3 / 1024, total['ficha-web'] / 1024))

    # Prueba de 40 px: así se ven en el tablero, sobre el fondo de la app
    n = len(listas); cols = 6; celda = 56
    hoja40 = Image.new('RGB', (cols * celda, ((n + cols - 1) // cols) * celda), FONDO_APP)
    for k, (cid, cuad) in enumerate(listas.items()):
        t40 = cuad.resize((40, 40), Image.LANCZOS)
        hoja40.paste(t40, ((k % cols) * celda + 8, (k // cols) * celda + 8), t40)
    hoja40.save(SALIDA / 'prueba-40.png')
    # Hoja de revisión: grande, sobre fondo oscuro y claro (los halos rosados se notan en el claro)
    celda = 200
    hoja = Image.new('RGB', (cols * celda, ((n + cols - 1) // cols) * celda * 2), FONDO_APP)
    d = ImageDraw.Draw(hoja)
    filas = (n + cols - 1) // cols
    d.rectangle([0, filas * celda, cols * celda, 2 * filas * celda], fill=(238, 241, 251))
    for k, (cid, cuad) in enumerate(listas.items()):
        g = cuad.resize((180, 180), Image.LANCZOS)
        x, y = (k % cols) * celda + 10, (k // cols) * celda + 6
        hoja.paste(g, (x, y), g); hoja.paste(g, (x, y + filas * celda), g)
    hoja.save(SALIDA / 'hoja.png')

    (RAIZ / 'data' / 'art.json').write_text(json.dumps(
        {'_formato': 'id de criatura -> archivos en art/web (los genera scripts/procesar-arte.py). build.py incrusta token y ficha-web.',
         'criaturas': art}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('Listo: %d criaturas -> art/web/ y data/art.json. Revisa art/web/prueba-40.png y art/web/hoja.png.' % len(art))


def imagenes(carpeta):
    return [f for f in sorted(carpeta.iterdir()) if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')] if carpeta.is_dir() else []


def retratos():
    """Retratos de personajes: sin fondo, recortados a lo visible, lado mayor 512 px."""
    destino = SALIDA / 'retratos'; destino.mkdir(parents=True, exist_ok=True)
    total = 0; n = 0
    for f in imagenes(RETRATOS):
        try:
            im = quitar_fondo(Image.open(f))
        except ValueError as e:
            print('ERROR %s: %s' % (f.name, e)); continue
        caja = im.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
        im = im.crop(caja)
        k = LADO_RETRATO / max(im.size)
        if k < 1:
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        salida = destino / (f.stem.lower() + '.webp')
        im.save(salida, 'WEBP', quality=80, method=6)
        peso = salida.stat().st_size; total += peso; n += 1
        print('retrato  %-32s %4dx%-4d %6.1fK' % (salida.name, im.width, im.height, peso / 1024))
    print('Retratos: %d, %.0f KB en total.' % (n, total / 1024))


def fondos():
    """Fondos de escena: hasta 1080 px de ancho, sin transparencia (no se agrandan)."""
    destino = SALIDA / 'fondos'; destino.mkdir(parents=True, exist_ok=True)
    total = 0; n = 0
    for f in imagenes(FONDOS):
        im = Image.open(f).convert('RGB')
        if im.width > ANCHO_FONDO:
            im = im.resize((ANCHO_FONDO, round(im.height * ANCHO_FONDO / im.width)), Image.LANCZOS)
        elif im.width < ANCHO_FONDO:
            print('AVISO: %s mide %d px de ancho (menos de %d); se deja así para no perder nitidez.' % (f.name, im.width, ANCHO_FONDO))
        salida = destino / (f.stem.lower() + '.webp')
        im.save(salida, 'WEBP', quality=72, method=6)
        peso = salida.stat().st_size; total += peso; n += 1
        print('fondo    %-32s %4dx%-4d %6.1fK' % (salida.name, im.width, im.height, peso / 1024))
    print('Fondos: %d, %.0f KB en total.' % (n, total / 1024))


def main():
    pedidos = [a.lower() for a in sys.argv[1:]] or ['criaturas', 'retratos', 'fondos']
    tareas = {'criaturas': criaturas, 'retratos': retratos, 'fondos': fondos}
    for p in pedidos:
        if p not in tareas:
            sys.exit('No conozco "%s". Opciones: criaturas, retratos, fondos.' % p)
    for p in pedidos:
        tareas[p]()


if __name__ == '__main__':
    main()
