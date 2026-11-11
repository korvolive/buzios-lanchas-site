/* Páginas de conteúdo para o Google e as IAs (2026-11-05, pedido do o dono):
   "Passeio de lancha em Búzios: roteiro e praias" e "Lancha para grupos e aniversários", em pt, en e es.
   São páginas simples (sem o JavaScript do site), geradas a cada publicação pelo scripts/prerender.mjs
   com as lanchas, o roteiro e o "a partir de" que estão no ar. Para mudar um texto, mude aqui. */
import fs from "node:fs";
import path from "node:path";

export const GUIAS = {
  roteiro: { pt: "passeio-de-lancha-em-buzios", en: "boat-tour-in-buzios", es: "paseo-en-lancha-en-buzios" },
  grupos: { pt: "lancha-para-grupos-e-aniversarios", en: "boat-party-for-groups-in-buzios", es: "lancha-para-grupos-y-cumpleanos" },
  precos: { pt: "quanto-custa-alugar-lancha-em-buzios", en: "boat-rental-prices-in-buzios", es: "precio-alquiler-lancha-en-buzios" },
  marinheiro: { pt: "aluguel-de-lancha-com-marinheiro-em-buzios", en: "boat-rental-with-skipper-in-buzios", es: "alquiler-de-lancha-con-marinero-en-buzios" },
  praias: { pt: "melhores-praias-de-buzios-de-lancha", en: "best-beaches-in-buzios-by-boat", es: "mejores-playas-de-buzios-en-lancha" },
};
export const guiaPath = (g, l) => (l === "pt" ? "/" : `/${l}/`) + GUIAS[g][l] + "/";

const WA = "5521999272550";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const boatPath = (l, slug) => (l === "pt" ? "/" : `/${l}/`) + `lancha/${slug}/`;
const homePath = l => (l === "pt" ? "/" : `/${l}/`);
const num = (v, l) => v.toLocaleString(l === "en" ? "en-US" : "pt-BR");

/* textos comuns das duas páginas */
const C = {
  pt: { html: "pt-BR", og: "pt_BR", home: "Início", boats: "Ver todas as lanchas", wa: "Consultar no WhatsApp", waMsg: "Olá! Vi o site e quero fazer um passeio de lancha em Búzios.",
    people: n => `até ${n} pessoas`, feet: f => `${String(f).replace(".", ",")} pés`, seeBoat: "Ver a lancha", photo: "Foto",
    foot: "Búzios Lanchas · CNPJ 32.154.099/0001-72 · Armação dos Búzios, RJ", privacy: "Termos e privacidade", ctaP: "Escolha a data e fale com a gente: respondemos na hora.", other: "Leia também", faqT: "Perguntas frequentes",
    price: (a, b) => `O passeio privativo de 4 horas sai a partir de R$ ${a}${b ? ` e o de 7 horas a partir de R$ ${b}` : ""}. O valor é por lancha, para o grupo todo (não é por pessoa), e muda conforme a lancha, a data e a temporada.` },
  en: { html: "en", og: "en_US", home: "Home", boats: "See all boats", wa: "Ask on WhatsApp", waMsg: "Hi! I saw the website and I'd like a boat tour in Búzios.",
    people: n => `up to ${n} people`, feet: f => `${f} ft`, seeBoat: "See the boat", photo: "Photo",
    foot: "Búzios Lanchas · CNPJ 32.154.099/0001-72 · Armação dos Búzios, RJ, Brazil", privacy: "Terms and privacy", ctaP: "Pick your date and message us: we reply right away.", other: "Read also", faqT: "Frequently asked questions",
    price: (a, b) => `The private 4-hour tour starts at R$ ${a}${b ? ` and the 7-hour tour at R$ ${b}` : ""}. The price is per boat, for the whole group (not per person), and varies with the boat, the date and the season.` },
  es: { html: "es", og: "es_ES", home: "Inicio", boats: "Ver todas las lanchas", wa: "Consultar por WhatsApp", waMsg: "¡Hola! Vi el sitio y quiero hacer un paseo en lancha en Búzios.",
    people: n => `hasta ${n} personas`, feet: f => `${String(f).replace(".", ",")} pies`, seeBoat: "Ver la lancha", photo: "Foto",
    foot: "Búzios Lanchas · CNPJ 32.154.099/0001-72 · Armação dos Búzios, RJ, Brasil", privacy: "Términos y privacidad", ctaP: "Elige la fecha y escríbenos: respondemos al instante.", other: "Lee también", faqT: "Preguntas frecuentes",
    price: (a, b) => `El paseo privado de 4 horas sale desde R$ ${a}${b ? ` y el de 7 horas desde R$ ${b}` : ""}. El precio es por lancha, para todo el grupo (no por persona), y cambia según la lancha, la fecha y la temporada.` },
};

/* pergunta do preço (mesma do site, com o "a partir de" automático) */
const faqPreco = { pt: "Quanto custa um passeio de lancha em Búzios?", en: "How much does a boat tour in Búzios cost?", es: "¿Cuánto cuesta un paseo en lancha en Búzios?" };

