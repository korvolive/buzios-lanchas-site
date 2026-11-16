// Búzios Lanchas: "Transferir Saldo" (Rodrigo 2026-11-13). O administrador manda dinheiro do saldo da Búzios no Asaas
// para o saldo de uma pessoa que já tem conta Asaas aprovada (vendedor, marinheiro, dono, parceiro), para ela sacar.
// POST { acao: "info", user_id }                         -> { pode, nome, doc } (doc mascarado; pode = conta aprovada)
// POST { acao: "transferir", user_id, valor, motivo, req } -> { ok, valor }   (req: chave do clique, evita mandar duas vezes)
// Só administrador (sessão + tabela admins). Confere o saldo antes. A validação de saques (asaas-saques) aprova porque
// a transferência fica registrada em transferencias_saldo com o mesmo id e valor. Tudo fica na auditoria.
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
const KEY = () => Deno.env.get("ASAAS_API_KEY") || "";
const API = () => (KEY().includes("_hmlg_") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3");
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mascara = (d: unknown) => { const s = String(d ?? "").replace(/\D/g, ""); return s.length === 11 ? `***.${s.slice(3, 6)}.${s.slice(6, 9)}-**` : s.length === 14 ? `**.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-**` : ""; };
async function asaas(path: string, init: RequestInit = {}) {
  const r = await fetch(API() + path, { ...init, headers: { access_token: KEY(), "content-type": "application/json", "user-agent": "buzios-lanchas", ...(init.headers || {}) } });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.errors?.[0]?.description || "asaas " + r.status), { status: r.status });
  return j;
}

const AVISO: Record<string, (v: string, m: string) => { title: string; body: string }> = {
  pt: (v, m) => ({ title: "Você recebeu " + v, body: `A Búzios Lanchas mandou ${v} para o seu saldo: ${m}. Já dá para sacar no app.` }),
  en: (v, m) => ({ title: "You received " + v, body: `Búzios Lanchas sent ${v} to your balance: ${m}. You can withdraw it in the app.` }),
  es: (v, m) => ({ title: "Recibiste " + v, body: `Búzios Lanchas envió ${v} a tu saldo: ${m}. Ya puedes retirarlo en la app.` }),
};
async function avisar(uid: string, valor: number, motivo: string) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("https://www.lanchaembuzios.com.br", k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", uid);
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...AVISO[l](brl(valor), motivo), url: "/login/", tag: "saldo-recebido" }), { TTL: 86400, urgency: "high" }); }
    catch (_) { /* aparelho sem push: o valor aparece no app mesmo assim */ }
  }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = (await db.auth.getUser(token)).data?.user?.id;
    if (!uid) return json({ erro: "sessao" }, 401);
    if (!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data) return json({ erro: "acesso" }, 403);
    const b = await req.json().catch(() => ({}));
    const alvo = String(b.user_id || "");
    if (!/^[0-9a-f-]{36}$/.test(alvo) || alvo === uid) return json({ erro: "pessoa" }, 400);
    const { data: ct } = await db.from("asaas_contas").select("wallet_id, aprovada_em, cpf_cnpj, nome").eq("user_id", alvo).maybeSingle();
    const pode = !!(ct?.wallet_id && ct?.aprovada_em);
    const nome = String(ct?.nome || (await db.from("perfis").select("nome").eq("user_id", alvo).maybeSingle()).data?.nome || "").trim(); // nome do titular da conta Asaas
    if (b.acao === "info") return json({ pode, nome, doc: mascara(ct?.cpf_cnpj) });
    if (b.acao !== "transferir") return json({ erro: "acao" }, 400);
    if (!pode) return json({ erro: "sem_conta" }, 409);
    const valor = Math.round(+b.valor * 100) / 100, motivo = String(b.motivo || "").trim().slice(0, 140), chave = String(b.req || "").slice(0, 64);
    if (!(valor >= 1) || valor > 50000) return json({ erro: "valor" }, 400);
    if (motivo.length < 3) return json({ erro: "motivo" }, 400);
    if (chave.length < 8) return json({ erro: "req" }, 400);
    const ja = (await db.from("transferencias_saldo").select("status, valor").eq("req", chave).maybeSingle()).data;
    if (ja) return ja.status === "falhou" ? json({ erro: "falhou" }, 409) : json({ ok: true, valor: +ja.valor, repetido: true });
    const saldo = +(await asaas("/finance/balance")).balance || 0;
    if (valor > saldo) return json({ erro: "saldo", saldo }, 409);
    const { data: row, error: ei } = await db.from("transferencias_saldo").insert({ req: chave, user_id: alvo, valor, motivo, comprovante: "asaas:enviando", criado_por: uid }).select("id").single();
    if (ei) return ei.code === "23505" ? json({ ok: true, valor, repetido: true }) : json({ erro: "registro" }, 500);
    try {
      const t = await asaas("/transfers", { method: "POST", body: JSON.stringify({ value: valor, walletId: ct!.wallet_id, description: "Búzios Lanchas: " + motivo }) });
      await db.from("transferencias_saldo").update({ comprovante: "asaas:" + t.id, status: "enviado" }).eq("id", row.id);
    } catch (e: any) {
      await db.from("transferencias_saldo").update({ comprovante: null, status: "falhou", erro: String(e?.message || e).slice(0, 300) }).eq("id", row.id);
      return json({ erro: "asaas", detalhe: String(e?.message || "").slice(0, 200) }, 502);
    }
    await avisar(alvo, valor, motivo).catch(e => console.error("avisar", e));
    return json({ ok: true, valor });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
