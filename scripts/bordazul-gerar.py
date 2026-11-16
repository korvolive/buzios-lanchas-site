#!/usr/bin/env python3
"""Gera o site do Bordazul (bordazul.com.br, pasta bordazul/) em PT, EN e ES, em HTML estático.

2026-11-15: marca nacional de aluguel de barcos (donos anunciam os barcos, como um marketplace).
Fase 1: página de entrada. Búzios já tem embarque aberto (leva ao lanchaembuzios.com.br, com a data e
o número de pessoas escolhidos no bilhete); os outros destinos aparecem "Em breve" e o visitante pode
pedir aviso pelo WhatsApp. Donos de barco pedem o cadastro pelo WhatsApp.

Identidade própria, diferente do site de Búzios: fonte Urbanist, azul vivo, amarelo e azul-marinho (coral trocado por amarelo a pedido, 2026-11-16),
cantos arredondados e botões redondos (Rodrigo 2026-11-15 achou a 1ª versão, em bilhete, "pré-histórica").
Capa com foto grande e barra de busca (destino, data, pessoas), como nos sites de viagem.

Uso: python3 scripts/bordazul-gerar.py   (reescreve bordazul/index.html, bordazul/en/, bordazul/es/,
bordazul/robots.txt e bordazul/sitemap.xml). Texto novo vale para as três línguas: edite T e rode de novo.
Destino novo com barco no ar: mude "aberto" para a URL do site do destino em DEST.
"""
import html, json, os, re

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bordazul")
DOM = "https://www.bordazul.com.br"
BZ = "https://www.lanchaembuzios.com.br"
WA = "5521999272550"
PATH = {"pt": "/", "en": "/en/", "es": "/es/"}
# Búzios mora dentro do Bordazul (bordazul.com.br/buzios/, mesma pasta do site de Búzios com a marca trocada pelo marca.js).
# Aberto por outro endereço (prévia em lanchaembuzios.com.br/bordazul/), o JS troca /buzios pelo endereço de Búzios.
BUZ = "/buzios"
HL = {"pt": "pt-BR", "en": "en", "es": "es"}
HOJE = "2026-11-15"

