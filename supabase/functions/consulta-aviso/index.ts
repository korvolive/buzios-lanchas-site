// Búzios Lanchas: consulta rápida que não virou conversa (Rodrigo 2026-10-23).
// O site chama logo depois de salvar os dados da janelinha. Os administradores recebem na hora o aviso de
// consulta nova (Rodrigo 2026-10-24). Se em 60 segundos o cliente não tocar em "Chamar no WhatsApp",
// recebem outro aviso para chamar ele. (2026-11-17: aviso imediato desligado a pedido do Rodrigo; fica só o de 60 s.)
// POST { k: <chave da consulta> }  (sem login: só age numa consulta existente, uma vez por consulta)
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
const SLOT: Record<string, Record<string, string>> = {
  pt: { manha: "manhã", tarde: "tarde", dia: "dia inteiro", noite: "noite" },
  en: { manha: "morning", tarde: "afternoon", dia: "full day", noite: "night" },
  es: { manha: "mañana", tarde: "tarde", dia: "día completo", noite: "noche" },
};
const dataBR = (d: string) => d.split("-").reverse().join("/");
const TXT: Record<string, (c: any) => { title: string; body: string }> = {
  pt: c => ({ title: "Cliente interessado não chamou no WhatsApp", body: `${c.nome} · ${c.lancha} · ${dataBR(c.data)} · ${SLOT.pt[c.horario] || c.horario}${c.pessoas ? ` · ${c.pessoas} pessoas` : ""}. Toque para chamar ele.` }),
  en: c => ({ title: "Interested client didn't message on WhatsApp", body: `${c.nome} · ${c.lancha} · ${dataBR(c.data)} · ${SLOT.en[c.horario] || c.horario}${c.pessoas ? ` · ${c.pessoas} people` : ""}. Tap to reach out.` }),
  es: c => ({ title: "Cliente interesado no escribió por WhatsApp", body: `${c.nome} · ${c.lancha} · ${dataBR(c.data)} · ${SLOT.es[c.horario] || c.horario}${c.pessoas ? ` · ${c.pessoas} personas` : ""}. Toca para contactarlo.` }),
};
const NOVA: Record<string, (c: any) => { title: string; body: string }> = {
  pt: c => ({ title: "📩 Consulta nova de disponibilidade", body: `${c.nome} · ${c.lancha} · ${dataBR(c.data)} · ${SLOT.pt[c.horario] || c.horario}${c.pessoas ? ` · ${c.pessoas} pessoas` : ""}` }),
  en: c => ({ title: "📩 New availability request", body: `${c.nome} · ${c.lancha} · ${dataBR(c.data)} · ${SLOT.en[c.horario] || c.horario}${c.pessoas ? ` · ${c.pessoas} people` : ""}` }),
  es: c => ({ title: "📩 Nueva consulta de disponibilidad", body: `${c.nome} · ${c.lancha} · ${dataBR(c.data)} · ${SLOT.es[c.horario] || c.horario}${c.pessoas ? ` · ${c.pessoas} personas` : ""}` }),
};
const CONSULTA_NOVA_PUSH = false;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function push(c: any, txt: typeof TXT, tag: string) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const lancha = (await db.from("lanchas").select("nome").eq("slug", c.lancha).maybeSingle()).data?.nome || c.lancha;
  const { data: ads } = await db.from("admins").select("user_id");
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", (ads || []).map(a => a.user_id));
  await Promise.all((subs || []).map(async s => {
    const m = (txt[s.lang] || txt.pt)({ ...c, lancha });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url: "/login/?consulta=" + c.id, tag: `${tag}-${c.id}` }), { TTL: 86400, urgency: "high" });
      console.log("push ok", tag, c.id);
    } catch (e: any) {
      console.error("push falhou", e?.statusCode, e?.body || String(e));
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }));
}

async function avisar(c: any) {
  // Rodrigo 2026-11-17: o aviso imediato de "Consulta nova de disponibilidade" virou flood no celular dele
  // (ele já acompanha pelo WhatsApp). Desligado. A consulta continua aparecendo no painel, e os avisos de
  // aprovação (aviso-aprovacao) e de sinal pago seguem iguais. Para religar: CONSULTA_NOVA_PUSH = true.
  if (CONSULTA_NOVA_PUSH) await push(c, NOVA, "consulta-nova").catch(e => console.error(e));
  if (c.chamou) return;
  await new Promise(r => setTimeout(r, 60_000));
  // ainda não chamou? marca como avisada (uma vez só) e manda o aviso
  const { data: x } = await db.from("consultas").update({ avisado_em: new Date().toISOString() }).eq("id", c.id).eq("chamou", false).is("avisado_em", null).select("id, nome, lancha, data, horario, pessoas").maybeSingle();
  if (x) await push(x, TXT, "consulta");
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { k } = await req.json().catch(() => ({}));
    if (typeof k !== "string" || !UUID.test(k)) return json({ ok: false }, 400);
    // trava contra abuso: no máximo 20 avisos por hora para os administradores
    const hora = new Date(Date.now() - 3600e3).toISOString();
    const { count } = await db.from("consultas").select("id", { count: "exact", head: true }).gte("agendado_em", hora);
    if ((count ?? 0) >= 20) return json({ ok: true, agendado: false });
    // marca uma vez só: chamadas repetidas não geram outro aviso
    const { data: c } = await db.from("consultas").update({ agendado_em: new Date().toISOString() }).eq("chave", k).is("agendado_em", null).select("id, nome, lancha, data, horario, pessoas, chamou").maybeSingle();
    if (!c) return json({ ok: true, agendado: false });
    // @ts-ignore EdgeRuntime existe no Supabase
    EdgeRuntime.waitUntil(avisar(c).catch(e => console.error(e)));
    return json({ ok: true, agendado: true });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