/* textos próprios de cada página */
const T = {
  roteiro: {
    pt: { title: "Passeio de lancha em Búzios: roteiro, praias e como funciona | Búzios Lanchas",
      desc: "Roteiro do passeio de lancha privativo em Búzios: Armação, Ossos, Azeda, João Fernandes, Ilha Branca, Ilha Feia e Tartaruga. Duração, o que está incluso, embarque e lanchas.",
      h1: "Passeio de lancha em Búzios: roteiro e praias",
      lead: "Búzios tem mais de 20 praias, e muitas das mais bonitas ficam melhores vistas do mar. No passeio de lancha privativo, a lancha é só do seu grupo: vocês param onde quiserem, mergulham em água transparente e voltam no horário combinado.",
      routeT: "O roteiro, parada por parada",
      routeP: "Este é o roteiro padrão de todas as lanchas. Vocês escolhem como aproveitar: fazer o roteiro completo, passar mais tempo na praia preferida ou fazer um caminho mais curto e ficar em uma praia o resto do passeio. As paradas podem mudar conforme as condições do mar.",
      howT: "Como funciona",
      how: ["<b>4 horas</b>: das 10h às 14h ou das 14h às 18h. Dá para conhecer as principais praias e parar para mergulho.", "<b>7 horas</b>: das 10h às 17h. Mais tempo em cada parada, para quem quer o dia inteiro no mar.",
        "<b>Incluso</b>: marinheiro habilitado, combustível, gelo, carvão, água mineral, cooler, churrasqueira e som Bluetooth. Se vocês levarem a carne, a tripulação faz o churrasco. Comidas e bebidas não estão inclusas, então dá para levar o que o grupo gosta.",
        "<b>Embarque</b>: nos píeres da Praia dos Ossos e marinas de Búzios, conforme a lancha e o horário. O local exato aparece na página de cada lancha.",
        "<b>Crianças e pets</b> são bem-vindos. A capacidade da lancha conta todo mundo, inclusive bebês, porque é o limite do documento da Marinha.",
        "<b>Reserva</b>: com sinal de 50% por Pix para a Búzios Lanchas. O restante é pago no dia. Se a Marinha proibir a navegação na data, o passeio é remarcado ou o sinal é devolvido."],
      faq: [["Quanto tempo dura o passeio de lancha em Búzios?", "Há duas opções: 4 horas (das 10h às 14h ou das 14h às 18h) e 7 horas (das 10h às 17h)."],
        ["Quais praias o passeio de lancha passa?", "O roteiro padrão passa pela Armação, Ossos, Azeda, Azedinha, João Fernandes, João Fernandinho, Ilha Branca, Ilha Feia, Tartaruga, Amores, Virgens e Canto. O grupo escolhe onde ficar mais tempo."],
        ["O passeio é privativo?", "Sim. A lancha é só do seu grupo, com marinheiro. Não é passeio coletivo de escuna."],
        ["Dá para mergulhar?", "Sim. Azeda, João Fernandes e a Ilha Feia estão entre os melhores lugares para mergulhar e fazer snorkel em Búzios."]] },
    en: { title: "Boat tour in Búzios: route, beaches and how it works | Búzios Lanchas",
      desc: "Private boat tour route in Búzios, Brazil: Armação, Ossos, Azeda, João Fernandes, Ilha Branca, Ilha Feia and Tartaruga. Duration, what's included, boarding and boats.",
      h1: "Boat tour in Búzios: route and beaches",
      lead: "Búzios has more than 20 beaches, and many of the most beautiful ones are best seen from the sea. On a private boat tour the boat is only for your group: you stop wherever you like, swim in clear water and come back at the agreed time.",
      routeT: "The route, stop by stop",
      routeP: "This is the standard route for every boat. You choose how to enjoy it: do the full route, spend more time at your favorite beach, or take a shorter route and stay at one beach for the rest of the tour. Stops may change with sea conditions.",
      howT: "How it works",
      how: ["<b>4 hours</b>: 10am to 2pm or 2pm to 6pm. Enough to see the main beaches and stop for a swim.", "<b>7 hours</b>: 10am to 5pm. More time at each stop, for a full day at sea.",
        "<b>Included</b>: licensed skipper, fuel, ice, charcoal, mineral water, cooler, barbecue grill and Bluetooth speaker. If you bring the meat, the crew grills it. Food and drinks are not included, so you can bring what your group likes.",
        "<b>Boarding</b>: at the piers of Praia dos Ossos and the marinas of Búzios, depending on the boat and time. The exact place is on each boat's page.",
        "<b>Children and pets</b> are welcome. The boat's capacity counts everyone, babies included, because it is the limit on the Brazilian Navy document.",
        "<b>Booking</b>: with a 50% deposit by Pix to Búzios Lanchas; the rest is paid on the day. If the Navy closes navigation on your date, the tour is rescheduled or the deposit refunded."],
      faq: [["How long is a boat tour in Búzios?", "There are two options: 4 hours (10am to 2pm or 2pm to 6pm) and 7 hours (10am to 5pm)."],
        ["Which beaches does the boat tour visit?", "The standard route passes Armação, Ossos, Azeda, Azedinha, João Fernandes, João Fernandinho, Ilha Branca, Ilha Feia, Tartaruga, Amores, Virgens and Canto. Your group chooses where to stay longer."],
        ["Is the tour private?", "Yes. The boat is only for your group, with a skipper. It is not a shared schooner tour."],
        ["Can we swim and snorkel?", "Yes. Azeda, João Fernandes and Ilha Feia are among the best places to swim and snorkel in Búzios."]] },
    es: { title: "Paseo en lancha en Búzios: recorrido, playas y cómo funciona | Búzios Lanchas",
      desc: "Recorrido del paseo privado en lancha en Búzios: Armação, Ossos, Azeda, João Fernandes, Ilha Branca, Ilha Feia y Tartaruga. Duración, qué incluye, embarque y lanchas.",
      h1: "Paseo en lancha en Búzios: recorrido y playas",
      lead: "Búzios tiene más de 20 playas, y muchas de las más lindas se ven mejor desde el mar. En el paseo privado en lancha, la lancha es solo para tu grupo: paran donde quieran, nadan en agua transparente y vuelven a la hora acordada.",
      routeT: "El recorrido, parada por parada",
      routeP: "Este es el recorrido estándar de todas las lanchas. Ustedes eligen cómo disfrutarlo: hacer el recorrido completo, quedarse más tiempo en la playa favorita o hacer un camino más corto y quedarse en una playa el resto del paseo. Las paradas pueden cambiar según las condiciones del mar.",
      howT: "Cómo funciona",
      how: ["<b>4 horas</b>: de 10 a 14 h o de 14 a 18 h. Alcanza para conocer las playas principales y parar a nadar.", "<b>7 horas</b>: de 10 a 17 h. Más tiempo en cada parada, para pasar el día entero en el mar.",
        "<b>Incluido</b>: marinero habilitado, combustible, hielo, carbón, agua mineral, conservadora, parrilla y parlante Bluetooth. Si llevan la carne, la tripulación hace el asado. Comidas y bebidas no están incluidas, así que pueden llevar lo que le guste al grupo.",
        "<b>Embarque</b>: en los muelles de Praia dos Ossos y las marinas de Búzios, según la lancha y el horario. El lugar exacto aparece en la página de cada lancha.",
        "<b>Niños y mascotas</b> son bienvenidos. La capacidad de la lancha cuenta a todos, incluso bebés, porque es el límite del documento de la Marina.",
        "<b>Reserva</b>: con una seña del 50% por Pix a Búzios Lanchas; el resto se paga el día del paseo. Si la Marina prohíbe la navegación en la fecha, el paseo se reprograma o se devuelve la seña."],
      faq: [["¿Cuánto dura el paseo en lancha en Búzios?", "Hay dos opciones: 4 horas (de 10 a 14 h o de 14 a 18 h) y 7 horas (de 10 a 17 h)."],
        ["¿Por qué playas pasa el paseo en lancha?", "El recorrido estándar pasa por Armação, Ossos, Azeda, Azedinha, João Fernandes, João Fernandinho, Ilha Branca, Ilha Feia, Tartaruga, Amores, Virgens y Canto. El grupo elige dónde quedarse más tiempo."],
        ["¿El paseo es privado?", "Sí. La lancha es solo para tu grupo, con marinero. No es un paseo compartido en goleta."],
        ["¿Se puede nadar y hacer snorkel?", "Sí. Azeda, João Fernandes e Ilha Feia están entre los mejores lugares para nadar y hacer snorkel en Búzios."]] },
  },
  grupos: {
    pt: { title: "Lancha para grupos e aniversários em Búzios | Búzios Lanchas",
      desc: "Aluguel de lancha privativa em Búzios para grupos de amigos, famílias, aniversários e despedidas. Lanchas para até 16 pessoas, com marinheiro, churrasqueira e som.",
      h1: "Passeio de lancha para grupos e aniversários em Búzios",
      lead: "Aniversário, despedida de solteira, encontro de amigos ou a família reunida: em Búzios, comemorar no mar é programa certo. A lancha é só do seu grupo, o valor é por lancha (não por pessoa) e vocês decidem o ritmo do dia.",
      whyT: "Por que é bom para grupos",
      why: ["<b>O valor é dividido</b>: quanto maior o grupo, menor fica a conta de cada um.", "<b>Só o seu grupo a bordo</b>: sem dividir o barco com desconhecidos.",
        "<b>Churrasqueira e som Bluetooth</b> em todas as lanchas. Levem a carne e a tripulação faz o churrasco.", "<b>Levem o que quiserem</b>: comidas, bebidas e o bolo de aniversário. Gelo, água mineral e cooler já estão inclusos.",
        "<b>Paradas para mergulho</b> nas praias mais bonitas, e vocês escolhem onde ficar mais tempo.", "<b>Crianças e pets</b> são bem-vindos."],
      tipsT: "Dicas para organizar",
      tips: ["Conte todo mundo, inclusive crianças e bebês: a capacidade da lancha é o limite do documento da Marinha.", "Para comemorar o dia inteiro, o passeio de 7 horas (10h às 17h) dá mais tempo em cada praia.",
        "Datas de verão, feriados e Réveillon esgotam antes. Reserve com antecedência.", "Grupo maior que a capacidade de uma lancha? Fale com a gente pelo WhatsApp e ajudamos a organizar."],
      boatsT: "Lanchas por tamanho",
      faq: [["Qual a maior lancha para grupos em Búzios?", "A Miss Bardot, de 35 pés, leva até 16 pessoas e tem ar-condicionado, gerador e air fryer."],
        ["Pode levar bolo e bebidas para o aniversário?", "Pode. Comidas e bebidas não estão inclusas, então o grupo leva o que quiser. Gelo, água mineral e cooler já estão no passeio."],
        ["O valor é por pessoa?", "Não. O valor é por lancha, para o grupo todo, até a capacidade da lancha."]] },
    en: { title: "Boat party for groups and birthdays in Búzios | Búzios Lanchas",
      desc: "Private boat rental in Búzios, Brazil, for groups of friends, families, birthdays and bachelorette parties. Boats for up to 16 people, with skipper, barbecue grill and music.",
      h1: "Boat tour for groups and birthdays in Búzios",
      lead: "A birthday, a bachelorette party, friends getting together or the whole family: in Búzios, celebrating at sea is a sure thing. The boat is only for your group, the price is per boat (not per person) and you set the pace of the day.",
      whyT: "Why it works for groups",
      why: ["<b>Split the price</b>: the bigger the group, the less each person pays.", "<b>Only your group on board</b>: no sharing the boat with strangers.",
        "<b>Barbecue grill and Bluetooth speaker</b> on every boat. Bring the meat and the crew grills it.", "<b>Bring what you like</b>: food, drinks and the birthday cake. Ice, mineral water and a cooler are included.",
        "<b>Swim stops</b> at the most beautiful beaches, and you choose where to stay longer.", "<b>Children and pets</b> are welcome."],
      tipsT: "Planning tips",
      tips: ["Count everyone, children and babies included: the boat's capacity is the limit on the Navy document.", "To celebrate all day, the 7-hour tour (10am to 5pm) gives more time at each beach.",
        "Summer dates, holidays and New Year's Eve sell out first. Book early.", "Group bigger than one boat? Message us on WhatsApp and we'll help you plan."],
      boatsT: "Boats by size",
      faq: [["What is the biggest boat for groups in Búzios?", "Miss Bardot, 35 ft, takes up to 16 people and has air conditioning, a generator and an air fryer."],
        ["Can we bring a cake and drinks for the birthday?", "Yes. Food and drinks are not included, so your group brings what it likes. Ice, mineral water and a cooler are part of the tour."],
        ["Is the price per person?", "No. The price is per boat, for the whole group, up to the boat's capacity."]] },
    es: { title: "Lancha para grupos y cumpleaños en Búzios | Búzios Lanchas",
      desc: "Alquiler de lancha privada en Búzios para grupos de amigos, familias, cumpleaños y despedidas. Lanchas para hasta 16 personas, con marinero, parrilla y música.",
      h1: "Paseo en lancha para grupos y cumpleaños en Búzios",
      lead: "Cumpleaños, despedida de soltera, encuentro de amigos o la familia reunida: en Búzios, festejar en el mar es un plan seguro. La lancha es solo para tu grupo, el precio es por lancha (no por persona) y ustedes deciden el ritmo del día.",
      whyT: "Por qué es ideal para grupos",
      why: ["<b>El precio se divide</b>: cuanto más grande el grupo, menos paga cada uno.", "<b>Solo tu grupo a bordo</b>: sin compartir el barco con desconocidos.",
        "<b>Parrilla y parlante Bluetooth</b> en todas las lanchas. Lleven la carne y la tripulación hace el asado.", "<b>Lleven lo que quieran</b>: comida, bebidas y la torta de cumpleaños. Hielo, agua mineral y conservadora ya están incluidos.",
        "<b>Paradas para nadar</b> en las playas más lindas, y ustedes eligen dónde quedarse más tiempo.", "<b>Niños y mascotas</b> son bienvenidos."],
      tipsT: "Consejos para organizar",
      tips: ["Cuenten a todos, incluso niños y bebés: la capacidad de la lancha es el límite del documento de la Marina.", "Para festejar todo el día, el paseo de 7 horas (de 10 a 17 h) da más tiempo en cada playa.",
        "Las fechas de verano, feriados y Año Nuevo se agotan primero. Reserven con anticipación.", "¿El grupo es más grande que una lancha? Escríbannos por WhatsApp y los ayudamos a organizar."],
      boatsT: "Lanchas por tamaño",
      faq: [["¿Cuál es la lancha más grande para grupos en Búzios?", "La Miss Bardot, de 35 pies, lleva hasta 16 personas y tiene aire acondicionado, generador y freidora de aire."],
        ["¿Se puede llevar torta y bebidas para el cumpleaños?", "Sí. Comidas y bebidas no están incluidas, así que el grupo lleva lo que quiera. Hielo, agua mineral y conservadora ya son parte del paseo."],
        ["¿El precio es por persona?", "No. El precio es por lancha, para todo el grupo, hasta la capacidad de la lancha."]] },
  },
};