# Regiões e destinos. aberto = URL do site com barcos (por enquanto só Búzios). uf = estado.
DEST = [
    ("rj", [("buzios", "Búzios", "RJ", BUZ), ("arraial", "Arraial do Cabo", "RJ", None), ("cabo-frio", "Cabo Frio", "RJ", None),
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
HERO_FOTOS = [("mar-buzios", 1600, 1080), ("barco-3", 1400, 1050), ("barco-1", 960, 1280), ("barco-4", 1080, 1236)]

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
  wa_breve="Olá! Quero ser avisado quando o Bordazul abrir em {c}.",
  links=[("#destinos", "Todos os destinos"), ("#como", "Como funciona"), ("#barco", "Anuncie seu barco")],
  foto_alt=["Vista aérea de Búzios e suas ilhas", "Lancha ao pôr do sol em Búzios", "Lancha ancorada em águas verdes de Búzios", "Na proa da lancha diante de uma ilha"],
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
  mares="Mares", mares_p="Os destinos que o Bordazul vai cobrir. Abrimos cada um quando tiver barcos bons para alugar lá.",
  reg={"rj": "Rio de Janeiro", "sp": "São Paulo", "sul": "Santa Catarina", "ba": "Bahia", "ne": "Alagoas e Pernambuco", "lagos": "Lagos e rios"},
  carta=["<strong>Tem um barco parado na marina?</strong> Ele pode virar passeio e renda, sem você precisar cuidar de anúncio, atendimento ou cobrança.",
         "O Bordazul nasceu de uma empresa de passeios de lancha em Búzios que já faz isso todos os dias: recebe o cliente, tira as dúvidas, confirma a data e cobra o sinal. O dono só cuida do barco e do passeio.",
         "Agora vamos levar esse jeito de trabalhar para outros mares do Brasil. Estamos abrindo os cadastros aos poucos, destino por destino, para cada cidade já começar com barcos bons.",
         "Se você tem lancha, iate, veleiro, catamarã ou escuna com marinheiro habilitado, fale com a gente. Você define o preço que quer receber, e o barco fica na agenda só quando você quiser."],
  carta_ass="Equipe Bordazul", carta_cargo="Cadastro de barcos", carta_btn="Quero anunciar meu barco",
  wa_dono="Olá! Tenho um barco e quero anunciar no Bordazul.",
  faq_h="Perguntas",
  faq=[("O que é o Bordazul?", "Uma plataforma para alugar barcos com marinheiro nos destinos náuticos do Brasil, com os barcos de vários donos reunidos em um só lugar."),
       ("Onde já tem barcos?", "Em Búzios, no Rio de Janeiro. Lá você vê todas as lanchas, fotos e preços por temporada e reserva online. Os outros destinos abrem aos poucos."),
       ("Todo barco tem marinheiro?", "Sim. Todos os passeios são feitos com marinheiro habilitado, e o barco é só do seu grupo."),
       ("O que vem incluso em Búzios?", "Combustível, gelo, carvão, água mineral e cooler. Comidas e bebidas não estão inclusas, e a equipe prepara o churrasco se você levar as carnes."),
       ("Como faço a reserva?", "Escolha o barco, a data e o número de pessoas. A data fica garantida com um sinal de 50%, e o restante é pago no dia do passeio."),
       ("Como posso pagar?", "O sinal pode ser pago por Pix em qualquer data e com cartão quando faltam 5 dias ou mais para o passeio."),
       ("E se eu precisar desistir?", "Você pode ficar com crédito de 100% do sinal por 1 ano. Com 7 dias ou mais de antecedência, também pode pedir o sinal inteiro de volta."),
       ("E se o mar não estiver bom?", "O passeio é remarcado para outra data, sem custo."),
       ("Quando abre a minha cidade?", "Assim que tiver barcos bons para alugar lá. Peça aviso pelo WhatsApp e você fica sabendo primeiro."),
       ("Posso anunciar meu barco?", "Pode. O cadastro é online, em bordazul.com.br/anunciar: você manda os dados, os documentos e as fotos, escolhe quanto quer receber e assina o termo pelo WhatsApp. A equipe analisa antes de o barco ir para o ar."),
       ("Quem está por trás do Bordazul?", "A Búzios Lanchas, empresa registrada que já leva grupos para passear de lancha em Búzios.")],
  cta_p="A primeira frota já está na água. O resto do Brasil vem logo atrás.",
  cta_h="Partiu Búzios?", cta_l="Lanchas de 22 a 35 pés, para até 16 pessoas, com passeios de 4 ou 7 horas.", cta_btn="Ver lanchas em Búzios",
  pe_lema="Bordazul: a bordo do azul.", pe_h="Até a bordo.", pe_p="Escreva para a gente quando quiser: sobre um passeio, sobre o seu barco ou para saber quando a sua cidade abre.",
  pe_selo="Lancha em Búzios",
  pe_imp="© 2026 Bordazul, uma marca da Búzios Lanchas · CNPJ 32.154.099/0001-72",
  wa_geral="Olá! Vim pelo site do Bordazul.",
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
  foto_alt=["Aerial view of Búzios and its islands", "Motorboat at sunset in Búzios", "Motorboat anchored in the green waters of Búzios", "On the bow in front of an island"],
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
       ("Can I list my boat?", "Yes. Sign-up is online at bordazul.com.br/anunciar (in Portuguese): boat details, documents, photos, your price and the partnership terms signed via WhatsApp. The team reviews every boat before it goes live."),
       ("Who is behind Bordazul?", "Búzios Lanchas, a registered company that already takes groups on boat tours in Búzios.")],
  cta_p="The first fleet is already on the water. The rest of Brazil is right behind.",
  cta_h="Off to Búzios?", cta_l="Boats from 22 to 35 feet, for up to 16 people, on 4 or 7 hour tours.", cta_btn="See boats in Búzios",
  pe_lema="Bordazul: aboard the blue.", pe_h="See you aboard.", pe_p="Write to us any time: about a tour, about your boat or to hear when your city opens.",
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
  foto_alt=["Vista aérea de Búzios y sus islas", "Lancha al atardecer en Búzios", "Lancha anclada en las aguas verdes de Búzios", "En la proa frente a una isla"],
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
       ("¿Puedo anunciar mi barco?", "Sí. El registro es online en bordazul.com.br/anunciar (en portugués): datos del barco, documentos, fotos, tu precio y el término firmado por WhatsApp. El equipo revisa cada barco antes de publicarlo."),
       ("¿Quién está detrás de Bordazul?", "Búzios Lanchas, empresa registrada que ya lleva grupos a pasear en lancha en Búzios.")],
  cta_p="La primera flota ya está en el agua. El resto de Brasil viene justo detrás.",
  cta_h="¿Vamos a Búzios?", cta_l="Lanchas de 22 a 35 pies, para hasta 16 personas, con paseos de 4 o 7 horas.", cta_btn="Ver lanchas en Búzios",
  pe_lema="Bordazul: a bordo del azul.", pe_h="Nos vemos a bordo.", pe_p="Escríbenos cuando quieras: sobre un paseo, sobre tu barco o para saber cuándo abre tu ciudad.",
  pe_selo="Lancha en Búzios",
  pe_imp="© 2026 Bordazul, una marca de Búzios Lanchas · CNPJ 32.154.099/0001-72",
  wa_geral="¡Hola! Llegué por el sitio de Bordazul.",
  noscript="Para ver las lanchas, abre el sitio de Búzios.",
 ),
}


