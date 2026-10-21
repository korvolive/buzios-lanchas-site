// Búzios Lanchas: cria a fatura do PayPal do sinal de um cliente estrangeiro e devolve o link de pagamento.
// POST { valor, moeda, lancha, data, horario, nome?, email?, lang }  (só o administrador).
// Chaves no Supabase (Edge Functions > Secrets), coladas pelo Rodrigo: PAYPAL_CLIENT_ID, PAYPAL_SECRET e, para testes, PAYPAL_ENV=sandbox.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const API = Deno.env.get("PAYPAL_ENV") === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
const ITEM: Record<string, (p: any) => { name: string; desc: string; note: string }> = {
  pt: p => ({ name: `Sinal do passeio de lancha (${p.lancha})`, desc: [p.data, p.horario].filter(Boolean).join(" · "), note: "O restante é pago na hora do embarque, direto ao responsável pela lancha. Obrigado! Búzios Lanchas" }),
  en: p => ({ name: `Boat trip deposit (${p.lancha})`, desc: [p.data, p.horario].filter(Boolean).join(" · "), note: "The balance is paid at boarding, directly to the boat's crew. Thank you! Búzios Lanchas" }),
  es: p => ({ name: `Seña del paseo en lancha (${p.lancha})`, desc: [p.data, p.horario].filter(Boolean).join(" · "), note: "El resto se paga al embarcar, directamente al responsable de la lancha. ¡Gracias! Búzios Lanchas" }),
};

async function pp(path: string, tok: string, body?: unknown) {
  const r = await fetch(API + path, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json", prefer: "return=representation" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch (_) { /* vazio */ }
  if (!r.ok) { console.error("paypal", path, r.status, t.slice(0, 800)); throw new Error(j?.details?.[0]?.issue || j?.name || `paypal ${r.status}`); }
  return j;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const id = Deno.env.get("PAYPAL_CLIENT_ID"), sec = Deno.env.get("PAYPAL_SECRET");
    if (req.method === "GET") { // só confere se as chaves funcionam (não cria nada nem mostra as chaves)
      if (!id || !sec) return json({ chaves: false });
      const a = await fetch(API + "/v1/oauth2/token", { method: "POST", headers: { authorization: "Basic " + btoa(`${id}:${sec}`), "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
      const j = a.ok ? await a.json() : {};
      return json({ chaves: true, ok: a.ok, status: a.status, ambiente: API.includes("sandbox") ? "sandbox" : "live", faturas: String(j.scope || "").includes("invoicing") });
    }
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = (await db.auth.getUser(token)).data?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    if (!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data) return json({ erro: "admin" }, 403);
    if (!id || !sec) return json({ erro: "sem_chaves" }, 503);
    const p = await req.json().catch(() => ({}));
    const valor = Number(p.valor), moeda = String(p.moeda || "USD").toUpperCase();
    if (!(valor > 0) || !/^[A-Z]{3}$/.test(moeda)) return json({ erro: "valor" }, 400);
    const auth = await fetch(API + "/v1/oauth2/token", { method: "POST", headers: { authorization: "Basic " + btoa(`${id}:${sec}`), "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
    if (!auth.ok) { console.error("paypal token", auth.status, (await auth.text()).slice(0, 300)); return json({ erro: "chaves" }, 502); }
    const tok = (await auth.json()).access_token;
    const tx = (ITEM[p.lang] || ITEM.en)(p);
    const email = typeof p.email === "string" && /^\S+@\S+\.\S+$/.test(p.email) ? p.email.trim() : "";
    const nome = String(p.nome || "").trim().split(/\s+/);
    const inv = await pp("/v2/invoicing/invoices", tok, {
      detail: { currency_code: moeda, note: tx.note },
      ...(email ? { primary_recipients: [{ billing_info: { email_address: email, ...(nome[0] ? { name: { given_name: nome[0], ...(nome.length > 1 ? { surname: nome.slice(1).join(" ") } : {}) } } : {}) } }] } : {}),
      items: [{ name: tx.name.slice(0, 200), description: tx.desc.slice(0, 1000), quantity: "1", unit_amount: { currency_code: moeda, value: valor.toFixed(2) } }],
      configuration: { allow_tip: false, partial_payment: { allow_partial_payment: false } },
    });
    const iid = inv.id || String(inv.href || "").split("/").pop();
    const sent = await pp(`/v2/invoicing/invoices/${iid}/send`, tok, { send_to_invoicer: false, send_to_recipient: !!email });
    const link = sent?.href || inv?.detail?.metadata?.recipient_view_url || "";
    if (!link) return json({ erro: "sem_link", id: iid }, 502);
    return json({ id: iid, link });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou", detalhe: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
