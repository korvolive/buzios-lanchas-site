"""Enquadramento automático das fotos da galeria (2026-11-13).
O quadro da galeria tem tamanho fixo (7:6 no computador, 4:5 no celular) e a foto o preenche cortando o que sobra.
Centralizado, uma foto em pé de corpo inteiro perdia os pés. Aqui, na publicação, um detector de pessoas
(o mesmo modelo de /login/lancha.tflite, MediaPipe) acha as pessoas de cada foto e escolhe o corte que as mostra inteiras,
mexendo o mínimo possível a partir do centro. Pessoa que não cabe inteira no quadro: fica a cabeça e o máximo do corpo.
Foto sem pessoa em destaque (ou em que a lancha é o assunto) fica centralizada, como antes. Não altera nenhuma foto nem o banco; o tamanho do quadro não muda.
Regra ampliada (2026-11-15, pedido do dono: "centralizar sempre a lancha, sem perder nada"): o detector também acha a lancha principal
(a maior, categoria "boat") e o corte a centraliza inteira junto com as pessoas. Quando o que importa (lancha ou pessoas) não cabe no quadro,
ou quando a foto não tem nada detectado mas o corte perderia mais de 20% dela (cabine, banheiro, sofá fotografados em pé), o --relatorio
marca a foto como "inteira": a rotina completa as bordas dela com estender-laterais.py (foto real intacta no meio) e registra em
img/completas.json. Faixa nos lados e quadro de tamanho diferente foram recusados pelo dono; até a rotina passar, fica o melhor corte.
Uso: python3 -I enquadrar.py <pasta img> <foto> ...   (foto = nome em img/ sem extensão ou URL do banco sem .jpg)
Saída: JSON {foto: ["X% Y%" computador, "X% Y%" celular]};
com --relatorio, {foto: {"computador": "corte"/"inteira", "celular": ..., "lancha": bool, "pessoas": n}} de todas as fotos; com --nao-cabe, {foto: [largura, altura]} das fotos em que a pessoa não cabe inteira no computador; foto que falhar fica de fora (o site usa o centro)."""
import io, json, os, sys, urllib.request
from PIL import Image, ImageOps

NAO_CABE = "--nao-cabe" in sys.argv  # lista as fotos em que a pessoa não cabe inteira no quadro do computador (rotina das laterais)
RELATORIO = "--relatorio" in sys.argv  # rotina: como cada foto aparece (corte ou inteira) nos dois quadros
ARGS = [a for a in sys.argv[1:] if a not in ("--nao-cabe", "--relatorio")]
LIMITE = 0.8  # foto sem nada detectado: corte que mostra menos que isto da foto vira foto inteira
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


def detecta(det, im):
    import mediapipe as mp
    import numpy as np
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(im)))
    cx = lambda d: (d.bounding_box.origin_x, d.bounding_box.origin_y, d.bounding_box.origin_x + d.bounding_box.width,
                    d.bounding_box.origin_y + d.bounding_box.height)
    gente = [cx(d) for d in r.detections if d.categories[0].category_name == "person"]
    barcos = [cx(d) for d in r.detections if d.categories[0].category_name == "boat"]
    return pessoas(im, gente), lancha(im, barcos)


