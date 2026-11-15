#!/usr/bin/env python3
"""Gera o site da Bordazul (bordazul.com.br, pasta bordazul/) em PT, EN e ES, em HTML estático.

2026-11-15: marca nacional de aluguel de barcos (donos anunciam os barcos, como um marketplace).
Fase 1: página de entrada. Búzios já tem embarque aberto (leva ao lanchaembuzios.com.br, com a data e
o número de pessoas escolhidos no bilhete); os outros destinos aparecem "Em breve" e o visitante pode
pedir aviso pelo WhatsApp. Donos de barco pedem o cadastro pelo WhatsApp.

Identidade própria (não repetir a cara do site de Búzios): o site é um bilhete de embarque.
Fontes Besley + Libre Franklin, azul do mar, papel branco e tinta quase preta.

Uso: python3 scripts/bordazul-gerar.py   (reescreve bordazul/index.html, bordazul/en/, bordazul/es/,
bordazul/robots.txt e bordazul/sitemap.xml). Texto novo vale para as três línguas: edite T e rode de novo.
Destino novo com barco no ar: mude "aberto" para a URL do site do destino em DEST.
"""
import html, json, os

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bordazul")
DOM = "https://www.bordazul.com.br"
BZ = "https://www.lanchaembuzios.com.br"
WA = "5521999272550"
PATH = {"pt": "/", "en": "/en/", "es": "/es/"}
HL = {"pt": "pt-BR", "en": "en", "es": "es"}
HOJE = "2026-11-15"

# Regiões e destinos. aberto = URL do site com barcos (por enquanto só Búzios). uf = estado.
DEST = [
    ("rj", [("buzios", "Búzios", "RJ", BZ), ("arraial", "Arraial do Cabo", "RJ", None), ("cabo-frio", "Cabo Frio", "RJ", None),
            ("rio", "Rio de Janeiro", "RJ", None), ("angra", "Angra dos Reis", "RJ", None), ("paraty", "Paraty", "RJ", None)]),
    ("sp", [("ilhabela", "Ilhabela", "SP", None), ("ubatuba", "Ubatuba", "SP", None), ("guaruja", "Guarujá", "SP", None)]),
    ("sul", [("floripa", "Florianópolis", "SC", None), ("bombinhas", "Bombinhas", "SC", None), ("camboriu", "Balneário Camboriú", "SC", None)]),
    ("ba", [("salvador", "Salvador", "BA", None), ("morro", "Morro de São Paulo", "BA", None), ("porto-seguro", "Porto Seguro", "BA", None)]),
    ("ne", [("maragogi", "Maragogi", "AL", None), ("porto-galinhas", "Porto de Galinhas", "PE", None), ("noronha", "Fernando de Noronha", "PE", None)]),
    ("lagos", [("capitolio", "Capitólio", "MG", None), ("paranoa", "Lago Paranoá, Brasília", "DF", None), ("manaus", "Rio Negro, Manaus", "AM", None)]),
]
# Os seis bilhetes da faixa de fotos (destinos do estado do Rio, onde a marca começa)
SLIPS = ["buzios", "arraial", "cabo-frio", "rio", "angra", "paraty"]
COORD = {"buzios": "22°45′S 41°53′O", "arraial": "22°58′S 42°02′O", "cabo-frio": "22°53′S 42°01′O",
         "rio": "22°54′S 43°10′O", "angra": "23°00′S 44°18′O", "paraty": "23°13′S 44°43′O"}
HERO_FOTOS = [("barco-1", 960, 1280), ("barco-2", 960, 1280), ("barco-4", 1080, 1236), ("barco-3", 1400, 1050)]