# Textos do visual novo (2026-11-15, Rodrigo achou o bilhete "pré-histórico": cantos arredondados, botões redondos, mais espaço)
EXTRA = {
 "pt": dict(
  dest_h="Para onde você quer ir?", dest_p="Começamos por Búzios. Os outros mares do Brasil abrem um de cada vez, sempre com barcos bons.",
  passos_h="Como funciona", passos=[("Escolha o destino", "Diga onde, quando e quantas pessoas vão a bordo."),
     ("Compare os barcos", "Fotos, tamanho, o que vem incluso e o preço de cada um."),
     ("Garanta a data", "Um sinal de 50% segura o dia. O restante é pago no embarque."),
     ("Embarque", "O marinheiro espera seu grupo no píer, na hora marcada.")],
  dono_h="Tem um barco parado?", dono_btn2="Saiba como funciona",
  faq_p="Não achou sua dúvida? Fale com a gente pelo WhatsApp.", cta_btn2="Falar no WhatsApp",
  passo="Passo"),
 "en": dict(
  dest_h="Where do you want to go?", dest_p="We start in Búzios. Brazil's other waters open one at a time, always with good boats.",
  passos_h="How it works", passos=[("Pick a destination", "Tell us where, when and how many people are coming."),
     ("Compare boats", "Photos, size, what is included and the price of each one."),
     ("Secure the date", "A 50% deposit holds the day. The rest is paid at boarding."),
     ("Get on board", "Your skipper meets the group at the pier, right on time.")],
  dono_h="Own a boat?", dono_btn2="See how it works",
  faq_p="Didn't find your question? Message us on WhatsApp.", cta_btn2="Chat on WhatsApp",
  passo="Step"),
 "es": dict(
  dest_h="¿A dónde quieres ir?", dest_p="Empezamos por Búzios. Los otros mares de Brasil abren uno a la vez, siempre con buenos barcos.",
  passos_h="Cómo funciona", passos=[("Elige el destino", "Dinos dónde, cuándo y cuántas personas van a bordo."),
     ("Compara barcos", "Fotos, tamaño, qué incluye y el precio de cada uno."),
     ("Asegura la fecha", "Una seña del 50% reserva el día. El resto se paga al embarcar."),
     ("Embarca", "El marinero espera a tu grupo en el muelle, a la hora acordada.")],
  dono_h="¿Tienes un barco parado?", dono_btn2="Mira cómo funciona",
  faq_p="¿No encontraste tu duda? Escríbenos por WhatsApp.", cta_btn2="Hablar por WhatsApp",
  passo="Paso"),
}
for _l in T:
    T[_l].update(EXTRA[_l])

# cor de fundo de cada cartão de destino sem foto (tons do mar)
TOM = {"arraial": "#0a7f8f", "cabo-frio": "#1172c9", "rio": "#16365c", "angra": "#0d6b5a", "paraty": "#2a4f7a"}

def e(s):
    return html.escape(s, quote=True)

def wa(msg):
    from urllib.parse import quote
    return f"https://wa.me/{WA}?text={quote(msg)}"

ICON_BUSCA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
ICON_WA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z"/></svg>'

