// Búzios Lanchas: avisa por e-mail o marinheiro que acabou de ser cadastrado (fixo de uma lancha ou freelancer).
// POST { email, tipo: "fixo" | "freelancer", lancha?, lang }  (administrador; para o fixo, também o dono da lancha)
// O Supabase manda o e-mail do modelo "Reset password" pelo SMTP da Brevo: com user_metadata.aviso preenchido,
// o modelo vira a mensagem de boas-vindas, e o botão entra no app para a pessoa criar a senha.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const SITE = "https://www.lanchaembuzios.com.br";

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
    const { email: e0, tipo, lancha, lang: l0 } = await req.json().catch(() => ({}));
    const email = String(e0 || "").trim().toLowerCase();
    const lang = ["pt", "en", "es"].includes(l0) ? l0 : "pt";
    if (!email || !["fixo", "freelancer"].includes(tipo)) return json({ erro: "dados" }, 400);
    const admin = !!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data;
    const dono = tipo === "fixo" && !!lancha && !!(await db.from("donos").select("user_id").eq("user_id", uid).eq("lancha", lancha).maybeSingle()).data;
    if (!admin && !dono) return json({ erro: "só o administrador ou o dono" }, 403);
    const u = await userByEmail(email);
    if (!u) return json({ status: "sem_conta" }, 404);
    // só avisa quem está mesmo cadastrado nessa função
    const cad = tipo === "fixo"
      ? (await db.from("marinheiros").select("nome").eq("user_id", u.id).eq("lancha", lancha).maybeSingle()).data
      : (await db.from("freelancers").select("nome").eq("user_id", u.id).maybeSingle()).data;
    if (!cad) return json({ erro: "não cadastrado" }, 404);
    const nomeL = tipo === "fixo" ? (await db.from("lanchas").select("nome").eq("slug", lancha).maybeSingle()).data?.nome || lancha : "";
    const meta = { ...(u.user_metadata || {}) };
    const aviso = { tipo, lancha: nomeL, nome: String(cad.nome || "").split(" ")[0], lang: meta.lang || lang };
    await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, lang: aviso.lang, aviso } });
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${SITE}/login/` });
    // tira o aviso de novo: um "Esqueci minha senha" depois volta a ser o e-mail normal
    await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, aviso: null } });
    if (error) { console.error("recover", error.message); return json({ status: "falhou", erro: error.message }, 502); }
    return json({ status: "enviado" });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
