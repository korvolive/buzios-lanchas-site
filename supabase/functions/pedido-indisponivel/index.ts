// Búzios Lanchas: depois que o administrador aprova um pedido, os outros pedidos pendentes da mesma lancha,
// data e horário (que se sobrepõe) viram "Não fechado" com motivo 'ocupado', e cada cliente é avisado no idioma dele
// (celular e e-mail) de que a data não está mais disponível, com o link das lanchas livres naquele dia (Rodrigo, 2026-10-22).
// Também avisa no celular o cliente do pedido aprovado (o e-mail de confirmação sai pelo notificar).
// POST { pid: <pedido aprovado> }  (só o administrador, ou o servidor com a chave service_role)
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const dataBR = (d: string) => d.split("-").reverse().join("/");
const SITE = "https://www.lanchaembuzios.com.br";
const lang = (x: string) => (["pt", "en", "es"].includes(x) ? x : "pt");
const ES_DDI = ["34", "51", "52", "53", "54", "56", "57", "58", "502", "503", "504", "505", "506", "507", "591", "593", "595", "598"];
// idioma do cliente: o da conta; sem ele, o do DDI do WhatsApp (mesma regra dos outros e-mails)
const ddiLang = (tel: string) => { const cc = String(tel || "").match(/^\s*\+(\d{1,3})\b/)?.[1]; return cc ? (cc === "55" ? "pt" : ES_DDI.includes(cc) ? "es" : "en") : "pt"; };
const livres = (l: string, d: string) => `${SITE}${l === "pt" ? "" : "/" + l}/?data=${d}#frota`;
const T: Record<string, any> = {
  pt: { tit: (b: string) => `${b} não está mais disponível`, corpo: (b: string, d: string) => `A ${b} já foi reservada para ${d}. Toque para ver as outras lanchas livres nesse dia.`,
    oi: (n: string) => n ? `Olá, ${n}!` : "Olá!", texto: (b: string, d: string) => `A lancha ${b} que você pediu para ${d} acabou de ser reservada por outro cliente.`,
    linhas: (u: string) => ["A boa notícia: ainda temos outras lanchas livres nesse dia.", `Veja as opções: ${u}`], nota: "Se preferir, fale com a gente pelo Chat do app ou pelo WhatsApp.", botao: "Ver meus passeios" },
  en: { tit: (b: string) => `${b} is no longer available`, corpo: (b: string, d: string) => `${b} has been booked for ${d}. Tap to see the other boats free that day.`,
    oi: (n: string) => n ? `Hi, ${n}!` : "Hi!", texto: (b: string, d: string) => `The boat ${b} you requested for ${d} has just been booked by another customer.`,
    linhas: (u: string) => ["The good news: we still have other boats free that day.", `See the options: ${u}`], nota: "If you prefer, talk to us in the app Chat or on WhatsApp.", botao: "See my tours" },
  es: { tit: (b: string) => `${b} ya no está disponible`, corpo: (b: string, d: string) => `${b} ya fue reservada para el ${d}. Toca para ver las otras lanchas libres ese día.`,
    oi: (n: string) => n ? `¡Hola, ${n}!` : "¡Hola!", texto: (b: string, d: string) => `La lancha ${b} que pediste para el ${d} acaba de ser reservada por otro cliente.`,
    linhas: (u: string) => ["La buena noticia: todavía tenemos otras lanchas libres ese día.", `Mira las opciones: ${u}`], nota: "Si prefieres, habla con nosotros por el Chat de la app o por WhatsApp.", botao: "Ver mis paseos" },
};
const SLOT: Record<string, Record<string, string>> = {
  pt: { manha: "manhã", tarde: "tarde", dia: "dia inteiro", noite: "noite" },
  en: { manha: "morning", tarde: "afternoon", dia: "full day", noite: "night" },
  es: { manha: "mañana", tarde: "tarde", dia: "día completo", noite: "noche" },
};
const OK: Record<string, (b: string, d: string, h: string) => { title: string; body: string }> = {
  pt: (b, d, h) => ({ title: "Passeio confirmado ✅", body: `${b} · ${d} · ${SLOT.pt[h] || h}. Toque para ver os detalhes do seu passeio.` }),
  en: (b, d, h) => ({ title: "Tour confirmed ✅", body: `${b} · ${d} · ${SLOT.en[h] || h}. Tap to see your tour details.` }),
  es: (b, d, h) => ({ title: "Paseo confirmado ✅", body: `${b} · ${d} · ${SLOT.es[h] || h}. Toca para ver los detalles de tu paseo.` }),
};
// mesmo horário: dia inteiro ocupa manhã e tarde; a noite é separada
const choca = (a: string, b: string) => a === b || (a !== "noite" && b !== "noite" && (a === "dia" || b === "dia"));