/* página "Quanto custa alugar uma lancha em Búzios" (2026-11-09, busca por preço). Só o "a partir de": nunca o preço de cada lancha. */
T.precos = {
  pt: { title: "Quanto custa alugar uma lancha em Búzios? Preços e temporadas | Búzios Lanchas",
    desc: "Preço do aluguel de lancha em Búzios: o valor é por lancha, não por pessoa. Veja o que muda o preço (tamanho, 4 ou 7 horas, temporada), o que está incluso e como reservar.",
    h1: "Quanto custa alugar uma lancha em Búzios",
    lead: "O aluguel de lancha em Búzios é cobrado por lancha, para o grupo todo, e não por pessoa. O valor depende de três coisas: o tamanho da lancha, a duração do passeio e a data.",
    whatT: "O que muda o preço",
    what: ["<b>Tamanho da lancha</b>: lanchas maiores levam mais gente e têm mais conforto, como ar-condicionado e cabine. A Miss Bardot, de 35 pés, leva até 16 pessoas.",
      "<b>Duração</b>: o passeio de 4 horas (10h às 14h ou 14h às 18h) ou o de 7 horas (10h às 17h), com mais tempo em cada praia.",
      "<b>Data e temporada</b>: verão, feriados, Réveillon e Carnaval custam mais. De segunda a quinta, fora de feriado, algumas lanchas têm desconto.",
      "<b>Tamanho do grupo</b>: como o valor é por lancha, quanto mais gente no grupo (até a capacidade), menor a conta de cada um."],
    seasT: "Temporadas em Búzios",
    seas: ["<b>Baixa temporada</b>: maio a outubro. Os melhores preços do ano.",
      "<b>Média temporada</b>: março, abril e novembro.", "<b>Alta temporada</b>: dezembro, janeiro e fevereiro.",
      "<b>Feriados</b>: feriadões têm valor próprio e esgotam antes.", "<b>Réveillon e Carnaval</b>: de 27 de dezembro a 5 de janeiro e no Carnaval. Reserve com bastante antecedência."],
    inclT: "O que está incluso no valor",
    incl: ["Marinheiro habilitado, combustível, gelo, carvão, água mineral e cooler.", "Churrasqueira e som Bluetooth. Se vocês levarem a carne, a tripulação faz o churrasco.",
      "Comidas e bebidas não estão inclusas: o grupo leva o que quiser.", "Reserva com sinal de 50% para a Búzios Lanchas; o restante é pago no dia do passeio."],
    boatsT: "As lanchas",
    faq: [["O preço do passeio de lancha é por pessoa?", "Não. O valor é por lancha, para o grupo todo, até a capacidade da lancha."],
      ["Qual a época mais barata para alugar lancha em Búzios?", "A baixa temporada, de maio a outubro, tem os menores preços. De segunda a quinta, fora de feriado, algumas lanchas também têm desconto."],
      ["O combustível está incluso?", "Sim. Combustível, marinheiro, gelo, carvão, água mineral e cooler já estão no valor."],
      ["Como faço para saber o preço exato da minha data?", "Mande a data e o número de pessoas pelo WhatsApp (21) 99927-2550. Respondemos na hora com as lanchas livres e o valor."]] },
  en: { title: "How much does it cost to rent a boat in Búzios? Prices and seasons | Búzios Lanchas",
    desc: "Boat rental prices in Búzios, Brazil: the price is per boat, not per person. See what changes the price (size, 4 or 7 hours, season), what's included and how to book.",
    h1: "How much does it cost to rent a boat in Búzios",
    lead: "Boat rental in Búzios is charged per boat, for the whole group, not per person. The price depends on three things: the size of the boat, the length of the tour and the date.",
    whatT: "What changes the price",
    what: ["<b>Boat size</b>: bigger boats take more people and have more comfort, such as air conditioning and a cabin. Miss Bardot, 35 ft, takes up to 16 people.",
      "<b>Length</b>: the 4-hour tour (10am to 2pm or 2pm to 6pm) or the 7-hour tour (10am to 5pm), with more time at each beach.",
      "<b>Date and season</b>: summer, holidays, New Year's and Carnival cost more. Monday to Thursday, outside holidays, some boats have a discount.",
      "<b>Group size</b>: since the price is per boat, the more people in your group (up to capacity), the less each person pays."],
    seasT: "Seasons in Búzios",
    seas: ["<b>Low season</b>: May to October. The best prices of the year.",
      "<b>Mid season</b>: March, April and November.", "<b>High season</b>: December, January and February.",
      "<b>Holidays</b>: long holiday weekends have their own price and sell out first.", "<b>New Year's and Carnival</b>: December 27 to January 5 and Carnival. Book well in advance."],
    inclT: "What's included in the price",
    incl: ["Licensed skipper, fuel, ice, charcoal, mineral water and a cooler.", "Barbecue grill and Bluetooth speaker. If you bring the meat, the crew grills it.",
      "Food and drinks are not included: your group brings what it likes.", "Booking with a 50% deposit to Búzios Lanchas; the rest is paid on the day of the tour."],
    boatsT: "The boats",
    faq: [["Is the boat tour price per person?", "No. The price is per boat, for the whole group, up to the boat's capacity."],
      ["When is it cheapest to rent a boat in Búzios?", "Low season, May to October, has the lowest prices. Monday to Thursday, outside holidays, some boats also have a discount."],
      ["Is fuel included?", "Yes. Fuel, skipper, ice, charcoal, mineral water and a cooler are included in the price."],
      ["How do I get the exact price for my date?", "Send the date and number of people on WhatsApp +55 21 99927-2550. We reply right away with the available boats and the price."]] },
  es: { title: "¿Cuánto cuesta alquilar una lancha en Búzios? Precios y temporadas | Búzios Lanchas",
    desc: "Precio del alquiler de lancha en Búzios: el valor es por lancha, no por persona. Mira qué cambia el precio (tamaño, 4 o 7 horas, temporada), qué incluye y cómo reservar.",
    h1: "Cuánto cuesta alquilar una lancha en Búzios",
    lead: "El alquiler de lancha en Búzios se cobra por lancha, para todo el grupo, y no por persona. El precio depende de tres cosas: el tamaño de la lancha, la duración del paseo y la fecha.",
    whatT: "Qué cambia el precio",
    what: ["<b>Tamaño de la lancha</b>: las lanchas más grandes llevan más gente y tienen más comodidad, como aire acondicionado y cabina. La Miss Bardot, de 35 pies, lleva hasta 16 personas.",
      "<b>Duración</b>: el paseo de 4 horas (de 10 a 14 h o de 14 a 18 h) o el de 7 horas (de 10 a 17 h), con más tiempo en cada playa.",
      "<b>Fecha y temporada</b>: verano, feriados, Año Nuevo y Carnaval cuestan más. De lunes a jueves, fuera de feriados, algunas lanchas tienen descuento.",
      "<b>Tamaño del grupo</b>: como el precio es por lancha, cuanta más gente en el grupo (hasta la capacidad), menos paga cada uno."],
    seasT: "Temporadas en Búzios",
    seas: ["<b>Temporada baja</b>: de mayo a octubre. Los mejores precios del año.",
      "<b>Temporada media</b>: marzo, abril y noviembre.", "<b>Temporada alta</b>: diciembre, enero y febrero.",
      "<b>Feriados</b>: los feriados largos tienen precio propio y se agotan primero.", "<b>Año Nuevo y Carnaval</b>: del 27 de diciembre al 5 de enero y en Carnaval. Reserva con mucha anticipación."],
    inclT: "Qué incluye el precio",
    incl: ["Marinero habilitado, combustible, hielo, carbón, agua mineral y conservadora.", "Parrilla y parlante Bluetooth. Si llevan la carne, la tripulación hace el asado.",
      "Comidas y bebidas no están incluidas: el grupo lleva lo que quiera.", "Reserva con una seña del 50% a Búzios Lanchas; el resto se paga el día del paseo."],
    boatsT: "Las lanchas",
    faq: [["¿El precio del paseo en lancha es por persona?", "No. El precio es por lancha, para todo el grupo, hasta la capacidad de la lancha."],
      ["¿Cuál es la época más barata para alquilar lancha en Búzios?", "La temporada baja, de mayo a octubre, tiene los precios más bajos. De lunes a jueves, fuera de feriados, algunas lanchas también tienen descuento."],
      ["¿El combustible está incluido?", "Sí. Combustible, marinero, hielo, carbón, agua mineral y conservadora ya están en el precio."],
      ["¿Cómo sé el precio exacto de mi fecha?", "Envía la fecha y la cantidad de personas por WhatsApp +55 21 99927-2550. Respondemos al instante con las lanchas libres y el precio."]] },
};

