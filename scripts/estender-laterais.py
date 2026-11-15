"""Completa as bordas de uma foto da galeria para ela aparecer INTEIRA nos dois quadros fixos (2026-11-13, ampliado 2026-11-15).
Pedido do dono: o quadro da galeria não muda de tamanho (7:6 no computador, 4:5 no celular), não pode ter faixa nos lados e nada pode
ser cortado; "como se a foto estivesse mais para o fundo". A foto vai para o meio de uma tela maior, que contém os dois quadros:
o Runway (gpt_image_2) completa só as bordas (paredes do próprio ambiente, céu, mar) e depois a foto ORIGINAL é colada de volta,
idêntica, no meio (alinhada por pontos em comum, com emenda suave). Tudo o que estava na foto continua 100% real.
Modo "interior" (cabine, banheiro, sofá): proíbe janela, mar, céu e móveis novos, e não deixa o ambiente maior; modo "exterior": cenário.
Não roda na publicação: é a ferramenta da rotina que acha fotos com `enquadrar.py --relatorio` (sessão na nuvem, onde a chave do Runway
entra pelo proxy). Custa cerca de 20 créditos por foto. A foto nova entra em img/completas.json (original -> nova); o banco não muda.
Uso: python3 -I estender-laterais.py <foto (nome em img/ ou URL do banco sem .jpg)> <nome novo em img/, ex.: sp-02> [interior|exterior]
Saída: img/<nome>.jpg (até 1600 px) e img/<nome>-t.jpg (miniatura). CONFIRA a imagem antes de usar (a IA às vezes inventa)."""
import base64, io, json, os, sys, time, urllib.request
import cv2
import numpy as np
from PIL import Image, ImageOps

FOTO, NOME = sys.argv[1], sys.argv[2]
MODO = sys.argv[3] if len(sys.argv) > 3 else "exterior"
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PERMITIDO = "https://sqoperylsqcbcjpcrlnp.supabase.co/storage/v1/object/public/lanchas/"
API = "https://api.dev.runwayml.com/v1"
CAB = {"X-Runway-Version": "2024-11-06", "Content-Type": "application/json", "Authorization": "Bearer proxy"}  # o proxy troca pela chave
BASE = "Outpainting of a real photograph. The input is a real photo placed in the center with flat gray empty bands around it. "
PROMPT = {
    "exterior": BASE + ("Fill ONLY the gray bands, naturally continuing the scene (sky, sea, beach, hills, boat hull, deck, railings, upholstery) "
                        "with the same lighting, perspective, colors and photographic style, as if the camera were further back with a wider lens. "
                        "Keep the central photo exactly identical: same people, same boat, same framing, no changes. "
                        "Do not add any new people, boats, text, logos or objects. Photorealistic, no gray bands left."),
    "interior": BASE + ("The photo was taken INSIDE a small boat cabin. Fill ONLY the gray bands by continuing the SAME enclosed interior: "
                        "the same walls, wooden trim, ceiling, upholstery and floor that touch the edges, as if the camera had a wider lens in the same tight space. "
                        "Enclosed space: NO windows, NO sea, NO sky, NO outdoors, NO deck, NO new furniture, NO new objects, NO people. "
                        "Keep the space the same size, do not make it look bigger. Same lighting and colors. "
                        "Keep the central photo exactly identical. Photorealistic, no gray bands left."),
}[MODO]
QUADROS = (7 / 6, 4 / 5)  # computador e celular (mesmo de enquadrar.py)
RATIOS = [(2048, 880), (1920, 1088), (1920, 1280), (1920, 1440), (1920, 1536), (1920, 1920), (1536, 1920), (1440, 1920), (1280, 1920), (1088, 1920)]


def req(url, dados=None):
    r = urllib.request.Request(url, data=json.dumps(dados).encode() if dados else None, headers=CAB, method="POST" if dados else "GET")
    with urllib.request.urlopen(r, timeout=60) as x:
        return json.load(x)


if FOTO.startswith(PERMITIDO):
    with urllib.request.urlopen(FOTO + ".jpg", timeout=30) as r:
        orig = ImageOps.exif_transpose(Image.open(io.BytesIO(r.read()))).convert("RGB")
else:
    orig = ImageOps.exif_transpose(Image.open(os.path.join(RAIZ, "img", FOTO + ".jpg"))).convert("RGB")
W, H = orig.size
# menor tela que contém a foto inteira nos dois quadros (com 3% de folga), no formato aceito pelo Runway mais próximo
Wc = max(W, H * QUADROS[0] * 1.03 if W < H * QUADROS[0] else W)
Hc = max(H, W / QUADROS[1] * 1.03 if H < W / QUADROS[1] else H)
if Wc == W and Hc == H:
    sys.exit("a foto já cabe inteira nos dois quadros")