async function push(uid: string, mk: (l: string) => { title: string; body: string; url: string }, tag: string) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return 0;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", uid);
  let n = 0;
  for (const s of subs || []) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...mk(lang(s.lang)), tag }), { TTL: 86400, urgency: "high" }); n++; }
    catch (e: any) { console.error("push falhou", e?.statusCode); if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
  return n;
}

async function email(uid: string, boat: string, d: string) {
  const { data } = await db.auth.admin.getUserById(uid);
  const u = data?.user;
  if (!u?.email || !u.email_confirmed_at || /@sem-email\.lanchaembuzios\.com\.br$/.test(u.email)) return false; // conta só com WhatsApp: sem e-mail de verdade
  const meta = { ...(u.user_metadata || {}) };
  const { data: c } = await db.from("clientes").select("nome, whatsapp").eq("user_id", uid).maybeSingle();
  const l = ["pt", "en", "es"].includes(meta.lang) ? meta.lang : ddiLang(c?.whatsapp), t = T[l];
  const nome = c?.nome || meta.nome || meta.full_name || "";
  const msg = { lang: l, oi: t.oi(String(nome).trim().split(" ")[0]), texto: t.texto(boat, dataBR(d)), linhas: t.linhas(livres(l, d)), nota: t.nota, botao: t.botao, url: `${SITE}/login/` };
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, lang: l, msg, assunto: { pt: `Data indisponível: ${boat} · ${dataBR(d)}`, en: `Date unavailable: ${boat} · ${dataBR(d)}`, es: `Fecha no disponible: ${boat} · ${dataBR(d)}` }[l as "pt"] } }); // lang no topo: o assunto do e-mail sai no idioma dele
  const { error } = await db.auth.signInWithOtp({ email: u.email, options: { shouldCreateUser: false, emailRedirectTo: `${SITE}/login/` } });
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg: null, assunto: null } });
  if (error) { console.error("email", error.message); return false; }
  return true;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    // o próprio servidor também chama (pagamento automático confirmou a reserva sozinho, Rodrigo 2026-10-25)
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!srk || token !== srk) {
      const { data: me } = await db.auth.getUser(token);
      const uid = me?.user?.id;
      if (!uid) return json({ erro: "login" }, 401);
      if (!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data) return json({ erro: "só o administrador" }, 403);
    }
    const { pid } = await req.json().catch(() => ({}));
    const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, horario, status").eq("id", pid).maybeSingle();
    if (!p || p.status !== "aprovado") return json({ erro: "pedido aprovado não encontrado" }, 404);
    const boat = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
    const confirmado = p.cliente ? await push(p.cliente, l => ({ ...OK[l](boat, dataBR(p.data), p.horario), url: "/login/" }), `confirmado-${p.id}`).catch(() => 0) : 0;
    const { data: outros } = await db.from("pedidos").select("id, cliente, horario").eq("lancha", p.lancha).eq("data", p.data).eq("status", "pendente").neq("id", p.id);
    const alvo = (outros || []).filter(o => choca(o.horario, p.horario));
    if (!alvo.length) return json({ confirmado, cancelados: 0 });
    await db.from("pedidos").update({ status: "recusado", motivo: "ocupado", atualizado_em: new Date().toISOString() }).in("id", alvo.map(o => o.id));
    let pushes = 0, mails = 0;
    for (const o of alvo) {
      if (!o.cliente) continue;
      pushes += await push(o.cliente, l => ({ title: T[l].tit(boat), body: T[l].corpo(boat, dataBR(p.data)), url: livres(l, p.data) }), `ocupado-${o.id}`).catch(() => 0);
      if (await email(o.cliente, boat, p.data).catch(e => (console.error(e), false))) mails++;
    }
    return json({ confirmado, cancelados: alvo.length, pushes, emails: mails });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
