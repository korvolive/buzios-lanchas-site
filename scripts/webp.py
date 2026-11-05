"""Gera as versões WebP das fotos de img/ (2026-11-05, site mais rápido no celular).
Para cada foto.jpg: foto.webp (mesmo tamanho) e, se for larga, foto-m.webp (800 px, para o celular).
Para cada foto-t.jpg (miniatura): foto-t.webp. Só gera o que falta ou ficou mais velho que o .jpg.
Roda na publicação (deploy.yml) antes de montar as páginas; também dá para rodar à mão: python3 scripts/webp.py"""
import os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "img")
MED = 800

def salva(src, dst, largura=None, q=78):
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return False
    im = Image.open(src)
    im = im.convert("RGB")
    if largura and im.width > largura:
        im = im.resize((largura, round(im.height * largura / im.width)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=q, method=6)
    return True

n = 0
for nome in sorted(os.listdir(ROOT)):
    if not nome.endswith(".jpg"):
        continue
    src = os.path.join(ROOT, nome)
    base = src[:-4]
    n += salva(src, base + ".webp")
    if not nome.endswith("-t.jpg"):
        n += salva(src, base + "-m.webp", MED, 75)
print(f"webp: {n} arquivos gerados")