op = []
for a, c in RATIOS:
    r = a / c
    tw, th = (Hc * r, Hc) if r > Wc / Hc else (Wc, Wc / r)
    op.append((tw * th, round(tw), round(th), f"{a}:{c}"))
_, T, TH, RATIO = min(op)
x0, y0 = (T - W) // 2, (TH - H) // 2
pad = Image.new("RGB", (T, TH), (128, 128, 128))
pad.paste(orig, (x0, y0))
b = io.BytesIO()
pad.save(b, "JPEG", quality=92)
t = req(API + "/text_to_image", {"model": "gpt_image_2", "promptText": PROMPT, "ratio": RATIO,
                                 "referenceImages": [{"uri": "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode(), "tag": "photo"}]})
for _ in range(90):
    time.sleep(5)
    s = req(API + "/tasks/" + t["id"])
    if s["status"] == "SUCCEEDED":
        break
    if s["status"] == "FAILED":
        sys.exit("Runway falhou: " + json.dumps(s))
else:
    sys.exit("Runway demorou demais")
with urllib.request.urlopen(s["output"][0], timeout=60) as r:
    gen = cv2.imdecode(np.frombuffer(r.read(), np.uint8), cv2.IMREAD_COLOR)

o = cv2.cvtColor(np.asarray(orig), cv2.COLOR_RGB2BGR)
sift = cv2.SIFT_create(4000)
k1, d1 = sift.detectAndCompute(cv2.cvtColor(o, cv2.COLOR_BGR2GRAY), None)
k2, d2 = sift.detectAndCompute(cv2.cvtColor(gen, cv2.COLOR_BGR2GRAY), None)
bons = [a for a, c in cv2.BFMatcher().knnMatch(d2, d1, k=2) if a.distance < 0.7 * c.distance]
M, inl = cv2.estimateAffinePartial2D(np.float32([k2[a.queryIdx].pt for a in bons]), np.float32([k1[a.trainIdx].pt for a in bons]),
                                     method=cv2.RANSAC, ransacReprojThreshold=4)
if M is None or inl.sum() < 60:
    sys.exit("não deu para alinhar a imagem gerada com a original: rode de novo")
M[0, 2] += x0
M[1, 2] += y0
gw = cv2.warpAffine(gen, M, (T, TH), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT).astype(np.float32)
# acerta a cor das bordas geradas pela foto real: a diferença (real - gerada) medida junto à borda da foto, bem suavizada,
# é somada às bordas e some aos poucos para fora (sem isso, céu em degradê fica com faixa visível na emenda)
dif_bordas = cv2.GaussianBlur(o.astype(np.float32) - gw[y0:y0 + H, x0:x0 + W], (0, 0), 15)
dif_bordas = cv2.copyMakeBorder(dif_bordas, y0, TH - H - y0, x0, T - W - x0, cv2.BORDER_REPLICATE)
xx, yy = np.meshgrid(np.arange(T), np.arange(TH))
dist = np.hypot(np.maximum(np.maximum(x0 - xx, xx - (x0 + W - 1)), 0), np.maximum(np.maximum(y0 - yy, yy - (y0 + H - 1)), 0))
alcance = max(T - W, TH - H, 2) * 0.6
gw = gw + dif_bordas * np.clip(1 - dist / alcance, 0, 1)[..., None]
F = 28  # emenda suave
rx = np.ones(W, np.float32)
ry = np.ones(H, np.float32)
for i in range(F):
    v = (i + 1) / (F + 1)
    if x0 > 0:
        rx[i] = rx[W - 1 - i] = v
    if y0 > 0:
        ry[i] = ry[H - 1 - i] = v
mask = np.zeros((TH, T), np.float32)
mask[y0:y0 + H, x0:x0 + W] = np.minimum(ry[:, None], rx[None, :])
oc = np.zeros_like(gw)
oc[y0:y0 + H, x0:x0 + W] = o
dif = float(np.abs(gw[y0 + 2:y0 + H - 2, x0 + 2:x0 + W - 2] - o[2:H - 2, 2:W - 2]).mean())
out = Image.fromarray(cv2.cvtColor((gw * (1 - mask[..., None]) + oc * mask[..., None]).clip(0, 255).astype(np.uint8), cv2.COLOR_BGR2RGB))
if max(out.size) > 1600:
    k = 1600 / max(out.size)
    out = out.resize((round(out.width * k), round(out.height * k)), Image.LANCZOS)
out.save(os.path.join(RAIZ, "img", NOME + ".jpg"), "JPEG", quality=84, optimize=True, progressive=True)
out.thumbnail((360, 360), Image.LANCZOS)
out.save(os.path.join(RAIZ, "img", NOME + "-t.jpg"), "JPEG", quality=80, optimize=True)
print(json.dumps({"foto": NOME, "tela": [T, TH], "ratio": RATIO, "pontos": int(inl.sum()), "diferenca_no_meio": round(dif, 1)}))
