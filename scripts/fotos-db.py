"""Versão para o celular da 1a foto de cada lancha cadastrada no app (2026-11-09).
As fotos do banco ficam no Supabase só no tamanho original; aqui, na publicação, gera-se uma cópia de 800 px em img/db/.
Não altera nada no banco. Foto que falhar fica de fora e o site usa a original.
Uso: python3 -I fotos-db.py <pasta img> <url sem extensão> ...   Saída: JSON {url: "/img/db/nome-m.webp"}"""
import io, json, os, re, sys, urllib.request
from PIL import Image

PASTA, URLS = os.path.join(sys.argv[1], "db"), sys.argv[2:]
PERMITIDO = "https://sqoperylsqcbcjpcrlnp.supabase.co/storage/v1/object/public/lanchas/"
LARG = 800
os.makedirs(PASTA, exist_ok=True)
saida = {}
for u in URLS:
    try:
        if not u.startswith(PERMITIDO):
            raise ValueError("endereço fora do banco de fotos")
        nome = re.sub(r"[^a-z0-9]+", "-", u[len(PERMITIDO):].lower()).strip("-")
        with urllib.request.urlopen(urllib.request.Request(u + ".jpg", headers={"User-Agent": "buzios-site-build"}), timeout=30) as r:
            im = Image.open(io.BytesIO(r.read())).convert("RGB")
        if im.width > LARG:
            im = im.resize((LARG, round(im.height * LARG / im.width)), Image.LANCZOS)
        im.save(os.path.join(PASTA, nome + "-m.webp"), "WEBP", quality=72, method=6)
        im.save(os.path.join(PASTA, nome + ".jpg"), "JPEG", quality=80, optimize=True, progressive=True)  # as páginas de guia usam o .jpg como imagem de prévia
        saida[u] = f"/img/db/{nome}-m.webp"
    except Exception as e:
        print(f"fotos-db: {u}: {e}", file=sys.stderr)
print(json.dumps(saida))