CSS = r"""
:root{--bg:#f4f7fb;--white:#fff;--ink:#0a1e33;--soft:#51657a;--line:#dfe7f0;--blue:#0a63e8;--blue-d:#0750c2;--navy:#071c35;--coral:#f5b82e;--coral-d:#e6a512;--chip:#e8f0fd;
--r:22px;--r-lg:32px;--m:clamp(16px,3vw,40px);--max:1240px;--f:"Urbanist",system-ui,sans-serif;--ease:cubic-bezier(.2,.7,.2,1)}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--f);font-size:1.0625rem;line-height:1.55;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%;height:auto}a{color:inherit}
:focus-visible{outline:3px solid var(--coral);outline-offset:3px;border-radius:8px}
h1,h2,h3{margin:0;font-weight:800;letter-spacing:-.025em;line-height:1.04}p{margin:0}
.wrap{max-width:var(--max);margin:0 auto;padding:0 var(--m)}
.skip{position:absolute;left:-999px}.skip:focus{left:16px;top:8px;z-index:30;background:#fff;padding:8px 14px;border-radius:999px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 26px;border-radius:999px;border:0;background:var(--blue);color:#fff;font:700 1rem var(--f);text-decoration:none;cursor:pointer;transition:transform .25s var(--ease),background-color .25s,box-shadow .25s}
.btn:hover{background:var(--blue-d);transform:translateY(-2px);box-shadow:0 10px 24px -10px rgba(10,99,232,.6)}
.btn.coral{background:var(--coral);color:var(--navy)}.btn.coral:hover{background:var(--coral-d);box-shadow:0 10px 24px -10px rgba(245,184,46,.6)}
.btn.ghost{background:rgba(255,255,255,.14);color:#fff}.btn.ghost:hover{background:rgba(255,255,255,.24);box-shadow:none}
.btn.white{background:#fff;color:var(--ink)}.btn.white:hover{background:#eef3fa}
/* topo */
.top{position:sticky;top:0;z-index:20;background:rgba(244,247,251,.92);-webkit-backdrop-filter:saturate(1.4) blur(12px);backdrop-filter:saturate(1.4) blur(12px)}
.top .wrap{display:flex;align-items:center;gap:28px;height:72px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:800;font-size:1.5rem;letter-spacing:-.03em}
.logo svg{flex:none}
.top nav{display:flex;gap:26px;margin-left:auto}
.top nav a{text-decoration:none;font-weight:600;font-size:.98rem;color:var(--soft);transition:color .2s}.top nav a:hover{color:var(--ink)}
.langs{display:flex;background:var(--white);border-radius:999px;padding:4px}
.langs a{text-decoration:none;font-weight:700;font-size:.82rem;padding:6px 10px;border-radius:999px;color:var(--soft)}
.langs a[aria-current]{background:var(--ink);color:#fff}
.top .btn{min-height:44px;padding:0 20px;font-size:.95rem}
/* capa */
.hero{position:relative;margin:4px var(--m) 0;border-radius:var(--r-lg);overflow:hidden;height:min(84svh,800px);min-height:560px;background:var(--navy);color:#fff}
.hero .ph .sl{position:absolute;inset:0;opacity:0;transition:opacity 1.6s ease;overflow:hidden}
.hero .ph .sl.on{opacity:1}
.hero .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
/* fotos em pé (Rodrigo 2026-11-16, sem desfoque): aparecem inteiras e nítidas, e a borda some no azul-marinho do fundo; fotos deitadas cobrem o topo todo */
.hero .ph .sl{background:var(--navy)}
@media (max-width:720px){
 .hero .ph .sl:not(.cm) img{bottom:auto;height:auto;-webkit-mask:linear-gradient(180deg,#000 72%,transparent);mask:linear-gradient(180deg,#000 72%,transparent)}
 .hero .ph .sl.up img{transform:translateY(-30%)} /* Miss Bardot: corta o céu, o barco fica acima do título */
}
@media (min-width:721px){
 .hero .ph .sl:not(.cv) img{left:62%;right:auto;width:auto;max-width:none;transform:translateX(-50%);-webkit-mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,28,53,.15) 0%,rgba(7,28,53,.05) 35%,rgba(7,28,53,.75) 100%);pointer-events:none}
.hero-txt{position:absolute;left:clamp(24px,5vw,72px);right:24px;bottom:clamp(120px,14vh,150px);z-index:2;max-width:780px}
.hero h1{font-size:clamp(2.6rem,1.4rem + 4.6vw,5.4rem)}
.hero .lead{margin-top:18px;font-size:clamp(1.1rem,1rem + .4vw,1.35rem);max-width:46ch;color:rgba(255,255,255,.92)}
/* busca */
.search{position:relative;z-index:5;max-width:980px;margin:-56px auto 0;padding:0 var(--m)}
.sbar{display:flex;align-items:stretch;background:#fff;border-radius:999px;padding:8px 8px 8px 12px;box-shadow:0 24px 60px -24px rgba(7,28,53,.35)}
.sf{flex:1;display:flex;flex-direction:column;justify-content:center;padding:8px 22px;border-radius:999px;position:relative;transition:background-color .2s}
.sf:hover{background:#f2f6fb}
.sf+.sf::before{content:"";position:absolute;left:0;top:22%;bottom:22%;width:1px;background:var(--line)}
.sf label{font-size:.8rem;font-weight:700;color:var(--ink)}
.sf select,.sf input{border:0;background:transparent;font:500 1.02rem var(--f);color:var(--ink);padding:2px 0;width:100%;outline:none;-webkit-appearance:none;appearance:none}
.sf select{cursor:pointer}
.step{display:flex;align-items:center;gap:10px}
.step button{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--line);background:#fff;font:700 1.05rem var(--f);color:var(--ink);cursor:pointer;line-height:1;transition:border-color .2s,background-color .2s}
.step button:hover{border-color:var(--ink)}
.step input{width:34px;text-align:center;-moz-appearance:textfield}.step input::-webkit-inner-spin-button{-webkit-appearance:none}
.sbar .btn{min-height:60px;padding:0 30px;font-size:1.05rem;flex:none}
.result{max-width:980px;margin:14px auto 0;text-align:center;font-weight:500;color:var(--soft)}.result:empty{display:none}
.result a{display:inline-flex;align-items:center;gap:6px;margin-left:8px;color:var(--blue);font-weight:700}
/* seções */
section{scroll-margin-top:80px}
.sec{padding:clamp(80px,10vw,130px) 0 0}
.sec-h{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:36px}
.sec-h h2{font-size:clamp(2rem,1.4rem + 2vw,3.2rem)}
.sec-h p{max-width:46ch;color:var(--soft);margin-top:12px}
/* destinos */
.dests{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.dest{position:relative;border-radius:var(--r);overflow:hidden;aspect-ratio:4/5;color:#fff;text-decoration:none;display:flex;flex-direction:column;justify-content:flex-end;padding:26px;transition:transform .35s var(--ease),box-shadow .35s}
.dest img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .8s var(--ease)}
.dest::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(7,28,53,.8))}
.dest>*:not(img){position:relative;z-index:1}
a.dest:hover{transform:translateY(-6px);box-shadow:0 24px 50px -24px rgba(7,28,53,.55)}a.dest:hover img{transform:scale(1.05)}
.dest .chip{position:absolute;top:20px;left:20px;z-index:2;background:rgba(255,255,255,.18);color:#fff;padding:7px 14px;border-radius:999px;font-size:.85rem;font-weight:700}
.dest.open .chip{background:var(--coral);color:var(--navy)}
.dest h3{font-size:clamp(1.6rem,1.2rem + 1vw,2.1rem)}
.dest .uf{font-weight:600;opacity:.8;font-size:.95rem;margin-top:4px}
.dest p{margin-top:10px;font-size:.98rem;color:rgba(255,255,255,.9)}
.dest .go{margin-top:16px;display:inline-flex;align-items:center;gap:8px;font-weight:700}
.dest.soon::after{background:linear-gradient(180deg,transparent,rgba(0,0,0,.18))}
.wave{position:absolute;right:-30px;top:30%;width:120%;opacity:.12}
/* passos */
/* seções com fundo alternado, como na página da Búzios (Rodrigo 2026-11-16): claro, azul-marinho, claro, azul-claro, azul */
#como,#perguntas{padding-bottom:clamp(80px,10vw,130px)}
#como{background:var(--navy);color:#fff;margin-top:clamp(80px,10vw,130px)}#como .passo{color:var(--ink)}#como .sec-h p{color:rgba(255,255,255,.72)}
#barco{background:var(--chip);padding-bottom:clamp(80px,10vw,130px);margin-top:clamp(80px,10vw,130px)}
#perguntas{background:#0b3f91;color:#fff}#perguntas .side p{color:rgba(255,255,255,.8)}#perguntas .side .btn{background:#fff;color:#0b3f91}
#perguntas details{color:var(--ink)}
#perguntas .cta{background:var(--coral);color:var(--navy)}#perguntas .cta p{color:rgba(7,28,53,.82)}#perguntas .cta .btn.white{background:var(--navy);color:#fff}
.passos{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;counter-reset:p}
.passo{background:var(--white);border-radius:var(--r);padding:30px 26px 34px;transition:transform .3s var(--ease)}
.passo:hover{transform:translateY(-4px)}
.passo .n{width:46px;height:46px;border-radius:50%;background:var(--chip);color:var(--blue);display:grid;place-items:center;font-weight:800;font-size:1.15rem}
.passo h3{font-size:1.3rem;margin-top:22px;letter-spacing:-.015em}
.passo p{margin-top:8px;color:var(--soft)}
/* mares */
.mares{display:grid;grid-template-columns:5fr 7fr;gap:clamp(24px,5vw,72px);background:var(--white);border-radius:var(--r-lg);padding:clamp(28px,5vw,64px)}
.mares h2{font-size:clamp(2rem,1.4rem + 2vw,3.2rem)}.mares .txt p{margin-top:14px;color:var(--soft);max-width:38ch}
.mares .count{margin-top:28px;display:flex;gap:28px}.mares .count b{display:block;font-size:2.4rem;line-height:1;letter-spacing:-.03em;color:var(--blue)}.mares .count span{color:var(--soft);font-size:.95rem}
details{border-radius:16px;background:var(--bg);margin-bottom:10px;transition:background-color .2s}
details[open]{background:#eef3fa}
summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:18px 22px;font-weight:700;font-size:1.05rem}
summary::-webkit-details-marker{display:none}
summary .plus{width:30px;height:30px;border-radius:50%;background:#fff;display:grid;place-items:center;font-weight:600;transition:transform .3s var(--ease)}
details[open] summary .plus{transform:rotate(45deg)}
summary small{font-weight:600;color:var(--soft);font-size:.85rem;margin-left:auto;margin-right:14px}
details ul{list-style:none;margin:0;padding:0 22px 16px}
details li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 0}
details li+li{border-top:1px solid var(--line)}
details li .uf{color:var(--soft);font-size:.85rem;margin-left:6px}
.tag{font-size:.82rem;font-weight:700;padding:5px 12px;border-radius:999px;background:#fff;color:var(--soft);white-space:nowrap}
a.tag{background:var(--coral);color:var(--navy);text-decoration:none}
/* donos */
.dono{display:grid;grid-template-columns:1.1fr 1fr;background:var(--navy);color:#fff;border-radius:var(--r-lg);overflow:hidden}
.dono .txt{padding:clamp(32px,5vw,72px)}
.dono h2{font-size:clamp(2rem,1.4rem + 2vw,3.2rem)}
.dono p{margin-top:16px;color:rgba(255,255,255,.85);max-width:52ch}.dono p strong{color:#fff}
.dono .btns{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}
.dono .ph{position:relative;min-height:420px}.dono .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.sign{margin-top:24px;font-weight:700}.sign span{display:block;font-weight:500;color:rgba(255,255,255,.65);font-size:.92rem}
/* perguntas */
.faq{display:grid;grid-template-columns:4fr 8fr;gap:clamp(24px,5vw,72px)}
.faq h2{font-size:clamp(2rem,1.4rem + 2vw,3.2rem)}.faq .side p{margin-top:14px;color:var(--soft)}.faq .side .btn{margin-top:22px}
.faq details{background:var(--white)}.faq details[open]{background:var(--white)}
.faq details p{padding:0 22px 20px;color:var(--soft)}
/* chamada */
.cta{margin-top:clamp(80px,10vw,130px);background:var(--blue);color:#fff;border-radius:var(--r-lg);padding:clamp(40px,6vw,80px);display:flex;justify-content:space-between;align-items:center;gap:32px;position:relative;overflow:hidden}
.cta h2{font-size:clamp(2.2rem,1.4rem + 2.6vw,3.8rem)}.cta p{margin-top:12px;max-width:44ch;color:rgba(255,255,255,.9)}
.cta .btns{display:flex;gap:12px;flex-wrap:wrap;flex:none}
/* rodapé */
.pe{margin-top:clamp(80px,10vw,130px);background:var(--navy);color:#fff;padding:64px 0 36px}
.pe .row{display:flex;justify-content:space-between;gap:40px;flex-wrap:wrap}
.pe .logo{color:#fff}.pe .lema{margin-top:10px;font-weight:700;color:var(--coral);letter-spacing:.01em}.pe .about{max-width:40ch;margin-top:14px;color:rgba(255,255,255,.7)}
.pe ul{list-style:none;margin:0;padding:0}.pe li+li{margin-top:10px}.pe ul a{text-decoration:none;color:rgba(255,255,255,.85);font-weight:600}.pe ul a:hover{color:#fff}
.pe .imp{margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.55);font-size:.9rem}
/* entradas */
.js .rv{opacity:0;transform:translateY(26px);transition:opacity .7s var(--ease),transform .7s var(--ease)}
.js .rv.in{opacity:1;transform:none}
@keyframes up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.js .hero-txt>*,.js .sbar{animation:up .9s var(--ease) both}.js .hero-txt>:nth-child(2){animation-delay:.1s}.js .sbar{animation-delay:.2s}
@media (max-width:1000px){
 .top nav{display:none}.top .btn{margin-left:auto}
 .dests{grid-template-columns:repeat(2,1fr)}.passos{grid-template-columns:repeat(2,1fr)}
 .mares,.faq,.dono{grid-template-columns:1fr}.dono .ph{min-height:300px;order:-1}
 .cta{flex-direction:column;align-items:flex-start}
}
@media (max-width:720px){
 .langs{display:none}.top .wrap{height:64px}.logo{font-size:1.3rem}
 .hero{margin:0 10px;border-radius:26px;height:auto;min-height:0;aspect-ratio:auto}.hero{height:74svh;min-height:480px}
 .hero-txt{left:22px;right:22px;bottom:200px}
 .search{margin-top:-120px;padding:0 20px}
 .sbar{flex-direction:column;border-radius:26px;padding:10px;gap:2px}
 .sf{padding:12px 16px;border-radius:16px}.sf+.sf::before{left:16px;right:16px;top:0;bottom:auto;width:auto;height:1px}
 .sbar .btn{min-height:56px;margin-top:8px;width:100%}
 .dests{grid-template-columns:1fr;gap:14px}.dest{aspect-ratio:16/11}
 .passos{grid-template-columns:1fr}.sec-h{display:block}
 .cta .btns .btn{width:100%}.cta .btns{width:100%}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}.js .rv{opacity:1;transform:none}}
"""

