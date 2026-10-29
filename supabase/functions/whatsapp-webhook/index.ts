// Búzios Lanchas: resposta automática do número oficial de avisos (21) 99501-0203 (Rodrigo, 2026-10-29).
// Esse número só manda avisos (códigos, passeio registrado, pagamento liberado). Quando alguém escreve nele,
// respondemos uma vez a cada 12 horas por número: "este número só envia avisos, fale no (21) 99927-2550", com botão para /falar/.
// Resposta dentro da conversa aberta pelo cliente: não usa modelo e não é cobrada.
// Segurança: o POST só é aceito com a assinatura X-Hub-Signature-256 da Meta (segredo WA_APP_SECRET, a chave secreta do app,
// colada pelo Rodrigo). Sem o segredo ou com assinatura errada, nada é enviado. Não lê nem guarda o texto das mensagens.
// GET  hub.mode=subscribe&hub.verify_token&hub.challenge   cadastro do webhook na Meta (segredo WA_VERIFY_TOKEN)
// POST evento "messages" da Meta
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const WA_TOKEN = Deno.env.get("WA_TOKEN") || "", WA_PHONE = Deno.env.get("WA_PHONE_ID") || "", WA_ON = Deno.env.get("WA_ATIVO") === "1";
const SECRET = Deno.env.get("WA_APP_SECRET") || "", VERIFY = Deno.env.get("WA_VERIFY_TOKEN") || "";
const SITE = "https://www.lanchaembuzios.com.br";
const ES_DDI = ["34", "51", "52", "53", "54", "56", "57", "58", "502", "503", "504", "505", "506", "507", "591", "593", "595", "598"];
const TXT: Record<string, { body: string; btn: string }> = {
  pt: { body: "Olá! Este número da Búzios Lanchas só envia avisos automáticos e não recebe mensagens. 🙂\n\nPara falar com a gente, chame no WhatsApp (21) 99927-2550 pelo botão abaixo.", btn: "Falar no WhatsApp" },
  en: { body: "Hi! This Búzios Lanchas number only sends automatic notices and can't receive messages. 🙂\n\nTo talk to us, message +55 21 99927-2550 on WhatsApp using the button below.", btn: "Chat on WhatsApp" },
  es: { body: "¡Hola! Este número de Búzios Lanchas solo envía avisos automáticos y no recibe mensajes. 🙂\n\nPara hablar con nosotros, escríbenos al WhatsApp +55 21 99927-2550 con el botón de abajo.", btn: "Hablar por WhatsApp" },
};
const langOf = (to: string) => to.startsWith("55") ? "pt" : ES_DDI.some(d => to.startsWith(d)) ? "es" : "en";

async function assinaturaOk(raw: string, h: string | null) {
  if (!SECRET || !h || !h.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = Array.from(mac, b => b.toString(16).padStart(2, "0")).join("");
  const got = h.slice(7).toLowerCase();
  if (got.length !== hex.length) return false;
  let d = 0; for (let i = 0; i < hex.length; i++) d |= hex.charCodeAt(i) ^ got.charCodeAt(i);
  return d === 0;
}

async function responder(to: string) {
  const { data: r } = await db.from("wa_autoresposta").select("em").eq("tel_dig", to).maybeSingle();
  if (r && Date.now() - new Date(r.em).getTime() < 12 * 3600e3) return;
  await db.from("wa_autoresposta").upsert({ tel_dig: to, em: new Date().toISOString() });
  const t = TXT[langOf(to)];
  const res = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE}/messages`, {
    method: "POST", headers: { authorization: `Bearer ${WA_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "interactive",
      interactive: { type: "cta_url", body: { text: t.body }, action: { name: "cta_url", parameters: { display_text: t.btn, url: `${SITE}/falar/` } } } }),
  });
  if (!res.ok) console.error("autoresposta falhou", res.status, (await res.text()).slice(0, 300));
  else console.log("autoresposta ok");
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  if (req.method === "GET") {
    const ok = VERIFY && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === VERIFY;
    return ok ? new Response(u.searchParams.get("hub.challenge") || "", { status: 200 }) : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const raw = await req.text();
  if (raw.length > 200_000 || !(await assinaturaOk(raw, req.headers.get("x-hub-signature-256")))) return new Response("forbidden", { status: 403 });
  if (!WA_ON || !WA_TOKEN || !WA_PHONE) return new Response("ok");
  let ev: any; try { ev = JSON.parse(raw); } catch { return new Response("ok"); }
  const nums = new Set<string>();
  for (const e of ev?.entry || []) for (const c of e?.changes || []) {
    const v = c?.value;
    if (c?.field !== "messages" || String(v?.metadata?.phone_number_id || "") !== WA_PHONE) continue;
    for (const m of v?.messages || []) { const f = String(m?.from || "").replace(/\D/g, ""); if (f.length >= 10 && f.length <= 15) nums.add(f); }
  }
  for (const n of nums) { try { await responder(n); } catch (e) { console.error("autoresposta", String(e)); } }
  return new Response("ok");
});