T = {
 "pt": dict(
  title="Bordazul | Aluguel de barco com marinheiro no Brasil",
  desc="Aluguel de lancha, iate e escuna com marinheiro nos mares do Brasil. Embarque aberto em Búzios; em breve Arraial do Cabo, Rio, Angra, Paraty e outros destinos.",
  nav=[("#destinos", "Destinos"), ("#como", "Como funciona"), ("#barco", "Tem um barco?"), ("#perguntas", "Perguntas")],
  navcta="Barcos em Búzios", lang="Idioma",
  h1="Seu dia no mar,<br>em todo o Brasil.",
  lead="Barcos com marinheiro, só para o seu grupo. Escolha o destino, a data e quantas pessoas vão a bordo.",
  f_dest="Destino", f_data="Data", f_pes="Pessoas", f_btn="Ver barcos", menos="Menos uma pessoa", mais="Mais uma pessoa",
  r_aberto="Búzios tem embarque aberto. Levamos você às lanchas com a sua data e o seu grupo.",
  r_breve="{c} ainda não abriu. Quer saber primeiro quando tiver barco lá?", r_breve_btn="Me avise pelo WhatsApp",
  wa_breve="Olá! Quero ser avisado quando a Bordazul abrir em {c}.",
  links=[("#destinos", "Todos os destinos"), ("#como", "Como funciona"), ("#barco", "Anuncie seu barco")],
  foto_alt=["Lancha ancorada em águas verdes de Búzios", "Proa de lancha a caminho das praias", "Lancha na proa diante de uma ilha", "Lancha ao pôr do sol em Búzios"],
  s_p1="Começamos por Búzios, onde a primeira frota já leva grupos às praias.",
  s_p2="Depois vêm o mar do Rio e o Brasil inteiro, um destino de cada vez.",
  s_alt="Vista aérea da península de Búzios e suas ilhas",
  aberto="Embarque aberto", breve="Em breve", ver="Ver lanchas",
  slip={"buzios": "Azeda, João Fernandes, Ilha Feia e Tartaruga. Saídas da Praia dos Ossos.",
        "arraial": "Prainhas do Pontal do Atalaia, Praia do Forno e Gruta Azul.",
        "cabo-frio": "Ilha do Japonês, Praia do Forte e Ilha do Papagaio.",
        "rio": "Baía de Guanabara, Ilhas Cagarras e o Pão de Açúcar.",
        "angra": "Lagoa Azul, Lagoa Verde e as ilhas da baía.",
        "paraty": "Saco do Mamanguá e as ilhas de água calma."},
  como_h="Do sofá ao mar", como_p="Reservar um barco tem que ser tão simples quanto pedir um carro. Este é o caminho, do primeiro clique ao embarque.",
  como=[("Em casa", [("Escolha o destino e a data", "1 minuto"), ("Compare barcos, fotos e preços", "no site")]),
        ("Na reserva", [("Tire dúvidas com a gente", "WhatsApp"), ("Garanta a data com o sinal", "50%")]),
        ("No dia", [("Encontre o marinheiro no píer", "na hora marcada"), ("Pague o restante", "no embarque")])],
  como_fim=("Você no mar", "4 ou 7 horas"),
  mares="Mares", mares_p="Os destinos que a Bordazul vai cobrir. Abrimos cada um quando tiver barcos bons para alugar lá.",
  reg={"rj": "Rio de Janeiro", "sp": "São Paulo", "sul": "Santa Catarina", "ba": "Bahia", "ne": "Alagoas e Pernambuco", "lagos": "Lagos e rios"},
  carta=["<strong>Tem um barco parado na marina?</strong> Ele pode virar passeio e renda, sem você precisar cuidar de anúncio, atendimento ou cobrança.",
         "A Bordazul nasceu de uma empresa de passeios de lancha em Búzios que já faz isso todos os dias: recebe o cliente, tira as dúvidas, confirma a data e cobra o sinal. O dono só cuida do barco e do passeio.",
         "Agora vamos levar esse jeito de trabalhar para outros mares do Brasil. Estamos abrindo os cadastros aos poucos, destino por destino, para cada cidade já começar com barcos bons.",
         "Se você tem lancha, iate, veleiro, catamarã ou escuna com marinheiro habilitado, fale com a gente. Você define o preço que quer receber, e o barco fica na agenda só quando você quiser."],
  carta_ass="Equipe Bordazul", carta_cargo="Cadastro de barcos", carta_btn="Quero anunciar meu barco",
  wa_dono="Olá! Tenho um barco e quero anunciar na Bordazul.",
  faq_h="Perguntas",
  faq=[("O que é a Bordazul?", "Uma plataforma para alugar barcos com marinheiro nos destinos náuticos do Brasil, com os barcos de vários donos reunidos em um só lugar."),
       ("Onde já tem barcos?", "Em Búzios, no Rio de Janeiro. Lá você vê todas as lanchas, fotos e preços por temporada e reserva online. Os outros destinos abrem aos poucos."),
       ("Todo barco tem marinheiro?", "Sim. Todos os passeios são feitos com marinheiro habilitado, e o barco é só do seu grupo."),
       ("O que vem incluso em Búzios?", "Combustível, gelo, carvão, água mineral e cooler. Comidas e bebidas não estão inclusas, e a equipe prepara o churrasco se você levar as carnes."),
       ("Como faço a reserva?", "Escolha o barco, a data e o número de pessoas. A data fica garantida com um sinal de 50%, e o restante é pago no dia do passeio."),
       ("Como posso pagar?", "O sinal pode ser pago por Pix em qualquer data e com cartão quando faltam 5 dias ou mais para o passeio."),
       ("E se eu precisar desistir?", "Você pode ficar com crédito de 100% do sinal por 1 ano. Com 7 dias ou mais de antecedência, também pode pedir o sinal inteiro de volta."),
       ("E se o mar não estiver bom?", "O passeio é remarcado para outra data, sem custo."),
       ("Quando abre a minha cidade?", "Assim que tiver barcos bons para alugar lá. Peça aviso pelo WhatsApp e você fica sabendo primeiro."),
       ("Posso anunciar meu barco?", "Pode. Fale com a gente pelo WhatsApp: os cadastros estão abrindo destino por destino."),
       ("Quem está por trás da Bordazul?", "A Búzios Lanchas, empresa registrada que já leva grupos para passear de lancha em Búzios.")],
  cta_p="A primeira frota já está na água. O resto do Brasil vem logo atrás.",
  cta_h="Partiu Búzios?", cta_l="Lanchas de 22 a 35 pés, para até 16 pessoas, com passeios de 4 ou 7 horas.", cta_btn="Ver lanchas em Búzios",
  pe_h="Até a bordo.", pe_p="Escreva para a gente quando quiser: sobre um passeio, sobre o seu barco ou para saber quando a sua cidade abre.",
  pe_selo="Lancha em Búzios",
  pe_imp="© 2026 Bordazul, uma marca da Búzios Lanchas · CNPJ 32.154.099/0001-72",
  wa_geral="Olá! Vim pelo site da Bordazul.",
  noscript="Para ver as lanchas, abra o site de Búzios.",
 ),
 "en": dict(
  title="Bordazul | Boat rental with a skipper in Brazil",
  desc="Rent a motorboat, yacht or schooner with a skipper on Brazil's waters. Now boarding in Búzios; coming soon to Arraial do Cabo, Rio, Angra, Paraty and more.",
  nav=[("#destinos", "Destinations"), ("#como", "How it works"), ("#barco", "Own a boat?"), ("#perguntas", "Questions")],
  navcta="Boats in Búzios", lang="Language",
  h1="Your day at sea,<br>all over Brazil.",
  lead="Boats with a skipper, just for your group. Choose the destination, the date and how many people are coming aboard.",
  f_dest="Destination", f_data="Date", f_pes="People", f_btn="See boats", menos="One person less", mais="One person more",
  r_aberto="Búzios is boarding now. We will take you to the boats with your date and your group.",
  r_breve="{c} is not open yet. Want to hear first when it has boats?", r_breve_btn="Tell me on WhatsApp",
  wa_breve="Hi! Please let me know when Bordazul opens in {c}.",
  links=[("#destinos", "All destinations"), ("#como", "How it works"), ("#barco", "List your boat")],
  foto_alt=["Motorboat anchored in the green waters of Búzios", "Bow of a boat heading to the beaches", "On the bow in front of an island", "Motorboat at sunset in Búzios"],
  s_p1="We start in Búzios, where the first fleet already takes groups to the beaches.",
  s_p2="Then the rest of Rio's coast and all of Brazil, one destination at a time.",
  s_alt="Aerial view of the Búzios peninsula and its islands",
  aberto="Boarding now", breve="Coming soon", ver="See boats",
  slip={"buzios": "Azeda, João Fernandes, Ilha Feia and Tartaruga. Departures from Praia dos Ossos.",
        "arraial": "Pontal do Atalaia, Praia do Forno and the Blue Grotto.",
        "cabo-frio": "Ilha do Japonês, Praia do Forte and Ilha do Papagaio.",
        "rio": "Guanabara Bay, the Cagarras Islands and Sugarloaf.",
        "angra": "Lagoa Azul, Lagoa Verde and the islands of the bay.",
        "paraty": "Saco do Mamanguá and calm-water islands."},
  como_h="Couch to coast", como_p="Booking a boat should be as easy as calling a car. Here is the way, from the first click to boarding.",
  como=[("At home", [("Pick the destination and date", "1 minute"), ("Compare boats, photos and prices", "online")]),
        ("Booking", [("Ask us anything", "WhatsApp"), ("Secure the date with a deposit", "50%")]),
        ("On the day", [("Meet your skipper at the pier", "on time"), ("Pay the rest", "at boarding")])],
  como_fim=("You, at sea", "4 or 7 hours"),
  mares="Seas", mares_p="The destinations Bordazul will cover. We open each one once it has good boats to rent.",
  reg={"rj": "Rio de Janeiro", "sp": "São Paulo", "sul": "Santa Catarina", "ba": "Bahia", "ne": "Alagoas and Pernambuco", "lagos": "Lakes and rivers"},
  carta=["<strong>Is your boat sitting in the marina?</strong> It can become tours and income, without you handling listings, customer service or payments.",
         "Bordazul was born from a boat tour company in Búzios that already does this every day: it welcomes the client, answers questions, confirms the date and collects the deposit. The owner only takes care of the boat and the tour.",
         "Now we are taking this way of working to other seas in Brazil. Sign-ups open step by step, one destination at a time, so each city starts with good boats.",
         "If you own a motorboat, yacht, sailboat, catamaran or schooner with a licensed skipper, talk to us. You set the price you want to receive, and the boat is on the calendar only when you want."],
  carta_ass="The Bordazul team", carta_cargo="Boat sign-ups", carta_btn="I want to list my boat",
  wa_dono="Hi! I own a boat and I would like to list it on Bordazul.",
  faq_h="Questions",
  faq=[("What is Bordazul?", "A platform to rent boats with a skipper in Brazil's nautical destinations, with boats from many owners in one place."),
       ("Where are boats available now?", "In Búzios, Rio de Janeiro. There you can see every boat, photos and seasonal prices and book online. Other destinations open step by step."),
       ("Does every boat come with a skipper?", "Yes. Every tour has a licensed skipper, and the boat is for your group only."),
       ("What is included in Búzios?", "Fuel, ice, charcoal, mineral water and a cooler. Food and drinks are not included, and the crew grills for you if you bring the meat."),
       ("How do I book?", "Choose the boat, the date and the number of people. The date is secured with a 50% deposit and the rest is paid on the day of the tour."),
       ("How can I pay?", "The deposit can be paid by Pix for any date, and by card when the tour is 5 or more days away."),
       ("What if I need to cancel?", "You can keep a credit of 100% of the deposit for 1 year. With 7 or more days' notice, you can also ask for the full deposit back."),
       ("What if the sea is rough?", "The tour is moved to another date at no cost."),
       ("When will my city open?", "As soon as it has good boats to rent. Ask on WhatsApp to be told first."),
       ("Can I list my boat?", "Yes. Message us on WhatsApp: sign-ups are opening destination by destination."),
       ("Who is behind Bordazul?", "Búzios Lanchas, a registered company that already takes groups on boat tours in Búzios.")],
  cta_p="The first fleet is already on the water. The rest of Brazil is right behind.",
  cta_h="Off to Búzios?", cta_l="Boats from 22 to 35 feet, for up to 16 people, on 4 or 7 hour tours.", cta_btn="See boats in Búzios",
  pe_h="See you aboard.", pe_p="Write to us any time: about a tour, about your boat or to hear when your city opens.",
  pe_selo="Motorboat in Búzios",
  pe_imp="© 2026 Bordazul, a Búzios Lanchas brand · CNPJ 32.154.099/0001-72",
  wa_geral="Hi! I found you on the Bordazul website.",
  noscript="To see the boats, open the Búzios website.",
 ),
 "es": dict(
  title="Bordazul | Alquiler de barco con marinero en Brasil",
  desc="Alquiler de lancha, yate y goleta con marinero en los mares de Brasil. Embarque abierto en Búzios; muy pronto Arraial do Cabo, Río, Angra, Paraty y más destinos.",
  nav=[("#destinos", "Destinos"), ("#como", "Cómo funciona"), ("#barco", "¿Tienes un barco?"), ("#perguntas", "Preguntas")],
  navcta="Barcos en Búzios", lang="Idioma",
  h1="Tu día en el mar,<br>en todo Brasil.",
  lead="Barcos con marinero, solo para tu grupo. Elige el destino, la fecha y cuántas personas van a bordo.",
  f_dest="Destino", f_data="Fecha", f_pes="Personas", f_btn="Ver barcos", menos="Una persona menos", mais="Una persona más",
  r_aberto="Búzios tiene embarque abierto. Te llevamos a las lanchas con tu fecha y tu grupo.",
  r_breve="{c} todavía no abrió. ¿Quieres saberlo primero cuando tenga barcos?", r_breve_btn="Avísame por WhatsApp",
  wa_breve="¡Hola! Quiero que me avisen cuando Bordazul abra en {c}.",
  links=[("#destinos", "Todos los destinos"), ("#como", "Cómo funciona"), ("#barco", "Anuncia tu barco")],
  foto_alt=["Lancha anclada en las aguas verdes de Búzios", "Proa de una lancha rumbo a las playas", "En la proa frente a una isla", "Lancha al atardecer en Búzios"],
  s_p1="Empezamos por Búzios, donde la primera flota ya lleva grupos a las playas.",
  s_p2="Después vienen el mar de Río y todo Brasil, un destino a la vez.",
  s_alt="Vista aérea de la península de Búzios y sus islas",
  aberto="Embarque abierto", breve="Muy pronto", ver="Ver lanchas",
  slip={"buzios": "Azeda, João Fernandes, Ilha Feia y Tartaruga. Salidas desde Praia dos Ossos.",
        "arraial": "Pontal do Atalaia, Praia do Forno y la Gruta Azul.",
        "cabo-frio": "Ilha do Japonês, Praia do Forte e Ilha do Papagaio.",
        "rio": "La Bahía de Guanabara, las Islas Cagarras y el Pan de Azúcar.",
        "angra": "Lagoa Azul, Lagoa Verde y las islas de la bahía.",
        "paraty": "Saco do Mamanguá e islas de agua tranquila."},
  como_h="Del sofá al mar", como_p="Reservar un barco tiene que ser tan simple como pedir un auto. Este es el camino, del primer clic al embarque.",
  como=[("En casa", [("Elige el destino y la fecha", "1 minuto"), ("Compara barcos, fotos y precios", "en el sitio")]),
        ("En la reserva", [("Pregúntanos lo que quieras", "WhatsApp"), ("Asegura la fecha con la seña", "50%")]),
        ("El día", [("Encuentra al marinero en el muelle", "a la hora"), ("Paga el resto", "al embarcar")])],
  como_fim=("Tú, en el mar", "4 o 7 horas"),
  mares="Mares", mares_p="Los destinos que Bordazul va a cubrir. Abrimos cada uno cuando tenga buenos barcos para alquilar.",
  reg={"rj": "Río de Janeiro", "sp": "São Paulo", "sul": "Santa Catarina", "ba": "Bahía", "ne": "Alagoas y Pernambuco", "lagos": "Lagos y ríos"},
  carta=["<strong>¿Tienes un barco parado en la marina?</strong> Puede convertirse en paseos e ingresos, sin que tengas que ocuparte de anuncios, atención o cobros.",
         "Bordazul nació de una empresa de paseos en lancha en Búzios que ya lo hace todos los días: recibe al cliente, responde dudas, confirma la fecha y cobra la seña. El dueño solo se ocupa del barco y del paseo.",
         "Ahora llevamos esta forma de trabajar a otros mares de Brasil. Abrimos los registros poco a poco, destino por destino, para que cada ciudad empiece con buenos barcos.",
         "Si tienes lancha, yate, velero, catamarán o goleta con marinero habilitado, escríbenos. Tú defines el precio que quieres recibir, y el barco está en la agenda solo cuando quieras."],
  carta_ass="Equipo Bordazul", carta_cargo="Registro de barcos", carta_btn="Quiero anunciar mi barco",
  wa_dono="¡Hola! Tengo un barco y quiero anunciarlo en Bordazul.",
  faq_h="Preguntas",
  faq=[("¿Qué es Bordazul?", "Una plataforma para alquilar barcos con marinero en los destinos náuticos de Brasil, con barcos de varios dueños en un solo lugar."),
       ("¿Dónde hay barcos hoy?", "En Búzios, Río de Janeiro. Allí ves todas las lanchas, fotos y precios por temporada y reservas en línea. Los otros destinos abren poco a poco."),
       ("¿Todos los barcos tienen marinero?", "Sí. Todos los paseos se hacen con marinero habilitado, y el barco es solo para tu grupo."),
       ("¿Qué incluye en Búzios?", "Combustible, hielo, carbón, agua mineral y conservadora. Comidas y bebidas no están incluidas, y el equipo prepara el asado si llevas la carne."),
       ("¿Cómo reservo?", "Elige el barco, la fecha y el número de personas. La fecha queda asegurada con una seña del 50% y el resto se paga el día del paseo."),
       ("¿Cómo puedo pagar?", "La seña se puede pagar por Pix para cualquier fecha y con tarjeta cuando faltan 5 días o más para el paseo."),
       ("¿Y si necesito cancelar?", "Puedes quedarte con un crédito del 100% de la seña por 1 año. Con 7 días o más de anticipación, también puedes pedir la seña completa de vuelta."),
       ("¿Y si el mar no está bueno?", "El paseo se pasa a otra fecha, sin costo."),
       ("¿Cuándo abre mi ciudad?", "En cuanto tenga buenos barcos para alquilar. Pide aviso por WhatsApp y te enteras primero."),
       ("¿Puedo anunciar mi barco?", "Sí. Escríbenos por WhatsApp: los registros se abren destino por destino."),
       ("¿Quién está detrás de Bordazul?", "Búzios Lanchas, empresa registrada que ya lleva grupos a pasear en lancha en Búzios.")],
  cta_p="La primera flota ya está en el agua. El resto de Brasil viene justo detrás.",
  cta_h="¿Vamos a Búzios?", cta_l="Lanchas de 22 a 35 pies, para hasta 16 personas, con paseos de 4 o 7 horas.", cta_btn="Ver lanchas en Búzios",
  pe_h="Nos vemos a bordo.", pe_p="Escríbenos cuando quieras: sobre un paseo, sobre tu barco o para saber cuándo abre tu ciudad.",
  pe_selo="Lancha en Búzios",
  pe_imp="© 2026 Bordazul, una marca de Búzios Lanchas · CNPJ 32.154.099/0001-72",
  wa_geral="¡Hola! Llegué por el sitio de Bordazul.",
  noscript="Para ver las lanchas, abre el sitio de Búzios.",
 ),
}

