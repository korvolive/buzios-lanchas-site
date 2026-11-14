"""Enquadramento automático das fotos da galeria (2026-11-13).
O quadro da galeria tem tamanho fixo (7:6 no computador, 4:5 no celular) e a foto o preenche cortando o que sobra.
Centralizado, uma foto em pé de corpo inteiro perdia os pés. Aqui, na publicação, um detector de pessoas
(o mesmo modelo de /login/lancha.tflite, MediaPipe) acha as pessoas de cada foto e escolhe o corte que as mostra inteiras,
mexendo o mínimo possível a partir do centro. Pessoa que não cabe inteira no quadro: fica a cabeça e o máximo do corpo.
Foto sem pessoa em destaque (ou em que a lancha é o assunto) fica centralizada, como antes. Não altera nenhuma foto nem o banco; o tamanho do quadro não muda.
Uso: python3 -I enquadrar.py <pasta img> <foto> ...   (foto = nome em img/ sem extensão ou URL do banco sem .jpg)
Saída: JSON {foto: ["X% Y%" computador, "X% Y%" celular]}; com --nao-cabe, {foto: [largura, altura]} das fotos em que a pessoa não cabe inteira no computador; foto que falhar fica de fora (o site usa o centro)."""
import io, json, os, sys, urllib.request
from PIL import Image, ImageOps

NAO_CABE = "--nao-cabe" in sys.argv  # lista as fotos em que a pessoa não cabe inteira no quadro do computador (rotina das laterais)
ARGS = [a for a in sys.argv[1:] if a != "--nao-cabe"]
PASTA, FOTOS = ARGS[0], ARGS[1:]
PERMITIDO = "https://sqoperylsqcbcjpcrlnp.supabase.co/storage/v1/object/public/lanchas/"
MODELO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "login", "lancha.tflite")
QUADROS = (7 / 6, 4 / 5)  # mesmo aspect-ratio de .gallery .main.tall (computador) e do @media (max-width:880px) (celular)


def abre(f):
    if f.startswith(PERMITIDO):
        with urllib.request.urlopen(urllib.request.Request(f + ".jpg", headers={"User-Agent": "buzios-site-build"}), timeout=30) as r:
            dados = r.read()
    elif f.replace("-", "").replace("_", "").isalnum():
        with open(os.path.join(PASTA, f + ".jpg"), "rb") as a:
            dados = a.read()
    else:
        raise ValueError("foto fora do site e do banco")
    return ImageOps.exif_transpose(Image.open(io.BytesIO(dados))).convert("RGB")  # mesma orientação que o navegador mostra


def pessoas(det, im):
    import mediapipe as mp
    import numpy as np
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(im)))
    cx = [(d.bounding_box.origin_x, d.bounding_box.origin_y, d.bounding_box.origin_x + d.bounding_box.width,
           d.bounding_box.origin_y + d.bounding_box.height) for d in r.detections]
    if not cx:
        return []
    maior = max(b[3] - b[1] for b in cx)
    if maior < 0.4 * im.height:  # gente pequena na foto da lancha: o assunto é a lancha, fica centralizada como antes
        return []
    # só quem está em destaque: gente pequena ao fundo (praia, outras lanchas) não manda no corte
    return [b for b in cx if (b[3] - b[1]) >= 0.18 * im.height and (b[3] - b[1]) >= 0.45 * maior]


def eixo(ini, fim, total, janela):
    """Posição (0 a 1) da janela no eixo: a mais perto do centro que mostra [ini, fim] inteiro; se não cabe, fica o começo (cabeça)."""
    sobra = total - janela
    if sobra <= 1:
        return 0.5
    centro = sobra / 2
    if fim - ini <= janela:
        pos = min(max(centro, fim - janela), ini)
    else:
        pos = ini
    return min(max(pos / sobra, 0.0), 1.0)


def cabe(im, caixas):
    W, H = im.size
    m = 0.02 * H
    alto = min(max(b[3] for b in caixas) + m, H) - max(min(b[1] for b in caixas) - m, 0)
    return W / H >= QUADROS[0] or alto <= W / QUADROS[0]


def corte(im, caixas):
    W, H = im.size
    m = 0.02 * H  # folga para não encostar cabeça e pés na borda
    x0, y0 = max(min(b[0] for b in caixas) - m, 0), max(min(b[1] for b in caixas) - m, 0)
    x1, y1 = min(max(b[2] for b in caixas) + m, W), min(max(b[3] for b in caixas) + m, H)
    saida = []
    for q in QUADROS:
        if W / H < q:  # foto mais em pé que o quadro: corta em cima e embaixo
            px, py = 0.5, eixo(y0, y1, H, W / q)
        else:  # foto mais deitada: corta dos lados
            cx = (x0 + x1) / 2
            larg = H * q
            px = eixo(cx - larg / 2, cx + larg / 2, W, larg) if x1 - x0 > larg else eixo(x0, x1, W, larg)
            py = 0.5
        saida.append(f"{round(px * 100)}% {round(py * 100)}%")
    return saida


def main():
    from mediapipe.tasks.python import BaseOptions, vision
    det = vision.ObjectDetector.create_from_options(vision.ObjectDetectorOptions(
        base_options=BaseOptions(model_asset_path=MODELO), score_threshold=0.4, max_results=20, category_allowlist=["person"]))
    saida = {}
    for f in dict.fromkeys(FOTOS):
        try:
            im = abre(f)
            if im.width > 1200:
                im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
            cx = pessoas(det, im)
            if NAO_CABE:
                if cx and not cabe(im, cx):
                    saida[f] = im.size
                continue
            if cx:
                pos = corte(im, cx)
                if pos != ["50% 50%", "50% 50%"]:
                    saida[f] = pos
        except Exception as e:
            print(f"enquadrar: {f}: {e}", file=sys.stderr)
    det.close()
    print(json.dumps(saida))


main()
