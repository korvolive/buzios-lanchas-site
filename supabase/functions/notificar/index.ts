// Búzios Lanchas: notificação no celular (Web Push).
// GET  -> { publica }  chave pública para o celular se inscrever
// POST { tipo: "aprovado", id: <bloqueio> }  (só o administrador) avisa os donos da lancha (no celular e por e-mail)
//                                             e manda ao cliente com conta o e-mail "reserva confirmada"
// POST { tipo: "fotos",    lancha: <slug> }  (o dono, depois de enviar fotos) avisa o administrador para aprovar
// POST { tipo: "pedido",   id: <pedido> }    (o próprio cliente, uma vez) avisa o administrador (no celular e por e-mail)
// POST { tipo: "marinheiro", id: <bloqueio> }  (administrador ou dono da lancha) avisa o marinheiro escolhido para pilotar (celular e e-mail)
// POST { tipo: "recusou", id: <bloqueio> }  (o marinheiro que acabou de sair do passeio) avisa os donos da lancha e o administrador (celular e e-mail)
// POST { tipo: "embarque", id: <bloqueio> }  (administrador, dono ou marinheiro fixo) avisa o cliente com conta que o local de embarque mudou
// POST { tipo: "avaliar", id: <bloqueio> }  (administrador; ou o dono, nos passeios de fora; depois de confirmar que o passeio aconteceu) pede a avaliação ao cliente (celular e e-mail)
// POST { tipo: "teste", ep? }                  avisa só quem chamou (com ep: só aquele aparelho)
// POST { tipo: "fim" }  (agendado a cada 15 min pelo pg_cron) avisa quando um passeio termina (da Búzios Lanchas: o administrador; de fora: os donos),
//                       para ele confirmar que aconteceu (libera a avaliação do cliente). Cada passeio é avisado uma vez (tabela fim_avisos).
//                       Na mesma rodada avisa o cliente com conta 1 hora antes do início do passeio (celular e e-mail), com embarque, mapa e contatos
//                       (dono da lancha; nos passeios da Búzios Lanchas também a Búzios Lanchas). Uma vez por passeio (tabela inicio_avisos).
//                       E apaga a pré-reserva (valor lançado, sinal zero) que passou 24 horas sem sinal: a data volta livre no site e o administrador é avisado.
// As chaves do envio são criadas aqui mesmo na primeira vez e ficam em push_config (ninguém do app lê).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const b64u = (a: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let keys: { publica: string; privada: string } | null = null;
async function chaves() {
  if (keys) return keys;
  const { data } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (data) return (keys = data);
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const novo = { id: 1, publica: b64u(await crypto.subtle.exportKey("raw", k.publicKey)), privada: (await crypto.subtle.exportKey("jwk", k.privateKey)).d! };
  await db.from("push_config").upsert(novo, { onConflict: "id", ignoreDuplicates: true });
  const { data: d2 } = await db.from("push_config").select("publica, privada").eq("id", 1).single();
  return (keys = d2!);
}