def e(s):
    return html.escape(s, quote=True)

def wa(msg):
    from urllib.parse import quote
    return f"https://wa.me/{WA}?text={quote(msg)}"

CSS = r"""
:root{--bg:#0b5cc4;--surface:#0a52b0;--deep:#062f66;--ink:#04121c;--paper:#ffffff;--paper-2:#eef3fa;--soft:#3d4c5c;
--step-small:clamp(.8125rem,.79rem + .1vw,.875rem);--step-body:clamp(1.0625rem,1.02rem + .2vw,1.1875rem);--step-lead:clamp(1.25rem,1.1rem + .7vw,1.625rem);
--step-head:clamp(2.25rem,1.3rem + 3.4vw,4.25rem);--step-giant:clamp(4.5rem,2rem + 11vw,12rem);--m:clamp(16px,2.2vw,32px);
--disp:"Besley",Georgia,serif;--text:"Libre Franklin",Arial,sans-serif;--ease:cubic-bezier(.2,.7,.2,1)}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--paper);font-family:var(--text);font-size:var(--step-body);line-height:1.5;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%;height:auto}
a{color:inherit}
:focus-visible{outline:3px solid #ffd23f;outline-offset:3px}
::selection{background:var(--ink);color:var(--paper)}
h1,h2,h3{font-family:var(--disp);font-weight:800;letter-spacing:-.02em;line-height:.95;margin:0}
p{margin:0}
.skip{position:absolute;left:-999px}.skip:focus{left:var(--m);top:8px;z-index:20;background:var(--paper);color:var(--ink);padding:8px 14px}
/* barra */
.bar{position:sticky;top:0;z-index:10;background:var(--bg);display:flex;align-items:center;gap:28px;padding:14px var(--m)}
.mark{font-family:var(--disp);font-weight:800;font-size:1.6rem;letter-spacing:-.02em;text-decoration:none;line-height:1}
.bar nav{display:flex;gap:24px;margin-left:auto}
.bar nav a,.langs a{text-decoration:none;font-size:var(--step-small);font-weight:600}
.bar nav a:hover,.langs a:hover{text-decoration:underline;text-underline-offset:4px}
.langs{display:flex;gap:10px}.langs a{opacity:.72}.langs a[aria-current]{opacity:1}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;background:var(--ink);color:var(--paper);font-weight:600;font-size:var(--step-small);text-decoration:none;border:0;border-radius:0;cursor:pointer;font-family:var(--text);transition:transform .25s var(--ease),background-color .25s var(--ease)}
.btn:hover{transform:translateY(-2px);background:#0d2536}.btn:active{transform:translateY(0)}
.btn.light{background:var(--paper);color:var(--ink)}.btn.light:hover{background:var(--paper-2)}
/* hero: bilhete ao lado da foto */
.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;padding:0 12px 12px}
.card{min-width:0;background:var(--paper);color:var(--ink);display:flex;flex-direction:column;min-height:calc(100svh - 76px)}
.stripe{display:flex;height:56px;overflow:hidden;flex:none}
.stripe i{flex:0 0 28px;height:100%}.stripe i:nth-child(odd){background:var(--ink)}
.card-in{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:clamp(28px,4vw,56px) clamp(20px,4vw,64px) 28px}
.bigmark{font-family:var(--disp);font-weight:800;font-size:clamp(3rem,1.6rem + 5vw,6.5rem);letter-spacing:-.03em;line-height:.9;color:var(--bg)}
.card h1{font-size:clamp(1.9rem,1.1rem + 2.6vw,3.25rem);margin-top:22px}
.card .lead{max-width:38ch;margin-top:18px;color:var(--ink)}
.ticket{width:100%;max-width:560px;margin-top:30px;background:var(--paper-2);text-align:left;position:relative;
 clip-path:polygon(0 0,100% 0,100% calc(50% - 12px),calc(100% - 12px) 50%,100% calc(50% + 12px),100% 100%,0 100%,0 calc(50% + 12px),12px 50%,0 calc(50% - 12px))}
.t-row{display:grid;grid-template-columns:1.4fr 1fr .9fr;gap:14px;padding:22px 26px 12px}
.ticket label{display:block;font-size:var(--step-small);font-weight:600;margin-bottom:6px}
.ticket select,.ticket input{width:100%;height:46px;font:inherit;font-size:1rem;color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:0;padding:0 10px}
.step{display:flex}.step button{flex:0 0 38px;height:46px;border:2px solid var(--ink);background:var(--ink);color:var(--paper);font-size:1.25rem;cursor:pointer;border-radius:0;transition:background-color .2s}
.step button:hover{background:var(--bg)}.step input{text-align:center;border-left:0;border-right:0;-moz-appearance:textfield;padding:0}
.step input::-webkit-inner-spin-button{-webkit-appearance:none}
.perf{height:6px;margin:6px 26px;background-image:radial-gradient(circle,var(--ink) 2px,transparent 2.5px);background-size:12px 6px;opacity:.35}/* taste-skill-ignore: pontos redondos de picote, pedidos pela direção */
.t-foot{padding:12px 26px 22px}
.t-foot .btn{width:100%;min-height:54px;font-size:1rem}
.result{padding:0 26px 22px;font-size:1rem}.result:empty{display:none}
.result a{font-weight:600;color:var(--bg)}
.card-links{display:flex;gap:22px;flex-wrap:wrap;justify-content:center;margin-top:auto;padding-top:28px;font-size:.9375rem}
.card-links a{text-decoration:none;font-weight:600}.card-links a:hover{text-decoration:underline;text-underline-offset:4px}
.room{position:sticky;top:76px;height:calc(100svh - 88px);overflow:hidden;background:var(--deep)}
.room img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.6s ease}
.room img.on{opacity:1}
/* faixa de bilhetes sobre a foto */
.show{position:relative;height:96svh;min-height:640px;overflow:hidden;background:var(--deep)}
.show>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.04);transition:transform 8s linear}
.show.vis>img{transform:scale(1.12)}
.show .copy{position:absolute;left:18%;top:10%;max-width:min(560px,70vw);padding:26px 28px;background:rgba(4,18,28,.55)}
.show .copy p{font-size:clamp(1.375rem,1rem + 1vw,2rem);line-height:1.25;color:var(--paper)}
.show .copy p+p{margin-top:16px}
.slips{position:absolute;left:0;right:0;bottom:0;display:flex;gap:12px;padding:0 12px;align-items:flex-end}
.slip{flex:1;min-width:0;background:var(--paper);color:var(--ink);padding:18px 18px 0;font-size:.9375rem;text-decoration:none;display:block;transition:transform .35s var(--ease)}
.slip:nth-child(1){height:44svh}.slip:nth-child(2){height:34svh;transform:rotate(-1.5deg)}.slip:nth-child(3){height:39svh}
.slip:nth-child(4){height:29svh;transform:rotate(1.2deg)}.slip:nth-child(5){height:36svh}.slip:nth-child(6){height:31svh;transform:rotate(-1deg)}
a.slip:hover{transform:translateY(-10px)}
.slip b{display:block;font-family:var(--disp);font-size:1.5rem;line-height:1;letter-spacing:-.02em}
.slip .dash{letter-spacing:.2em;opacity:.5;margin:8px 0;white-space:nowrap;overflow:hidden}
.slip .st{display:inline-block;margin-top:10px;font-weight:600}
.slip.open{background:var(--ink);color:var(--paper)}
/* como funciona */
.como{display:grid;grid-template-columns:repeat(12,1fr);gap:24px;padding:clamp(120px,14vw,200px) var(--m)}
.como .txt{grid-column:1/6}.como h2{font-size:var(--step-head)}.como .txt p{margin-top:20px;max-width:30ch;font-size:var(--step-lead);line-height:1.35}
.itin{grid-column:7/12;max-width:480px;background:var(--paper);color:var(--ink);padding:30px 28px 56px;font-variant-numeric:tabular-nums;
 clip-path:polygon(0 0,100% 0,100% calc(100% - 16px),95% 100%,90% calc(100% - 16px),85% 100%,80% calc(100% - 16px),75% 100%,70% calc(100% - 16px),65% 100%,60% calc(100% - 16px),55% 100%,50% calc(100% - 16px),45% 100%,40% calc(100% - 16px),35% 100%,30% calc(100% - 16px),25% 100%,20% calc(100% - 16px),15% 100%,10% calc(100% - 16px),5% 100%,0 calc(100% - 16px))}
.itin h3{font-family:var(--text);font-weight:600;font-size:1rem;letter-spacing:0;line-height:1.3;margin-top:28px}.itin h3:first-child{margin-top:0}
.itin ul{list-style:none;margin:10px 0 0;padding:0}
.itin li{display:flex;align-items:baseline;gap:8px;padding:5px 0;font-size:1rem}
.itin li span:nth-child(2){flex:1;min-width:20px;height:4px;background-image:radial-gradient(circle,var(--ink) 1.6px,transparent 2px);background-size:8px 4px;opacity:.45;transform:translateY(-3px)}/* taste-skill-ignore: pontos redondos de picote, pedidos pela direção */
.itin li span:last-child{text-align:right;white-space:nowrap}
.itin .fim{margin:28px -28px 0;background:var(--ink);color:var(--paper);height:48px;display:flex;justify-content:space-between;align-items:center;padding:0 28px;font-weight:600}
/* mares */
.mares{background:var(--paper);color:var(--ink);padding:clamp(120px,14vw,200px) var(--m)}
.mares .col{max-width:640px;margin:0 auto;container-type:inline-size}
.mares h2{font-size:31cqw;line-height:.8;letter-spacing:-.04em;color:var(--bg)}
.mares .col>p{margin:22px 0 26px;max-width:46ch}
details{background:var(--paper-2);margin-bottom:6px}
summary{list-style:none;cursor:pointer;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-weight:600;transition:background-color .2s}
summary::-webkit-details-marker{display:none}
summary:hover{background:#e2eaf5}
summary::after{content:"+";font-size:1.5rem;font-weight:400;transition:transform .3s var(--ease)}
details[open] summary::after{transform:rotate(45deg)}
details ul{list-style:none;margin:0;padding:4px 18px 20px}
details li{display:flex;justify-content:space-between;gap:16px;padding:7px 0}
details li a{font-weight:600;color:var(--bg)}
details li .uf{opacity:.65;margin-left:6px;font-size:var(--step-small)}
.tag-soon{color:var(--soft)}
/* carta para donos */
.carta{padding:clamp(140px,14vw,200px) var(--m);display:flex;justify-content:center}
.sheet{width:min(640px,100%);background:var(--paper);color:var(--ink)}
.sheet-in{padding:60px 60px 72px;clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),97.5% 100%,95% calc(100% - 12px),92.5% 100%,90% calc(100% - 12px),87.5% 100%,85% calc(100% - 12px),82.5% 100%,80% calc(100% - 12px),77.5% 100%,75% calc(100% - 12px),72.5% 100%,70% calc(100% - 12px),67.5% 100%,65% calc(100% - 12px),62.5% 100%,60% calc(100% - 12px),57.5% 100%,55% calc(100% - 12px),52.5% 100%,50% calc(100% - 12px),47.5% 100%,45% calc(100% - 12px),42.5% 100%,40% calc(100% - 12px),37.5% 100%,35% calc(100% - 12px),32.5% 100%,30% calc(100% - 12px),27.5% 100%,25% calc(100% - 12px),22.5% 100%,20% calc(100% - 12px),17.5% 100%,15% calc(100% - 12px),12.5% 100%,10% calc(100% - 12px),7.5% 100%,5% calc(100% - 12px),2.5% 100%,0 calc(100% - 12px));background:var(--paper)}
.sheet{background:transparent}
.portrait{width:44px;height:44px;border-radius:50%;object-fit:cover}
.sheet p{font-size:1.0625rem;line-height:1.55;margin-top:22px}
.sheet p strong{font-weight:600;background:#cfe1ff;padding:0 3px}
.sign{margin-top:30px}.sign em{display:block;font-size:1.375rem}.sign span{font-size:var(--step-small);color:var(--soft)}
.dots{height:6px;margin:0 6px;background-image:radial-gradient(circle,var(--paper) 2.5px,transparent 3px);background-size:14px 6px}/* taste-skill-ignore: pontos redondos de picote, pedidos pela direção */
.stub{background:var(--paper);color:var(--ink);min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 24px}
.stub span{font-weight:600}
/* perguntas */
.faq{display:grid;grid-template-columns:repeat(12,1fr);gap:24px;padding:clamp(120px,14vw,200px) var(--m);background:var(--deep)}
.faq h2{grid-column:1/4;font-size:clamp(1.75rem,1.4rem + 1vw,2rem)}
.faq .cols{grid-column:5/13;columns:2;column-gap:56px}
.faq .cols p{break-inside:avoid;margin-bottom:20px;font-size:1.0625rem;line-height:1.55}
.faq .cols b{font-weight:600}
/* chamada final */
.cta{position:relative;background:var(--ink);min-height:80svh;display:grid;grid-template-columns:repeat(12,1fr);gap:24px;padding:120px var(--m) 0;overflow:hidden}
.cta>p{grid-column:1/5;align-self:end;margin-bottom:64px;font-size:clamp(1.25rem,1rem + .6vw,1.5rem);line-height:1.35}
.reply{grid-column:6/13;align-self:end;background:var(--paper);color:var(--ink);aspect-ratio:7/5;transform:rotate(2deg) translateY(60px);padding:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;transition:transform .5s var(--ease)}
.reply:hover{transform:rotate(1deg) translateY(48px)}
.reply h2{font-size:clamp(2rem,1.4rem + 1.6vw,3rem)}
.reply p{margin:16px 0 28px;max-width:40ch}
.reply .btn{width:100%;min-height:56px;font-size:1rem}
/* rodapé: verso do cartão */
.pe{padding:120px var(--m) 32px}
.post{max-width:1100px;margin:0 auto;background:var(--paper);color:var(--ink);padding:72px 56px 28px;position:relative;
 -webkit-mask:radial-gradient(circle 50px at 50px 0,transparent 98%,#000) 0 0/100px 100% repeat-x;mask:radial-gradient(circle 50px at 50px 0,transparent 98%,#000) 0 0/100px 100% repeat-x}/* taste-skill-ignore: pontos redondos de picote, pedidos pela direção */
.post-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.post h2{font-size:2rem}.post-grid>div:first-child p{margin-top:14px;max-width:38ch}
.addr{position:relative;padding-top:8px}
.addr ul{list-style:none;margin:0;padding:0}.addr li+li{margin-top:12px}
.addr a{font-size:1.125rem;text-decoration:none;font-weight:600}.addr a:hover{text-decoration:underline;text-underline-offset:4px}
.stamp{position:absolute;right:0;top:-24px;width:88px;padding:6px;background:var(--paper);transform:rotate(3deg)}
.stamp img{aspect-ratio:3/4;object-fit:cover;width:100%}
.imp{text-align:center;font-size:var(--step-small);margin-top:56px;color:var(--soft)}
.wordfoot{font-family:var(--disp);font-weight:800;font-size:clamp(4rem,1rem + 15vw,15rem);letter-spacing:-.04em;line-height:.8;text-align:center;margin-top:48px;color:var(--paper)}
/* entradas */
.js .rv{opacity:0;transform:translateY(24px);transition:opacity .7s var(--ease),transform .7s var(--ease)}
.js .rv.in{opacity:1;transform:none}
.js .show .slip{translate:0 60px;opacity:0;transition:translate .9s var(--ease),opacity .9s var(--ease),transform .35s var(--ease)}
.show.vis .slip{translate:0 0;opacity:1}
.show .slip:nth-child(2){transition-delay:80ms}.show .slip:nth-child(3){transition-delay:160ms}.show .slip:nth-child(4){transition-delay:240ms}.show .slip:nth-child(5){transition-delay:320ms}.show .slip:nth-child(6){transition-delay:400ms}
@keyframes up{from{opacity:0;translate:0 24px}to{opacity:1;translate:0 0}}
.js .card-in>*{animation:up .8s var(--ease) both}.js .card-in>:nth-child(2){animation-delay:.08s}.js .card-in>:nth-child(3){animation-delay:.16s}.js .card-in>:nth-child(4){animation-delay:.24s}.js .card-in>:nth-child(5){animation-delay:.32s}
.js .stripe i{animation:up .6s var(--ease) both}
@media (max-width:960px){
 .bar nav{display:none}.bar .btn{margin-left:auto}
 .hero{grid-template-columns:minmax(0,1fr)}.room{position:relative;top:0;height:48svh;order:-1}
 .card{min-height:0;margin-top:-24px;position:relative;z-index:1;margin-left:12px;margin-right:12px}
 .stripe{height:40px}.t-row{grid-template-columns:1fr 1fr}.t-row>div:first-child{grid-column:1/-1}
 .como{grid-template-columns:1fr}.como .txt,.itin{grid-column:1/-1}.itin{max-width:none}
 .faq{grid-template-columns:1fr}.faq h2,.faq .cols{grid-column:1/-1}.faq .cols{columns:1}
 .cta{grid-template-columns:1fr;padding-top:96px}.cta>p,.reply{grid-column:1/-1}.cta>p{margin-bottom:24px}
 .reply{width:90%;justify-self:center;transform:rotate(1deg) translateY(40px);aspect-ratio:auto;padding:36px 24px 48px}
 .post-grid{grid-template-columns:1fr}
}
@media (max-width:640px){
 .show{height:100svh}.show .copy{left:16px;right:16px;top:6%;max-width:none;padding:18px}.show .copy p{font-size:1.375rem}
 .slips{overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:0}.slip{flex:0 0 42vw;scroll-snap-align:start;font-size:.875rem}
 .sheet-in{padding:36px 24px 56px}.stub{flex-direction:column;align-items:stretch;text-align:center;padding:16px 24px 20px}
 .post{padding:64px 24px 24px;-webkit-mask-size:60px 100%;mask-size:60px 100%;-webkit-mask-image:radial-gradient(circle 30px at 30px 0,transparent 98%,#000);mask-image:radial-gradient(circle 30px at 30px 0,transparent 98%,#000)}/* taste-skill-ignore: pontos redondos de picote, pedidos pela direção */
 .stamp{width:64px;top:-40px}
 .langs{display:none}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}.js .rv{opacity:1;transform:none}.js .show .slip{opacity:1;translate:none}.show>img{transform:none}}
"""

