#!/usr/bin/env python3
"""Gera as páginas em inglês e espanhol do lanchasregiaodoslagos.com.br (pasta regiao/).

2026-11-16: o Google Search Console acusou 404 em /en/ e /es/ desse domínio. A fonte continua sendo
regiao/index.html (textos das 3 línguas no dicionário T); este script copia a página para regiao/en/ e
regiao/es/ trocando só o cabeçalho (língua, título, descrição, canonical) e gera robots.txt e sitemap.xml.

Uso: python3 scripts/regiao-gerar.py   (rode de novo sempre que mudar regiao/index.html)
"""
import os

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "regiao")
DOM = "https://www.lanchasregiaodoslagos.com.br"
HOJE = "2026-11-16"

PT = {
    "lang": '<html lang="pt-BR">',
    "title": "<title>Lanchas Região dos Lagos | Búzios, Cabo Frio e Arraial do Cabo</title>",
    "desc": '<meta name="description" content="Aluguel de lancha na Região dos Lagos (RJ): escolha a cidade do seu passeio, Búzios, Cabo Frio ou Arraial do Cabo. Um serviço da Búzios Lanchas.">',
    "canon": f'<link rel="canonical" href="{DOM}/">',
    "ogd": '<meta property="og:description" content="Búzios, Cabo Frio e Arraial do Cabo: escolha a cidade do seu passeio de lancha.">',
}
OUTRAS = {
    "en": {
        "lang": '<html lang="en">',
        "title": "<title>Boat Rental in the Lakes Region, Brazil | Búzios, Cabo Frio and Arraial do Cabo</title>",
        "desc": '<meta name="description" content="Private boat tours in the Lakes Region (Rio de Janeiro, Brazil): choose your city, Búzios, Cabo Frio or Arraial do Cabo. A Búzios Lanchas service.">',
        "canon": f'<link rel="canonical" href="{DOM}/en/">',
        "ogd": '<meta property="og:description" content="Búzios, Cabo Frio and Arraial do Cabo: choose the city for your boat tour.">',
    },
    "es": {
        "lang": '<html lang="es">',
        "title": "<title>Alquiler de Lancha en la Región de los Lagos, Brasil | Búzios, Cabo Frio y Arraial do Cabo</title>",
        "desc": '<meta name="description" content="Paseos en lancha privada en la Región de los Lagos (Río de Janeiro, Brasil): elige tu ciudad, Búzios, Cabo Frio o Arraial do Cabo. Un servicio de Búzios Lanchas.">',
        "canon": f'<link rel="canonical" href="{DOM}/es/">',
        "ogd": '<meta property="og:description" content="Búzios, Cabo Frio y Arraial do Cabo: elige la ciudad de tu paseo en lancha.">',
    },
}

fonte = open(os.path.join(RAIZ, "index.html"), encoding="utf-8").read()
for lg, novo in OUTRAS.items():
    s = fonte
    for k, v in PT.items():
        assert s.count(v) == 1, f"não achei no regiao/index.html: {v}"
        s = s.replace(v, novo[k])
    os.makedirs(os.path.join(RAIZ, lg), exist_ok=True)
    with open(os.path.join(RAIZ, lg, "index.html"), "w", encoding="utf-8") as f:
        f.write(s)

with open(os.path.join(RAIZ, "robots.txt"), "w", encoding="utf-8") as f:
    f.write(f"User-agent: *\nAllow: /\n\nSitemap: {DOM}/sitemap.xml\n")

alts = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{h}" href="{DOM}{p}"/>'
               for h, p in (("pt-BR", "/"), ("en", "/en/"), ("es", "/es/"), ("x-default", "/")))
urls = "".join(f"\n  <url>\n    <loc>{DOM}{p}</loc>\n    <lastmod>{HOJE}</lastmod>{alts}\n  </url>" for p in ("/", "/en/", "/es/"))
with open(os.path.join(RAIZ, "sitemap.xml"), "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            f'xmlns:xhtml="http://www.w3.org/1999/xhtml">{urls}\n</urlset>\n')
print("regiao/: en/, es/, robots.txt e sitemap.xml gerados")