const SLOT: Record<string, Record<string, string>> = {
  pt: { manha: "manhã", tarde: "tarde", dia: "dia inteiro", noite: "noite" },
  en: { manha: "morning", tarde: "afternoon", dia: "full day", noite: "night" },
  es: { manha: "mañana", tarde: "tarde", dia: "día completo", noite: "noche" },
};
const dataBR = (d: string) => d.split("-").reverse().join("/");
const TXT: Record<string, Record<string, (p: any) => { title: string; body: string }>> = {
  aprovado: {
    pt: p => ({ title: "Passeio novo na sua agenda", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario}. A Búzios Lanchas confirmou o passeio.${p.semMar ? " Escolha quem vai pilotar." : ""}` }),
    en: p => ({ title: "New trip in your schedule", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario}. Búzios Lanchas confirmed the trip.${p.semMar ? " Choose who will drive." : ""}` }),
    es: p => ({ title: "Paseo nuevo en tu agenda", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario}. Búzios Lanchas confirmó el paseo.${p.semMar ? " Elige quién va a pilotar." : ""}` }),
  },
  pedido: {
    pt: p => ({ title: "Pedido novo pelo site", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario} · ${p.pessoas} pessoas` }),
    en: p => ({ title: "New request from the website", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario} · ${p.pessoas} people` }),
    es: p => ({ title: "Pedido nuevo desde el sitio", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario} · ${p.pessoas} personas` }),
  },
  fim: {
    pt: p => ({ title: "Passeio terminou: confirme", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario}${p.cliente ? " · " + p.cliente : ""}. ${p.fora ? "Confirme que foi concluído e que não há saldo pendente para o cliente poder avaliar." : "Confirme que aconteceu para o cliente poder avaliar."}${p.com ? ` 💼 Comissão de ${p.com.nome}: ${COMV(p)}.` : ""}` }),
    en: p => ({ title: "Trip ended: please confirm", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario}${p.cliente ? " · " + p.cliente : ""}. ${p.fora ? "Confirm it was completed with no balance due so the client can rate it." : "Confirm it happened so the client can rate it."}${p.com ? ` 💼 Commission for ${p.com.nome}: ${COMV(p)}.` : ""}` }),
    es: p => ({ title: "Paseo terminado: confirma", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario}${p.cliente ? " · " + p.cliente : ""}. ${p.fora ? "Confirma que se completó y que no hay saldo pendiente para que el cliente pueda evaluar." : "Confirma que ocurrió para que el cliente pueda evaluar."}${p.com ? ` 💼 Comisión de ${p.com.nome}: ${COMV(p)}.` : ""}` }),
  },
  venceu: {
    pt: p => ({ title: "Pré-reserva vencida", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario}${p.cliente ? " · " + p.cliente : ""}. O sinal não entrou em 24 horas: a data voltou a ficar livre no site.` }),
    en: p => ({ title: "Hold expired", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario}${p.cliente ? " · " + p.cliente : ""}. No deposit within 24 hours: the date is free again on the website.` }),
    es: p => ({ title: "Pre-reserva vencida", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario}${p.cliente ? " · " + p.cliente : ""}. La seña no entró en 24 horas: la fecha volvió a quedar libre en el sitio.` }),
  },
  marinheiro: {
    pt: p => ({ title: "Você vai pilotar", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario}. Toque para ver o passeio.` }),
    en: p => ({ title: "You will drive", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario}. Tap to see the trip.` }),
    es: p => ({ title: "Vas a pilotar", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario}. Toca para ver el paseo.` }),
  },
  fotos: {
    pt: p => ({ title: "Fotos novas para aprovar", body: `${p.lancha}: ${p.n} foto${p.n > 1 ? "s" : ""} esperando a sua aprovação. Toque para ver.` }),
    en: p => ({ title: "New photos to approve", body: `${p.lancha}: ${p.n} photo${p.n > 1 ? "s" : ""} waiting for your approval. Tap to see.` }),
    es: p => ({ title: "Fotos nuevas para aprobar", body: `${p.lancha}: ${p.n} foto${p.n > 1 ? "s" : ""} esperando tu aprobación. Toca para ver.` }),
  },
  recusou: {
    pt: p => ({ title: "Marinheiro saiu do passeio", body: `${p.nome} não vai poder pilotar a ${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario}. Escolha outro marinheiro.` }),
    en: p => ({ title: "Skipper left the trip", body: `${p.nome} can't drive ${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario}. Choose another skipper.` }),
    es: p => ({ title: "El marinero dejó el paseo", body: `${p.nome} no podrá pilotar ${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario}. Elige otro marinero.` }),
  },
  embarque: {
    pt: p => ({ title: "Novo local de embarque", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario}: o embarque agora é em ${p.embarque}.` }),
    en: p => ({ title: "New boarding place", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario}: boarding is now at ${p.embarque}.` }),
    es: p => ({ title: "Nuevo lugar de embarque", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario}: el embarque ahora es en ${p.embarque}.` }),
  },
  avaliar: {
    pt: p => ({ title: "Como foi o seu passeio?", body: `Avalie a ${p.lancha} e o marinheiro. Leva menos de 1 minuto.${p.cup ? ` 🎁 Avalie e ganhe um cupom de desconto para o seu próximo passeio nesta mesma lancha.` : ""}` }),
    en: p => ({ title: "How was your tour?", body: `Rate ${p.lancha} and the skipper. It takes less than a minute.${p.cup ? ` 🎁 Rate it and get a discount coupon for your next tour on this same boat.` : ""}` }),
    es: p => ({ title: "¿Cómo fue tu paseo?", body: `Califica ${p.lancha} y al marinero. Lleva menos de 1 minuto.${p.cup ? ` 🎁 Califica y gana un cupón de descuento para tu próximo paseo en esta misma lancha.` : ""}` }),
  },
  inicio: {
    pt: p => ({ title: "Seu passeio começa em breve", body: `${p.lancha} · ${p.hora}${p.embarque ? " · Embarque: " + p.embarque : ""}. Toque para ver o local e os contatos.` }),
    en: p => ({ title: "Your tour starts soon", body: `${p.lancha} · ${p.hora}${p.embarque ? " · Boarding: " + p.embarque : ""}. Tap to see the place and contacts.` }),
    es: p => ({ title: "Tu paseo empieza pronto", body: `${p.lancha} · ${p.hora}${p.embarque ? " · Embarque: " + p.embarque : ""}. Toca para ver el lugar y los contactos.` }),
  },
  avisarCli: {
    pt: p => ({ title: "Avise o cliente: passeio em breve", body: `${p.cliente || "Cliente"} · ${p.lancha} · ${p.hora}. Ele ainda não tem conta no app: toque para mandar o aviso no WhatsApp.` }),
    en: p => ({ title: "Tell the client: tour soon", body: `${p.cliente || "Client"} · ${p.lancha} · ${p.hora}. They have no app account yet: tap to send the reminder on WhatsApp.` }),
    es: p => ({ title: "Avisa al cliente: paseo pronto", body: `${p.cliente || "Cliente"} · ${p.lancha} · ${p.hora}. Todavía no tiene cuenta en la app: toca para mandar el aviso por WhatsApp.` }),
  },
  teste: {
    pt: () => ({ title: "Notificações ativadas", body: "Você vai receber os avisos da Búzios Lanchas aqui." }),
    en: () => ({ title: "Notifications are on", body: "You will get Búzios Lanchas alerts here." }),
    es: () => ({ title: "Notificaciones activadas", body: "Recibirás aquí los avisos de Búzios Lanchas." }),
  },
};

async function enviar(users: string[], tipo: string, p: any, url: string, so?: string) {
  if (!users.length) return 0;
  const k = await chaves();
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  let q = db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", users);
  if (so) q = q.eq("endpoint", so); // teste: só este aparelho
  const { data: subs } = await q;
  let n = 0;
  await Promise.all((subs || []).map(async s => {
    const m = (TXT[tipo][s.lang] || TXT[tipo].pt)(p);
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url, tag: `${tipo}-${p.id ?? "t"}` }), { TTL: 86400, urgency: "high" });
      n++;
      console.log("push ok", tipo, new URL(s.endpoint).host);
    } catch (e: any) {
      console.error("push falhou", tipo, e?.statusCode, new URL(s.endpoint).host, e?.body || String(e));
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }));
  return n;
}

// cupom de fidelidade do passeio: vai junto do pedido de avaliação, no celular e no e-mail (Rodrigo 2026-10-23)
const CUP_TXT: Record<string, (c: any) => string> = {
  pt: c => `🎁 Avalie e ganhe um cupom de desconto para o seu próximo passeio nesta mesma lancha, válido por 6 meses.`,
  en: c => `🎁 Rate your tour and get a discount coupon for your next tour on this same boat, valid for 6 months.`,
  es: c => `🎁 Califica y gana un cupón de descuento para tu próximo paseo en esta misma lancha, válido por 6 meses.`,
};
const CUP_USO: Record<string, string> = {
  pt: "O cupom aparece na sua conta assim que você avaliar. Para usar, na hora de reservar toque em Usar meu cupom.",
  en: "The coupon shows up in your account as soon as you rate. To use it, tap Use my coupon when booking.",
  es: "El cupón aparece en tu cuenta en cuanto califiques. Para usarlo, al reservar toca Usar mi cupón.",
};
async function cupomDo(bid: number, cli: string) {
  // cupom só nasce depois que o cliente avalia (Rodrigo 2026-10-23): aqui só promete o valor do cupom do dono da lancha
  const { data: p } = await db.from("pedidos").select("id, lancha, vendedor").eq("bloqueio_id", bid).eq("cliente", cli).eq("status", "aprovado").limit(1).maybeSingle();
  if (!p) return null;
  const { data: b } = await db.from("bloqueios").select("data").eq("id", bid).maybeSingle();
  if (!b || b.data < "2026-10-22") return null;
  if ((await db.from("avaliacoes").select("pedido_id").eq("pedido_id", p.id).maybeSingle()).data) return null; // já avaliou
  // só o cupom do dono, que vale na mesma lancha (Rodrigo 2026-10-25: a Búzios não dá mais cupom da comissão)
  const { data: cd, error } = await db.from("cupom_dono").select("valor").eq("lancha", p.lancha).maybeSingle();
  if (error || !cd) return null;
  return { valor: `R$ ${cd.valor}` };
}

// e-mail pelo Supabase (modelo "Magic Link", SMTP da Brevo): com user_metadata.msg preenchido o modelo mostra esta mensagem,
// e o botão entra logado no app. Depois o msg sai de novo, para o "entrar por link" voltar a ser o e-mail normal.
const HOR: Record<string, Record<string, string>> = {
  pt: { manha: "Manhã (10h às 14h)", tarde: "Tarde (14h às 18h)", dia: "Dia inteiro (10h às 17h)", noite: "Noite" },
  en: { manha: "Morning (10am to 2pm)", tarde: "Afternoon (2pm to 6pm)", dia: "Full day (10am to 5pm)", noite: "Night" },
  es: { manha: "Mañana (10h a 14h)", tarde: "Tarde (14h a 18h)", dia: "Día completo (10h a 17h)", noite: "Noche" },
};
const hm = (x: string, lang: string) => { const [h, m] = x.split(":").map(Number); if (lang === "en") return (h % 12 || 12) + (m ? ":" + String(m).padStart(2, "0") : "") + (h < 12 ? "am" : "pm"); return h + "h" + (m ? String(m).padStart(2, "0") : ""); };
const horario = (b: any, a: any, lang: string) => a?.hora_ini && a?.hora_fim
  ? `${(HOR[lang][b.horario] || b.horario).replace(/ \(.*$/, "")} (${hm(a.hora_ini, lang)} ${{ pt: "às", en: "to", es: "a" }[lang]} ${hm(a.hora_fim, lang)})`
  : HOR[lang][b.horario] || b.horario;
// localização dos locais de embarque fixos (pins do Rodrigo); vai só para o cliente, dono e marinheiro já conhecem os lugares
const MAPA: Record<string, string> = {
  "Píer do Golfinho (Praia dos Ossos)": "https://maps.app.goo.gl/Qe2YacVDVvZcgYbN9",
  "Porto Veleiro (Praia dos Ossos)": "https://maps.app.goo.gl/3YanCFbVSmcZjGdCA",
  "BR Marina": "https://maps.app.goo.gl/2cNUHqhBYXmWD8By9",
  "Píer do Centro": "https://maps.app.goo.gl/ZBat1GF7X6DfnJ9W7",
  "Píer Porto da Barra": "https://maps.app.goo.gl/EEHSdyrpAcoogHULA",
  "Azul Marina": "https://maps.app.goo.gl/92BjzPAprjhsMJxm6",
};
// taxa de embarque dos píeres particulares, paga pelo cliente direto no local (BR Marina, Azul Marina, Píer do Centro e Píer Porto da Barra não cobram)
const TAXA: Record<string, [string, number]> = { "Porto Veleiro (Praia dos Ossos)": ["Porto Veleiro", 10], "Píer do Golfinho (Praia dos Ossos)": ["Píer do Golfinho", 5] };
const TAXA_TXT: Record<string, (l: string, v: number) => string> = {
  pt: (l, v) => `Por ser um píer privativo, o ${l} cobra uma pequena taxa de embarque de R$ ${v} por pessoa, paga direto no local.`,
  en: (l, v) => `Because it is a private pier, ${l} charges a small boarding fee of R$ ${v} per person, paid directly there.`,
  es: (l, v) => `Por ser un muelle privado, ${l} cobra una pequeña tasa de embarque de R$ ${v} por persona, que se paga directamente allí.`,
};
const taxa = (e: string, lang: string) => TAXA[e] ? (TAXA_TXT[lang] || TAXA_TXT.pt)(TAXA[e][0], TAXA[e][1]) : "";
const MAIL: Record<string, Record<string, (p: any) => any>> = {
  dono: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `A Búzios Lanchas confirmou um passeio novo na ${p.lancha}.`, linhas: [`Data: ${p.data}`, `Horário: ${p.horario}`, ...(p.pessoas ? [`Pessoas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : []), ...(p.cliente ? [`Cliente: ${p.cliente}`] : [])], nota: p.semMar ? "Abra a agenda e escolha quem vai pilotar." : "O passeio já está na sua agenda.", botao: "Abrir minha agenda" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `Búzios Lanchas confirmed a new trip on ${p.lancha}.`, linhas: [`Date: ${p.data}`, `Time: ${p.horario}`, ...(p.pessoas ? [`People: ${p.pessoas}`] : []), ...(p.embarque ? [`Boarding: ${p.embarque}`] : []), ...(p.cliente ? [`Client: ${p.cliente}`] : [])], nota: p.semMar ? "Open the schedule and choose who will drive." : "The trip is already in your schedule.", botao: "Open my schedule" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `Búzios Lanchas confirmó un paseo nuevo en ${p.lancha}.`, linhas: [`Fecha: ${p.data}`, `Horario: ${p.horario}`, ...(p.pessoas ? [`Personas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : []), ...(p.cliente ? [`Cliente: ${p.cliente}`] : [])], nota: p.semMar ? "Abre la agenda y elige quién va a pilotar." : "El paseo ya está en tu agenda.", botao: "Abrir mi agenda" }),
  },
  pedido: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `Pedido novo de reserva pelo site: ${p.lancha}.`, linhas: [`Cliente: ${p.cliente}`, ...(p.whats ? [`WhatsApp: ${p.whats}`] : []), `Data: ${p.data}`, `Horário: ${p.horario}`, `Pessoas: ${p.pessoas}`, ...(p.embarque ? [`Embarque: ${p.embarque}`] : [])], nota: "O pedido está em Reservas › Pendentes. Se a lancha estiver livre, toque em Liberar pagamento; quando o sinal chegar, toque em Aprovar.", botao: "Abrir as reservas" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `New booking request from the website: ${p.lancha}.`, linhas: [`Client: ${p.cliente}`, ...(p.whats ? [`WhatsApp: ${p.whats}`] : []), `Date: ${p.data}`, `Time: ${p.horario}`, `People: ${p.pessoas}`, ...(p.embarque ? [`Boarding: ${p.embarque}`] : [])], nota: "The request is in Bookings › Pending. If the boat is free, tap Release payment; when the deposit arrives, tap Approve.", botao: "Open bookings" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `Pedido nuevo de reserva desde el sitio: ${p.lancha}.`, linhas: [`Cliente: ${p.cliente}`, ...(p.whats ? [`WhatsApp: ${p.whats}`] : []), `Fecha: ${p.data}`, `Horario: ${p.horario}`, `Personas: ${p.pessoas}`, ...(p.embarque ? [`Embarque: ${p.embarque}`] : [])], nota: "El pedido está en Reservas › Pendientes. Si la lancha está libre, toca Liberar pago; cuando llegue la seña, toca Aprobar.", botao: "Abrir las reservas" }),
  },
  mar: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `Você foi escolhido para pilotar a ${p.lancha}.`, linhas: [`Data: ${p.data}`, `Horário: ${p.horario}`, ...(p.pessoas ? [`Pessoas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : []), ...(p.cliente ? [`Cliente: ${p.cliente}`] : []), ...p.donos.map((d: any) => `Dono da lancha: ${d}`)], nota: "Se não puder ir, avise pelo app em \"Não vou poder ir\".", botao: "Ver meus passeios" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `You were chosen to drive ${p.lancha}.`, linhas: [`Date: ${p.data}`, `Time: ${p.horario}`, ...(p.pessoas ? [`People: ${p.pessoas}`] : []), ...(p.embarque ? [`Boarding: ${p.embarque}`] : []), ...(p.cliente ? [`Client: ${p.cliente}`] : []), ...p.donos.map((d: any) => `Boat owner: ${d}`)], nota: "If you can't make it, tell us in the app with \"I can't make it\".", botao: "See my trips" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `Te eligieron para pilotar ${p.lancha}.`, linhas: [`Fecha: ${p.data}`, `Horario: ${p.horario}`, ...(p.pessoas ? [`Personas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : []), ...(p.cliente ? [`Cliente: ${p.cliente}`] : []), ...p.donos.map((d: any) => `Dueño de la lancha: ${d}`)], nota: "Si no puedes ir, avisa en la app con \"No voy a poder ir\".", botao: "Ver mis paseos" }),
  },
  saiu: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `${p.nome} não vai poder pilotar a ${p.lancha} neste passeio.`, linhas: [`Data: ${p.data}`, `Horário: ${p.horario}`, ...(p.pessoas ? [`Pessoas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : [])], nota: "Abra a agenda e escolha outro marinheiro para este passeio.", botao: "Escolher outro marinheiro" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `${p.nome} can't drive ${p.lancha} on this trip.`, linhas: [`Date: ${p.data}`, `Time: ${p.horario}`, ...(p.pessoas ? [`People: ${p.pessoas}`] : []), ...(p.embarque ? [`Boarding: ${p.embarque}`] : [])], nota: "Open the schedule and choose another skipper for this trip.", botao: "Choose another skipper" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `${p.nome} no podrá pilotar ${p.lancha} en este paseo.`, linhas: [`Fecha: ${p.data}`, `Horario: ${p.horario}`, ...(p.pessoas ? [`Personas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : [])], nota: "Abre la agenda y elige otro marinero para este paseo.", botao: "Elegir otro marinero" }),
  },
  embarque: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `O local de embarque do seu passeio na ${p.lancha} mudou.`, linhas: [`Novo local de embarque: ${p.embarque}`, ...(MAPA[p.embarque] ? [`Localização: ${MAPA[p.embarque]}`] : []), ...(TAXA[p.embarque] ? [taxa(p.embarque, "pt")] : []), `Data: ${p.data}`, `Horário: ${p.horario}`, "Búzios Lanchas: WhatsApp (21) 99927-2550"], nota: "Qualquer dúvida, fale com a gente. Bom passeio!", botao: "Ver minha reserva" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `The boarding place for your trip on ${p.lancha} has changed.`, linhas: [`New boarding place: ${p.embarque}`, ...(MAPA[p.embarque] ? [`Location: ${MAPA[p.embarque]}`] : []), ...(TAXA[p.embarque] ? [taxa(p.embarque, "en")] : []), `Date: ${p.data}`, `Time: ${p.horario}`, "Búzios Lanchas: WhatsApp +55 21 99927-2550"], nota: "Any questions, talk to us. Enjoy your trip!", botao: "See my booking" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `El lugar de embarque de tu paseo en ${p.lancha} cambió.`, linhas: [`Nuevo lugar de embarque: ${p.embarque}`, ...(MAPA[p.embarque] ? [`Ubicación: ${MAPA[p.embarque]}`] : []), ...(TAXA[p.embarque] ? [taxa(p.embarque, "es")] : []), `Fecha: ${p.data}`, `Horario: ${p.horario}`, "Búzios Lanchas: WhatsApp +55 21 99927-2550"], nota: "Cualquier duda, háblanos. ¡Buen paseo!", botao: "Ver mi reserva" }),
  },
  avaliar: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `Obrigado por passear com a gente na ${p.lancha}! Conte como foi: dê a nota da lancha e do marinheiro.`, linhas: [`Data: ${p.data}`, `Horário: ${p.horario}`, ...(p.cup ? [CUP_TXT.pt(p.cup)] : [])], nota: `${p.cup ? CUP_USO.pt + " " : ""}A avaliação leva menos de 1 minuto e ajuda outros clientes a escolher. Você pode alterá-la por até 7 dias.`, botao: "Avaliar o passeio" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `Thank you for touring with us on ${p.lancha}! Tell us how it went: rate the boat and the skipper.`, linhas: [`Date: ${p.data}`, `Time: ${p.horario}`, ...(p.cup ? [CUP_TXT.en(p.cup)] : [])], nota: `${p.cup ? CUP_USO.en + " " : ""}The review takes less than a minute and helps other guests choose. You can change it for up to 7 days.`, botao: "Rate the tour" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `¡Gracias por pasear con nosotros en ${p.lancha}! Cuéntanos cómo fue: califica la lancha y al marinero.`, linhas: [`Fecha: ${p.data}`, `Horario: ${p.horario}`, ...(p.cup ? [CUP_TXT.es(p.cup)] : [])], nota: `${p.cup ? CUP_USO.es + " " : ""}La evaluación lleva menos de 1 minuto y ayuda a otros clientes a elegir. Puedes cambiarla hasta 7 días.`, botao: "Evaluar el paseo" }),
  },
  fim: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `Terminou um passeio na ${p.lancha}. ${p.fora ? "Confirme que ele foi concluído e que não há saldo pendente para liberar a avaliação do cliente." : "Confirme se ele aconteceu para liberar a avaliação do cliente."}`, linhas: [`Data: ${p.data}`, `Horário: ${p.horario}`, ...(p.cliente ? [`Cliente: ${p.cliente}`] : []), ...(p.com ? [`💼 Comissão do vendedor ${p.com.nome}: ${COMV(p)}. Lembre de pagar depois de confirmar (Reservas › Histórico › Marcar comissão paga).`] : [])], nota: "Abra o app na aba Passeios: o passeio está no topo, em \"Passeios pendentes de confirmação\".", botao: "Confirmar o passeio" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `A tour on ${p.lancha} has ended. ${p.fora ? "Confirm it was completed with no balance due so the client can rate it." : "Confirm it happened so the client can rate it."}`, linhas: [`Date: ${p.data}`, `Time: ${p.horario}`, ...(p.cliente ? [`Client: ${p.cliente}`] : []), ...(p.com ? [`💼 Seller commission for ${p.com.nome}: ${COMV(p)}. Remember to pay it after confirming (Bookings › History › Mark commission paid).`] : [])], nota: "Open the app on the Tours tab: the tour is at the top, under \"Tours waiting for confirmation\".", botao: "Confirm the tour" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `Terminó un paseo en ${p.lancha}. ${p.fora ? "Confirma que se completó y que no hay saldo pendiente para liberar la evaluación del cliente." : "Confirma si ocurrió para liberar la evaluación del cliente."}`, linhas: [`Fecha: ${p.data}`, `Horario: ${p.horario}`, ...(p.cliente ? [`Cliente: ${p.cliente}`] : []), ...(p.com ? [`💼 Comisión del vendedor ${p.com.nome}: ${COMV(p)}. Recuerda pagarla después de confirmar (Reservas › Historial › Marcar comisión pagada).`] : [])], nota: "Abre la app en la pestaña Paseos: el paseo está arriba, en \"Paseos pendientes de confirmación\".", botao: "Confirmar el paseo" }),
  },
  venceu: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `A pré-reserva na ${p.lancha} venceu: o sinal não entrou em 24 horas. O app apagou a pré-reserva e a data voltou a ficar livre no site.`, linhas: [`Data: ${p.data}`, `Horário: ${p.horario}`, ...(p.cliente ? [`Cliente: ${p.cliente}`] : [])], nota: "Se o cliente ainda quiser, crie o passeio de novo no app.", botao: "Abrir o app" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `The hold on ${p.lancha} expired: no deposit within 24 hours. The app deleted the hold and the date is free again on the website.`, linhas: [`Date: ${p.data}`, `Time: ${p.horario}`, ...(p.cliente ? [`Client: ${p.cliente}`] : [])], nota: "If the client still wants it, create the trip again in the app.", botao: "Open the app" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `La pre-reserva en ${p.lancha} venció: la seña no entró en 24 horas. La app borró la pre-reserva y la fecha volvió a quedar libre en el sitio.`, linhas: [`Fecha: ${p.data}`, `Horario: ${p.horario}`, ...(p.cliente ? [`Cliente: ${p.cliente}`] : [])], nota: "Si el cliente todavía quiere, crea el paseo de nuevo en la app.", botao: "Abrir la app" }),
  },
  inicio: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `Seu passeio na ${p.lancha} começa em breve!`, linhas: [`Data: ${p.data}`, `Horário: ${p.horario}`, ...(p.embarque ? [`Embarque: ${p.embarque}`] : []), ...(MAPA[p.embarque] ? [`Localização: ${MAPA[p.embarque]}`] : []), ...(TAXA[p.embarque] ? [taxa(p.embarque, "pt")] : []), ...(p.donos || []).map((d: string) => `Dono da lancha: ${d}`), ...(p.buzios ? ["Búzios Lanchas: WhatsApp (21) 99927-2550"] : [])], nota: "Chegue ao local de embarque uns 10 minutos antes. Qualquer imprevisto, fale com o dono da lancha. Bom passeio!", botao: "Ver minha reserva" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `Your tour on ${p.lancha} starts soon!`, linhas: [`Date: ${p.data}`, `Time: ${p.horario}`, ...(p.embarque ? [`Boarding: ${p.embarque}`] : []), ...(MAPA[p.embarque] ? [`Location: ${MAPA[p.embarque]}`] : []), ...(TAXA[p.embarque] ? [taxa(p.embarque, "en")] : []), ...(p.donos || []).map((d: string) => `Boat owner: ${d}`), ...(p.buzios ? ["Búzios Lanchas: WhatsApp +55 21 99927-2550"] : [])], nota: "Please be at the boarding place about 10 minutes early. If anything comes up, talk to the boat owner. Enjoy your tour!", botao: "See my booking" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `¡Tu paseo en ${p.lancha} empieza pronto!`, linhas: [`Fecha: ${p.data}`, `Horario: ${p.horario}`, ...(p.embarque ? [`Embarque: ${p.embarque}`] : []), ...(MAPA[p.embarque] ? [`Ubicación: ${MAPA[p.embarque]}`] : []), ...(TAXA[p.embarque] ? [taxa(p.embarque, "es")] : []), ...(p.donos || []).map((d: string) => `Dueño de la lancha: ${d}`), ...(p.buzios ? ["Búzios Lanchas: WhatsApp +55 21 99927-2550"] : [])], nota: "Llega al lugar de embarque unos 10 minutos antes. Ante cualquier imprevisto, habla con el dueño de la lancha. ¡Buen paseo!", botao: "Ver mi reserva" }),
  },
  avisarCli: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `O passeio de ${p.cliente || "um cliente"} na ${p.lancha} começa em breve. O cliente ainda não tem conta na Búzios Lanchas, então não recebe o aviso automático.`, linhas: [`Data: ${p.data}`, `Horário: ${p.horario}`, ...(p.embarque ? [`Embarque: ${p.embarque}`] : [])], nota: "Abra o app e mande para ele no WhatsApp a mensagem pronta com o local, a localização, os contatos e o link para se cadastrar e avaliar a lancha e o marinheiro.", botao: "Mandar o aviso ao cliente" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `${p.cliente || "A client"}'s tour on ${p.lancha} starts soon. The client has no Búzios Lanchas account yet, so they don't get the automatic reminder.`, linhas: [`Date: ${p.data}`, `Time: ${p.horario}`, ...(p.embarque ? [`Boarding: ${p.embarque}`] : [])], nota: "Open the app and send them the ready WhatsApp message with the place, location, contacts and the link to sign up and rate the boat and skipper.", botao: "Send the reminder to the client" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `El paseo de ${p.cliente || "un cliente"} en ${p.lancha} empieza pronto. El cliente todavía no tiene cuenta en Búzios Lanchas, así que no recibe el aviso automático.`, linhas: [`Fecha: ${p.data}`, `Horario: ${p.horario}`, ...(p.embarque ? [`Embarque: ${p.embarque}`] : [])], nota: "Abre la app y mándale por WhatsApp el mensaje listo con el lugar, la ubicación, los contactos y el enlace para registrarse y calificar la lancha y al marinero.", botao: "Mandar el aviso al cliente" }),
  },
  cliente: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `Sua reserva na ${p.lancha} está confirmada.`, linhas: [`Data: ${p.data}`, `Horário: ${p.horario}`, ...(p.pessoas ? [`Pessoas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : []), ...(MAPA[p.embarque] ? [`Localização: ${MAPA[p.embarque]}`] : []), ...(TAXA[p.embarque] ? [taxa(p.embarque, "pt")] : []), ...(p.resto ? [`Na hora do embarque, pague ao responsável pela lancha o restante: ${p.resto}`] : []), ...(p.donos || []).map((d: string) => `Dono da lancha: ${d}`), ...(p.recibo ? ["🧾 O recibo do sinal já está no app, em Meus passeios: toque em Ver minha reserva e depois em Baixar recibo do sinal."] : []), "Búzios Lanchas: WhatsApp (21) 99927-2550"], nota: "Combine os detalhes do passeio direto com o dono da lancha. Qualquer dúvida, fale com a gente. Bom passeio!", botao: "Ver minha reserva" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `Your booking on ${p.lancha} is confirmed.`, linhas: [`Date: ${p.data}`, `Time: ${p.horario}`, ...(p.pessoas ? [`People: ${p.pessoas}`] : []), ...(p.embarque ? [`Boarding: ${p.embarque}`] : []), ...(MAPA[p.embarque] ? [`Location: ${MAPA[p.embarque]}`] : []), ...(TAXA[p.embarque] ? [taxa(p.embarque, "en")] : []), ...(p.resto ? [`At boarding, pay the balance to the boat's crew: ${p.resto}`] : []), ...(p.donos || []).map((d: string) => `Boat owner: ${d}`), ...(p.recibo ? ["🧾 Your deposit receipt is ready in the app, under My tours: tap See my booking and then Download deposit receipt."] : []), "Búzios Lanchas: WhatsApp +55 21 99927-2550"], nota: "Arrange the trip details directly with the boat owner. Any questions, talk to us. Enjoy your trip!", botao: "See my booking" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `Tu reserva en ${p.lancha} está confirmada.`, linhas: [`Fecha: ${p.data}`, `Horario: ${p.horario}`, ...(p.pessoas ? [`Personas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : []), ...(MAPA[p.embarque] ? [`Ubicación: ${MAPA[p.embarque]}`] : []), ...(TAXA[p.embarque] ? [taxa(p.embarque, "es")] : []), ...(p.resto ? [`Al embarcar, paga el resto al responsable de la lancha: ${p.resto}`] : []), ...(p.donos || []).map((d: string) => `Dueño de la lancha: ${d}`), ...(p.recibo ? ["🧾 El recibo de la seña ya está en la app, en Mis paseos: toca Ver mi reserva y luego Descargar recibo de la seña."] : []), "Búzios Lanchas: WhatsApp +55 21 99927-2550"], nota: "Coordina los detalles del paseo directamente con el dueño de la lancha. Cualquier duda, háblanos. ¡Buen paseo!", botao: "Ver mi reserva" }),
  },
};
/* assunto de cada e-mail dizendo o motivo (Rodrigo 2026-10-22); o modelo do Supabase usa .Data.assunto quando existe */
const dd = (p: any) => (p.data ? ` · ${p.data}` : "");
const ASSUNTO: Record<string, Record<string, (p: any) => string>> = {
  dono: { pt: p => `Passeio confirmado: ${p.lancha}${dd(p)}`, en: p => `Tour confirmed: ${p.lancha}${dd(p)}`, es: p => `Paseo confirmado: ${p.lancha}${dd(p)}` },
  pedido: { pt: p => `Nova reserva pelo site: ${p.lancha}${dd(p)}`, en: p => `New booking request: ${p.lancha}${dd(p)}`, es: p => `Nueva reserva por el sitio: ${p.lancha}${dd(p)}` },
  mar: { pt: p => `Você vai pilotar: ${p.lancha}${dd(p)}`, en: p => `You will skipper: ${p.lancha}${dd(p)}`, es: p => `Vas a pilotar: ${p.lancha}${dd(p)}` },
  saiu: { pt: p => `Marinheiro saiu do passeio: ${p.lancha}${dd(p)}`, en: p => `Skipper left the tour: ${p.lancha}${dd(p)}`, es: p => `El marinero dejó el paseo: ${p.lancha}${dd(p)}` },
  embarque: { pt: p => `Novo local de embarque: ${p.lancha}${dd(p)}`, en: p => `New boarding place: ${p.lancha}${dd(p)}`, es: p => `Nuevo lugar de embarque: ${p.lancha}${dd(p)}` },
  avaliar: { pt: p => `Avalie o seu passeio na ${p.lancha}`, en: p => `Rate your tour on ${p.lancha}`, es: p => `Califica tu paseo en ${p.lancha}` },
  fim: { pt: p => `Passeio terminou, confirme: ${p.lancha}${dd(p)}`, en: p => `Tour ended, please confirm: ${p.lancha}${dd(p)}`, es: p => `Paseo terminado, confirma: ${p.lancha}${dd(p)}` },
  venceu: { pt: p => `Pré-reserva vencida: ${p.lancha}${dd(p)}`, en: p => `Hold expired: ${p.lancha}${dd(p)}`, es: p => `Pre-reserva vencida: ${p.lancha}${dd(p)}` },
  inicio: { pt: p => `Seu passeio começa em breve: ${p.lancha}`, en: p => `Your tour starts soon: ${p.lancha}`, es: p => `Tu paseo empieza pronto: ${p.lancha}` },
  avisarCli: { pt: p => `Avise o cliente: passeio em breve na ${p.lancha}`, en: p => `Remind the client: tour soon on ${p.lancha}`, es: p => `Avisa al cliente: paseo pronto en ${p.lancha}` },
  cliente: { pt: p => `Reserva confirmada: ${p.lancha}${dd(p)}`, en: p => `Booking confirmed: ${p.lancha}${dd(p)}`, es: p => `Reserva confirmada: ${p.lancha}${dd(p)}` },
};
async function mandarEmail(userId: string, tipo: "dono" | "cliente" | "pedido" | "mar" | "saiu" | "embarque" | "avaliar" | "fim" | "inicio" | "avisarCli" | "venceu", p: any) {
  const { data } = await db.auth.admin.getUserById(userId);
  const u = data?.user;
  if (!u?.email || !u.email_confirmed_at || /@sem-email\.lanchaembuzios\.com\.br$/.test(u.email)) return false; // conta só com WhatsApp: sem e-mail de verdade
  const meta = { ...(u.user_metadata || {}) };
  const lang = ["pt", "en", "es"].includes(meta.lang) ? meta.lang : "pt";
  const nome = p.nomes?.[userId] || meta.nome || meta.full_name || "";
  const msg = { lang, ...MAIL[tipo][lang]({ ...p, horario: horario(p.b, p.a, lang), primeiro: String(nome).trim().split(" ")[0] || "" }) };
  msg.oi = msg.oi.replace(/, !$/, "!"); /* sem nome: só "Olá!" */
  const assunto = ASSUNTO[tipo]?.[lang]?.(p) || null;
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg, assunto } });
  const { error } = await db.auth.signInWithOtp({ email: u.email, options: { shouldCreateUser: false, emailRedirectTo: "https://www.lanchaembuzios.com.br/login/" } });
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg: null, assunto: null } });
  if (error) { console.error("email", tipo, error.message); return false; }
  return true;
}

// comissão do vendedor no aviso de fim (Rodrigo 2026-10-23: lembrar de pagar o vendedor)
const COMV = (p: any) => `R$ ${Number(p.com.valor).toLocaleString("pt-BR")}`;
async function comissaoDe(bid: number) {
  const { data: pd } = await db.from("pedidos").select("vendedor, vendedor_cod, preco_base, preco_cliente, comissao_paga").eq("bloqueio_id", bid).maybeSingle();
  const valor = pd && pd.vendedor && !pd.comissao_paga ? Number(pd.preco_cliente || 0) - Number(pd.preco_base || 0) : 0;
  if (!(valor > 0)) return null;
  const nome = (await db.from("perfis").select("nome").eq("user_id", pd.vendedor).maybeSingle()).data?.nome
    || (await db.from("clientes").select("nome").eq("user_id", pd.vendedor).maybeSingle()).data?.nome || pd.vendedor_cod || "vendedor";
  return { nome: String(nome).trim().split(" ")[0], valor };
}
// fim do passeio no horário de Búzios (UTC-3): hora_fim combinada, senão o fim do horário padrão; a noite só conta no dia seguinte
const FIM: Record<string, number> = { manha: 14, tarde: 18, dia: 17, noite: 99 };
const FORA_DESDE = "2026-10-21"; // passeios de fora: o dono confirma a partir desta data (os antigos não entram)
async function fins() {
  const agora = new Date(Date.now() - 3 * 3600 * 1000), hoje = agora.toISOString().slice(0, 10), hora = agora.getUTCHours() + agora.getUTCMinutes() / 60;
  const d0 = new Date(agora.getTime() - 3 * 86400 * 1000).toISOString().slice(0, 10);
  const { data: bs, error } = await db.from("bloqueios").select("id, lancha, data, horario, anotacoes(origem, cliente, cliente_conta, hora_ini, hora_fim), realizados(aconteceu), fim_avisos(bloqueio_id)").gte("data", d0).lte("data", hoje);
  if (error) { console.error("fim", error.message); return 0; }
  const um = (x: any) => Array.isArray(x) ? x[0] : x;
  const prontos = (bs || []).filter(b => {
    const a = um(b.anotacoes);
    if (!a || !(a.origem === "buzios" || b.data >= FORA_DESDE) || um(b.realizados) || um(b.fim_avisos)) return false;
    if (b.data < hoje) return true;
    const fim = a.hora_fim ? (([h, m]) => h + m / 60)(String(a.hora_fim).split(":").map(Number)) : FIM[b.horario] ?? 99;
    return hora >= fim;
  });
  if (!prontos.length) return 0;
  const { data: novos } = await db.from("fim_avisos").upsert(prontos.map(b => ({ bloqueio_id: b.id })), { onConflict: "bloqueio_id", ignoreDuplicates: true }).select("bloqueio_id");
  const ok = new Set((novos || []).map(n => n.bloqueio_id));
  // passeio da Búzios Lanchas: avisa o administrador; passeio de fora: avisa os donos da lancha
  const { data: ads } = await db.from("admins").select("user_id");
  const adms = (ads || []).map(a => a.user_id);
  const nomes = new Map<string, string>(), donos = new Map<string, string[]>();
  for (const l of new Set(prontos.map(b => b.lancha))) {
    nomes.set(l, (await db.from("lanchas").select("nome").eq("slug", l).maybeSingle()).data?.nome || l);
    donos.set(l, ((await db.from("donos").select("user_id").eq("lancha", l)).data || []).map(d => d.user_id));
  }
  let n = 0;
  const todos = [...new Set([...adms, ...[...donos.values()].flat()])];
  const { data: ps } = await db.from("perfis").select("user_id, nome").in("user_id", todos.length ? todos : ["00000000-0000-0000-0000-000000000000"]);
  const nomesPs = Object.fromEntries((ps || []).map(x => [x.user_id, x.nome]));
  for (const b of prontos.filter(b => ok.has(b.id))) {
    const a = um(b.anotacoes), fora = a?.origem !== "buzios", alvo = fora ? donos.get(b.lancha) || [] : adms;
    const com = fora ? null : await comissaoDe(b.id).catch(e => (console.error("comissao", e), null)); // só o administrador paga comissão
    n += await enviar(alvo, "fim", { id: b.id, lancha: nomes.get(b.lancha), data: b.data, horario: b.horario, cliente: a?.cliente || "", fora, com }, "/login/");
    // também por e-mail, para confirmar o quanto antes mesmo sem o aviso no celular
    for (const ad of alvo) await mandarEmail(ad, "fim", { b, a, lancha: nomes.get(b.lancha), data: dataBR(b.data), cliente: a?.cliente || "", fora, com, nomes: nomesPs }).catch(e => console.error(e));
  }
  return n;
}

// aviso ao cliente 1 hora antes do início (hora_ini combinada, senão o início do horário padrão; noite só com hora combinada)
const INI: Record<string, number> = { manha: 10, tarde: 14, dia: 10, noite: 99 };
async function inicios() {
  const agora = new Date(Date.now() - 3 * 3600 * 1000), hoje = agora.toISOString().slice(0, 10), hora = agora.getUTCHours() + agora.getUTCMinutes() / 60;
  const { data: bs, error } = await db.from("bloqueios").select("id, lancha, data, horario, anotacoes(origem, cliente, cliente_conta, telefone, embarque, hora_ini, hora_fim, valor, sinal), realizados(aconteceu), inicio_avisos(bloqueio_id)").eq("data", hoje);
  if (error) { console.error("inicio", error.message); return 0; }
  const um = (x: any) => Array.isArray(x) ? x[0] : x;
  const prontos = (bs || []).filter(b => {
    const a = um(b.anotacoes);
    if (a && +a.valor > 0 && a.sinal !== null && a.sinal !== "" && +a.sinal === 0) return false; // pré-reserva (sinal zero): ainda não confirmado
    if (!a || !(a.cliente_conta || String(a.telefone || "").replace(/\D/g, "").length >= 8) || um(b.realizados) || um(b.inicio_avisos)) return false;
    const ini = a.hora_ini ? (([h, m]) => h + m / 60)(String(a.hora_ini).split(":").map(Number)) : INI[b.horario] ?? 99;
    return hora >= ini - 1 && hora < ini + 1; // a partir de 1 hora antes; se o aviso atrasar mais de 1 hora depois do início, não manda
  });
  if (!prontos.length) return 0;
  const { data: novos } = await db.from("inicio_avisos").upsert(prontos.map(b => ({ bloqueio_id: b.id })), { onConflict: "bloqueio_id", ignoreDuplicates: true }).select("bloqueio_id");
  const ok = new Set((novos || []).map(n => n.bloqueio_id));
  const adms = ((await db.from("admins").select("user_id")).data || []).map(x => x.user_id);
  let n = 0;
  for (const b of prontos.filter(b => ok.has(b.id))) {
    const a = um(b.anotacoes), lancha = (await db.from("lanchas").select("nome").eq("slug", b.lancha).maybeSingle()).data?.nome || b.lancha;
    const { data: ds } = await db.from("donos").select("user_id").eq("lancha", b.lancha);
    const { data: pd } = await db.from("perfis").select("nome, telefone").in("user_id", (ds || []).map(d => d.user_id).concat(["00000000-0000-0000-0000-000000000000"]));
    const donos = (pd || []).filter(x => x.nome).map(x => x.nome + (x.telefone ? ` · WhatsApp ${x.telefone}` : ""));
    const hora = a.hora_ini ? String(a.hora_ini).replace(/^0/, "").replace(":00", "h").replace(":", "h") : `${INI[b.horario]}h`;
    if (!a.cliente_conta) {
      // cliente sem conta: avisa quem cuida do passeio (Búzios Lanchas: administrador; de fora: donos) para mandar a mensagem pronta no WhatsApp
      const alvo = a.origem === "buzios" ? adms : (ds || []).map(d => d.user_id);
      n += await enviar(alvo, "avisarCli", { id: b.id, lancha, hora, cliente: a.cliente || "" }, `/login/?avisar=${b.id}`);
      const { data: ns } = await db.from("perfis").select("user_id, nome").in("user_id", alvo.concat(["00000000-0000-0000-0000-000000000000"]));
      for (const u of alvo) await mandarEmail(u, "avisarCli", { b, a, lancha, data: dataBR(b.data), embarque: a.embarque || "", cliente: a.cliente || "", nomes: Object.fromEntries((ns || []).map(x => [x.user_id, x.nome])) }).catch(e => console.error(e));
      continue;
    }
    const { data: c } = await db.from("clientes").select("nome").eq("user_id", a.cliente_conta).maybeSingle();
    n += await enviar([a.cliente_conta], "inicio", { id: b.id, lancha, hora, embarque: a.embarque || "" }, "/login/");
    await mandarEmail(a.cliente_conta, "inicio", { b, a, lancha, data: dataBR(b.data), embarque: a.embarque || "", donos, buzios: a.origem === "buzios", nomes: { [a.cliente_conta]: c?.nome || a.cliente || "" } }).catch(e => console.error(e));
  }
  return n;
}

// pré-reserva (valor lançado, sinal zero) com mais de 24 horas sem sinal: apaga, a data volta livre no site e o administrador é avisado (Rodrigo 2026-10-25).
// Só passeios de hoje em diante e sem pedido do site ligado (pedido aprovado tem fluxo próprio).
async function vencerPre() {
  const limite = new Date(Date.now() - 24 * 3600 * 1000).toISOString(), hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: bs, error } = await db.from("bloqueios").select("id, lancha, data, horario, anotacoes!inner(cliente, valor, sinal, hora_ini, hora_fim), pedidos(id)")
    .lt("criado_em", limite).gte("data", hoje).gt("anotacoes.valor", 0).eq("anotacoes.sinal", 0);
  if (error) { console.error("vencer", error.message); return 0; }
  const um = (x: any) => Array.isArray(x) ? x[0] : x;
  const vencidas = (bs || []).filter(b => !(b.pedidos || []).length);
  if (!vencidas.length) return 0;
  const adms = ((await db.from("admins").select("user_id")).data || []).map(x => x.user_id);
  let n = 0;
  for (const b of vencidas) {
    const { data: a } = await db.from("anotacoes").select("sinal").eq("bloqueio_id", b.id).maybeSingle(); // o sinal pode ter entrado agora
    if (!a || a.sinal === null || +a.sinal !== 0) continue;
    const { data: apagou, error: e } = await db.from("bloqueios").delete().eq("id", b.id).select("id");
    if (e || !apagou?.length) { console.error("vencer apagar", b.id, e?.message); continue; }
    const an = um(b.anotacoes), lancha = (await db.from("lanchas").select("nome").eq("slug", b.lancha).maybeSingle()).data?.nome || b.lancha;
    console.log("pré-reserva vencida", b.id, b.lancha, b.data, b.horario);
    n += await enviar(adms, "venceu", { id: b.id, lancha, data: b.data, horario: b.horario, cliente: an?.cliente || "" }, "/login/");
    for (const ad of adms) await mandarEmail(ad, "venceu", { b, a: an, lancha, data: dataBR(b.data), cliente: an?.cliente || "" }).catch(err => console.error(err));
  }
  return n;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method === "GET") return json({ publica: (await chaves()).publica });
    const corpo = await req.clone().json().catch(() => ({}));
    if (corpo.tipo === "fim") return json({ enviados: await fins(), inicio: await inicios().catch(e => (console.error("inicio", e), 0)), vencidas: await vencerPre().catch(e => (console.error("vencer", e), 0)) });
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    // o próprio servidor (pagamento automático confirmou a reserva, função asaas/paypal-checkout) entra como administrador
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", sistema = !!srk && token === srk;
    const u = sistema ? null : (await db.auth.getUser(token)).data;
    const uid = sistema ? "00000000-0000-0000-0000-000000000000" : u?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    const { tipo, id } = await req.json().catch(() => ({}));
    if (sistema && tipo !== "aprovado") return json({ erro: "tipo" }, 403);
    const admin = sistema || !!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data;
    const nomeLancha = async (slug: string) => (await db.from("lanchas").select("nome").eq("slug", slug).maybeSingle()).data?.nome || slug;

    if (tipo === "teste") return json({ enviados: await enviar([uid], "teste", {}, "/login/", typeof corpo.ep === "string" ? corpo.ep : undefined) });

    if (tipo === "aprovado") {
      if (!admin) return json({ erro: "só o administrador" }, 403);
      const { data: b } = await db.from("bloqueios").select("id, lancha, data, horario").eq("id", id).maybeSingle();
      if (!b) return json({ erro: "passeio não encontrado" }, 404);
      const { data: ds } = await db.from("donos").select("user_id").eq("lancha", b.lancha);
      const alvo = (ds || []).map(d => d.user_id).filter(x => x !== uid);
      const { data: an } = await db.from("anotacoes").select("marinheiro, cliente, cliente_conta, pessoas, embarque, hora_ini, hora_fim, valor, sinal").eq("bloqueio_id", b.id).maybeSingle();
      const lancha = await nomeLancha(b.lancha);
      // o restante, que o cliente paga ao responsável pela lancha na hora do embarque (Rodrigo, 2026-10-22)
      const restoN = Math.max(0, (+an?.valor || 0) - (+an?.sinal || 0)), resto = restoN ? "R$ " + restoN.toLocaleString("pt-BR") : "";
      const enviados = await enviar(alvo, "aprovado", { ...b, semMar: !an?.marinheiro, lancha }, "/login/");
      const { data: ps } = await db.from("perfis").select("user_id, nome").in("user_id", alvo.length ? alvo : ["00000000-0000-0000-0000-000000000000"]);
      const nomes = Object.fromEntries((ps || []).map(x => [x.user_id, x.nome]));
      const p = { b, a: an, lancha, data: dataBR(b.data), pessoas: an?.pessoas ? String(an.pessoas) : "", embarque: an?.embarque || "", cliente: an?.cliente || "", semMar: !an?.marinheiro, nomes };
      const emails = { donos: 0, cliente: false };
      for (const d of alvo) if (await mandarEmail(d, "dono", p).catch(e => (console.error(e), false))) emails.donos++;
      if (an?.cliente_conta) {
        const { data: c } = await db.from("clientes").select("nome").eq("user_id", an.cliente_conta).maybeSingle();
        // nome e WhatsApp de todos os donos da lancha, para o cliente combinar o passeio direto com eles
        const { data: pd } = await db.from("perfis").select("nome, telefone").in("user_id", (ds || []).map(d => d.user_id).concat(["00000000-0000-0000-0000-000000000000"]));
        const donos = (pd || []).filter(x => x.nome).map(x => x.nome + (x.telefone ? ` · WhatsApp ${x.telefone}` : ""));
        // sinal pago pela central de pagamento: o recibo está em Meus passeios (Rodrigo 2026-10-29)
        const pid = (await db.from("pedidos").select("id").eq("bloqueio_id", b.id).limit(1).maybeSingle()).data?.id;
        const recibo = !!pid && !!(await db.from("pagamentos_pp").select("pedido").eq("pedido", pid).maybeSingle()).data;
        emails.cliente = await mandarEmail(an.cliente_conta, "cliente", { ...p, donos, resto, recibo, nomes: { [an.cliente_conta]: c?.nome || an.cliente || "" } }).catch(e => (console.error(e), false));
      }
      // no chat de atendimento do cliente: a Búzios Lanchas confirma e lembra o restante no embarque
      if (an?.cliente_conta) {
        const { data: ped } = await db.from("pedidos").select("id").eq("bloqueio_id", b.id).maybeSingle();
        const { data: cv } = await db.from("conversas").select("id").eq("tipo", "suporte").eq("cliente", an.cliente_conta).maybeSingle();
        if (cv && ped) { // só pedido do site (o sinal passou pela Búzios Lanchas)
          const tx = `Pagamento do sinal confirmado: sua reserva na ${lancha} em ${dataBR(b.data)} está confirmada! ✅` + (resto ? ` Na hora do embarque, você paga o restante (${resto}) direto ao responsável pela lancha.` : "");
          const { data: m } = await db.from("mensagens").insert({ conversa: cv.id, autor: null, texto: tx, sistema: "ok:" + restoN, pedido: ped?.id || null }).select("id").maybeSingle();
          if (m) await db.from("conversas").update({ ultima_em: new Date().toISOString(), ultima_msg: tx.slice(0, 80), encerrada_em: null }).eq("id", cv.id);
        }
      }
      return json({ enviados, emails });
    }

    if (tipo === "marinheiro") {
      const { data: b } = await db.from("bloqueios").select("id, lancha, data, horario").eq("id", id).maybeSingle();
      if (!b) return json({ erro: "passeio não encontrado" }, 404);
      const dono = !!(await db.from("donos").select("user_id").eq("user_id", uid).eq("lancha", b.lancha).maybeSingle()).data;
      if (!admin && !dono) return json({ erro: "só o administrador ou o dono" }, 403);
      const { data: an } = await db.from("anotacoes").select("marinheiro, cliente, pessoas, embarque, hora_ini, hora_fim").eq("bloqueio_id", b.id).maybeSingle();
      const m = an?.marinheiro;
      if (!m || m === uid) return json({ enviados: 0 });
      const lancha = await nomeLancha(b.lancha);
      const enviados = await enviar([m], "marinheiro", { ...b, lancha }, "/login/");
      const nome = (await db.from("freelancers").select("nome").eq("user_id", m).maybeSingle()).data?.nome
        || (await db.from("marinheiros").select("nome").eq("user_id", m).limit(1).maybeSingle()).data?.nome
        || (await db.from("perfis").select("nome").eq("user_id", m).maybeSingle()).data?.nome || "";
      // contato do dono para o marinheiro; o nome do cliente só vai para o marinheiro fixo da lancha (o freelancer recebe só o passeio)
      const { data: ds } = await db.from("donos").select("user_id").eq("lancha", b.lancha);
      const { data: ps } = await db.from("perfis").select("user_id, nome, telefone").in("user_id", (ds || []).map(d => d.user_id).concat(["00000000-0000-0000-0000-000000000000"]));
      const donos = (ps || []).filter(x => x.user_id !== m && x.nome).map(x => x.nome + (x.telefone ? ` · WhatsApp ${x.telefone}` : ""));
      const fixo = !!(await db.from("marinheiros").select("user_id").eq("user_id", m).eq("lancha", b.lancha).maybeSingle()).data;
      const email = await mandarEmail(m, "mar", { b, a: an, lancha, data: dataBR(b.data), pessoas: an?.pessoas ? String(an.pessoas) : "", embarque: an?.embarque || "", cliente: fixo ? an?.cliente || "" : "", donos, nomes: { [m]: nome } }).catch(e => (console.error(e), false));
      return json({ enviados, email });
    }

    if (tipo === "embarque") {
      // o local de embarque mudou (dono, administrador ou marinheiro fixo): avisa o cliente com conta por e-mail e no celular
      const { data: b } = await db.from("bloqueios").select("id, lancha, data, horario").eq("id", id).maybeSingle();
      if (!b) return json({ erro: "passeio não encontrado" }, 404);
      const dono = !!(await db.from("donos").select("user_id").eq("user_id", uid).eq("lancha", b.lancha).maybeSingle()).data;
      const fixo = !!(await db.from("marinheiros").select("user_id").eq("user_id", uid).eq("lancha", b.lancha).eq("fixo", true).maybeSingle()).data;
      if (!admin && !dono && !fixo) return json({ erro: "sem permissão" }, 403);
      const { data: an } = await db.from("anotacoes").select("cliente, cliente_conta, embarque, hora_ini, hora_fim").eq("bloqueio_id", b.id).maybeSingle();
      if (!an?.cliente_conta || !an.embarque) return json({ enviados: 0, email: false });
      const lancha = await nomeLancha(b.lancha);
      const enviados = await enviar([an.cliente_conta], "embarque", { ...b, lancha, embarque: an.embarque }, "/login/");
      const { data: c } = await db.from("clientes").select("nome").eq("user_id", an.cliente_conta).maybeSingle();
      const email = await mandarEmail(an.cliente_conta, "embarque", { b, a: an, lancha, data: dataBR(b.data), embarque: an.embarque, nomes: { [an.cliente_conta]: c?.nome || an.cliente || "" } }).catch(e => (console.error(e), false));
      return json({ enviados, email });
    }

    if (tipo === "avaliar") {
      // o administrador confirmou que o passeio aconteceu: pede a avaliação ao cliente com conta (celular e e-mail)
      const { data: b } = await db.from("bloqueios").select("id, lancha, data, horario").eq("id", id).maybeSingle();
      if (!b) return json({ erro: "passeio não encontrado" }, 404);
      const { data: og } = await db.from("anotacoes").select("origem").eq("bloqueio_id", b.id).maybeSingle();
      const dono = !!(await db.from("donos").select("user_id").eq("user_id", uid).eq("lancha", b.lancha).maybeSingle()).data;
      if (!admin && !(dono && og?.origem !== "buzios")) return json({ erro: "só o administrador ou o dono (passeio de fora)" }, 403);
      const { data: r } = await db.from("realizados").select("aconteceu").eq("bloqueio_id", b.id).maybeSingle();
      if (!r?.aconteceu) return json({ enviados: 0, email: false });
      const { data: an } = await db.from("anotacoes").select("cliente, cliente_conta, hora_ini, hora_fim").eq("bloqueio_id", b.id).maybeSingle();
      const cli = an?.cliente_conta || (await db.from("pedidos").select("cliente").eq("bloqueio_id", b.id).eq("status", "aprovado").limit(1).maybeSingle()).data?.cliente;
      if (!cli) return json({ enviados: 0, email: false });
      const lancha = await nomeLancha(b.lancha);
      const cup = await cupomDo(b.id, cli).catch(e => (console.error(e), null));
      const enviados = await enviar([cli], "avaliar", { ...b, lancha, cup }, "/login/");
      const { data: c } = await db.from("clientes").select("nome").eq("user_id", cli).maybeSingle();
      // o administrador confirma pelo app, que já manda o e-mail da avaliação pela função "avaliacao" (link que entra logado): aqui só o dono manda e-mail, para o cliente não receber dois
      const email = admin ? false : await mandarEmail(cli, "avaliar", { b, a: an, lancha, cup, data: dataBR(b.data), nomes: { [cli]: c?.nome || an?.cliente || "" } }).catch(e => (console.error(e), false));
      return json({ enviados, email });
    }

    if (tipo === "recusou") {
      const { data: b } = await db.from("bloqueios").select("id, lancha, data, horario").eq("id", id).maybeSingle();
      if (!b) return json({ erro: "passeio não encontrado" }, 404);
      const { data: an } = await db.from("anotacoes").select("marinheiro, marinheiro_recusou, pessoas, embarque, hora_ini, hora_fim").eq("bloqueio_id", b.id).maybeSingle();
      // só quem acabou de sair (o nome gravado por recusar_passeio é o dele) dispara o aviso
      const meu = (await db.from("marinheiros").select("nome").eq("user_id", uid).eq("lancha", b.lancha).maybeSingle()).data?.nome
        || (await db.from("freelancers").select("nome").eq("user_id", uid).maybeSingle()).data?.nome || "Marinheiro";
      if (an?.marinheiro || an?.marinheiro_recusou !== meu) return json({ enviados: 0 });
      const { data: ds } = await db.from("donos").select("user_id").eq("lancha", b.lancha);
      const { data: ads } = await db.from("admins").select("user_id");
      const alvo = [...new Set([...(ds || []), ...(ads || [])].map(x => x.user_id))].filter(x => x !== uid);
      const lancha = await nomeLancha(b.lancha);
      const enviados = await enviar(alvo, "recusou", { ...b, lancha, nome: meu }, "/login/");
      const { data: ps } = await db.from("perfis").select("user_id, nome").in("user_id", alvo.length ? alvo : ["00000000-0000-0000-0000-000000000000"]);
      const p = { b, a: an, lancha, nome: meu, data: dataBR(b.data), pessoas: an?.pessoas ? String(an.pessoas) : "", embarque: an?.embarque || "", nomes: Object.fromEntries((ps || []).map(x => [x.user_id, x.nome])) };
      let emails = 0;
      for (const d of alvo) if (await mandarEmail(d, "saiu", p).catch(e => (console.error(e), false))) emails++;
      return json({ enviados, emails });
    }

    if (tipo === "fotos") { // o dono enviou fotos da lancha: avisa o administrador para aprovar
      const l = String(corpo.lancha || "");
      const desde = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: ps } = await db.from("fotos_pendentes").select("id").eq("lancha", l).eq("enviado_por", uid).gte("criado_em", desde);
      if (!ps?.length) return json({ enviados: 0 });
      const { data: ads } = await db.from("admins").select("user_id");
      const alvo = (ads || []).map(a => a.user_id).filter(x => x !== uid);
      return json({ enviados: await enviar(alvo, "fotos", { lancha: await nomeLancha(l), n: ps.length }, "/login/?fotos=1") });
    }

    if (tipo === "pedido") {
      const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, horario, pessoas, embarque, criado_em, avisado_em").eq("id", id).maybeSingle();
      if (!p || p.cliente !== uid) return json({ erro: "pedido não encontrado" }, 404);
      if (p.avisado_em || Date.now() - Date.parse(p.criado_em) > 10 * 60 * 1000) return json({ enviados: 0 });
      const { data: marcado } = await db.from("pedidos").update({ avisado_em: new Date().toISOString() }).eq("id", p.id).is("avisado_em", null).select("id");
      if (!marcado?.length) return json({ enviados: 0 });
      const { data: ads } = await db.from("admins").select("user_id");
      const alvo = (ads || []).map(a => a.user_id), lancha = await nomeLancha(p.lancha);
      const enviados = await enviar(alvo, "pedido", { ...p, lancha }, "/login/");
      const { data: c } = await db.from("clientes").select("nome, whatsapp").eq("user_id", uid).maybeSingle();
      const dados = { b: p, a: null, lancha, data: dataBR(p.data), pessoas: String(p.pessoas || ""), embarque: p.embarque || "", cliente: c?.nome || "", whats: c?.whatsapp || "" };
      let emails = 0;
      for (const a of alvo) if (await mandarEmail(a, "pedido", dados).catch(e => (console.error(e), false))) emails++;
      return json({ enviados, emails });
    }
    return json({ erro: "tipo" }, 400);
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
