// Búzios Lanchas: ALERTA do chat da equipe (Rodrigo 2026-10-23). Lancha quebrada em alto-mar, emergência, mau tempo...
// O app grava o alerta (rpc equipe_alerta: motivo obrigatório, 1 por pessoa a cada 30 min) e chama esta função,
// que avisa no celular TODA a equipe (donos, marinheiros, vendedores, moderadores e administradores), uma vez por alerta.
// POST { id }  (com login: só quem disparou o alerta, até 5 minutos depois)
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
const CAT: Record<string, Record<string, string>> = {
  pt: { pane: "Pane / lancha com problema", emergencia: "Emergência", tempo: "Mau tempo", outro: "Alerta" },
  en: { pane: "Breakdown / boat in trouble", emergencia: "Emergency", tempo: "Bad weather", outro: "Alert" },
  es: { pane: "Avería / lancha con problemas", emergencia: "Emergencia", tempo: "Mal tiempo", outro: "Alerta" },
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = (await db.auth.getUser(token)).data?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    const { id } = await req.json().catch(() => ({}));
    const desde = new Date(Date.now() - 5 * 60000).toISOString();
    // marca uma vez só (só o autor, alerta recente e ainda não avisado)
    const { data: a } = await db.from("equipe_msgs").update({ avisado_em: new Date().toISOString() })
      .eq("id", id).eq("autor", uid).eq("tipo", "alerta").is("avisado_em", null).is("apagada_em", null).gte("criado_em", desde)
      .select("id, texto, categoria, local").maybeSingle();
    if (!a) return json({ enviados: 0 });
    const { data: ids } = await db.rpc("_eq_membros");
    const users = ((ids || []) as any[]).map(x => typeof x === "string" ? x : Object.values(x)[0] as string).filter(u => u && u !== uid);
    const nome = (await db.rpc("_eq_nome", { u: uid })).data || "";
    const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
    if (!k || !users.length) return json({ enviados: 0 });
    webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
    const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", users);
    let n = 0;
    await Promise.all((subs || []).map(async s => {
      const L = CAT[s.lang] ? s.lang : "pt";
      const m = { title: `🚨 ${CAT[L][a.categoria] || CAT[L].outro} · ${String(nome).split(" ")[0]}`, body: a.texto.slice(0, 180), url: "/login/?equipe=1", tag: `alerta-${a.id}` };
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(m), { TTL: 3600, urgency: "high" });
        n++;
      } catch (e: any) {
        console.error("push falhou", e?.statusCode, e?.body || String(e));
        if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
      }
    }));
    console.log("alerta", a.id, "enviados", n);
    return json({ enviados: n });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
