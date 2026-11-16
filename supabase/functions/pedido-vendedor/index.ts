// Búzios Lanchas: avisa no celular o administrador quando um marinheiro pede para ser vendedor (Rodrigo, 2026-10-22).
// POST {}  (o marinheiro, logo depois da rpc pedir_vendedor; só avisa se o pedido é dos últimos 10 minutos)
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// iPhone (app da loja): aparelhos "apns:<token>" vão direto para a Apple (chave .p8 nos segredos APNS_*). Antes só notificar e
// aviso-aprovacao mandavam; nas outras funções o envio falhava calado e o iPhone ficava sem aviso (revisão geral 2026-11-16).
{
  const wp = webpush.sendNotification.bind(webpush);
  let jwt: { t: string; em: number } | null = null;
  const tok = async () => {
    if (jwt && Date.now() - jwt.em < 50 * 60e3) return jwt.t;
    const pem = (Deno.env.get("APNS_KEY_P8") || "").replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
    const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const enc = (o: unknown) => b64u(new TextEncoder().encode(JSON.stringify(o)));
    const head = `${enc({ alg: "ES256", kid: Deno.env.get("APNS_KEY_ID") })}.${enc({ iss: Deno.env.get("APNS_TEAM_ID"), iat: Math.floor(Date.now() / 1000) })}`;
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(head)));
    jwt = { t: `${head}.${b64u(sig)}`, em: Date.now() };
    return jwt.t;
  };
  // deno-lint-ignore no-explicit-any
  (webpush as any).sendNotification = async (s: any, payload?: any, o?: any) => {
    if (!String(s?.endpoint || "").startsWith("apns:")) return wp(s, payload, o);
    let m: any = {}; try { m = typeof payload === "string" ? JSON.parse(payload) : (payload || {}); } catch (_) { m = { body: String(payload || "") }; }
    const r = await fetch(`https://api.push.apple.com/3/device/${String(s.endpoint).slice(5)}`, {
      method: "POST",
      headers: { authorization: `bearer ${await tok()}`, "apns-topic": "br.com.lanchaembuzios.app", "apns-push-type": "alert", "apns-priority": "10", ...(m.tag ? { "apns-collapse-id": String(m.tag).slice(0, 64) } : {}) },
      body: JSON.stringify({ aps: { alert: { title: m.title || "Búzios Lanchas", body: m.body || "" }, sound: "default" }, url: m.url || "/" }),
    });
    if (r.ok) return { statusCode: r.status };
    const t = await r.text();
    // aparelho que saiu do app: 410 para quem chamou apagar a inscrição, como no Web Push
    throw Object.assign(new Error(t), { statusCode: /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(t) ? 410 : r.status, body: t });
  };
}

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
