"""Completa as laterais de uma foto em pé da galeria para a pessoa caber inteira no quadro do computador (2026-11-13).
Pedido do dono: sem mudar o tamanho do quadro, mostrar a pessoa da cabeça aos pés. A foto vira 4:3:
o Runway (gpt_image_2) completa só as laterais (céu, mar, deck) e depois a foto ORIGINAL é colada de volta, idêntica,
no meio (alinhada por pontos em comum, com emenda suave). A pessoa e a lancha continuam 100% da foto real.
Não roda na publicação: é a ferramenta da rotina que acha fotos novas com `enquadrar.py --nao-cabe` (sessão na nuvem,
onde a chave do Runway entra pelo proxy). Custa cerca de 20 créditos por foto.
Uso: python3 -I estender-laterais.py <foto (nome em img/ ou URL do banco sem .jpg)> <nome novo em img/, ex.: mb-18>
Saída: img/<nome>.jpg (até 1600 px) e img/<nome>-t.jpg (miniatura). Confira a imagem antes de usar."""
import base64, io, json, os, sys, time, urllib.request
import cv2
import numpy as np
from PIL import Image, ImageOps

FOTO, NOME = sys.argv[1], sys.argv[2]
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PERMITIDO = "https://sqoperylsqcbcjpcrlnp.supabase.co/storage/v1/object/public/lanchas/"
API = "https://api.dev.runwayml.com/v1"
CAB = {"X-Runway-Version": "2024-11-06", "Content-Type": "application/json", "Authorization": "Bearer proxy"}  # o proxy troca pela chave
PROMPT = ("Outpainting of a real photograph. The input image is a real photo placed in the center with flat gray empty bands on the left and right. "
          "Fill ONLY the gray side bands, naturally continuing the scene (sky, trees, beach, sea, boat deck, railings, upholstery) with the same lighting, "
          "perspective, colors and photographic style, as if the camera had a wider lens. Keep the central photo exactly identical: same person, same face, "
          "same body, same boat, same pose, same framing, no changes. Do not add any new people, text, logos or objects. Photorealistic, no gray bands left.")


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
T = round(H * 4 / 3)
x0 = (T - W) // 2
if T <= W:
    sys.exit("foto já é larga: não precisa completar")
pad = Image.new("RGB", (T, H), (128, 128, 128))
pad.paste(orig, (x0, 0))
b = io.BytesIO()
pad.save(b, "JPEG", quality=92)
t = req(API + "/text_to_image", {"model": "gpt_image_2", "promptText": PROMPT, "ratio": "1920:1440",
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
gw = cv2.warpAffine(gen, M, (T, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT).astype(np.float32)
F = 28  # emenda suave
mask = np.zeros((H, T), np.float32)
mask[:, x0 + F:x0 + W - F] = 1
for i in range(F):
    mask[:, x0 + i] = mask[:, x0 + W - 1 - i] = (i + 1) / (F + 1)
oc = np.zeros_like(gw)
oc[:, x0:x0 + W] = o
dif = float(np.abs(gw[:, x0 + 2:x0 + W - 2] - o[:, 2:W - 2]).mean())
out = Image.fromarray(cv2.cvtColor((gw * (1 - mask[..., None]) + oc * mask[..., None]).clip(0, 255).astype(np.uint8), cv2.COLOR_BGR2RGB))
if out.width > 1600:
    out = out.resize((1600, round(out.height * 1600 / out.width)), Image.LANCZOS)
out.save(os.path.join(RAIZ, "img", NOME + ".jpg"), "JPEG", quality=84, optimize=True, progressive=True)
out.thumbnail((360, 360), Image.LANCZOS)
out.save(os.path.join(RAIZ, "img", NOME + "-t.jpg"), "JPEG", quality=80, optimize=True)
print(json.dumps({"foto": NOME, "pontos": int(inl.sum()), "diferenca_no_meio": round(dif, 1)}))
