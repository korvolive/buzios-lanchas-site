// Búzios Lanchas: o que falta na conta Asaas de uma pessoa (Rodrigo 2026-11-15).
// POST { user_id } -> { geral, dados, documentos, docs: [{ tipo, status, link }] }  (situação no Asaas, sem links nem dados pessoais)
// POST { lembrar: true } (robô, 1 vez por dia) -> push para quem ainda não enviou o documento e a selfie, até concluir
// POST { todos: true } -> { contas: [{ user_id, nome, ...situação }] }              (todas as contas ainda não aprovadas)
// Quem pode: administrador logado (tabela admins) ou o robô (x-chave = resgate_config.chave). Só leitura no Asaas.
// Se o Asaas já aprovou, marca aprovada_em (o robô de 10 em 10 minutos avisaria a pessoa do mesmo jeito).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const KEY = () => Deno.env.get("ASAAS_API_KEY") || "";
const API = () => (KEY().includes("_hmlg_") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3");
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-chave", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const de64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function segredo() {
  const s = Deno.env.get("ASAAS_CHAVES_SEGREDO") || "";
  if (s.length < 32) throw new Error("sem_segredo");
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)), "AES-GCM", false, ["decrypt"]);
}
async function chaveSub(uid: string) {
  const { data: k } = await db.from("asaas_chaves").select("api_key").eq("user_id", uid).maybeSingle();
  const [v, iv, ct] = String(k?.api_key || "").split(":");
  if (v !== "v1" || !iv || !ct) return "";
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: de64(iv) }, await segredo(), de64(ct))); }
  catch (e) { console.error("chaveSub", uid, e); return ""; }
}
async function situacao(uid: string) {
  const k = await chaveSub(uid);
  if (!k) return { geral: null, sem_chave: true, docs: [] };
  const h = { headers: { access_token: k, "user-agent": "buzios-lanchas" } };
  const st: any = await fetch(API() + "/myAccount/status", h).then((x) => x.json()).catch(() => ({}));
  const dc: any = await fetch(API() + "/myAccount/documents", h).then((x) => x.json()).catch(() => ({}));
  const docs = (dc?.data || []).map((d: any) => ({ tipo: d.type, status: d.status, link: !!d.onboardingUrl }));
  if (st?.general === "APPROVED") await db.from("asaas_contas").update({ aprovada_em: new Date().toISOString() }).eq("user_id", uid).is("aprovada_em", null);
  return { geral: st?.general || null, dados: st?.commercialInfo || null, documentos: st?.documentation || null, conta_bancaria: st?.bankAccountInfo || null, docs };
}

const LEMBRA: Record<string, { title: string; body: string }> = {
  pt: { title: "Falta só o documento e a selfie", body: "Abra o app e toque em Enviar documento e selfie. Leva 2 minutos e libera a sua conta para receber direto." },
  en: { title: "Just your ID and selfie left", body: "Open the app and tap Send ID and selfie. It takes 2 minutes and unlocks your account to get paid directly." },
  es: { title: "Solo falta el documento y la selfie", body: "Abre la app y toca Enviar documento y selfie. Toma 2 minutos y libera tu cuenta para cobrar directo." },
};
async function lembrar(uids: string[]) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k || !uids.length) return 0;
  webpush.setVapidDetails("https://www.lanchaembuzios.com.br", k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", uids);
  let n = 0;
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...LEMBRA[l], url: "/login/", tag: "docs-lembrete" }), { TTL: 43200, urgency: "normal" }); n++; }
    catch (_) { /* aparelho sem push: a janela do app continua pedindo */ }
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  try {
    const ch = req.headers.get("x-chave") || "";
    let ok = false;
    if (ch) ok = ch === String((await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle()).data?.chave || "\u0000");
    else {
      const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const uid = tok ? (await db.auth.getUser(tok)).data?.user?.id : null;
      ok = !!uid && !!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data;
    }
    if (!ok) return json({ erro: "acesso" }, 403);
    const b = await req.json().catch(() => ({}));
    if (b.lembrar === true) {
      if (!ch) return json({ erro: "acesso" }, 403); // só o robô
      const { data: cs } = await db.from("asaas_contas").select("user_id").is("aprovada_em", null).limit(30);
      const falta: string[] = [];
      for (const c of cs || []) { const s = await situacao(c.user_id); if (s.geral !== "APPROVED" && (s.docs || []).some((d: any) => ["NOT_SENT", "REJECTED"].includes(d.status) && d.link)) falta.push(c.user_id); }
      return json({ pessoas: falta.length, avisos: await lembrar(falta) });
    }
    if (b.todos === true) {
      const { data: cs } = await db.from("asaas_contas").select("user_id, nome, criado_em").is("aprovada_em", null).order("criado_em").limit(30);
      const contas = [];
      for (const c of cs || []) contas.push({ user_id: c.user_id, nome: c.nome, criado_em: c.criado_em, ...(await situacao(c.user_id)) });
      return json({ contas });
    }
    const alvo = String(b.user_id || "");
    if (!/^[0-9a-f-]{36}$/.test(alvo)) return json({ erro: "pessoa" }, 400);
    if (!(await db.from("asaas_contas").select("user_id").eq("user_id", alvo).maybeSingle()).data) return json({ status: "sem_conta" });
    return json(await situacao(alvo));
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