JS = r"""
document.documentElement.classList.add("js");
(function(){
var f=document.getElementById("bilhete"),d=document.getElementById("f-data"),p=document.getElementById("f-pes"),s=document.getElementById("f-dest"),out=document.getElementById("res");
var now=new Date(),iso=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");d.min=iso;
document.querySelectorAll("[data-step]").forEach(function(b){b.addEventListener("click",function(){var v=(+p.value||1)+(+b.dataset.step);p.value=Math.max(1,Math.min(60,v));});});
function show(){var o=s.options[s.selectedIndex];out.innerHTML="";if(!o)return;
 if(o.dataset.url){out.textContent=f.dataset.aberto;}else{var c=o.dataset.nome,m=f.dataset.wa.replace("{c}",c);
  out.innerHTML=f.dataset.breve.replace("{c}",c)+' <a href="https://wa.me/'+f.dataset.num+'?text='+encodeURIComponent(m)+'" rel="noopener">'+f.dataset.btn+'</a>';}}
s.addEventListener("change",show);
f.addEventListener("submit",function(ev){var o=s.options[s.selectedIndex];if(!o.dataset.url){ev.preventDefault();show();out.querySelector("a")&&out.querySelector("a").focus();return;}
 ev.preventDefault();var q=[];if(d.value&&d.value>=iso)q.push("data="+d.value);var n=+p.value;if(n>=1&&n<=99)q.push("pessoas="+n);
 location.href=o.dataset.url+(q.length?"?"+q.join("&"):"");});
var imgs=[].slice.call(document.querySelectorAll(".room img")),i=0,red=matchMedia("(prefers-reduced-motion: reduce)").matches;
if(imgs.length>1&&!red){setInterval(function(){if(document.hidden)return;imgs[i].classList.remove("on");i=(i+1)%imgs.length;imgs[i].classList.add("on");},5600);}
var io="IntersectionObserver" in window?new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add(x.target.classList.contains("show")?"vis":"in");io.unobserve(x.target);}});},{threshold:.15}):null;
document.querySelectorAll(".rv,.show").forEach(function(el,k){if(!io){el.classList.add("in","vis");return;}
 if(el.classList.contains("rv")){var sib=[].slice.call(el.parentNode.children).filter(function(c){return c.classList.contains("rv");});el.style.transitionDelay=(sib.indexOf(el)*75)+"ms";}io.observe(el);});
})();
"""