/* páginas "lancha com marinheiro" e "praias de Búzios" (2026-11-09). Seções: secs = [[título, [itens]]] */
T.marinheiro = {
  pt: { title: "Aluguel de lancha com marinheiro em Búzios | Búzios Lanchas",
    desc: "Aluguel de lancha com marinheiro habilitado em Búzios: combustível, gelo, carvão e água inclusos. Passeios privativos de 4 ou 7 horas. Veja como funciona e as lanchas.",
    h1: "Aluguel de lancha com marinheiro em Búzios",
    lead: "Em todas as nossas lanchas o marinheiro habilitado já está incluso. Vocês não precisam de habilitação nem de se preocupar com a navegação: é só aproveitar o passeio com o grupo.",
    secs: [["O que o marinheiro faz", ["Conduz a lancha com segurança e conhece as praias, as paradas e as condições do mar de Búzios.", "Ajuda no embarque e no desembarque e cuida da âncora nas paradas para mergulho.", "Se vocês levarem a carne, a tripulação faz o churrasco.", "Decide com o grupo o melhor caminho conforme o vento e o mar, sempre priorizando a segurança."]],
      ["O que mais está incluso", ["Combustível, gelo, carvão, água mineral e cooler.", "Churrasqueira e som Bluetooth.", "Comidas e bebidas não estão inclusas: o grupo leva o que quiser."]],
      ["Como reservar", ["Escolha a data e a lancha e fale com a gente pelo WhatsApp (21) 99927-2550.", "A reserva é confirmada com sinal de 50%; o restante é pago no dia.", "Crianças e pets são bem-vindos. A capacidade conta todo mundo, inclusive bebês."]]],
    boatsT: "Lanchas com marinheiro",
    faq: [["O marinheiro está incluso no valor?", "Sim. Todas as lanchas saem com marinheiro habilitado, e o valor também inclui combustível, gelo, carvão, água mineral e cooler."],
      ["Preciso ter habilitação para alugar uma lancha em Búzios?", "Não. Como a lancha sai com marinheiro habilitado, o grupo só aproveita o passeio."]] },
  en: { title: "Boat rental with skipper in Búzios | Búzios Lanchas",
    desc: "Boat rental with a licensed skipper in Búzios, Brazil: fuel, ice, charcoal and water included. Private 4 or 7 hour tours. See how it works and the boats.",
    h1: "Boat rental with skipper in Búzios",
    lead: "On all our boats the licensed skipper is already included. You don't need a boating license or to worry about navigation: just enjoy the tour with your group.",
    secs: [["What the skipper does", ["Drives the boat safely and knows the beaches, the stops and the sea conditions in Búzios.", "Helps with boarding and getting off, and handles the anchor at swim stops.", "If you bring the meat, the crew grills it.", "Chooses the best route with your group depending on wind and sea, always putting safety first."]],
      ["What else is included", ["Fuel, ice, charcoal, mineral water and a cooler.", "Barbecue grill and Bluetooth speaker.", "Food and drinks are not included: your group brings what it likes."]],
      ["How to book", ["Pick the date and the boat and message us on WhatsApp +55 21 99927-2550.", "The booking is confirmed with a 50% deposit; the rest is paid on the day.", "Children and pets are welcome. Capacity counts everyone, babies included."]]],
    boatsT: "Boats with skipper",
    faq: [["Is the skipper included in the price?", "Yes. Every boat comes with a licensed skipper, and the price also includes fuel, ice, charcoal, mineral water and a cooler."],
      ["Do I need a boating license to rent a boat in Búzios?", "No. Since the boat comes with a licensed skipper, your group just enjoys the tour."]] },
  es: { title: "Alquiler de lancha con marinero en Búzios | Búzios Lanchas",
    desc: "Alquiler de lancha con marinero habilitado en Búzios: combustible, hielo, carbón y agua incluidos. Paseos privados de 4 o 7 horas. Mira cómo funciona y las lanchas.",
    h1: "Alquiler de lancha con marinero en Búzios",
    lead: "En todas nuestras lanchas el marinero habilitado ya está incluido. No necesitan licencia ni preocuparse por la navegación: solo disfrutar el paseo con el grupo.",
    secs: [["Qué hace el marinero", ["Conduce la lancha con seguridad y conoce las playas, las paradas y las condiciones del mar de Búzios.", "Ayuda a subir y bajar, y se encarga del ancla en las paradas para nadar.", "Si llevan la carne, la tripulación hace el asado.", "Elige con el grupo el mejor camino según el viento y el mar, siempre priorizando la seguridad."]],
      ["Qué más está incluido", ["Combustible, hielo, carbón, agua mineral y conservadora.", "Parrilla y parlante Bluetooth.", "Comidas y bebidas no están incluidas: el grupo lleva lo que quiera."]],
      ["Cómo reservar", ["Elige la fecha y la lancha y escríbenos por WhatsApp +55 21 99927-2550.", "La reserva se confirma con una seña del 50%; el resto se paga el día del paseo.", "Niños y mascotas son bienvenidos. La capacidad cuenta a todos, incluso bebés."]]],
    boatsT: "Lanchas con marinero",
    faq: [["¿El marinero está incluido en el precio?", "Sí. Todas las lanchas salen con marinero habilitado, y el precio también incluye combustible, hielo, carbón, agua mineral y conservadora."],
      ["¿Necesito licencia para alquilar una lancha en Búzios?", "No. Como la lancha sale con marinero habilitado, el grupo solo disfruta el paseo."]] },
};
T.praias = {
  pt: { title: "Melhores praias de Búzios para ver de lancha | Búzios Lanchas",
    desc: "Quais praias de Búzios conhecer de lancha: praias para mergulho, praias tranquilas e praias animadas. Azeda, João Fernandes, Amores, Tartaruga, Ilha Feia e mais.",
    h1: "Melhores praias de Búzios para conhecer de lancha",
    lead: "Búzios tem mais de 20 praias, e muitas ficam melhores vistas do mar. Veja como escolher onde parar no passeio de lancha privativo, de acordo com o que o seu grupo quer fazer.",
    secs: [["Para mergulhar e fazer snorkel", ["<b>Azeda e Azedinha</b>: águas calmas e transparentes, boas para mergulho.", "<b>João Fernandes e João Fernandinho</b>: das mais procuradas, com água clara perto da pedra.", "<b>Ilha Feia</b>: parada de mar aberto, boa para quem quer snorkel."]],
      ["Para ficar tranquilo com a família", ["<b>Praia da Tartaruga</b>: pequena, de água calma e fácil para quem tem criança.", "<b>Amores</b>: pequena enseada entre pedras, pertinho da Tartaruga.", "<b>Ossos</b>: perto do embarque e da vila, boa para um fim de passeio."]],
      ["Para um passeio animado", ["<b>Ossos e Armação</b>: restaurantes e movimento na orla.", "Em dias de mar mais agitado, o marinheiro sugere as praias mais abrigadas."]],
      ["Como escolher", ["No passeio de 4 horas dá para ver as principais praias e parar para mergulho.", "No passeio de 7 horas há mais tempo em cada parada, ideal para o dia inteiro.", "O roteiro muda conforme o vento e o mar: o marinheiro e o grupo decidem juntos."]]],
    boatsT: "Lanchas para o passeio",
    faq: [["Qual a melhor praia de Búzios para mergulhar?", "Azeda, João Fernandes e a Ilha Feia estão entre as melhores para mergulho e snorkel."],
      ["Qual a melhor praia de Búzios para ir com criança?", "As praias mais calmas e tranquilas, como Tartaruga e Azedinha, são boas opções. O marinheiro ajuda a escolher conforme o mar do dia."],
      ["Dá para conhecer várias praias no mesmo passeio?", "Sim. O roteiro padrão passa por várias praias e o grupo escolhe onde ficar mais tempo."]] },
  en: { title: "Best beaches in Búzios to see by boat | Búzios Lanchas",
    desc: "Which Búzios beaches to visit by boat: beaches for swimming and snorkeling, calm beaches and lively beaches. Azeda, João Fernandes, Amores, Tartaruga, Ilha Feia and more.",
    h1: "Best beaches in Búzios to see by boat",
    lead: "Búzios has more than 20 beaches, and many are best seen from the sea. Here is how to choose where to stop on a private boat tour, depending on what your group wants to do.",
    secs: [["For swimming and snorkeling", ["<b>Azeda and Azedinha</b>: calm, clear water, great for swimming.", "<b>João Fernandes and João Fernandinho</b>: among the most popular, with clear water near the rocks.", "<b>Ilha Feia</b>: an open-sea stop, good for snorkeling."]],
      ["For a relaxed day with family", ["<b>Tartaruga beach</b>: small, with calm water, easy for kids.", "<b>Amores</b>: a small cove between rocks, close to Tartaruga.", "<b>Ossos</b>: close to boarding and the village, nice at the end of the tour."]],
      ["For a lively tour", ["<b>Ossos and Armação</b>: restaurants and activity along the shore.", "On rougher sea days, the skipper suggests the more sheltered beaches."]],
      ["How to choose", ["The 4-hour tour covers the main beaches with a swim stop.", "The 7-hour tour gives more time at each stop, ideal for a full day.", "The route changes with wind and sea: the skipper and your group decide together."]]],
    boatsT: "Boats for the tour",
    faq: [["What is the best beach in Búzios for swimming?", "Azeda, João Fernandes and Ilha Feia are among the best for swimming and snorkeling."],
      ["What is the best Búzios beach for kids?", "Calmer, quieter beaches such as Tartaruga and Azedinha are good options. The skipper helps choose depending on the sea that day."],
      ["Can we see several beaches on one tour?", "Yes. The standard route passes several beaches and your group chooses where to stay longer."]] },
  es: { title: "Mejores playas de Búzios para conocer en lancha | Búzios Lanchas",
    desc: "Qué playas de Búzios conocer en lancha: playas para nadar y hacer snorkel, playas tranquilas y playas animadas. Azeda, João Fernandes, Amores, Tartaruga, Ilha Feia y más.",
    h1: "Mejores playas de Búzios para conocer en lancha",
    lead: "Búzios tiene más de 20 playas, y muchas se ven mejor desde el mar. Mira cómo elegir dónde parar en el paseo privado en lancha, según lo que quiera hacer tu grupo.",
    secs: [["Para nadar y hacer snorkel", ["<b>Azeda y Azedinha</b>: aguas calmas y transparentes, ideales para nadar.", "<b>João Fernandes y João Fernandinho</b>: de las más buscadas, con agua clara junto a las rocas.", "<b>Ilha Feia</b>: parada de mar abierto, buena para snorkel."]],
      ["Para estar tranquilos en familia", ["<b>Playa Tartaruga</b>: pequeña, de agua calma, fácil para niños.", "<b>Amores</b>: pequeña ensenada entre rocas, muy cerca de Tartaruga.", "<b>Ossos</b>: cerca del embarque y del pueblo, linda para el final del paseo."]],
      ["Para un paseo animado", ["<b>Ossos y Armação</b>: restaurantes y movimiento en la costanera.", "En días de mar más agitado, el marinero sugiere las playas más protegidas."]],
      ["Cómo elegir", ["El paseo de 4 horas permite ver las playas principales y parar a nadar.", "El paseo de 7 horas da más tiempo en cada parada, ideal para todo el día.", "El recorrido cambia según el viento y el mar: el marinero y el grupo deciden juntos."]]],
    boatsT: "Lanchas para el paseo",
    faq: [["¿Cuál es la mejor playa de Búzios para nadar?", "Azeda, João Fernandes e Ilha Feia están entre las mejores para nadar y hacer snorkel."],
      ["¿Cuál es la mejor playa de Búzios para ir con niños?", "Las playas más calmas y tranquilas, como Tartaruga y Azedinha, son buenas opciones. El marinero ayuda a elegir según el mar del día."],
      ["¿Se pueden conocer varias playas en el mismo paseo?", "Sí. El recorrido estándar pasa por varias playas y el grupo elige dónde quedarse más tiempo."]] },
};

