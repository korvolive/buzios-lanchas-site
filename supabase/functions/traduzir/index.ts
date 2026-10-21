// Búzios Lanchas: tradução automática dos textos de uma lancha nova (português -> inglês e espanhol).
// POST { textos: string[] }  ->  { en: string[], es: string[] }   (só administrador)
// Usa o tradutor público do Google; se falhar, o MyMemory. O administrador pode corrigir o resultado no app.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

async function google(q: string, to: string) {
  const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=${to}&dt=t&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("google " + r.status);
  const j = await r.json();
  return (j[0] as [string][]).map(p => p[0]).join("");
}
async function mymemory(q: string, to: string) {
  const r = await fetch(`https://api.mymemory.translated.net/get?langpair=pt-BR|${to === "en" ? "en-US" : "es-ES"}&q=${encodeURIComponent(q)}`);
  const j = await r.json();
  if (j.responseStatus !== 200) throw new Error("mymemory " + j.responseStatus);
  return j.responseData.translatedText as string;
}
const one = async (q: string, to: string) => !q.trim() ? "" : await google(q, to).catch(() => mymemory(q, to)).catch(() => "");

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const auth = req.headers.get("authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { authorization: auth } }, auth: { persistSession: false } });
    const { data: admin } = await sb.rpc("e_admin");
    if (admin !== true) return json({ error: "so_admin" }, 403);
    const { textos } = await req.json();
    if (!Array.isArray(textos) || textos.length > 10 || textos.some(x => typeof x !== "string" || x.length > 3000)) return json({ error: "textos" }, 400);
    const [en, es] = await Promise.all(["en", "es"].map(to => Promise.all(textos.map(q => one(q, to)))));
    return json({ en, es });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
