// Búzios Lanchas: aviso de segurança de saque e de troca de chave Pix (Rodrigo 2026-11-21).
// Cada saque pedido pelo app e cada troca de chave Pix entram na fila public.avisos_seguranca (triggers do banco, arquivo
// 2026-11-21_seguranca-saque.sql). Esta função manda o aviso:
//  - para a própria pessoa: push (app e iPhone) e WhatsApp pelo número oficial (360dialog, modelos de Utilidade saque_pedido e
//    chave_pix_trocada, que saem mesmo fora da janela de 24 h), no idioma do aparelho dela;
//  O administrador NÃO recebe (Rodrigo 2026-11-21): só o próprio dono/vendedor.
// Os modelos são criados sozinhos (no máximo uma tentativa por dia); até a Meta aprovar, sai só o push.
// A chave Pix aparece mascarada (CPF/CNPJ só com os dígitos do meio). Sem nomes de pessoas da empresa e sem emoji nos textos.
// POST {acao:"enviar"} com x-chave (resgate_config.chave): pg_net na hora e cron de 15 em 15 min se sobrou aviso.
// POST {acao:"modelos"} com x-chave: situação dos modelos (só leitura).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const SITE = "https://www.lanchaembuzios.com.br";
const D360 = "https://waba-v2.360dialog.io";
const LCW: Record<string, string> = { pt: "pt_BR", en: "en", es: "es" };
const ES_DDI = ["34", "51", "52", "53", "54", "56", "57", "58", "502", "503", "504", "505", "506", "507", "591", "593", "595", "598"];
const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const limpa = (s: unknown) => String(s ?? "").replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 120);
const primeiro = (n: unknown) => { const p = String(n || "").trim().split(/\s+/)[0] || ""; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""; };
function waNum(s: unknown) {
  let d = dig(s);
  if (/^5555\d{10,11}$/.test(d)) d = d.slice(2);
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) d = "55" + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}
function brl(v: number, l: string) {
  const s = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return l === "en" ? "R$ " + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "R$ " + s;
}
// chave mascarada: dá para reconhecer a própria chave sem expor o documento inteiro
function mascara(tipo: string, k: string) {
  k = String(k || "");
  if (tipo === "cpf" && /^\d{11}$/.test(k)) return `***.${k.slice(3, 6)}.${k.slice(6, 9)}-**`;
  if (tipo === "cnpj" && /^\d{14}$/.test(k)) return `**.${k.slice(2, 5)}.${k.slice(5, 8)}/${k.slice(8, 12)}-**`;
  if (tipo === "telefone") { const d = dig(k); return `(${d.slice(2, 4)}) *****-${d.slice(-4)}`; }
  if (tipo === "email") { const [u, d] = k.split("@"); return `${u.slice(0, 2)}***@${d || ""}`; }
  if (tipo === "aleatoria") return `${k.slice(0, 8)}-****`;
  return k.slice(0, 4) + "****";
}
const TIPO: Record<string, Record<string, string>> = {
  pt: { cpf: "CPF", cnpj: "CNPJ", email: "e-mail", telefone: "celular", aleatoria: "aleatória" },
  en: { cpf: "CPF", cnpj: "CNPJ", email: "email", telefone: "phone", aleatoria: "random" },
  es: { cpf: "CPF", cnpj: "CNPJ", email: "correo", telefone: "celular", aleatoria: "aleatoria" },
};
const chaveTxt = (l: string, tipo: string, k: string) => `${TIPO[l][tipo] || ""} ${mascara(tipo, k)}`.trim();

