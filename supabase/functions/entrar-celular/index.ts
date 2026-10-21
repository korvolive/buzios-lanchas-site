// Búzios Lanchas: entrar com o celular (WhatsApp) e a senha.
// Toda conta tem e-mail (confirmado por código no cadastro); aqui o celular só serve para achar a conta.
// POST { tel, senha }        -> a sessão (igual ao login por e-mail), { erro: "sem_conta" }, { erro: "senha" } ou { erro: "confirmar", email }
// POST { tel, recuperar: 1 } -> manda o e-mail de nova senha para a conta desse celular (devolve o e-mail só mascarado)
// O e-mail da conta nunca volta para quem só sabe o celular.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL_SB = Deno.env.get("SUPABASE_URL")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const dig = (x: unknown) => String(x || "").replace(/\D/g, "");
// e-mail só com o começo e o domínio (ro•••@gmail.com), para a pessoa saber onde procurar o link
const mascara = (e: string) => { const [u, d] = e.split("@"); return `${u.slice(0, 2)}•••@${d}`; };

// contas com esse celular: clientes (WhatsApp do cadastro) e equipe (perfis)
async function contas(d: string) {
  const ids = new Set<string>();
  const { data: cs } = await db.from("clientes").select("user_id, whatsapp");
  (cs || []).forEach(c => { if (dig(c.whatsapp) === d) ids.add(c.user_id); });
  const { data: ps } = await db.from("perfis").select("user_id, telefone");
  (ps || []).forEach(p => { if (dig(p.telefone) === d) ids.add(p.user_id); });
  const emails: string[] = [];
  for (const id of [...ids].slice(0, 3)) {
    const { data } = await db.auth.admin.getUserById(id);
    if (data?.user?.email) emails.push(data.user.email);
  }
  return emails;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { tel, senha, recuperar, volta } = await req.json().catch(() => ({}));
    const d = dig(tel);
    if (d.length < 10 || d.length > 15) return json({ erro: "tel" }, 400);
    const emails = await contas(d);
    if (!emails.length) return json({ erro: "sem_conta" });
    if (recuperar) {
      const to = typeof volta === "string" && volta.startsWith("https://www.lanchaembuzios.com.br/") ? volta : "https://www.lanchaembuzios.com.br/login/";
      for (const email of emails) await fetch(`${URL_SB}/auth/v1/recover?redirect_to=${encodeURIComponent(to)}`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email }) });
      return json({ ok: true, para: emails.map(mascara).join(", ") });
    }
    if (typeof senha !== "string" || !senha) return json({ erro: "senha" });
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    for (const email of emails) {
      const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json", ...(ip ? { "x-forwarded-for": ip } : {}) }, body: JSON.stringify({ email, password: senha }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.access_token) return json(j);
      if (/confirm/i.test(`${j.error_code || ""} ${j.msg || j.message || j.error_description || ""}`)) return json({ erro: "confirmar", email });
      if (r.status === 429) return json({ erro: "muitas" }, 429);
    }
    await new Promise(r => setTimeout(r, 800)); // senha errada: segura um pouco para dificultar tentativas em sequência
    return json({ erro: "senha" });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
