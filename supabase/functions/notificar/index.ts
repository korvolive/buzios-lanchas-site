// Búzios Lanchas: notificação no celular (Web Push).
// GET  -> { publica }  chave pública para o celular se inscrever
// POST { tipo: "aprovado", id: <bloqueio> }  (só o administrador) avisa os donos da lancha (no celular e por e-mail)
//                                             e manda ao cliente com conta o e-mail "reserva confirmada"
// POST { tipo: "pedido",   id: <pedido> }    (o próprio cliente, uma vez) avisa o administrador (no celular e por e-mail)
// POST { tipo: "marinheiro", id: <bloqueio> }  (administrador ou dono da lancha) avisa o marinheiro escolhido para pilotar (celular e e-mail)
// POST { tipo: "recusou", id: <bloqueio> }  (o marinheiro que acabou de sair do passeio) avisa os donos da lancha e o administrador (celular e e-mail)
// POST { tipo: "teste" }                       avisa só quem chamou
// POST { tipo: "fim" }  (agendado a cada 15 min pelo pg_cron) avisa o administrador quando um passeio da Búzios Lanchas termina,
//                       para ele confirmar que aconteceu (libera a avaliação do cliente). Cada passeio é avisado uma vez (tabela fim_avisos).
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
    pt: p => ({ title: "Passeio terminou: confirme", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario}${p.cliente ? " · " + p.cliente : ""}. Confirme que aconteceu para o cliente poder avaliar.` }),
    en: p => ({ title: "Trip ended: please confirm", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario}${p.cliente ? " · " + p.cliente : ""}. Confirm it happened so the client can rate it.` }),
    es: p => ({ title: "Paseo terminado: confirma", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario}${p.cliente ? " · " + p.cliente : ""}. Confirma que ocurrió para que el cliente pueda evaluar.` }),
  },
  marinheiro: {
    pt: p => ({ title: "Você vai pilotar", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario}. Toque para ver o passeio.` }),
    en: p => ({ title: "You will drive", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario}. Tap to see the trip.` }),
    es: p => ({ title: "Vas a pilotar", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario}. Toca para ver el paseo.` }),
  },
  recusou: {
    pt: p => ({ title: "Marinheiro saiu do passeio", body: `${p.nome} não vai poder pilotar a ${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario}. Escolha outro marinheiro.` }),
    en: p => ({ title: "Skipper left the trip", body: `${p.nome} can't drive ${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario}. Choose another skipper.` }),
    es: p => ({ title: "El marinero dejó el paseo", body: `${p.nome} no podrá pilotar ${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario}. Elige otro marinero.` }),
  },
  teste: {
    pt: () => ({ title: "Notificações ativadas", body: "Você vai receber os avisos da Búzios Lanchas aqui." }),
    en: () => ({ title: "Notifications are on", body: "You will get Búzios Lanchas alerts here." }),
    es: () => ({ title: "Notificaciones activadas", body: "Recibirás aquí los avisos de Búzios Lanchas." }),
  },
};

