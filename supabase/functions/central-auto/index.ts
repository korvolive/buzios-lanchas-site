// Búzios Lanchas: a central de pagamento nasce sozinha (Rodrigo 2026-11-05, Marcin).
// O cliente que acabou de criar a conta pelo link da pré-reserva chama aqui ao abrir Meus passeios.
// Antes, a central só era criada quando o administrador abria o app (que continua criando, se ainda faltar).
// Brasileiro ou pedido de vendedor: Pix em reais. Estrangeiro: PayPal no câmbio do dia + 10% (igual ao app), e também Pix.
// Não manda e-mail nem WhatsApp oficial: o cliente já está na conversa com o Lucas e vê o pagamento na conta.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const SITE = "https://www.lanchaembuzios.com.br";
const SYM: Record<string, string> = { USD: "US$", EUR: "€", GBP: "£", BRL: "R$" };
const fmt = (m: string, v: number) => `${SYM[m] || m} ${Number(v).toLocaleString(m === "BRL" ? "pt-BR" : "en-US", { minimumFractionDigits: Number.isInteger(+v) ? 0 : 2, maximumFractionDigits: 2 })}`;
// mesmos do app (login/index.html: PAIS_DDI, COB_EUR, cobCur, niceUp, FX_MARKUP)
const PAIS_DDI: Record<string, string> = { BR: "55", AR: "54", CL: "56", UY: "598", PY: "595", CO: "57", PE: "51", MX: "52", BO: "591", EC: "593", VE: "58", US: "1", CA: "1", PT: "351", ES: "34", FR: "33", IT: "39", DE: "49", GB: "44", IE: "353", NL: "31", BE: "32", CH: "41", AT: "43", SE: "46", NO: "47", DK: "45", FI: "358", PL: "48", IL: "972", AU: "61", NZ: "64", ZA: "27", JP: "81", CN: "86", KR: "82", IN: "91", AE: "971", CR: "506", PA: "507", DO: "1", GT: "502", CU: "53", PR: "1" };
const COB_EUR = new Set(["49", "33", "39", "351", "31", "32", "43", "353", "30", "358", "352", "356", "357", "386", "421", "372", "371", "370", "385"]);
const niceUp = (x: number) => { const step = x < 100 ? 5 : x < 1000 ? 10 : x < 10000 ? 50 : 10 ** (Math.floor(Math.log10(x)) - 1); return Math.ceil(x / step) * step; };

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = auth ? (await db.auth.getUser(auth)).data?.user?.id : null;
    if (!uid) return json({ erro: "login" }, 401);
    const { data: ps } = await db.from("pedidos").select("id, lancha, data, sinal_valor, vendedor")
      .eq("cliente", uid).eq("status", "pendente").not("sinal_liberado_em", "is", null).is("paypal_link", null).gt("sinal_valor", 0).limit(5);
    if (!ps?.length) return json({ n: 0 });
    const { data: cl } = await db.from("clientes").select("pais, whatsapp").eq("user_id", uid).maybeSingle();
    const cc = PAIS_DDI[String(cl?.pais || "")] || (String(cl?.whatsapp || "").trim().match(/^\+(\d{1,3})\s/) || [])[1] || "55";
    let n = 0;
    for (const p of ps) {
      if ((await db.from("pagamentos_pp").select("pedido").eq("pedido", p.id).maybeSingle()).data) continue;
      let moeda = "BRL", valor = +p.sinal_valor;
      if (cc !== "55" && !p.vendedor) { // com vendedor: só Pix (Rodrigo, 2026-10-22)
        moeda = cc === "34" || COB_EUR.has(cc) ? "EUR" : cc === "44" ? "GBP" : "USD";
        const fx = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/cambio").then(r => r.json()).catch(() => null);
        const r = +fx?.rates?.[moeda.toLowerCase()];
        if (!(r > 0)) continue; // sem câmbio agora: o app do administrador cria depois
        valor = niceUp(valor * r * 1.10);
      }
      const { data: c, error } = await db.from("pagamentos_pp").insert({ pedido: p.id, moeda, valor }).select("token").single();
      if (error || !c) continue; // outra chamada criou ao mesmo tempo
      const url = `${SITE}/pagar/?p=${p.id}&k=${c.token}`, texto = fmt(moeda, valor);
      await db.from("pedidos").update({ paypal_link: url, paypal_valor: texto, atualizado_em: new Date().toISOString() }).eq("id", p.id).is("paypal_link", null);
      console.log("central automática", p.id, texto); n++;
    }
    return json({ n });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