JS = r"""
document.documentElement.classList.add("js");
if(!/(^|\.)bordazul\.com\.br$/.test(location.hostname))document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll('a[href^="/buzios"],option[data-url^="/buzios"],form[action^="/buzios"]').forEach(function(el){["href","data-url","action"].forEach(function(k){var v=el.getAttribute(k);if(v&&v.indexOf("/buzios")===0)el.setAttribute(k,"https://www.lanchaembuzios.com.br"+v.slice(7));});});});
(function(){
var f=document.getElementById("bilhete"),d=document.getElementById("f-data"),p=document.getElementById("f-pes"),s=document.getElementById("f-dest"),out=document.getElementById("res");
var now=new Date(),iso=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");d.min=iso;
document.querySelectorAll("[data-step]").forEach(function(b){b.addEventListener("click",function(){var v=(+p.value||1)+(+b.dataset.step);p.value=Math.max(1,Math.min(60,v));});});
function show(){var o=s.options[s.selectedIndex];out.innerHTML="";if(!o)return;
 if(o.dataset.url){out.textContent=f.dataset.aberto;}else{var c=o.dataset.nome,m=f.dataset.wa.replace("{c}",c);
  out.innerHTML=f.dataset.breve.replace("{c}",c)+' <a href="https://wa.me/'+f.dataset.num+'?text='+encodeURIComponent(m)+'" rel="noopener">'+f.dataset.btn+'</a>';}}
s.addEventListener("change",show);
document.querySelectorAll("[data-pick]").forEach(function(a){a.addEventListener("click",function(ev){ev.preventDefault();s.value=a.dataset.pick;show();document.getElementById("busca").scrollIntoView({behavior:"smooth",block:"center"});});});
f.addEventListener("submit",function(ev){var o=s.options[s.selectedIndex];ev.preventDefault();if(!o.dataset.url){show();var a=out.querySelector("a");a&&a.focus();return;}
 var q=[];if(d.value&&d.value>=iso)q.push("data="+d.value);var n=+p.value;if(n>=1&&n<=99)q.push("pessoas="+n);
 location.href=o.dataset.url+(q.length?"?"+q.join("&"):"");});
var imgs=[].slice.call(document.querySelectorAll(".hero .ph .sl")),i=0,red=matchMedia("(prefers-reduced-motion: reduce)").matches;
if(imgs.length>1&&!red){setInterval(function(){if(document.hidden)return;imgs[i].classList.remove("on");i=(i+1)%imgs.length;imgs[i].classList.add("on");},5600);}
var io="IntersectionObserver" in window?new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add("in");io.unobserve(x.target);}});},{threshold:.12}):null;
document.querySelectorAll(".rv").forEach(function(el){if(!io){el.classList.add("in");return;}
 var sib=[].slice.call(el.parentNode.children).filter(function(c){return c.classList.contains("rv");});el.style.transitionDelay=(Math.min(sib.indexOf(el),6)*70)+"ms";io.observe(el);});
})();
"""