def lancha(im, cx):
    """A lancha principal: a maior detectada, se ocupar pelo menos 6% da foto (barquinho ao fundo não conta)."""
    if not cx:
        return None
    b = max(cx, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    if (b[2] - b[0]) * (b[3] - b[1]) < 0.06 * im.width * im.height:
        return None
    # o detector costuma deixar de fora torre, antena, toldo e mastro: reserva meia altura do casco acima da caixa
    return (b[0], max(b[1] - 0.5 * (b[3] - b[1]), 0), b[2], b[3])


def pessoas(im, cx):
    if not cx:
        return []
    maior = max(b[3] - b[1] for b in cx)
    if maior < 0.4 * im.height:  # gente pequena na foto da lancha: o assunto é a lancha, fica centralizada como antes
        return []
    # só quem está em destaque: gente pequena ao fundo (praia, outras lanchas) não manda no corte
    return [b for b in cx if (b[3] - b[1]) >= 0.18 * im.height and (b[3] - b[1]) >= 0.45 * maior]


def eixo(ini, fim, total, janela, cabeca=True):
    """Posição (0 a 1) da janela no eixo: a mais perto do centro que mostra [ini, fim] inteiro; se não cabe, fica o começo (cabeça)
    quando há pessoa, ou o meio do que importa quando é só a lancha."""
    sobra = total - janela
    if sobra <= 1:
        return 0.5
    centro = sobra / 2
    if fim - ini <= janela:
        pos = min(max(centro, fim - janela), ini)
    else:
        pos = ini if cabeca else (ini + fim - janela) / 2
    return min(max(pos / sobra, 0.0), 1.0)


def cabe(im, caixas):
    W, H = im.size
    m = 0.02 * H
    alto = min(max(b[3] for b in caixas) + m, H) - max(min(b[1] for b in caixas) - m, 0)
    return W / H >= QUADROS[0] or alto <= W / QUADROS[0]


def corte(im, caixas, cabeca=True):
    W, H = im.size
    m = 0.02 * H  # folga para não encostar cabeça e pés na borda
    x0, y0 = max(min(b[0] for b in caixas) - m, 0), max(min(b[1] for b in caixas) - m, 0)
    x1, y1 = min(max(b[2] for b in caixas) + m, W), min(max(b[3] for b in caixas) + m, H)
    saida = []
    for q in QUADROS:
        if W / H < q:  # foto mais em pé que o quadro: corta em cima e embaixo
            px, py = 0.5, eixo(y0, y1, H, W / q, cabeca)
        else:  # foto mais deitada: corta dos lados
            cx = (x0 + x1) / 2
            larg = H * q
            px = eixo(cx - larg / 2, cx + larg / 2, W, larg) if x1 - x0 > larg else eixo(x0, x1, W, larg, cabeca)
            py = 0.5
        saida.append(f"{round(px * 100)}% {round(py * 100)}%")
    return saida


def janela_cabe(W, H, q, caixas):
    """O que importa (caixas) cabe inteiro no quadro q?"""
    m = 0.02 * H
    x0, y0 = max(min(b[0] for b in caixas) - m, 0), max(min(b[1] for b in caixas) - m, 0)
    x1, y1 = min(max(b[2] for b in caixas) + m, W), min(max(b[3] for b in caixas) + m, H)
    return (y1 - y0) <= W / q + 1 if W / H < q else (x1 - x0) <= H * q + 1


def decide(im, gente, barco):
    """[pos computador, pos celular, inteira] para a foto."""
    W, H = im.size
    caixas = gente + ([barco] if barco else [])
    pos = corte(im, caixas, bool(gente)) if caixas else ["50% 50%", "50% 50%"]
    inteira = ""
    for q, k in zip(QUADROS, "dm"):
        visivel = min(W / H / q, q / (W / H))
        if visivel >= 0.98:
            continue
        if caixas:
            if not janela_cabe(W, H, q, caixas):
                inteira += k
        elif visivel < LIMITE:
            inteira += k
    return pos, inteira


def main():
    from mediapipe.tasks.python import BaseOptions, vision
    det = vision.ObjectDetector.create_from_options(vision.ObjectDetectorOptions(
        base_options=BaseOptions(model_asset_path=MODELO), score_threshold=0.4, max_results=20, category_allowlist=["person", "boat"]))
    saida = {}
    for f in dict.fromkeys(FOTOS):
        try:
            im = abre(f)
            if im.width > 1200:
                im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
            cx, barco = detecta(det, im)
            if NAO_CABE:
                if cx and not cabe(im, cx):
                    saida[f] = im.size
                continue
            pos, inteira = decide(im, cx, barco)
            if RELATORIO:
                saida[f] = {"computador": "inteira" if "d" in inteira else "corte", "celular": "inteira" if "m" in inteira else "corte",
                            "lancha": barco is not None, "pessoas": len(cx), "tamanho": im.size}
            elif pos != ["50% 50%", "50% 50%"]:
                saida[f] = pos
        except Exception as e:
            print(f"enquadrar: {f}: {e}", file=sys.stderr)
    det.close()
    print(json.dumps(saida))


main()