const CSS = `:root{--bg:#f3f7f8;--surface:#fff;--ink:#0c2430;--muted:#55707b;--line:#d6e2e6;--sea:#0b5c73;--sea-deep:#06394a;--brass:#c99a2e;--wa:#1f9d55}
@media (prefers-color-scheme:dark){:root{--bg:#071a22;--surface:#0d2531;--ink:#e6f1f4;--muted:#93aeb8;--line:#1d3a47;--sea:#4fb3cc;--sea-deep:#0a2e3b;--brass:#e0b54d;color-scheme:dark}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--sea)}img{max-width:100%;display:block}
header{background:var(--sea-deep);color:#fff}
.in{max-width:900px;margin:0 auto;padding:0 16px}
header .in{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:58px}
header a{color:#fff;text-decoration:none}.brand{font-weight:800;font-size:18px}
.langs{display:flex;gap:6px}.langs a{border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:4px 11px;font-weight:700;font-size:14px}
.langs a[aria-current]{background:var(--brass);border-color:var(--brass);color:#1d1503}
.hero{position:relative;color:#fff;background:#06394a center/cover no-repeat}
.hero .in{padding:64px 16px 40px;position:relative}.hero:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,30,40,.25),rgba(4,30,40,.75))}
h1{font-size:clamp(28px,6vw,44px);line-height:1.15;margin:0 0 12px}
.hero p{font-size:18px;max-width:640px;margin:0 0 20px}
.btn{display:inline-block;background:var(--wa);color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:999px}
.btn.alt{background:none;border:2px solid currentColor;color:inherit;margin:8px 0 0 8px;padding:11px 18px}
main section{padding:28px 0 4px}h2{font-size:24px;line-height:1.25;margin:0 0 10px}
ul.list{padding-left:20px}ul.list li{margin:6px 0}
.stops{list-style:none;padding:0;display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.stops li,.boat{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.stops img,.boat img{width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;background:var(--line)}
@media (max-width:600px){.stops li{display:grid;grid-template-columns:116px 1fr}.stops img{height:100%;aspect-ratio:auto;min-height:116px}.stops .tx{padding:10px 12px}.stops h3{font-size:16px}.stops p{font-size:14px}}
.stops .tx,.boat .tx{padding:12px 14px}.stops h3,.boat h3{margin:0 0 4px;font-size:18px}.stops p,.boat p{margin:0;color:var(--muted);font-size:15px}
.stops small{display:block;color:var(--muted);font-size:12px;margin-top:6px}
.boats{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
.boat{text-decoration:none;color:inherit;display:block}.boat .meta{font-weight:700;color:var(--sea);font-size:14px;margin-bottom:4px}
.price{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--brass);border-radius:12px;padding:14px 16px}
details{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:8px 0}summary{font-weight:700;cursor:pointer}details p{margin:8px 0 0}
.cta{background:var(--sea-deep);color:#fff;border-radius:18px;padding:22px;margin:30px 0;text-align:center}.cta p{margin:0 0 14px}
footer{border-top:1px solid var(--line);margin-top:30px;padding:22px 0 40px;color:var(--muted);font-size:14px}footer p{margin:6px 0}`;

