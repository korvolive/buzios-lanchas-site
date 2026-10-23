// Búzios Lanchas: e-mail pedindo ao cliente que avalie o passeio (depois que o administrador confirma que aconteceu).
// POST { bid: <bloqueio>, lang }  (só o administrador)
// Cliente com conta: modelo "Magic Link" com user_metadata.avaliar preenchido (o botão já entra logado em Meus passeios).
// Cliente sem conta (só convite com e-mail): modelo "Invite user" com data.avaliar (o botão cria a senha e abre a avaliação).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const SITE = "https://www.lanchaembuzios.com.br";
const dataBR = (d: string) => d.split("-").reverse().join("/");
const ES_DDI = ["34", "51", "52", "53", "54", "56", "57", "58", "502", "503", "504", "505", "506", "507", "591", "593", "595", "598"];

// cupom de fidelidade do passeio: com cupom, o e-mail usa a mensagem montada aqui (modelo com user_metadata.msg) e conta do cupom (Rodrigo 2026-10-23)
const CUP_MSG: Record<string, (a: any, c: any) => any> = {
  pt: (a, c) => ({ oi: `Olá, ${a.primeiro}!`, texto: `Obrigado por passear com a gente na ${a.lancha}! Conte como foi: dê a nota da lancha e do marinheiro.`, linhas: [`Data: ${a.data}`, `🎁 Você ganhou um cupom de ${c.valor} para usar em qualquer lancha do site da Búzios Lanchas, válido por 6 meses (até ${c.ate}).`], nota: "Para usar o cupom, entre no site com a sua conta e, na hora de reservar, toque em Usar meu cupom. A avaliação leva menos de 1 minuto e ajuda outros clientes a escolher.", botao: "Avaliar o passeio" }),
  en: (a, c) => ({ oi: `Hi, ${a.primeiro}!`, texto: `Thank you for touring with us on ${a.lancha}! Tell us how it went: rate the boat and the skipper.`, linhas: [`Date: ${a.data}`, `🎁 You earned a ${c.valor} coupon to use on any boat on the Búzios Lanchas website, valid for 6 months (until ${c.ate}).`], nota: "To use the coupon, sign in on the website and, when booking, tap Use my coupon. The review takes less than a minute and helps other guests choose.", botao: "Rate the tour" }),
  es: (a, c) => ({ oi: `¡Hola, ${a.primeiro}!`, texto: `¡Gracias por pasear con nosotros en ${a.lancha}! Cuéntanos cómo fue: califica la lancha y al marinero.`, linhas: [`Fecha: ${a.data}`, `🎁 Ganaste un cupón de ${c.valor} para usar en cualquier lancha del sitio de Búzios Lanchas, válido por 6 meses (hasta ${c.ate}).`], nota: "Para usar el cupón, entra al sitio con tu cuenta y, al reservar, toca Usar mi cupón. La evaluación lleva menos de 1 minuto y ayuda a otros clientes a elegir.", botao: "Evaluar el paseo" }),
};
async function cupomDo(bid: number, cli: string) {
  const { error } = await db.rpc("gerar_cupons", { uid: cli }); // o cupom nasce no fim do passeio; garante que já existe
  if (error) console.error("cupom", error.message);
  const { data: ps } = await db.from("pedidos").select("id").eq("bloqueio_id", bid).eq("cliente", cli);
  if (!ps?.length) return null;
  const { data: c } = await db.from("cupons").select("id, valor, expira_em").in("origem_pedido", ps.map(p => p.id)).is("pedido", null).limit(1).maybeSingle();
  if (!c) return null;
  await db.from("cupons").update({ avisado_em: new Date().toISOString() }).eq("id", c.id);
  return { valor: `R$ ${Math.round(+c.valor)}`, ate: dataBR(c.expira_em) };
}

async function userByEmail(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = data.users.find(x => (x.email || "").toLowerCase() === email);
    if (u || data.users.length < 1000) return u || null;
  }
  return null;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: me } = await db.auth.getUser(token);
    const uid = me?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    if (!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data) return json({ erro: "só o administrador" }, 403);
    const { bid, lang: l0 } = await req.json().catch(() => ({}));
    const { data: b } = await db.from("bloqueios").select("id, lancha, data, horario").eq("id", bid).maybeSingle();
    if (!b) return json({ erro: "passeio" }, 404);
    if (!(await db.from("realizados").select("aconteceu").eq("bloqueio_id", b.id).eq("aconteceu", true).maybeSingle()).data) return json({ erro: "passeio não confirmado" }, 409);
    const { data: an } = await db.from("anotacoes").select("cliente, cliente_conta, telefone").eq("bloqueio_id", b.id).maybeSingle();
    let email = "", nome = an?.cliente || "";
    if (an?.cliente_conta) email = (await db.auth.admin.getUserById(an.cliente_conta)).data.user?.email?.replace(/^.*@sem-email\.lanchaembuzios\.com\.br$/, "") || ""; // conta só com WhatsApp: tenta o e-mail do convite
    if (!email) { const { data: c } = await db.from("convites").select("email, nome").eq("bloqueio_id", b.id).maybeSingle(); email = c?.email || ""; nome = c?.nome || nome; }
    email = email.trim().toLowerCase();
    if (!email) return json({ status: "sem_email" });
    const nomeL = (await db.from("lanchas").select("nome").eq("slug", b.lancha).maybeSingle()).data?.nome || b.lancha;
    const u = await userByEmail(email);
    const meta = { ...(u?.user_metadata || {}) };
    // idioma do cliente: o da conta dele; sem conta, o do DDI do WhatsApp (Rodrigo, 2026-10-22)
    const cc = String(an?.telefone || "").match(/^\s*\+(\d{1,3})\b/)?.[1];
    const ddi = cc ? (cc === "55" ? "pt" : ES_DDI.includes(cc) ? "es" : "en") : "";
    const lang = ["pt", "en", "es"].includes(meta.lang) ? meta.lang : ddi || (["pt", "en", "es"].includes(l0) ? l0 : "pt");
    const avaliar = { lancha: nomeL, data: dataBR(b.data), primeiro: (meta.nome || nome || "").split(" ")[0], lang };
    const assunto = { pt: `Avalie o seu passeio na ${nomeL}`, en: `Rate your tour on ${nomeL}`, es: `Califica tu paseo en ${nomeL}` }[lang as "pt"]; // assunto com o motivo (Rodrigo 2026-10-22)
    if (u?.email_confirmed_at) {
      const cup = await cupomDo(b.id, an?.cliente_conta || u.id).catch(e => (console.error(e), null));
      const msg = cup ? { lang, ...CUP_MSG[lang](avaliar, cup) } : null;
      if (msg) msg.oi = msg.oi.replace(/, !$/, "!"); /* sem nome: só "Olá!" */
      await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, lang, ...(msg ? { msg } : { avaliar }), assunto } });
      const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${SITE}/login/` } });
      // tira o pedido de avaliação de novo: um "entrar por link" depois volta a ser o e-mail normal
      await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, avaliar: null, msg: null, assunto: null } });
      if (error) { console.error("otp", error.message); return json({ status: "falhou", erro: error.message, email }, 502); }
      return json({ status: "enviado", email, cupom: !!cup });
    }
    const { error } = await db.auth.admin.inviteUserByEmail(email, { data: { lang, primeiro: avaliar.primeiro, avaliar, assunto }, redirectTo: `${SITE}/login/` });
    if (error) { console.error("invite", error.message); return json({ status: "falhou", erro: error.message, email }, 502); }
    return json({ status: "enviado", email });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
