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
    if (an?.cliente_conta) email = (await db.auth.admin.getUserById(an.cliente_conta)).data.user?.email || "";
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
    if (u?.email_confirmed_at) {
      await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, lang, avaliar } });
      const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${SITE}/login/` } });
      // tira o pedido de avaliação de novo: um "entrar por link" depois volta a ser o e-mail normal
      await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, avaliar: null } });
      if (error) { console.error("otp", error.message); return json({ status: "falhou", erro: error.message, email }, 502); }
      return json({ status: "enviado", email });
    }
    const { error } = await db.auth.admin.inviteUserByEmail(email, { data: { lang, primeiro: avaliar.primeiro, avaliar }, redirectTo: `${SITE}/login/` });
    if (error) { console.error("invite", error.message); return json({ status: "falhou", erro: error.message, email }, 502); }
    return json({ status: "enviado", email });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