def destino_options(t, lang):
    out = []
    for reg, cidades in DEST:
        out.append(f'<optgroup label="{e(t["reg"][reg])}">')
        for k, nome, uf, url in cidades:
            u = f' data-url="{e(url + PATH[lang])}"' if url else ""
            out.append(f'<option value="{k}" data-nome="{e(nome)}"{u}{" selected" if k == "buzios" else ""}>{e(nome)}</option>')
        out.append("</optgroup>")
    return "".join(out)

def pagina(lang):
    t = T[lang]
    url = DOM + PATH[lang]
    pre = "" if lang == "pt" else "../"
    alt = "".join(f'<link rel="alternate" hreflang="{HL[l]}" href="{DOM + PATH[l]}">' for l in T) + f'<link rel="alternate" hreflang="x-default" href="{DOM}/">'
    langs = "".join(f'<a href="{PATH[l] if lang == "pt" else ("../" if l == "pt" else "../" + l + "/")}" hreflang="{HL[l]}" lang="{HL[l]}"{" aria-current=\"page\"" if l == lang else ""}>{l.upper()}</a>' for l in T)
    nav = "".join(f'<a href="{h}">{e(x)}</a>' for h, x in t["nav"])
    bz = BZ + PATH[lang]
    stripe = "<i></i>" * 40
    fotos = "".join(f'<img src="{pre}img/{n}.jpg" width="{w}" height="{h}" alt="{e(t["foto_alt"][i])}"{" class=on" if i == 0 else " loading=lazy"}>' for i, (n, w, h) in enumerate(HERO_FOTOS))
    cid = {k: (nome, uf, u) for _, cs in DEST for k, nome, uf, u in cs}
    slips = []
    for k in SLIPS:
        nome, uf, u = cid[k]
        inner = (f'<b>{e(nome)}</b><div class="dash" aria-hidden="true">- - - - - - - - - - - - - - - -</div>'
                 f'<div>{e(COORD[k])}</div><div>{e(t["slip"][k])}</div><span class="st">{e(t["aberto"] if u else t["breve"])}</span>')
        slips.append(f'<a class="slip open" href="{e(bz)}">{inner}</a>' if u else f'<div class="slip">{inner}</div>')
    como = "".join(f'<h3>{e(g)}</h3><ul>' + "".join(f'<li><span>{e(a)}</span><span aria-hidden="true"></span><span>{e(b)}</span></li>' for a, b in rows) + "</ul>" for g, rows in t["como"])
    regs = []
    for i, (reg, cidades) in enumerate(DEST):
        abertos = sum(1 for c in cidades if c[3])
        lis = "".join(
            f'<li><span>{e(nome)}<span class="uf">{uf}</span></span>'
            + (f'<a href="{e(u + PATH[lang])}">{e(t["aberto"])}</a>' if u else f'<span class="tag-soon">{e(t["breve"])}</span>')
            + "</li>" for k, nome, uf, u in cidades)
        regs.append(f'<details class="rv"{" open" if i == 0 else ""}><summary>{e(t["reg"][reg])}</summary><ul>{lis}</ul></details>')
    carta = "".join(f"<p>{p}</p>" for p in t["carta"])
    faq = "".join(f'<p class="rv"><b>{e(q)}</b> {e(a)}</p>' for q, a in t["faq"])
    ld = {"@context": "https://schema.org", "@type": "Organization", "name": "Bordazul", "url": DOM + "/",
          "description": t["desc"], "parentOrganization": {"@type": "Organization", "name": "Búzios Lanchas", "url": BZ + "/"},
          "contactPoint": {"@type": "ContactPoint", "telephone": "+55-21-99927-2550", "contactType": "customer service", "availableLanguage": ["Portuguese", "English", "Spanish"]}}
    ldf = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t["faq"]]}
    return f"""<!doctype html>
<html lang="{HL[lang]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(t["title"])}</title>
<meta name="description" content="{e(t["desc"])}">
<link rel="canonical" href="{url}">{alt}
<meta property="og:type" content="website"><meta property="og:url" content="{url}"><meta property="og:title" content="{e(t["title"])}">
<meta property="og:description" content="{e(t["desc"])}"><meta property="og:image" content="{DOM}/img/barco-3.jpg">
<meta name="theme-color" content="#0b5cc4">
<link rel="icon" href="{pre}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Besley:wght@800&family=Libre+Franklin:wght@400;600&display=swap" rel="stylesheet">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(ldf, ensure_ascii=False)}</script>
<style>{CSS}</style>
</head>
<body>
<a class="skip" href="#bilhete">{e(t["f_btn"])}</a>
<header class="bar">
<a class="mark" href="{PATH[lang] if lang == "pt" else "./"}">Bordazul</a>
<nav aria-label="Bordazul">{nav}</nav>
<div class="langs" aria-label="{e(t["lang"])}">{langs}</div>
<a class="btn light" href="{e(bz)}">{e(t["navcta"])}</a>
</header>
<main>
<section class="hero">
<div class="card">
<div class="stripe" aria-hidden="true">{stripe}</div>
<div class="card-in">
<div class="bigmark" aria-hidden="true">Bordazul</div>
<h1>{t["h1"]}</h1>
<p class="lead">{e(t["lead"])}</p>
<form class="ticket" id="bilhete" action="{e(bz)}" method="get" data-aberto="{e(t["r_aberto"])}" data-breve="{e(t["r_breve"])}" data-btn="{e(t["r_breve_btn"])}" data-wa="{e(t["wa_breve"])}" data-num="{WA}">
<div class="t-row">
<div><label for="f-dest">{e(t["f_dest"])}</label><select id="f-dest" name="destino">{destino_options(t, lang)}</select></div>
<div><label for="f-data">{e(t["f_data"])}</label><input id="f-data" name="data" type="date"></div>
<div><label for="f-pes">{e(t["f_pes"])}</label><div class="step"><button type="button" data-step="-1" aria-label="{e(t["menos"])}">−</button><input id="f-pes" name="pessoas" type="number" inputmode="numeric" min="1" max="60" value="2"><button type="button" data-step="1" aria-label="{e(t["mais"])}">+</button></div></div>
</div>
<div class="perf" aria-hidden="true"></div>
<div class="t-foot"><button class="btn" type="submit">{e(t["f_btn"])}</button></div>
<p class="result" id="res" aria-live="polite"></p>
</form>
<div class="card-links">{"".join(f'<a href="{h}">{e(x)}</a>' for h, x in t["links"])}</div>
</div>
</div>
<div class="room">{fotos}</div>
</section>

<section class="show" id="destinos">
<img src="{pre}img/mar-buzios.jpg" width="1600" height="1080" alt="{e(t["s_alt"])}" loading="lazy">
<div class="copy rv"><p>{e(t["s_p1"])}</p><p>{e(t["s_p2"])}</p></div>
<div class="slips">{"".join(slips)}</div>
</section>

<section class="como" id="como">
<div class="txt"><h2 class="rv">{e(t["como_h"])}</h2><p class="rv">{e(t["como_p"])}</p></div>
<div class="itin rv">{como}<div class="fim"><span>{e(t["como_fim"][0])}</span><span>{e(t["como_fim"][1])}</span></div></div>
</section>

<section class="mares" aria-labelledby="mares-h">
<div class="col">
<h2 id="mares-h" class="rv">{e(t["mares"])}</h2>
<p class="rv">{e(t["mares_p"])}</p>
<div>{"".join(regs)}</div>
</div>
</section>

<section class="carta" id="barco">
<div class="sheet rv">
<div class="sheet-in">
{carta}
<div class="sign"><em>{e(t["carta_ass"])}</em><span>{e(t["carta_cargo"])}</span></div>
</div>
<div class="dots" aria-hidden="true"></div>
<div class="stub"><span>WhatsApp (21) 99927-2550</span><a class="btn" href="{e(wa(t["wa_dono"]))}" rel="noopener">{e(t["carta_btn"])}</a></div>
</div>
</section>

<section class="faq" id="perguntas">
<h2 class="rv">{e(t["faq_h"])}</h2>
<div class="cols">{faq}</div>
</section>

<section class="cta">
<p class="rv">{e(t["cta_p"])}</p>
<div class="reply"><h2>{e(t["cta_h"])}</h2><p>{e(t["cta_l"])}</p><a class="btn" href="{e(bz)}">{e(t["cta_btn"])}</a></div>
</section>
</main>

<footer class="pe">
<div class="post">
<div class="post-grid">
<div><h2>{e(t["pe_h"])}</h2><p>{e(t["pe_p"])}</p></div>
<div class="addr">
<div class="stamp"><img src="{pre}img/selo.jpg" width="960" height="1280" alt="{e(t["pe_selo"])}" loading="lazy"></div>
<ul>
<li><a href="{e(wa(t["wa_geral"]))}" rel="noopener">WhatsApp (21) 99927-2550</a></li>
<li><a href="{e(bz)}">lanchaembuzios.com.br</a></li>
<li><a href="https://www.instagram.com/missbardotbuzios/" rel="noopener">@missbardotbuzios</a></li>
<li><a href="{DOM}/">bordazul.com.br</a></li>
</ul>
</div>
</div>
<p class="imp">{e(t["pe_imp"])}</p>
</div>
<div class="wordfoot" aria-hidden="true">Bordazul</div>
</footer>
<script>{JS}</script>
</body>
</html>
"""

FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0b5cc4"/><text x="32" y="47" font-family="Georgia,serif" font-weight="800" font-size="44" text-anchor="middle" fill="#fff">B</text></svg>'

def main():
    for lang in T:
        d = RAIZ if lang == "pt" else os.path.join(RAIZ, lang)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
            f.write(pagina(lang))
    with open(os.path.join(RAIZ, "favicon.svg"), "w") as f:
        f.write(FAVICON)
    with open(os.path.join(RAIZ, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\n\nSitemap: {DOM}/sitemap.xml\n")
    urls = "".join(
        f"<url><loc>{DOM + PATH[l]}</loc><lastmod>{HOJE}</lastmod>"
        + "".join(f'<xhtml:link rel="alternate" hreflang="{HL[o]}" href="{DOM + PATH[o]}"/>' for o in T) + "</url>"
        for l in T)
    with open(os.path.join(RAIZ, "sitemap.xml"), "w") as f:
        f.write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">{urls}</urlset>\n')
    print("ok:", RAIZ)

if __name__ == "__main__":
    main()
