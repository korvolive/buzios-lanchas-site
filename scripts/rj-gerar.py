#!/usr/bin/env python3
"""Gera o site do rjlanchas.com.br (pasta rj/) em PT, EN e ES, em HTML estático (bom para o Google).

Rodrigo 2026-11-12: domínio para a futura expansão no estado do Rio; por enquanto o destino no ar é
Búzios (leva ao lanchaembuzios.com.br) e os outros destinos aparecem "Em breve", com texto próprio
(sem copiar o site de Búzios). Cabo Frio e Arraial entram no ar sozinhos quando tiverem lancha
publicada no app (mesma regra do lanchasregiaodoslagos.com.br).

Uso: python3 scripts/rj-gerar.py   (reescreve rj/index.html, rj/en/, rj/es/, rj/robots.txt, rj/sitemap.xml)
Toda mudança de texto vale para as três línguas: edite o dicionário T abaixo e rode de novo.
"""
import json, os, html

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "rj")
DOM = "https://www.rjlanchas.com.br"
BZ = "https://www.lanchaembuzios.com.br"
WA = "5521999272550"
PATH = {"pt": "/", "en": "/en/", "es": "/es/"}
HL = {"pt": "pt-BR", "en": "en", "es": "es"}
HOJE = "2026-11-12"

# destinos: k, nome, coordenada, site (quando houver), foto (só foto real; sem foto = ilustração), cores da ilustração
DEST = [
    dict(k="buzios", nome="Búzios", coord="22°45′S · 41°53′O", url=BZ, img="/img/buzios.jpg", live=True),
    dict(k="arraial", nome="Arraial do Cabo", coord="22°58′S · 42°02′O", url="https://www.lanchasemarraial.com.br",
         hue=["#06607a", "#29b3c2", "#e9f4f0"]),
    dict(k="cabo-frio", nome="Cabo Frio", coord="22°53′S · 42°01′O", url="https://www.cabofriolanchas.com.br",
         hue=["#0e7c93", "#4fb3c4", "#f2d99a"]),
    dict(k="rio", nome="Rio de Janeiro", coord="22°54′S · 43°10′O", hue=["#0a4a66", "#3a8fb0", "#f4dcb0"]),
    dict(k="angra", nome="Angra dos Reis e Ilha Grande", coord="23°00′S · 44°18′O", hue=["#0b5a4f", "#2fa391", "#e6f2da"]),
    dict(k="paraty", nome="Paraty", coord="23°13′S · 44°43′O", hue=["#11506b", "#4f9fae", "#f1e2c4"]),
]