LOGO = '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#0a63e8"/><path d="M5 18c2.2 0 2.2-2 4.4-2s2.2 2 4.4 2 2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M8 23c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6" fill="none" stroke="#f5b82e" stroke-width="2.4" stroke-linecap="round"/></svg>'

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
    bz = BUZ + PATH[lang]
    fotos = "".join(f'<div class="sl{" on" if i == 0 else ""}{" cv" if w > h else ""}{" cm" if n == "mar-buzios" else ""}{" up" if n == "barco-1" else ""}" style="--src:url({pre}img/{n}.jpg)"><img src="{pre}img/{n}.jpg" width="{w}" height="{h}" alt="{e(t["foto_alt"][i])}"{"" if i == 0 else " loading=lazy"}></div>' for i, (n, w, h) in enumerate(HERO_FOTOS))
    cid = {k: (nome, uf, u) for _, cs in DEST for k, nome, uf, u in cs}
    cards = []
    for k in SLIPS:
        nome, uf, u = cid[k]
        if u:
            cards.append(f'<a class="dest open rv" href="{e(bz)}"><img src="{pre}img/barco-1.jpg" width="960" height="1280" alt="{e(t["foto_alt"][2])}" loading="lazy">'
                         f'<span class="chip">{e(t["aberto"])}</span><h3>{e(nome)}</h3><div class="uf">{e(uf)}</div>'
                         f'<p>{e(t["slip"][k])}</p><span class="go">{e(t["ver"])} →</span></a>')
        else:
            cards.append(f'<a class="dest soon rv" href="#busca" data-pick="{k}" style="background:{TOM[k]}">'
                         f'<svg class="wave" viewBox="0 0 400 120" aria-hidden="true"><path d="M0 60c33 0 33-30 67-30s33 30 66 30 34-30 67-30 33 30 67 30 33-30 66-30 34 30 67 30" fill="none" stroke="#fff" stroke-width="10"/><path d="M0 100c33 0 33-30 67-30s33 30 66 30 34-30 67-30 33 30 67 30 33-30 66-30 34 30 67 30" fill="none" stroke="#fff" stroke-width="10"/></svg>'
                         f'<span class="chip">{e(t["breve"])}</span><h3>{e(nome)}</h3><div class="uf">{e(uf)}</div>'
                         f'<p>{e(t["slip"][k])}</p></a>')
    passos = "".join(f'<div class="passo rv"><div class="n" aria-label="{e(t["passo"])} {i+1}">{i+1}</div><h3>{e(a)}</h3><p>{e(b)}</p></div>' for i, (a, b) in enumerate(t["passos"]))
    regs = []
    total = sum(len(c) for _, c in DEST)
    for i, (reg, cidades) in enumerate(DEST):
        lis = "".join(
            f'<li><span>{e(nome)}<span class="uf">{uf}</span></span>'
            + (f'<a class="tag" href="{e(u + PATH[lang])}">{e(t["aberto"])}</a>' if u else f'<span class="tag">{e(t["breve"])}</span>')
            + "</li>" for k, nome, uf, u in cidades)
        regs.append(f'<details{" open" if i == 0 else ""}><summary>{e(t["reg"][reg])}<small>{len(cidades)}</small><span class="plus" aria-hidden="true">+</span></summary><ul>{lis}</ul></details>')
    carta = "".join(f"<p>{p}</p>" for p in t["carta"][1:])
    faq = "".join(f'<details><summary>{e(q)}<span class="plus" aria-hidden="true">+</span></summary><p>{e(a)}</p></details>' for q, a in t["faq"])
    ld = {"@context": "https://schema.org", "@type": "Organization", "name": "Bordazul", "url": DOM + "/",
          "description": t["desc"], "parentOrganization": {"@type": "Organization", "name": "Búzios Lanchas", "url": BZ + "/"},
          "contactPoint": {"@type": "ContactPoint", "telephone": "+55-21-99927-2550", "contactType": "customer service", "availableLanguage": ["Portuguese", "English", "Spanish"]}}
    ldf = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t["faq"]]}
    home = PATH[lang] if lang == "pt" else "./"
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
<meta name="theme-color" content="#f4f7fb">
<link rel="icon" href="{pre}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@500;600;700;800&display=swap" rel="stylesheet">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(ldf, ensure_ascii=False)}</script>
<style>{CSS}</style>
</head>
<body>
<a class="skip" href="#busca">{e(t["f_btn"])}</a>
<header class="top"><div class="wrap">
<a class="logo" href="{home}">{LOGO}bordazul</a>
<nav aria-label="Bordazul">{nav}</nav>
<div class="langs" aria-label="{e(t["lang"])}">{langs}</div>
<a class="btn" href="{e(bz)}">{e(t["navcta"])}</a>
</div></header>
<main>
<section class="hero">
<div class="ph">{fotos}</div>
<div class="hero-txt"><h1>{t["h1"]}</h1><p class="lead">{e(t["lead"])}</p></div>
</section>
<div class="search" id="busca">
<form class="sbar" id="bilhete" action="{e(bz)}" method="get" data-aberto="{e(t["r_aberto"])}" data-breve="{e(t["r_breve"])}" data-btn="{e(t["r_breve_btn"])}" data-wa="{e(t["wa_breve"])}" data-num="{WA}">
<div class="sf"><label for="f-dest">{e(t["f_dest"])}</label><select id="f-dest" name="destino">{destino_options(t, lang)}</select></div>
<div class="sf"><label for="f-data">{e(t["f_data"])}</label><input id="f-data" name="data" type="date"></div>
<div class="sf"><label for="f-pes">{e(t["f_pes"])}</label><div class="step"><button type="button" data-step="-1" aria-label="{e(t["menos"])}">−</button><input id="f-pes" name="pessoas" type="number" inputmode="numeric" min="1" max="60" value="2"><button type="button" data-step="1" aria-label="{e(t["mais"])}">+</button></div></div>
<button class="btn" type="submit">{ICON_BUSCA}{e(t["f_btn"])}</button>
</form>
<p class="result" id="res" aria-live="polite"></p>
</div>