// ---------- modelos de Utilidade (WhatsApp oficial) ----------
const MOD_SAQUE = "saque_pedido", MOD_PIX = "chave_pix_trocada";
const TXT: Record<string, Record<string, string>> = {
  [MOD_SAQUE]: {
    pt_BR: "Aviso de segurança da Búzios Lanchas: foi pedido pelo app um saque de {{1}} da conta de recebimento de {{2}}, para a chave Pix {{3}}. Se não foi você, fale com a Búzios Lanchas agora.",
    en: "Búzios Lanchas security notice: a withdrawal of {{1}} was requested in the app from the payout account of {{2}}, to the Pix key {{3}}. If this wasn't you, contact Búzios Lanchas now.",
    es: "Aviso de seguridad de Búzios Lanchas: se pidió en la app un retiro de {{1}} de la cuenta de cobro de {{2}}, a la llave Pix {{3}}. Si no fuiste tú, habla con Búzios Lanchas ahora.",
  },
  [MOD_PIX]: {
    pt_BR: "Aviso de segurança da Búzios Lanchas: a chave Pix de recebimento de {{1}} foi trocada no app para {{2}}. Se não foi você, fale com a Búzios Lanchas agora.",
    en: "Búzios Lanchas security notice: the payout Pix key of {{1}} was changed in the app to {{2}}. If this wasn't you, contact Búzios Lanchas now.",
    es: "Aviso de seguridad de Búzios Lanchas: la llave Pix de cobro de {{1}} se cambió en la app a {{2}}. Si no fuiste tú, habla con Búzios Lanchas ahora.",
  },
};
const EX: Record<string, Record<string, string[]>> = {
  [MOD_SAQUE]: { pt_BR: ["R$ 1.250,00", "Carlos", "CPF ***.456.789-**"], en: ["R$ 1,250.00", "Carlos", "CPF ***.456.789-**"], es: ["R$ 1.250,00", "Carlos", "CPF ***.456.789-**"] },
  [MOD_PIX]: { pt_BR: ["Carlos", "CPF ***.456.789-**"], en: ["Carlos", "CPF ***.456.789-**"], es: ["Carlos", "CPF ***.456.789-**"] },
};
async function d360Key() {
  const env = Deno.env.get("D360_API_KEY") || "";
  if (env) return env;
  const { data } = await db.from("segredos_app").select("valor").eq("nome", "D360_API_KEY").maybeSingle();
  return String(data?.valor || "");
}
let situacao: any[] = [];
// idiomas aprovados de cada modelo; cria os que faltam (uma tentativa por dia)
async function modelos(key: string): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = { [MOD_SAQUE]: [], [MOD_PIX]: [] };
  const r = await fetch(`${D360}/v1/configs/templates?limit=1000`, { headers: { "D360-API-KEY": key } });
  if (!r.ok) return out;
  const jt: any = await r.json().catch(() => ({}));
  const ts: any[] = (jt.waba_templates || jt.data || []).filter((t: any) => t?.name === MOD_SAQUE || t?.name === MOD_PIX);
  situacao = ts.map((t) => ({ nome: t.name, idioma: t.language, status: t.status, categoria: t.category, motivo: t.rejected_reason || null }));
  for (const t of ts) if (String(t.status).toLowerCase() === "approved" && String(t.category).toUpperCase() === "UTILITY") out[t.name].push(String(t.language));
  const { data: cfg } = await db.from("resgate_config").select("seg_modelo_em").eq("id", 1).maybeSingle();
  if (!cfg?.seg_modelo_em || Date.parse(cfg.seg_modelo_em) < Date.now() - 864e5) {
    await db.from("resgate_config").update({ seg_modelo_em: new Date().toISOString() }).eq("id", 1);
    for (const nome of [MOD_SAQUE, MOD_PIX]) for (const lc of Object.keys(TXT[nome]).filter((lc) => !ts.some((t) => t.name === nome && String(t.language) === lc))) {
      const c = await fetch(`${D360}/v1/configs/templates`, {
        method: "POST", headers: { "D360-API-KEY": key, "content-type": "application/json" },
        body: JSON.stringify({ name: nome, category: "UTILITY", language: lc, components: [{ type: "BODY", text: TXT[nome][lc], example: { body_text: [EX[nome][lc]] } }] }),
      });
      console.log("modelo criado", nome, lc, c.status, c.ok ? "" : (await c.text()).slice(0, 300));
    }
  }
  return out;
}
async function wa(key: string, to: string, nome: string, lc: string, params: string[]) {
  const r = await fetch(`${D360}/messages`, { method: "POST", headers: { "D360-API-KEY": key, "content-type": "application/json" }, body: JSON.stringify({
    messaging_product: "whatsapp", recipient_type: "individual", to, type: "template",
    template: { name: nome, language: { code: lc }, components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: limpa(text) || "-" })) }] },
  }) });
  if (!r.ok) console.error("wa falhou", nome, r.status, (await r.text()).slice(0, 300));
  return r.ok ? "enviado" : "falhou";
}