T = {
 "pt": dict(
  title="RJ Lanchas | Aluguel de lancha no Rio de Janeiro",
  desc="Aluguel de lancha privativa com marinheiro no estado do Rio de Janeiro. Comece por Búzios, com passeios de 4 ou 7 horas. Em breve Arraial do Cabo, Cabo Frio, Rio, Angra e Paraty.",
  by="uma marca da Búzios Lanchas", nav="Idioma",
  eyebrow="Estado do Rio de Janeiro · Passeios de lancha",
  h1="Aluguel de lancha no <em>Rio de Janeiro</em>.",
  lead="Lanchas privativas com marinheiro, só para o seu grupo. Começamos por Búzios, um dos mares mais bonitos do estado, e vamos chegar aos outros destinos do Rio aos poucos.",
  cta="Ver lanchas em Búzios", cta2="Falar no WhatsApp",
  hdest="Destinos", sdest="Escolha onde quer passear. Os destinos marcados como em breve ainda não têm lanchas disponíveis.",
  go="Ver lanchas", soon="Em breve",
  d_buzios="Azeda, João Fernandes, Ilha Feia e Tartaruga. Lanchas de 4 ou 7 horas saindo da Praia dos Ossos, com preços por temporada no site.",
  d_arraial="Prainhas do Pontal do Atalaia, Praia do Forno e Gruta Azul, com a água mais transparente do estado.",
  **{"d_cabo-frio": "Ilha do Japonês, Praia do Forte e Ilha do Papagaio, no mar azul de Cabo Frio."},
  d_rio="Baía de Guanabara, Ilhas Cagarras e o pôr do sol com o Pão de Açúcar ao fundo.",
  d_angra="Lagoa Azul, Lagoa Verde e as centenas de ilhas da baía de Angra dos Reis.",
  d_paraty="Saco do Mamanguá, praias desertas e ilhas de água calma na baía de Paraty.",
  hinc="Como funciona o passeio",
  i1="Lancha só para o seu grupo", i1s="Passeio privativo com marinheiro, sem dividir a lancha com desconhecidos.",
  i2="Combustível, gelo e água inclusos", i2s="Também carvão e cooler. A equipe prepara o churrasco se você levar as carnes.",
  i3="Reserva com garantia", i3s="Empresa registrada, pagamento com recibo e atendimento direto pelo WhatsApp.",
  hfaq="Perguntas frequentes",
  faq=[
   ("Onde a RJ Lanchas já tem lanchas?", "Hoje os passeios são em Búzios, com a frota da Búzios Lanchas. Você vê todas as lanchas, fotos e preços em lanchaembuzios.com.br. Os outros destinos do estado aparecem aqui assim que tiverem lanchas."),
   ("O que está incluso no aluguel da lancha?", "Combustível, gelo, carvão, água mineral e cooler. Comidas e bebidas não estão inclusas, e a equipe prepara o churrasco se você levar as carnes."),
   ("Quantas pessoas cabem na lancha?", "Depende da lancha. A Miss Bardot, nossa principal em Búzios, tem 35 pés e leva até 16 pessoas, com ar-condicionado, gerador e air fryer. A Midas tem 32 pés e leva até 12."),
   ("Quanto tempo dura o passeio?", "Os passeios mais pedidos são de 4 horas e de 7 horas. Outros horários podem ser combinados pelo WhatsApp."),
   ("Como faço a reserva?", "Escolha a lancha no site de Búzios ou fale com a gente pelo WhatsApp (21) 99927-2550. A reserva é confirmada com um sinal e o restante é pago no embarque."),
  ],
  waB="Fale conosco", waM="Olá! Vim pelo site RJ Lanchas e quero saber sobre passeio de lancha.",
  foot="© 2026 Búzios Lanchas · CNPJ 32.154.099/0001-72"),
 "en": dict(
  title="RJ Lanchas | Boat rental in Rio de Janeiro",
  desc="Private boat rental with a skipper in the state of Rio de Janeiro. Start with Búzios, with 4 or 7 hour tours. Coming soon: Arraial do Cabo, Cabo Frio, Rio, Angra and Paraty.",
  by="a Búzios Lanchas brand", nav="Language",
  eyebrow="State of Rio de Janeiro · Boat tours",
  h1="Boat rental in <em>Rio de Janeiro</em>.",
  lead="Private boats with a skipper, just for your group. We start in Búzios, home to some of the most beautiful waters in the state, and will reach the other destinations of Rio step by step.",
  cta="See boats in Búzios", cta2="Chat on WhatsApp",
  hdest="Destinations", sdest="Choose where you want to go. Destinations marked coming soon do not have boats available yet.",
  go="See boats", soon="Coming soon",
  d_buzios="Azeda, João Fernandes, Ilha Feia and Tartaruga. 4 or 7 hour tours leaving from Praia dos Ossos, with seasonal prices on the website.",
  d_arraial="Prainhas do Pontal do Atalaia, Praia do Forno and the Blue Grotto, with the clearest water in the state.",
  **{"d_cabo-frio": "Ilha do Japonês, Praia do Forte and Ilha do Papagaio, on the blue waters of Cabo Frio."},
  d_rio="Guanabara Bay, the Cagarras Islands and the sunset behind Sugarloaf Mountain.",
  d_angra="Lagoa Azul, Lagoa Verde and the hundreds of islands of Angra dos Reis bay.",
  d_paraty="Saco do Mamanguá, empty beaches and calm-water islands in Paraty bay.",
  hinc="How the tour works",
  i1="A boat just for your group", i1s="Private tour with a skipper, no sharing the boat with strangers.",
  i2="Fuel, ice and water included", i2s="Charcoal and a cooler too. The crew grills for you if you bring the meat.",
  i3="Guaranteed booking", i3s="Registered company, payment with receipt and direct support on WhatsApp.",
  hfaq="Frequently asked questions",
  faq=[
   ("Where does RJ Lanchas have boats today?", "Today our tours are in Búzios, with the Búzios Lanchas fleet. You can see every boat, photos and prices at lanchaembuzios.com.br. Other destinations in the state will show up here as soon as they have boats."),
   ("What is included in the boat rental?", "Fuel, ice, charcoal, mineral water and a cooler. Food and drinks are not included, and the crew grills for you if you bring the meat."),
   ("How many people fit on the boat?", "It depends on the boat. Miss Bardot, our main boat in Búzios, is 35 feet and takes up to 16 people, with air conditioning, a generator and an air fryer. Midas is 32 feet and takes up to 12."),
   ("How long is the tour?", "The most popular tours are 4 hours and 7 hours. Other times can be arranged on WhatsApp."),
   ("How do I book?", "Choose your boat on the Búzios website or message us on WhatsApp +55 21 99927-2550. Your booking is confirmed with a deposit and the rest is paid at boarding."),
  ],
  waB="Chat with us", waM="Hi! I found you on the RJ Lanchas website and I would like to know about boat tours.",
  foot="© 2026 Búzios Lanchas · CNPJ 32.154.099/0001-72"),
 "es": dict(
  title="RJ Lanchas | Alquiler de lancha en Río de Janeiro",
  desc="Alquiler de lancha privada con marinero en el estado de Río de Janeiro. Empieza por Búzios, con paseos de 4 o 7 horas. Muy pronto Arraial do Cabo, Cabo Frio, Río, Angra y Paraty.",
  by="una marca de Búzios Lanchas", nav="Idioma",
  eyebrow="Estado de Río de Janeiro · Paseos en lancha",
  h1="Alquiler de lancha en <em>Río de Janeiro</em>.",
  lead="Lanchas privadas con marinero, solo para tu grupo. Empezamos por Búzios, uno de los mares más lindos del estado, y llegaremos a los otros destinos de Río poco a poco.",
  cta="Ver lanchas en Búzios", cta2="Hablar por WhatsApp",
  hdest="Destinos", sdest="Elige dónde quieres pasear. Los destinos marcados como muy pronto todavía no tienen lanchas disponibles.",
  go="Ver lanchas", soon="Muy pronto",
  d_buzios="Azeda, João Fernandes, Ilha Feia y Tartaruga. Paseos de 4 o 7 horas saliendo de Praia dos Ossos, con precios por temporada en el sitio.",
  d_arraial="Prainhas do Pontal do Atalaia, Praia do Forno y la Gruta Azul, con el agua más transparente del estado.",
  **{"d_cabo-frio": "Ilha do Japonês, Praia do Forte y Ilha do Papagaio, en el mar azul de Cabo Frio."},
  d_rio="La Bahía de Guanabara, las Islas Cagarras y el atardecer con el Pan de Azúcar de fondo.",
  d_angra="Lagoa Azul, Lagoa Verde y los cientos de islas de la bahía de Angra dos Reis.",
  d_paraty="Saco do Mamanguá, playas desiertas e islas de agua tranquila en la bahía de Paraty.",
  hinc="Cómo funciona el paseo",
  i1="Lancha solo para tu grupo", i1s="Paseo privado con marinero, sin compartir la lancha con desconocidos.",
  i2="Combustible, hielo y agua incluidos", i2s="También carbón y conservadora. El equipo prepara el asado si llevas la carne.",
  i3="Reserva con garantía", i3s="Empresa registrada, pago con recibo y atención directa por WhatsApp.",
  hfaq="Preguntas frecuentes",
  faq=[
   ("¿Dónde tiene lanchas RJ Lanchas hoy?", "Hoy los paseos son en Búzios, con la flota de Búzios Lanchas. Puedes ver todas las lanchas, fotos y precios en lanchaembuzios.com.br. Los otros destinos del estado aparecerán aquí en cuanto tengan lanchas."),
   ("¿Qué incluye el alquiler de la lancha?", "Combustible, hielo, carbón, agua mineral y conservadora. Comidas y bebidas no están incluidas, y el equipo prepara el asado si llevas la carne."),
   ("¿Cuántas personas caben en la lancha?", "Depende de la lancha. La Miss Bardot, nuestra principal en Búzios, tiene 35 pies y lleva hasta 16 personas, con aire acondicionado, generador y freidora de aire. La Midas tiene 32 pies y lleva hasta 12."),
   ("¿Cuánto dura el paseo?", "Los paseos más pedidos son de 4 horas y de 7 horas. Otros horarios se pueden combinar por WhatsApp."),
   ("¿Cómo reservo?", "Elige la lancha en el sitio de Búzios o escríbenos por WhatsApp +55 21 99927-2550. La reserva se confirma con una seña y el resto se paga al embarcar."),
  ],
  waB="Habla con nosotros", waM="¡Hola! Vengo del sitio RJ Lanchas y quiero saber sobre paseos en lancha.",
  foot="© 2026 Búzios Lanchas · CNPJ 32.154.099/0001-72"),
}

