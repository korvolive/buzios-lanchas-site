// Búzios Lanchas: avisa no celular o administrador quando um marinheiro pede para ser vendedor (Rodrigo, 2026-10-22).
// POST {}  (o marinheiro, logo depois da rpc pedir_vendedor; só avisa se o pedido é dos últimos 10 minutos)
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const T: Record<string, (d: string) => { title: string; body: string }> = {
  pt: d => ({ title: "Pedido para ser vendedor 💼", body: `${d} quer ser vendedor do site. Toque para aprovar ou recusar.` }),
  en: d => ({ title: "Seller request 💼", body: `${d} wants to become a website seller. Tap to approve or decline.` }),
  es: d => ({ title: "Pedido para ser vendedor 💼", body: `${d} quiere ser vendedor del sitio. Toca para aprobar o rechazar.` }),
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: me } = await db.auth.getUser(token);
    const uid = me?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    const desde = new Date(Date.now() - 10 * 60e3).toISOString();
    const { data: h } = await db.from("pedidos_vendedor").select("user_id").eq("user_id", uid).is("recusado_em", null).gte("criado_em", desde).maybeSingle();
    if (!h) return json({ erro: "sem pedido recente" }, 404);
    const f = (await db.from("freelancers").select("nome").eq("user_id", uid).maybeSingle()).data;
    const m = (await db.from("marinheiros").select("nome").eq("user_id", uid).limit(1).maybeSingle()).data;
    const quem = String(f?.nome || m?.nome || me.user?.email || "Um marinheiro").split(" ").slice(0, 2).join(" ");
    const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
    if (!k) return json({ enviados: 0 });
    webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
    const { data: adm } = await db.from("admins").select("user_id");
    const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", (adm || []).map(a => a.user_id));
    let n = 0;
    for (const s of subs || []) {
      const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...T[l](quem), url: "/login/", tag: `vend-${uid}` }), { TTL: 86400 }); n++; }
      catch (e: any) { console.error("push falhou", e?.statusCode); if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
    }
    return json({ enviados: n });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
