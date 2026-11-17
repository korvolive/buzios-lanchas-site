// Búzios Lanchas: link para entrar, gerado pelo administrador (2026-11-16: dono esqueceu a senha).
// POST { user_id } com o token do administrador -> { link }: link de uso único (expira como o e-mail de nova senha)
// que abre o app já na tela "Criar senha nova". O administrador manda pelo WhatsApp; a pessoa não precisa de e-mail.
// Quem pode: só administrador logado (tabela admins). Não gera link para outro administrador.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const VOLTA = "https://www.lanchaembuzios.com.br/login/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  try {
    const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const quem = tok ? (await db.auth.getUser(tok)).data?.user?.id : null;
    const adm = quem ? (await db.from("admins").select("user_id").eq("user_id", quem).maybeSingle()).data : null;
    if (!adm) return json({ erro: "proibido" }, 403);
    const { user_id } = await req.json().catch(() => ({}));
    if (typeof user_id !== "string" || !UUID.test(user_id) || user_id === quem) return json({ erro: "pessoa" }, 400);
    if ((await db.from("admins").select("user_id").eq("user_id", user_id).maybeSingle()).data) return json({ erro: "proibido" }, 403);
    const { data: u } = await db.auth.admin.getUserById(user_id);
    const email = u?.user?.email;
    if (!email) return json({ erro: "sem_conta" }, 404);
    if (u.user.banned_until && new Date(u.user.banned_until) > new Date()) return json({ erro: "bloqueado" }, 409);
    const { data: lk, error } = await db.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: VOLTA } });
    if (error || !lk?.properties?.action_link) { console.error("acesso-link", error?.message); return json({ erro: "falhou" }, 500); }
    console.log("acesso-link gerado", { por: quem, para: user_id }); // só ids, sem dados pessoais
    // regra 11 do SEGURANCA.md: mudança de acesso fica na auditoria (quem gerou, para quem, quando)
    await db.from("auditoria").insert({ tabela: "auth.users", operacao: "LINK_NOVA_SENHA", registro: user_id, quem, depois: { por: quem, para: user_id } }).then(() => {}, () => {});
    return json({ link: lk.properties.action_link });
  } catch (e) {
    console.error("acesso-link", (e as Error).message);
    return json({ erro: "falhou" }, 500);
  }
});