ICON = {
 "i1": '<path d="M3 17h18l-3 4H6z"/><path d="M11 16V5l7 11z"/>',
 "i2": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 "i3": '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
}
WA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>'

CSS = """:root{--bg:#f3f7f8;--surface:#fff;--ink:#0c2430;--muted:#55707b;--line:#d6e2e6;--sea:#0b5c73;--sea-deep:#06394a;--brass:#c99a2e;--brass-ink:#3d2c06;
--display:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;--body:"Figtree",ui-sans-serif,system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 var(--body)}
a{color:inherit}.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
header{background:var(--sea-deep);color:#eaf4f6}
header .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px;padding-top:env(safe-area-inset-top,0px)}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.logo b{display:block;font:800 20px/1.1 var(--display);letter-spacing:-.01em}
.logo small{display:block;font:500 10.5px/1.3 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:#a9c6ce;margin-top:3px}
.lang{display:flex;border:1px solid rgba(201,154,46,.7);border-radius:999px;overflow:hidden}
.lang a{font:600 13px var(--body);padding:7px 12px;color:#e9d7a9;text-decoration:none}
.lang a[aria-current]{background:var(--brass);color:var(--brass-ink)}
.hero{position:relative;color:#eef6f8;background:radial-gradient(1200px 500px at 85% -10%,rgba(201,154,46,.20),transparent 60%),linear-gradient(170deg,var(--sea-deep) 0%,var(--sea) 70%,#0e6f86 100%);padding:44px 0 120px;overflow:hidden}
.hero::before{content:"";position:absolute;inset:0;background:url("/img/buzios.jpg") center/cover;opacity:.18;mix-blend-mode:luminosity}
.hero .wrap{position:relative}
.eyebrow{font:500 12.5px var(--mono);letter-spacing:.06em;color:#a9c6ce;margin:0 0 12px}
h1{font:800 clamp(32px,4.6vw,56px)/1.03 var(--display);letter-spacing:-.025em;margin:0;max-width:18ch}
h1 em{font-style:normal;color:var(--brass)}
.lead{font-size:clamp(16px,1.6vw,18.5px);color:#d3e6ea;max-width:62ch;margin:14px 0 22px}
.btns{display:flex;flex-wrap:wrap;gap:10px}
.btn{display:inline-flex;align-items:center;gap:8px;font:700 15.5px var(--body);border-radius:999px;padding:12px 20px;text-decoration:none}
.btn.p{background:var(--brass);color:var(--brass-ink)}.btn.s{border:1px solid rgba(255,255,255,.45);color:#fff}
.btn:focus-visible,.dest a:focus-visible{outline:3px solid #fff;outline-offset:3px}
.wave{position:absolute;left:0;right:0;bottom:-1px;width:100%;height:70px;display:block}
main{position:relative;z-index:1;margin-top:-80px;padding-bottom:36px}
h2{font:800 clamp(24px,2.6vw,32px)/1.1 var(--display);letter-spacing:-.02em;margin:0 0 6px}
.sub{color:var(--muted);margin:0 0 18px;max-width:70ch}
section+section{margin-top:44px}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:22px;box-shadow:0 18px 40px -26px rgba(6,57,74,.45)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.city{position:relative;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden;text-decoration:none;transition:transform .25s ease,box-shadow .25s ease}
a.city:hover{transform:translateY(-3px);box-shadow:0 22px 44px -24px rgba(6,57,74,.55)}
.pic{position:relative;aspect-ratio:16/9;overflow:hidden;background:var(--sea)}
.pic img{width:100%;height:100%;object-fit:cover;display:block}
.pic svg{position:absolute;inset:0;width:100%;height:100%}
.coord{position:absolute;left:12px;bottom:9px;font:500 11px var(--mono);letter-spacing:.05em;color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.45)}
.soon{position:absolute;top:10px;right:10px;font:600 12px var(--body);background:rgba(6,57,74,.78);color:#f3e3b8;border:1px solid rgba(201,154,46,.7);padding:4px 10px;border-radius:999px}
.body{padding:13px 16px 15px;display:flex;flex-direction:column;flex:1}
.body h3{font:800 21px/1.1 var(--display);letter-spacing:-.015em;margin:0}
.body p{color:var(--muted);font-size:14.5px;line-height:1.45;margin:6px 0 12px;flex:1}
.cta{align-self:flex-start;font:600 14.5px var(--body);background:var(--brass);color:var(--brass-ink);border-radius:999px;padding:8px 15px}
.city.off .cta{background:var(--bg);color:var(--muted);border:1px solid var(--line)}
.inc{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.inc div{display:flex;gap:12px;align-items:flex-start}
.inc svg{flex:none;color:var(--sea);margin-top:2px}
.inc b{display:block;font:700 15.5px var(--body)}.inc span{display:block;color:var(--muted);font-size:14px;line-height:1.45}
details{border-top:1px solid var(--line);padding:14px 0}details:first-of-type{border-top:0;padding-top:4px}
summary{cursor:pointer;font:700 16px var(--body);list-style:none;display:flex;justify-content:space-between;gap:12px}
summary::-webkit-details-marker{display:none}summary::after{content:"+";color:var(--sea);font-weight:800}
details[open] summary::after{content:"–"}
details p{color:var(--muted);margin:8px 0 0;max-width:75ch}
footer{background:var(--sea-deep);color:#a9c6ce;font-size:14px;padding:18px 0 calc(18px + env(safe-area-inset-bottom,0px))}
footer .wrap{display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between}
footer a{color:#e9d7a9;text-decoration:none}
.wa-fab{position:fixed;right:18px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:5;display:inline-flex;align-items:center;gap:8px;background:#25d366;color:#fff;text-decoration:none;font:700 15px var(--body);padding:12px 18px 12px 14px;border-radius:999px;box-shadow:0 10px 26px -8px rgba(0,0,0,.45)}
.wa-fab svg{width:24px;height:24px}
@media (max-width:900px){.grid{grid-template-columns:1fr 1fr}.inc{grid-template-columns:1fr;gap:14px}}
@media (max-width:600px){.wrap{padding:0 16px}.hero{padding:28px 0 104px}main{margin-top:-72px}.grid{grid-template-columns:1fr;gap:12px}
.city{flex-direction:row}.pic{aspect-ratio:auto;width:36%;flex:none;min-height:150px}.coord{display:none}.soon{top:8px;right:auto;left:8px;font-size:11px;padding:3px 8px}
.body{padding:12px 14px}.body h3{font-size:18.5px}.body p{font-size:13.5px;margin:4px 0 10px}.cta{font-size:13.5px;padding:7px 13px}
.logo small{display:none}.logo b{font-size:17px}.lang a{padding:6px 9px;font-size:12.5px}.panel{padding:18px 16px}
.btn{flex:1;justify-content:center}.wa-fab{right:14px;padding:13px}.wa-fab span{display:none}footer{padding-bottom:calc(84px + env(safe-area-inset-bottom,0px))}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}""".replace("%BZ%", BZ)