// ---------- push (web e iPhone) ----------
let vapid = false;
let apnsJwt: { t: string; em: number } | null = null;
async function apnsToken() {
  if (apnsJwt && Date.now() - apnsJwt.em < 50 * 60e3) return apnsJwt.t;
  const pem = (Deno.env.get("APNS_KEY_P8") || "").replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const enc = (o: unknown) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const head = `${enc({ alg: "ES256", kid: Deno.env.get("APNS_KEY_ID") })}.${enc({ iss: Deno.env.get("APNS_TEAM_ID"), iat: Math.floor(Date.now() / 1000) })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(head)));
  apnsJwt = { t: `${head}.${b64u(sig)}`, em: Date.now() };
  return apnsJwt.t;
}
async function push(subs: any[], msg: (l: string) => { title: string; body: string }, tag: string) {
  if (!subs.length) return 0;
  if (!vapid) {
    const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
    if (!k) return 0;
    webpush.setVapidDetails(SITE, k.publica, k.privada); vapid = true;
  }
  let n = 0;
  await Promise.all(subs.map(async (s) => {
    const m = msg(["pt", "en", "es"].includes(s.lang) ? s.lang : "pt");
    try {
      if (String(s.endpoint).startsWith("apns:")) {
        const r = await fetch(`https://api.push.apple.com/3/device/${s.endpoint.slice(5)}`, {
          method: "POST",
          headers: { authorization: `bearer ${await apnsToken()}`, "apns-topic": "br.com.lanchaembuzios.app", "apns-push-type": "alert", "apns-priority": "10", "apns-collapse-id": tag.slice(0, 64) },
          body: JSON.stringify({ aps: { alert: m, sound: "default" }, url: "/login/" }),
        });
        if (!r.ok) { const t = await r.text(); throw Object.assign(new Error(t), { statusCode: /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(t) ? 410 : r.status }); }
      } else {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url: "/login/", tag }), { TTL: 86400, urgency: "high" });
      }
      n++;
    } catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }));
  return n;
}

const PUSH_SAQUE: Record<string, (v: string, k: string) => { title: string; body: string }> = {
  pt: (v, k) => ({ title: "Saque pedido", body: `Saque de ${v} para a chave Pix ${k}. Se não foi você, fale com a Búzios Lanchas agora.` }),
  en: (v, k) => ({ title: "Withdrawal requested", body: `Withdrawal of ${v} to the Pix key ${k}. If this wasn't you, contact Búzios Lanchas now.` }),
  es: (v, k) => ({ title: "Retiro pedido", body: `Retiro de ${v} a la llave Pix ${k}. Si no fuiste tú, habla con Búzios Lanchas ahora.` }),
};
const PUSH_PIX: Record<string, (k: string) => { title: string; body: string }> = {
  pt: (k) => ({ title: "Chave Pix trocada", body: `Sua chave Pix de recebimento agora é ${k}. Se não foi você, fale com a Búzios Lanchas agora.` }),
  en: (k) => ({ title: "Pix key changed", body: `Your payout Pix key is now ${k}. If this wasn't you, contact Búzios Lanchas now.` }),
  es: (k) => ({ title: "Llave Pix cambiada", body: `Tu llave Pix de cobro ahora es ${k}. Si no fuiste tú, habla con Búzios Lanchas ahora.` }),
};