async function enviar(users: string[], tipo: string, p: any, url: string) {
  if (!users.length) return 0;
  const k = await chaves();
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", users);
  let n = 0;
  await Promise.all((subs || []).map(async s => {
    const m = (TXT[tipo][s.lang] || TXT[tipo].pt)(p);
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url, tag: `${tipo}-${p.id ?? "t"}` }), { TTL: 86400, urgency: "high" });
      n++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
      else console.error("push", e?.statusCode, e?.body || String(e));
    }
  }));
  return n;
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
const MAIL: Record<string, Record<string, (p: any) => any>> = {
  dono: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `A Búzios Lanchas confirmou um passeio novo na ${p.lancha}.`, linhas: [`Data: ${p.data}`, `Horário: ${p.horario}`, ...(p.pessoas ? [`Pessoas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : []), ...(p.cliente ? [`Cliente: ${p.cliente}`] : [])], nota: p.semMar ? "Abra a agenda e escolha quem vai pilotar." : "O passeio já está na sua agenda.", botao: "Abrir minha agenda" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `Búzios Lanchas confirmed a new trip on ${p.lancha}.`, linhas: [`Date: ${p.data}`, `Time: ${p.horario}`, ...(p.pessoas ? [`People: ${p.pessoas}`] : []), ...(p.embarque ? [`Boarding: ${p.embarque}`] : []), ...(p.cliente ? [`Client: ${p.cliente}`] : [])], nota: p.semMar ? "Open the schedule and choose who will drive." : "The trip is already in your schedule.", botao: "Open my schedule" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `Búzios Lanchas confirmó un paseo nuevo en ${p.lancha}.`, linhas: [`Fecha: ${p.data}`, `Horario: ${p.horario}`, ...(p.pessoas ? [`Personas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : []), ...(p.cliente ? [`Cliente: ${p.cliente}`] : [])], nota: p.semMar ? "Abre la agenda y elige quién va a pilotar." : "El paseo ya está en tu agenda.", botao: "Abrir mi agenda" }),
  },
  pedido: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `Pedido novo de reserva pelo site: ${p.lancha}.`, linhas: [`Cliente: ${p.cliente}`, ...(p.whats ? [`WhatsApp: ${p.whats}`] : []), `Data: ${p.data}`, `Horário: ${p.horario}`, `Pessoas: ${p.pessoas}`, ...(p.embarque ? [`Embarque: ${p.embarque}`] : [])], nota: "O pedido está em Reservas › Pendentes. Aprove depois de receber o sinal de 50%.", botao: "Abrir as reservas" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `New booking request from the website: ${p.lancha}.`, linhas: [`Client: ${p.cliente}`, ...(p.whats ? [`WhatsApp: ${p.whats}`] : []), `Date: ${p.data}`, `Time: ${p.horario}`, `People: ${p.pessoas}`, ...(p.embarque ? [`Boarding: ${p.embarque}`] : [])], nota: "The request is in Bookings › Pending. Approve it after receiving the 50% deposit.", botao: "Open bookings" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `Pedido nuevo de reserva desde el sitio: ${p.lancha}.`, linhas: [`Cliente: ${p.cliente}`, ...(p.whats ? [`WhatsApp: ${p.whats}`] : []), `Fecha: ${p.data}`, `Horario: ${p.horario}`, `Personas: ${p.pessoas}`, ...(p.embarque ? [`Embarque: ${p.embarque}`] : [])], nota: "El pedido está en Reservas › Pendientes. Apruébalo después de recibir la seña del 50%.", botao: "Abrir las reservas" }),
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
  cliente: {
    pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `Sua reserva na ${p.lancha} está confirmada.`, linhas: [`Data: ${p.data}`, `Horário: ${p.horario}`, ...(p.pessoas ? [`Pessoas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : [])], nota: "Qualquer dúvida, fale com a gente no WhatsApp (21) 99927-2550. Bom passeio!", botao: "Ver minha reserva" }),
    en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `Your booking on ${p.lancha} is confirmed.`, linhas: [`Date: ${p.data}`, `Time: ${p.horario}`, ...(p.pessoas ? [`People: ${p.pessoas}`] : []), ...(p.embarque ? [`Boarding: ${p.embarque}`] : [])], nota: "Any questions, talk to us on WhatsApp +55 21 99927-2550. Enjoy your trip!", botao: "See my booking" }),
    es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `Tu reserva en ${p.lancha} está confirmada.`, linhas: [`Fecha: ${p.data}`, `Horario: ${p.horario}`, ...(p.pessoas ? [`Personas: ${p.pessoas}`] : []), ...(p.embarque ? [`Embarque: ${p.embarque}`] : [])], nota: "Cualquier duda, háblanos por WhatsApp +55 21 99927-2550. ¡Buen paseo!", botao: "Ver mi reserva" }),
  },
};
async function mandarEmail(userId: string, tipo: "dono" | "cliente" | "pedido" | "mar" | "saiu", p: any) {
  const { data } = await db.auth.admin.getUserById(userId);
  const u = data?.user;
  if (!u?.email || !u.email_confirmed_at) return false;
  const meta = { ...(u.user_metadata || {}) };
  const lang = ["pt", "en", "es"].includes(meta.lang) ? meta.lang : "pt";
  const nome = p.nomes?.[userId] || meta.nome || meta.full_name || "";
  const msg = { lang, ...MAIL[tipo][lang]({ ...p, horario: horario(p.b, p.a, lang), primeiro: String(nome).trim().split(" ")[0] || "" }) };
  msg.oi = msg.oi.replace(/, !$/, "!"); /* sem nome: só "Olá!" */
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg } });
  const { error } = await db.auth.signInWithOtp({ email: u.email, options: { shouldCreateUser: false, emailRedirectTo: "https://www.lanchaembuzios.com.br/login/" } });
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg: null } });
  if (error) { console.error("email", tipo, error.message); return false; }
  return true;
}

// fim do passeio no horário de Búzios (UTC-3): hora_fim combinada, senão o fim do horário padrão; a noite só conta no dia seguinte
const FIM: Record<string, number> = { manha: 14, tarde: 18, dia: 17, noite: 99 };
async function fins() {
  const agora = new Date(Date.now() - 3 * 3600 * 1000), hoje = agora.toISOString().slice(0, 10), hora = agora.getUTCHours() + agora.getUTCMinutes() / 60;
  const d0 = new Date(agora.getTime() - 3 * 86400 * 1000).toISOString().slice(0, 10);
  const { data: bs, error } = await db.from("bloqueios").select("id, lancha, data, horario, anotacoes(origem, cliente, cliente_conta, hora_fim), realizados(aconteceu), fim_avisos(bloqueio_id)").gte("data", d0).lte("data", hoje);
  if (error) { console.error("fim", error.message); return 0; }
  const um = (x: any) => Array.isArray(x) ? x[0] : x;
  const prontos = (bs || []).filter(b => {
    const a = um(b.anotacoes);
    if (!a || !(a.origem === "buzios" || a.cliente_conta) || um(b.realizados) || um(b.fim_avisos)) return false;
    if (b.data < hoje) return true;
    const fim = a.hora_fim ? (([h, m]) => h + m / 60)(String(a.hora_fim).split(":").map(Number)) : FIM[b.horario] ?? 99;
    return hora >= fim;
  });
  if (!prontos.length) return 0;
  const { data: novos } = await db.from("fim_avisos").upsert(prontos.map(b => ({ bloqueio_id: b.id })), { onConflict: "bloqueio_id", ignoreDuplicates: true }).select("bloqueio_id");
  const ok = new Set((novos || []).map(n => n.bloqueio_id));
  const { data: ads } = await db.from("admins").select("user_id");
  const alvo = (ads || []).map(a => a.user_id);
  const nomes = new Map<string, string>();
  for (const l of new Set(prontos.map(b => b.lancha))) nomes.set(l, (await db.from("lanchas").select("nome").eq("slug", l).maybeSingle()).data?.nome || l);
  let n = 0;
  for (const b of prontos.filter(b => ok.has(b.id))) n += await enviar(alvo, "fim", { id: b.id, lancha: nomes.get(b.lancha), data: b.data, horario: b.horario, cliente: um(b.anotacoes)?.cliente || "" }, "/login/");
  return n;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method === "GET") return json({ publica: (await chaves()).publica });
    const corpo = await req.clone().json().catch(() => ({}));
    if (corpo.tipo === "fim") return json({ enviados: await fins() });
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    const { tipo, id } = await req.json().catch(() => ({}));
    const admin = !!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data;
    const nomeLancha = async (slug: string) => (await db.from("lanchas").select("nome").eq("slug", slug).maybeSingle()).data?.nome || slug;

    if (tipo === "teste") return json({ enviados: await enviar([uid], "teste", {}, "/login/") });

    if (tipo === "aprovado") {
      if (!admin) return json({ erro: "só o administrador" }, 403);
      const { data: b } = await db.from("bloqueios").select("id, lancha, data, horario").eq("id", id).maybeSingle();
      if (!b) return json({ erro: "passeio não encontrado" }, 404);
      const { data: ds } = await db.from("donos").select("user_id").eq("lancha", b.lancha);
      const alvo = (ds || []).map(d => d.user_id).filter(x => x !== uid);
      const { data: an } = await db.from("anotacoes").select("marinheiro, cliente, cliente_conta, pessoas, embarque, hora_ini, hora_fim").eq("bloqueio_id", b.id).maybeSingle();
      const lancha = await nomeLancha(b.lancha);
      const enviados = await enviar(alvo, "aprovado", { ...b, semMar: !an?.marinheiro, lancha }, "/login/");
      const { data: ps } = await db.from("perfis").select("user_id, nome").in("user_id", alvo.length ? alvo : ["00000000-0000-0000-0000-000000000000"]);
      const nomes = Object.fromEntries((ps || []).map(x => [x.user_id, x.nome]));
      const p = { b, a: an, lancha, data: dataBR(b.data), pessoas: an?.pessoas ? String(an.pessoas) : "", embarque: an?.embarque || "", cliente: an?.cliente || "", semMar: !an?.marinheiro, nomes };
      const emails = { donos: 0, cliente: false };
      for (const d of alvo) if (await mandarEmail(d, "dono", p).catch(e => (console.error(e), false))) emails.donos++;
      if (an?.cliente_conta) {
        const { data: c } = await db.from("clientes").select("nome").eq("user_id", an.cliente_conta).maybeSingle();
        emails.cliente = await mandarEmail(an.cliente_conta, "cliente", { ...p, nomes: { [an.cliente_conta]: c?.nome || an.cliente || "" } }).catch(e => (console.error(e), false));
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