def art(d):
    h = d["hue"]; k = d["k"]
    ondas = "".join(f'<path d="M0 {185+i*26}c50-12 100-12 150 0s100 12 150 0 70-10 100-4" fill="none" stroke="#fff" stroke-opacity="{.35-i*.05:.2f}" stroke-width="1.6"/>' for i in range(5))
    return (f'<svg viewBox="0 0 400 310" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="g-{k}" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{h[2]}"/><stop offset=".46" stop-color="{h[1]}"/><stop offset="1" stop-color="{h[0]}"/></linearGradient></defs>'
            f'<rect width="400" height="310" fill="url(#g-{k})"/><circle cx="300" cy="92" r="38" fill="#fff" opacity=".55"/>'
            f'<path d="M0 158c30-30 70-52 112-40 26 8 40 26 70 26 34 0 52-22 86-18 22 3 36 14 50 24v10H0z" fill="#0a4f63" opacity=".5"/>{ondas}'
            f'<path d="M232 214h52l-9 11h-34z" fill="#fff" opacity=".9"/><path d="M250 212v-22l15 22z" fill="#c99a2e"/></svg>')


def card(d, t, lang):
    coord = d["coord"].replace("O", "W") if lang == "en" else d["coord"]
    pic = f'<img src="{d["img"]}" alt="{html.escape(d["nome"])}" loading="lazy" width="900" height="506">' if d.get("img") else art(d)
    live = d.get("live")
    soon = "" if live else f'<span class="soon">{t["soon"]}</span>'
    body = (f'<div class="body"><h3>{d["nome"]}</h3><p>{t["d_" + d["k"]]}</p>'
            f'<span class="cta">{t["go"] + " →" if live else t["soon"]}</span></div>')
    inner = f'<div class="pic">{pic}{soon}<span class="coord">{coord}</span></div>{body}'
    extra = f' data-k="{d["k"]}" data-url="{d["url"]}"' if (not live and d.get("url")) else ""
    if live:
        return f'<a class="city" href="{d["url"]}{PATH[lang]}">{inner}</a>'
    return f'<div class="city off"{extra}>{inner}</div>'


