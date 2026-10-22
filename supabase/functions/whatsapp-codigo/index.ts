// Búzios Lanchas: confirmação do WhatsApp do cliente por código (Rodrigo, 2026-10-22).
// Manda um código de 6 números pelo WhatsApp oficial (API da Meta, modelo de "Autenticação", paga por mensagem enviada)
// e marca clientes.whatsapp_ok_em quando o cliente digita o código certo. Com o WhatsApp confirmado,
// os passeios cadastrados com aquele celular entram na conta dele (resgatar_convites).
// POST { acao: "status" }              -> { configurado }
// POST { acao: "enviar", lang }        -> { ok } | { erro: "espere" | "limite" | "sem_whatsapp" | "ja_confirmado" | "nao_configurado" | "envio" }
// POST { acao: "confirmar", codigo }   -> { ok } | { erro: "codigo" | "expirou" | "tentativas" }
// Segredos (Supabase > Edge Functions > Secrets, colados pelo Rodrigo): WA_TOKEN, WA_PHONE_ID; opcional WA_TEMPLATE (padrão codigo_verificacao).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const TOKEN = Deno.env.get("WA_TOKEN") || "", PHONE = Deno.env.get("WA_PHONE_ID") || "", TEMPLATE = Deno.env.get("WA_TEMPLATE") || "codigo_verificacao";
const LANG: Record<string, string> = { pt: "pt_BR", en: "en", es: "es" };
const dig = (s: string) => String(s || "").replace(/\D/g, "");
const MAX_DIA = 5, ESPERA_S = 60, VALIDO_MIN = 10, MAX_TENT = 5;

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function codigo6() {
  const a = new Uint32Array(1); crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, "0");
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.acao === "status") return json({ configurado: !!(TOKEN && PHONE) });
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = (await db.auth.getUser(token)).data?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    const { data: c } = await db.from("clientes").select("whatsapp, whatsapp_ok_em").eq("user_id", uid).maybeSingle();
    const tel = dig(c?.whatsapp || "");
    if (!c || tel.length < 10) return json({ erro: "sem_whatsapp" }, 400);
    if (c.whatsapp_ok_em) return json({ ok: true, ja: true });
    const { data: w } = await db.from("wa_codigos").select("*").eq("user_id", uid).maybeSingle();

    if (body.acao === "enviar") {
      if (!TOKEN || !PHONE) return json({ erro: "nao_configurado" }, 503);
      const hoje = new Date().toISOString().slice(0, 10), mesmoDia = w?.dia === hoje;
      if (w && Date.now() - new Date(w.ultimo_envio).getTime() < ESPERA_S * 1000) return json({ erro: "espere" }, 429);
      if (w && mesmoDia && w.envios_dia >= MAX_DIA) return json({ erro: "limite" }, 429);
      const cod = codigo6();
      const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE}/messages`, {
        method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: tel, type: "template", template: { name: TEMPLATE, language: { code: LANG[body.lang] || "pt_BR" },
          components: [{ type: "body", parameters: [{ type: "text", text: cod }] }, { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: cod }] }] } }),
      });
      if (!r.ok) { console.error("whatsapp", r.status, (await r.text()).slice(0, 400)); return json({ erro: "envio" }, 502); }
      await db.from("wa_codigos").upsert({ user_id: uid, tel_dig: tel, hash: await sha(uid + ":" + cod), expira_em: new Date(Date.now() + VALIDO_MIN * 60000).toISOString(),
        tentativas: 0, ultimo_envio: new Date().toISOString(), envios_dia: mesmoDia ? w.envios_dia + 1 : 1, dia: hoje });
      return json({ ok: true });
    }

    if (body.acao === "confirmar") {
      if (!w || w.tel_dig !== tel) return json({ erro: "codigo" }, 400);
      if (new Date(w.expira_em).getTime() < Date.now()) return json({ erro: "expirou" }, 400);
      if (w.tentativas >= MAX_TENT) return json({ erro: "tentativas" }, 429);
      if ((await sha(uid + ":" + dig(body.codigo))) !== w.hash) {
        await db.from("wa_codigos").update({ tentativas: w.tentativas + 1 }).eq("user_id", uid);
        return json({ erro: "codigo" }, 400);
      }
      await db.from("clientes").update({ whatsapp_ok_em: new Date().toISOString() }).eq("user_id", uid);
      await db.from("wa_codigos").update({ expira_em: new Date().toISOString(), tentativas: MAX_TENT }).eq("user_id", uid);
      return json({ ok: true });
    }
    return json({ erro: "acao" }, 400);
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
