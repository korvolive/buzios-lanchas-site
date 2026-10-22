// Búzios Lanchas: tradução automática do chat (Rodrigo, 2026-10-22). Cada mensagem aparece no idioma de quem lê;
// quem não quiser desliga no botão "Traduzir" do chat. As traduções ficam guardadas em mensagens_trad (uma vez por idioma).
// POST { cid, ids: number[], para: "pt"|"en"|"es" }  ->  { [id]: { t, de } }   (só quem participa da conversa)
// Usa o tradutor público do Google (detecta o idioma); se falhar, a mensagem fica como está.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

async function google(q: string, to: string) {
  const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("google " + r.status);
  const j = await r.json();
  return { t: (j[0] as [string][]).map(p => p[0]).join(""), de: String(j[2] || "").slice(0, 2) };
}

// mesma regra do banco (public.participa), chamada com o login de quem pede (auditoria de segurança 2026-10-22)
async function participa(token: string, cid: number) {
  const u = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await u.rpc("participa", { cid });
  if (error) { console.error("participa", error.message); return false; }
  return data === true;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = (await db.auth.getUser(token)).data?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    const { cid, ids, para } = await req.json().catch(() => ({}));
    if (!["pt", "en", "es"].includes(para) || !Array.isArray(ids) || !ids.length || ids.length > 40) return json({ erro: "dados" }, 400);
    if (!(await participa(token, Number(cid)))) return json({ erro: "acesso" }, 403);
    const { data: ms } = await db.from("mensagens").select("id, texto").eq("conversa", Number(cid)).in("id", ids.map(Number)).not("autor", "is", null).is("apagada_em", null).is("anexo", null);
    const out: Record<number, { t: string; de: string }> = {};
    if (!ms?.length) return json(out);
    const { data: cache } = await db.from("mensagens_trad").select("mensagem, texto, de").eq("lang", para).in("mensagem", ms.map(m => m.id));
    for (const c of cache || []) out[c.mensagem] = { t: c.texto, de: c.de || "" };
    const falta = ms.filter(m => !out[m.id] && m.texto?.trim());
    await Promise.all(falta.map(async m => {
      try {
        const r = await google(m.texto, para);
        out[m.id] = r;
        await db.from("mensagens_trad").upsert({ mensagem: m.id, lang: para, texto: r.t, de: r.de }, { onConflict: "mensagem,lang" });
      } catch (e) { console.error("traduzir", m.id, String(e)); }
    }));
    return json(out);
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