def pagina(lang):
    t = T[lang]
    url = DOM + PATH[lang]
    alt = "".join(f'<link rel="alternate" hreflang="{HL[l]}" href="{DOM + PATH[l]}">' for l in T) + f'<link rel="alternate" hreflang="x-default" href="{DOM}/">'
    langs = "".join(f'<a href="{PATH[l]}" hreflang="{HL[l]}" lang="{HL[l]}"{" aria-current=\"page\"" if l == lang else ""}>{l.upper()}</a>' for l in T)
    wa = f"https://wa.me/{WA}?text=" + __import__("urllib.parse").parse.quote(t["waM"])
    ld = [
        {"@context": "https://schema.org", "@type": "TravelAgency", "name": "RJ Lanchas", "url": url,
         "description": t["desc"], "telephone": "+55 21 99927-2550", "image": DOM + "/img/buzios.jpg",
         "parentOrganization": {"@type": "Organization", "name": "Búzios Lanchas", "url": BZ + "/"},
         "areaServed": [{"@type": "State", "name": "Rio de Janeiro"}, {"@type": "City", "name": "Armação dos Búzios"}],
         "sameAs": ["https://www.instagram.com/missbardotbuzios/", BZ + "/"]},
        {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": HL[lang],
         "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t["faq"]]},
    ]
    faq = "".join(f"<details><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>" for q, a in t["faq"])
    inc = "".join(f'<div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICON[i]}</svg><p style="margin:0"><b>{t[i]}</b><span>{t[i + "s"]}</span></p></div>' for i in ("i1", "i2", "i3"))
    cards = "".join(card(d, t, lang) for d in DEST)
    return f"""<!doctype html><html lang="{HL[lang]}"><head><meta charset="utf-8">
<!-- rjlanchas.com.br: gerado por scripts/rj-gerar.py (não edite à mão; edite o script e rode de novo) -->
<script>(function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'gtm.start':new Date().getTime(),event:'gtm.js'}});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);}})(window,document,'script','dataLayer','GTM-NVP9L5DF');</script>
<title>{t["title"]}</title>
<meta name="description" content="{html.escape(t["desc"])}">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#06394a">
<link rel="canonical" href="{url}">{alt}
<meta property="og:title" content="{html.escape(t["title"])}"><meta property="og:description" content="{html.escape(t["desc"])}">
<meta property="og:image" content="{DOM}/img/buzios.jpg"><meta property="og:url" content="{url}"><meta property="og:type" content="website"><meta property="og:site_name" content="RJ Lanchas">
<link rel="icon" href="{BZ}/apple-touch-icon.png"><link rel="apple-touch-icon" href="{BZ}/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<style>{CSS}</style></head><body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NVP9L5DF" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<header><div class="wrap">
<a class="logo" href="{PATH[lang]}" aria-label="RJ Lanchas"><svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="16" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 20h22l-4 5H10z" fill="currentColor"/><path d="M14 19V9l7 10z" fill="#c99a2e"/></svg><span><b>RJ Lanchas</b><small>{t["by"]}</small></span></a>
<nav class="lang" aria-label="{t["nav"]}">{langs}</nav>
</div></header>
<section class="hero"><div class="wrap">
<p class="eyebrow">{t["eyebrow"]}</p><h1>{t["h1"]}</h1><p class="lead">{t["lead"]}</p>
<div class="btns"><a class="btn p" href="{BZ}{PATH[lang]}">{t["cta"]} →</a><a class="btn s" href="{wa}" rel="noopener">{t["cta2"]}</a></div>
</div><svg class="wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0 50c160-30 320-30 480 0s320 30 480 0 320-30 480 0v40H0z" fill="#f3f7f8"/></svg></section>
<main><div class="wrap">
<section class="panel" aria-labelledby="h-dest"><h2 id="h-dest">{t["hdest"]}</h2><p class="sub">{t["sdest"]}</p><div class="grid" id="grid">{cards}</div></section>
<section aria-labelledby="h-inc"><h2 id="h-inc">{t["hinc"]}</h2><div class="inc" style="margin-top:14px">{inc}</div></section>
<section class="panel" aria-labelledby="h-faq"><h2 id="h-faq">{t["hfaq"]}</h2>{faq}</section>
</div></main>
<footer><div class="wrap"><span>{t["foot"]}</span><span><a href="https://wa.me/{WA}" rel="noopener">WhatsApp (21) 99927-2550</a> · <a href="https://www.instagram.com/missbardotbuzios/" rel="noopener">@missbardotbuzios</a> · <a href="{BZ}{PATH[lang]}">lanchaembuzios.com.br</a></span></div></footer>
<a class="wa-fab" href="{wa}" target="_blank" rel="noopener" aria-label="{t["waB"]}">{WA_SVG}<span>{t["waB"]}</span></a>
<script>
/* Arraial e Cabo Frio entram no ar sozinhos quando tiverem lancha publicada no app (ativa, não oculta) */
(function(){{var API="https://sqoperylsqcbcjpcrlnp.supabase.co/rest/v1/lanchas",KEY="sb_publishable_Dvz6L37Nn7kTKyPmh0_CHw_5CJnQIuJ",GO={json.dumps(t["go"] + " →", ensure_ascii=False)},P={json.dumps(PATH[lang])};
document.querySelectorAll(".city.off[data-k]").forEach(function(el){{fetch(API+"?select=slug&dados->>cidade=eq."+el.dataset.k+"&ativa=is.true&oculta=is.false&limit=1",{{headers:{{apikey:KEY}}}}).then(function(r){{return r.ok?r.json():[]}}).then(function(r){{if(!r.length)return;
var a=document.createElement("a");a.className="city";a.href=el.dataset.url+P;a.innerHTML=el.innerHTML;var s=a.querySelector(".soon");if(s)s.remove();a.querySelector(".cta").textContent=GO;el.replaceWith(a);}}).catch(function(){{}});}});}})();
</script>
</body></html>
"""


def main():
    for lang in T:
        d = os.path.join(RAIZ, PATH[lang].strip("/"))
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
            f.write(pagina(lang))
    with open(os.path.join(RAIZ, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\n\nSitemap: {DOM}/sitemap.xml\n")
    urls = "".join(
        f"<url><loc>{DOM + PATH[l]}</loc><lastmod>{HOJE}</lastmod>"
        + "".join(f'<xhtml:link rel="alternate" hreflang="{HL[o]}" href="{DOM + PATH[o]}"/>' for o in T)
        + "</url>" for l in T)
    with open(os.path.join(RAIZ, "sitemap.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
                + urls + "</urlset>\n")
    print("rj/ gerado:", ", ".join(PATH.values()))


if __name__ == "__main__":
    main()