const TRACK = `<script>(function(w,d,s,l,i){if(/BuziosLanchasIOS/.test(navigator.userAgent))return;w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-NVP9L5DF');</script>
<script>!function(f,b,e,v,n,t,s){if(f.fbq||/BuziosLanchasIOS/.test(navigator.userAgent))return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');if(window.fbq){fbq('init','1672637870274530');fbq('track','PageView');}</script>`;

/* dados: { boats:[{slug,name,feet,cap,tag:{pt,en,es},img}], route:[{name, desc:{pt,en,es}, img, credit}], piso4, piso7 } */
export function gerarPaginas(ROOT, SITE, dados) {
  const urls = [];
  for (const g of Object.keys(GUIAS)) for (const l of ["pt", "en", "es"]) {
    const c = C[l], t = T[g][l], url = SITE + guiaPath(g, l), outros = Object.keys(GUIAS).filter(x => x !== g);
    const wa = `https://wa.me/${WA}?text=${encodeURIComponent(c.waMsg)}`;
    const boats = g === "grupos" ? [...dados.boats].sort((a, b) => (b.cap || 0) - (a.cap || 0)) : dados.boats;
    const img0 = boats[0]?.img, heroImg = g === "roteiro" || !/^(https:\/\/[\w.\-]+)?\/[\w\/.\-]+$/.test(img0 || "") ? "/img/rt-08-m.webp" : img0;
    const abs = u => /^https?:/.test(u) ? u : SITE + u;
    const faq = [...(dados.piso4 ? [[faqPreco[l], c.price(num(dados.piso4, l), dados.piso7 ? num(dados.piso7, l) : "")]] : []), ...t.faq];
    const boatCards = boats.map(b => `<a class="boat" href="${boatPath(l, b.slug)}">${b.img ? `<img src="${esc(b.img)}" alt="${esc(b.name)}" loading="lazy" width="800" height="533">` : ""}<div class="tx"><h3>${esc(b.name)}</h3><div class="meta">${[b.feet ? c.feet(b.feet) : "", b.cap ? c.people(b.cap) : ""].filter(Boolean).join(" · ")}</div><p>${esc(b.tag?.[l] || "")}</p></div></a>`).join("");
    const priceBox = dados.piso4 ? `<section><div class="price">${c.price(num(dados.piso4, l), dados.piso7 ? num(dados.piso7, l) : "")}</div></section>` : "";
    const body = (g === "marinheiro" || g === "praias")
      ? `${t.secs.map(([h2, it]) => `<section><h2>${h2}</h2><ul class="list">${it.map(x => `<li>${x}</li>`).join("")}</ul></section>`).join("\n")}
<section><h2>${t.boatsT}</h2><div class="boats">${boatCards}</div></section>`
      : g === "precos"
      ? `${priceBox}<section><h2>${t.whatT}</h2><ul class="list">${t.what.map(x => `<li>${x}</li>`).join("")}</ul></section>
<section><h2>${t.seasT}</h2><ul class="list">${t.seas.map(x => `<li>${x}</li>`).join("")}</ul></section>
<section><h2>${t.inclT}</h2><ul class="list">${t.incl.map(x => `<li>${x}</li>`).join("")}</ul></section>
<section><h2>${t.boatsT}</h2><div class="boats">${boatCards}</div></section>`
      : g === "roteiro"
      ? `<section><h2>${t.routeT}</h2><p>${t.routeP}</p><ol class="stops">${dados.route.map((r, i) => `<li>${r.img ? `<img src="${r.img}" alt="${esc(r.name)}" loading="lazy" width="800" height="533">` : ""}<div class="tx"><h3>${i + 1}. ${esc(r.name)}</h3><p>${esc(r.desc[l] || "")}</p>${r.credit ? `<small>${c.photo}: ${r.credit[1] ? `<a href="${esc(r.credit[1])}" rel="nofollow noopener" target="_blank">${esc(r.credit[0])}</a>` : esc(r.credit[0])}</small>` : ""}</div></li>`).join("")}</ol></section>
<section><h2>${t.howT}</h2><ul class="list">${t.how.map(x => `<li>${x}</li>`).join("")}</ul></section>
<section><h2>${{ pt: "As lanchas", en: "The boats", es: "Las lanchas" }[l]}</h2><div class="boats">${boatCards}</div></section>`
      : `<section><h2>${t.whyT}</h2><ul class="list">${t.why.map(x => `<li>${x}</li>`).join("")}</ul></section>
<section><h2>${t.boatsT}</h2><div class="boats">${boatCards}</div></section>
<section><h2>${t.tipsT}</h2><ul class="list">${t.tips.map(x => `<li>${x}</li>`).join("")}</ul></section>`;
    const ld = { "@context": "https://schema.org", "@graph": [
      { "@type": "WebPage", "@id": url, "url": url, "name": t.h1, "description": t.desc, "inLanguage": c.html, "isPartOf": { "@type": "WebSite", "url": SITE + "/", "name": "Búzios Lanchas" },
        "about": { "@id": SITE + "/#empresa" }, "primaryImageOfPage": abs(heroImg).replace(/-m\.webp$/, ".jpg").replace(/\.webp$/, ".jpg") },
      ...(g === "roteiro" ? [{ "@type": "TouristTrip", "name": t.h1, "description": t.desc, "url": url, "provider": { "@id": SITE + "/#empresa" },
        "itinerary": { "@type": "ItemList", "itemListElement": dados.route.map((r, i) => ({ "@type": "ListItem", "position": i + 1, "item": { "@type": "TouristAttraction", "name": r.name, "description": r.desc[l] || "" } })) } }] : []),
      { "@type": "FAQPage", "mainEntity": faq.map(([q, a]) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })) },
      { "@type": "BreadcrumbList", "itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Búzios Lanchas", "item": SITE + homePath(l) }, { "@type": "ListItem", "position": 2, "name": t.h1, "item": url }] }] };
    const alt = [["pt-BR", "pt"], ["en", "en"], ["es", "es"], ["x-default", "pt"]].map(([hl, x]) => `<link rel="alternate" hreflang="${hl}" href="${SITE}${guiaPath(g, x)}">`).join("");
    const html = `<!doctype html>
<html lang="${c.html}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.title)}</title><meta name="description" content="${esc(t.desc)}">
<link rel="canonical" href="${url}">${alt}
<meta property="og:type" content="article"><meta property="og:site_name" content="Búzios Lanchas"><meta property="og:title" content="${esc(t.h1)}"><meta property="og:description" content="${esc(t.desc)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${abs(heroImg).replace(/-m\.webp$/, ".jpg").replace(/\.webp$/, ".jpg")}"><meta property="og:locale" content="${c.og}"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#06394a"><link rel="icon" href="/login/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="preload" as="image" href="${heroImg}" fetchpriority="high">
${TRACK}
<style>${CSS}.hero{background-image:url(${heroImg})}</style>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head><body>
<header><div class="in"><a class="brand" href="${homePath(l)}">Búzios Lanchas</a><nav class="langs" aria-label="Idioma / Language">${["pt", "en", "es"].map(x => `<a href="${guiaPath(g, x)}" hreflang="${x}"${x === l ? ' aria-current="page"' : ""}>${x.toUpperCase()}</a>`).join("")}</nav></div></header>
<div class="hero"><div class="in"><h1>${t.h1}</h1><p>${t.lead}</p><a class="btn" href="${wa}" target="_blank" rel="noopener">${c.wa}</a><a class="btn alt" href="${homePath(l)}#frota">${c.boats}</a></div></div>
<main class="in">
${body}
${g === "precos" ? "" : priceBox}
<section><h2>${c.faqT}</h2>${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</section>
<div class="cta"><p>${c.ctaP}</p><a class="btn" href="${wa}" target="_blank" rel="noopener">${c.wa}</a></div>
<p>${c.other}: ${outros.map(o => `<a href="${guiaPath(o, l)}">${T[o][l].h1}</a>`).join(" · ")} · <a href="${homePath(l)}">${c.boats}</a></p>
</main>
<footer><div class="in"><p>${c.foot}</p><p><a href="${homePath(l)}">${c.home}</a> · <a href="https://wa.me/${WA}" target="_blank" rel="noopener">WhatsApp (21) 99927-2550</a> · <a href="/privacidade/">${c.privacy}</a></p></div></footer>
</body></html>
`;
    const out = path.join(ROOT, guiaPath(g, l), "index.html");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    urls.push({ url: guiaPath(g, l), g });
  }
  return urls;
}