async function enviar() {
  const { data: fila } = await db.from("avisos_seguranca").select("id").is("enviado_em", null).lt("tentativas", 5)
    .gt("criado_em", new Date(Date.now() - 2 * 864e5).toISOString()).order("id").limit(20);
  if (!fila?.length) return { enviados: 0 };
  const key = await d360Key();
  const aprov = key ? await modelos(key).catch(() => ({ [MOD_SAQUE]: [], [MOD_PIX]: [] } as Record<string, string[]>)) : { [MOD_SAQUE]: [], [MOD_PIX]: [] };
  const { data: adm } = await db.from("admins").select("user_id");
  const admIds = (adm || []).map((a: any) => a.user_id);
  const out: any[] = [];
  for (const f of fila) {
    // pega o aviso para si antes de mandar: pg_net e cron ao mesmo tempo não mandam duas vezes
    const { data: a } = await db.from("avisos_seguranca").update({ enviado_em: new Date().toISOString() }).eq("id", f.id).is("enviado_em", null).select("*").maybeSingle();
    if (!a) continue;
    const ja: any = a.resultado || {}; // nova tentativa: não repete o que já foi
    const res: any = { ...ja };
    delete res.erro;
    try {
      const { data: ct } = await db.from("asaas_contas").select("nome").eq("user_id", a.user_id).maybeSingle();
      const { data: pf } = await db.from("perfis").select("nome, telefone").eq("user_id", a.user_id).maybeSingle();
      const { data: cl } = await db.from("clientes").select("nome, whatsapp, whatsapp_ok_em").eq("user_id", a.user_id).maybeSingle();
      const nomeComp = String(pf?.nome || ct?.nome || cl?.nome || "").trim();
      const nome = primeiro(nomeComp) || "parceiro";
      const to = waNum(cl?.whatsapp_ok_em ? cl.whatsapp : pf?.telefone || cl?.whatsapp);
      const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", a.user_id);
      const l0 = (subs || []).map((x: any) => x.lang).find((x: string) => ["pt", "en", "es"].includes(x));
      const l = l0 && !(l0 === "pt" && to && !to.startsWith("55")) ? l0 : !to || to.startsWith("55") ? "pt" : ES_DDI.some((d) => to.startsWith(d)) ? "es" : "en";
      const sq = a.tipo === "saque";
      const modelo = sq ? MOD_SAQUE : MOD_PIX;
      const params = (lg: string) => sq ? [brl(+a.valor, lg), nome, chaveTxt(lg, a.chave_tipo, a.chave)] : [nome, chaveTxt(lg, a.chave_tipo, a.chave)];
      // só a própria pessoa: o administrador não recebe estes avisos (Rodrigo 2026-11-21, "senão fico recebendo mensagem o dia todo")
      if (!admIds.includes(a.user_id)) {
        if (ja.push === undefined) res.push = await push(subs || [], (lg) => sq ? PUSH_SAQUE[lg](brl(+a.valor, lg), chaveTxt(lg, a.chave_tipo, a.chave)) : PUSH_PIX[lg](chaveTxt(lg, a.chave_tipo, a.chave)), `seg-${a.tipo}-${a.id}`);
        if (ja.wa !== "enviado") res.wa = !to ? "sem_telefone" : !key ? "sem_chave" : !aprov[modelo].includes(LCW[l]) ? "modelo_em_aprovacao" : await wa(key, to, modelo, LCW[l], params(l));
      }
      const falhou = res.wa === "falhou";
      // WhatsApp falhou: volta para a fila (até 5 tentativas); modelo ainda em aprovação não volta (o push já avisou)
      await db.from("avisos_seguranca").update({ resultado: res, tentativas: a.tentativas + 1, ...(falhou && a.tentativas + 1 < 5 ? { enviado_em: null } : {}) }).eq("id", a.id);
    } catch (e) {
      console.error("aviso", a.id, e);
      await db.from("avisos_seguranca").update({ enviado_em: null, tentativas: a.tentativas + 1, resultado: { erro: String(e).slice(0, 200) } }).eq("id", a.id);
      res.erro = true;
    }
    out.push({ id: a.id, ...res });
  }
  return { enviados: out.length, avisos: out };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  const ch = req.headers.get("x-chave") || "";
  const cfg = ch ? (await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle()).data : null;
  if (!(cfg?.chave && ch === cfg.chave)) return json({ erro: "chave" }, 403);
  const b = await req.json().catch(() => ({}));
  try {
    if (b.acao === "modelos") { const key = await d360Key(); const ok = key ? await modelos(key) : {}; return json({ aprovados: ok, situacao }); }
    if (b.acao === "enviar") return json(await enviar());
    return json({ erro: "acao" }, 400);
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