<section class="sec" id="destinos"><div class="wrap">
<div class="sec-h"><div><h2 class="rv">{e(t["dest_h"])}</h2><p class="rv">{e(t["dest_p"])}</p></div></div>
<div class="dests">{"".join(cards)}</div>
</div></section>

<section class="sec" id="como"><div class="wrap">
<div class="sec-h"><div><h2 class="rv">{e(t["passos_h"])}</h2><p class="rv">{e(t["como_p"])}</p></div></div>
<div class="passos">{passos}</div>
</div></section>

<section class="sec"><div class="wrap">
<div class="mares rv">
<div class="txt"><h2>{e(t["mares"])}</h2><p>{e(t["mares_p"])}</p>
<div class="count"><div><b>{total}</b><span>{"destinos" if lang != "en" else "destinations"}</span></div><div><b>{len(DEST)}</b><span>{"regiões" if lang=="pt" else "regions" if lang=="en" else "regiones"}</span></div></div></div>
<div>{"".join(regs)}</div>
</div>
</div></section>

<section class="sec" id="barco"><div class="wrap">
<div class="dono rv">
<div class="txt"><h2>{e(t["dono_h"])}</h2><p>{re.sub(r"^<strong>.*?</strong>\s*", "", t["carta"][0])}</p>{carta}
<div class="sign">{e(t["carta_ass"])}<span>{e(t["carta_cargo"])}</span></div>
<div class="btns"><a class="btn coral" href="/anunciar/">{e(t["carta_btn"])}</a></div></div>
<div class="ph"><img src="{pre}img/barco-3.jpg" width="1400" height="1050" alt="{e(t["foto_alt"][1])}" loading="lazy"></div>
</div>
</div></section>

