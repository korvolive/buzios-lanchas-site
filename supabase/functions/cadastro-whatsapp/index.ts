// Búzios Lanchas: conta só com o WhatsApp, sem e-mail (Rodrigo, 2026-10-23).
// O cliente confirma o celular com um código de 6 números no WhatsApp oficial; o e-mail fica opcional.
// Por dentro, a conta ganha um e-mail que não existe (wa<celular>@sem-email.lanchaembuzios.com.br): ninguém manda nada para ele.
// POST { acao: "status" }                                   -> { ativo }
// POST { acao: "enviar", tel, lang, para: "cadastro"|"senha" } -> { ok } | { erro: "ja_tem" | "sem_conta" | "espere" | "limite" | "tel" | "nao_configurado" | "envio" }
// POST { acao: "criar", tel, codigo, senha, nome, cpf, whatsapp, nascimento, lang } -> a sessão | { erro: "codigo" | "tentativas" | "ja_tem" | "tel_ja" | "cpf_ja" | "cpf" | "dados" }
// POST { acao: "trocar", tel, codigo, senha }               -> a sessão | { erro: "codigo" | "tentativas" | "sem_conta" | "dados" }
// POST { acao: "email", novo } (logado, conta sem e-mail)   -> { ok } (manda o código de confirmação para o e-mail novo) | { erro: "email" | "usado" | "tem_email" }
// POST { acao: "email_cancelar" } (logado)                  -> { ok } (volta a conta para sem e-mail, se o novo não foi confirmado)
// POST { acao: "juntar_enviar", tel, lang } (logado, conta sem cadastro de cliente) -> { ok } manda o código para o WhatsApp de outra conta
// POST { acao: "juntar", tel, codigo }   (logado) -> a sessão da conta do WhatsApp, agora com o e-mail desta (a conta vazia é apagada)
//                                            | { erro: "tem_email", email } (a outra conta já tem um e-mail de verdade)
// POST { acao: "lead_enviar", tel, lang } -> { ok } | { ok, ja } | { erro: "ja_tem" | "sem_lead" | ... }  quem entrou pelo link de vendedor/parceiro
//                                            (o site já gravou o contato com criar_lead_vendedor) pede o código para liberar os valores
// POST { acao: "lead", tel, codigo, cod } -> { ok } marca vendedor_leads.wa_ok_em (WhatsApp confirmado: o contato fica 12 meses com o vendedor do código cod)
// Segredos: WA_TOKEN, WA_PHONE_ID, WA_ATIVO=1 (os mesmos da whatsapp-codigo).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL_SB = Deno.env.get("SUPABASE_URL")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const TOKEN = Deno.env.get("WA_TOKEN") || "", PHONE = Deno.env.get("WA_PHONE_ID") || "", TEMPLATE = Deno.env.get("WA_TEMPLATE") || "codigo_verificacao";
const ATIVO = !!(TOKEN && PHONE && Deno.env.get("WA_ATIVO") === "1");
const LANG: Record<string, string> = { pt: "pt_BR", en: "en", es: "es" };
const SEM = "@sem-email.lanchaembuzios.com.br";
const dig = (s: unknown) => String(s || "").replace(/\D/g, "");
const VALIDO_MIN = 10;

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function codigo6() {
  const a = new Uint32Array(1); crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, "0");
}
const contas = async (t: string) => ((await db.rpc("conta_do_celular", { t })).data || []) as { user_id: string; cliente: boolean; wa_ok: boolean }[];
const sessao = async (email: string, password: string) => {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  return r.json().catch(() => ({}));
};
async function mandaCodigo(t: string, para: string, lang: string) {
  const { data: res } = await db.rpc("wa_reservar_tel", { t }).maybeSingle();
  if (!res) {
    const { data: w } = await db.from("wa_cadastro").select("ultimo_envio").eq("tel_dig", t).maybeSingle();
    return json({ erro: w && Date.now() - new Date(w.ultimo_envio).getTime() < 60000 ? "espere" : "limite" }, 429);
  }
  const cod = codigo6();
  const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE}/messages`, {
    method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: t, type: "template", template: { name: TEMPLATE, language: { code: LANG[lang] || "pt_BR" },
      components: [{ type: "body", parameters: [{ type: "text", text: cod }] }, { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: cod }] }] } }),
  });
  if (!r.ok) { console.error("whatsapp", r.status, (await r.text()).slice(0, 400)); return json({ erro: "envio" }, 502); }
  await db.from("wa_cadastro").update({ hash: await sha(`${t}:${cod}:${para}`), expira_em: new Date(Date.now() + VALIDO_MIN * 60000).toISOString(), tentativas: 0 }).eq("tel_dig", t);
  return json({ ok: true });
}
// confere o código (no máximo 5 tentativas, contadas no banco antes de conferir)
async function confere(t: string, codigo: unknown, para: string) {
  const { data: w } = await db.rpc("wa_tentativa_tel", { t }).maybeSingle();
  if (!w) return "tentativas";
  if (!w.hash || (await sha(`${t}:${dig(codigo)}:${para}`)) !== w.hash) return "codigo";
  await db.from("wa_cadastro").update({ expira_em: new Date().toISOString(), tentativas: 5 }).eq("tel_dig", t);
  return "";
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    if (b.acao === "status") return json({ ativo: ATIVO });

    // ----- conta logada sem e-mail: colocar um e-mail (com confirmação por código) ou desistir dele
    if (b.acao === "email" || b.acao === "email_cancelar") {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const u = (await db.auth.getUser(token)).data?.user;
      if (!u) return json({ erro: "login" }, 401);
      const { data: c } = await db.from("clientes").select("whatsapp, whatsapp_ok_em").eq("user_id", u.id).maybeSingle();
      const semEmail = (u.email || "").endsWith(SEM), pend = !!u.user_metadata?.email_pendente;
      if (b.acao === "email_cancelar") {
        if (pend && !u.email_confirmed_at && c?.whatsapp_ok_em)
          await db.auth.admin.updateUserById(u.id, { email: `wa${dig(c.whatsapp)}${SEM}`, email_confirm: true, user_metadata: { email_pendente: null } });
        return json({ ok: true });
      }
      if (!semEmail && !pend) return json({ erro: "tem_email" });
      const novo = String(b.novo || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(novo) || novo.endsWith(SEM)) return json({ erro: "email" });
      const { error } = await db.auth.admin.updateUserById(u.id, { email: novo, email_confirm: false, user_metadata: { email_pendente: true } });
      if (error) return json({ erro: /already|registered|exists/i.test(error.message) ? "usado" : "email" });
      await db.rpc("email_desconfirmar", { u: u.id }); // só vale depois do código
      // o código chega pelo modelo "Confirm signup" (o mesmo do cadastro com e-mail)
      await fetch(`${URL_SB}/auth/v1/resend`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ type: "signup", email: novo }) });
      return json({ ok: true, email: novo });
    }

    if (!ATIVO) return json({ erro: "nao_configurado" }, 503);
    const t = dig(b.tel);
    if (t.length < 10 || t.length > 15) return json({ erro: "tel" }, 400);

    if (b.acao === "enviar") {
      const para = b.para === "senha" ? "senha" : "cadastro", acc = await contas(t);
      if (para === "cadastro" && acc.length) return json({ erro: "ja_tem" });
      if (para === "senha" && !acc.some(a => a.cliente && a.wa_ok)) return json({ erro: "sem_conta" });
      return await mandaCodigo(t, para, b.lang);
    }

    // ----- link de vendedor/parceiro: confirmar o WhatsApp para ver os valores com desconto (Rodrigo 2026-10-26).
    // O código só sai quando o próprio cliente pede (os limites de wa_reservar_tel valem aqui também).
    if (b.acao === "lead_enviar" || b.acao === "lead") {
      const { data: l } = await db.from("vendedor_leads").select("*").eq("telefone", t).eq("origem", "link").maybeSingle(); // sem confirmar, o contato some em 24 h (cron leads-24h)
      if (!l) return json({ erro: "sem_lead" }, 400);
      if (b.acao === "lead_enviar") {
        if ((await contas(t)).some(a => a.cliente)) return json({ erro: "ja_tem" });
        if (l.wa_ok_em) return json({ ok: true, ja: true });
        return await mandaCodigo(t, "lead", b.lang);
      }
      const e = await confere(t, b.codigo, "lead"); if (e) return json({ erro: e }, e === "tentativas" ? 429 : 400);
      const upd: Record<string, unknown> = { wa_ok_em: new Date().toISOString() };
      // contato ainda sem confirmar: fica com o vendedor do link onde o cliente confirmou (Rodrigo 2026-10-26)
      if (!l.wa_ok_em && b.cod) {
        const { data: v } = await db.from("vendedores").select("user_id").eq("codigo", String(b.cod).trim().toUpperCase()).eq("ativo", true).maybeSingle();
        if (v && v.user_id !== l.vendedor) upd.vendedor = v.user_id;
      }
      await db.from("vendedor_leads").update(upd).eq("id", l.id);
      return json({ ok: true });
    }

    // ----- entrou pelo Google (ou outro e-mail) com o WhatsApp de uma conta que já existe: junta as duas (Rodrigo 2026-10-23)
    if (b.acao === "juntar_enviar" || b.acao === "juntar") {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const g = (await db.auth.getUser(token)).data?.user;
      if (!g) return json({ erro: "login" }, 401);
      const gEmail = (g.email || "").toLowerCase();
      if (!g.email_confirmed_at || !gEmail || gEmail.endsWith(SEM)) return json({ erro: "dados" }, 400);
      if ((await db.from("clientes").select("user_id").eq("user_id", g.id).maybeSingle()).data) return json({ erro: "dados" }, 400); // só conta vazia
      for (const tb of ["admins", "donos", "perfis", "vendedores", "marinheiros", "freelancers"]) // conta de equipe nunca é apagada aqui
        if ((await db.from(tb).select("user_id").eq("user_id", g.id).limit(1).maybeSingle()).data) return json({ erro: "dados" }, 400);
      const o = (await contas(t)).find(a => a.cliente && a.user_id !== g.id);
      if (!o) return json({ erro: "sem_conta" });
      if (b.acao === "juntar_enviar") return await mandaCodigo(t, "juntar", b.lang);
      const e = await confere(t, b.codigo, "juntar"); if (e) return json({ erro: e }, e === "tentativas" ? 429 : 400);
      const ou = (await db.auth.admin.getUserById(o.user_id)).data.user;
      if (!ou) return json({ erro: "sem_conta" });
      const oEmail = (ou.email || "").toLowerCase();
      if (ou.email_confirmed_at && !oEmail.endsWith(SEM) && oEmail !== gEmail) // já tem e-mail de verdade: entra com ele
        return json({ erro: "tem_email", email: oEmail.replace(/^(.{2})[^@]*/, "$1***") });
      const { error: de } = await db.auth.admin.deleteUser(g.id); // libera o e-mail; o Google passa a cair na conta antiga
      if (de) { console.error("juntar delete", de.message); return json({ erro: "falhou" }, 500); }
      const { error: ue } = await db.auth.admin.updateUserById(ou.id, { email: gEmail, email_confirm: true, user_metadata: { ...(ou.user_metadata || {}), email_pendente: null, sem_email: null } });
      if (ue) { console.error("juntar update", ue.message); return json({ erro: "falhou" }, 500); }
      await db.from("clientes").update({ whatsapp_ok_em: new Date().toISOString() }).eq("user_id", ou.id); // o código confirmou o WhatsApp
      const { data: lk, error: le } = await db.auth.admin.generateLink({ type: "magiclink", email: gEmail });
      if (le || !lk?.properties?.hashed_token) { console.error("juntar link", le?.message); return json({ erro: "falhou" }, 500); }
      const r = await fetch(`${URL_SB}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: lk.properties.hashed_token }) });
      return json(await r.json().catch(() => ({ erro: "falhou" })));
    }

    if (b.acao === "criar") {
      const nome = String(b.nome || "").replace(/\s+/g, " ").trim(), senha = String(b.senha || ""), cpf = dig(b.cpf) || null, nasc = String(b.nascimento || "");
      const whatsapp = String(b.whatsapp || "").trim();
      if (nome.length < 5 || !nome.includes(" ") || senha.length < 6 || !/^\d{4}-\d{2}-\d{2}$/.test(nasc) || dig(whatsapp) !== t) return json({ erro: "dados" }, 400);
      const e = await confere(t, b.codigo, "cadastro"); if (e) return json({ erro: e }, e === "tentativas" ? 429 : 400);
      if ((await contas(t)).length) return json({ erro: "ja_tem" });
      const email = `wa${t}${SEM}`;
      const { data: nu, error } = await db.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { lang: b.lang || "pt", full_name: nome, sem_email: true } });
      if (error || !nu?.user) return json({ erro: /already|registered|exists/i.test(error?.message || "") ? "ja_tem" : "falhou" }, 400);
      const { error: ce } = await db.from("clientes").insert({ user_id: nu.user.id, nome, cpf, whatsapp, nascimento: nasc, whatsapp_ok_em: new Date().toISOString() });
      if (ce) {
        await db.auth.admin.deleteUser(nu.user.id);
        return json({ erro: ce.code === "23505" ? (/whatsapp/i.test(ce.message) ? "tel_ja" : "cpf_ja") : /check|cpf/i.test(ce.message) ? "cpf" : "dados" }, 400);
      }
      return json(await sessao(email, senha));
    }

    if (b.acao === "trocar") {
      const senha = String(b.senha || "");
      if (senha.length < 6) return json({ erro: "dados" }, 400);
      const e = await confere(t, b.codigo, "senha"); if (e) return json({ erro: e }, e === "tentativas" ? 429 : 400);
      const a = (await contas(t)).find(x => x.cliente && x.wa_ok);
      if (!a) return json({ erro: "sem_conta" });
      const { data: u } = await db.auth.admin.updateUserById(a.user_id, { password: senha, ...((await db.auth.admin.getUserById(a.user_id)).data.user?.email_confirmed_at ? {} : { email: `wa${t}${SEM}`, email_confirm: true, user_metadata: { email_pendente: null } }) });
      return json(await sessao(u.user?.email || "", senha));
    }
    return json({ erro: "acao" }, 400);
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