<section class="sec" id="perguntas"><div class="wrap">
<div class="faq">
<div class="side"><h2 class="rv">{e(t["faq_h"])}</h2><p class="rv">{e(t["faq_p"])}</p><a class="btn rv" href="{e(wa(t["wa_geral"]))}" rel="noopener">{ICON_WA}{e(t["cta_btn2"])}</a></div>
<div class="rv">{faq}</div>
</div>
<div class="cta rv"><div><h2>{e(t["cta_h"])}</h2><p>{e(t["cta_l"])} {e(t["cta_p"])}</p></div>
<div class="btns"><a class="btn white" href="{e(bz)}">{e(t["cta_btn"])} →</a></div></div>
</div></section>
</main>

<footer class="pe"><div class="wrap">
<div class="row">
<div><a class="logo" href="{home}">{LOGO}bordazul</a><p class="lema">{e(t["pe_lema"])}</p><p class="about">{e(t["pe_p"])}</p></div>
<ul>
<li><a href="{e(wa(t["wa_geral"]))}" rel="noopener">WhatsApp (21) 99927-2550</a></li>
<li><a href="{e(bz)}">Búzios, RJ</a></li>
<li><a href="https://www.instagram.com/missbardotbuzios/" rel="noopener">@missbardotbuzios</a></li>
</ul>
<ul>{nav.replace("<a ", "<li><a ").replace("</a>", "</a></li>")}</ul>
</div>
<p class="imp">{e(t["pe_imp"])}</p>
</div></footer>
<script>{JS}</script>
</body>
</html>
"""

FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#0a63e8"/><path d="M5 18c2.2 0 2.2-2 4.4-2s2.2 2 4.4 2 2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M8 23c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6" fill="none" stroke="#f5b82e" stroke-width="2.4" stroke-linecap="round"/></svg>'

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
