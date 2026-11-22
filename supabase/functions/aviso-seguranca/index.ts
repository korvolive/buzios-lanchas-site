// Búzios Lanchas: aviso de segurança de saque e de troca de chave Pix (Rodrigo 2026-11-21).
// Cada saque pedido pelo app e cada troca de chave Pix entram na fila public.avisos_seguranca (triggers do banco, arquivo
// 2026-11-21_seguranca-saque.sql). Esta função manda o aviso:
//  - para a própria pessoa: push (app e iPhone) e e-mail da conta, no idioma do aparelho dela;
//  O administrador NÃO recebe (Rodrigo 2026-11-21): só o próprio dono/vendedor.
// SEM WhatsApp (Rodrigo 2026-11-22): sai pelo número oficial e ele vê todas no celular dele. Só app + e-mail.
// A chave Pix aparece mascarada (CPF/CNPJ só com os dígitos do meio). Sem nomes de pessoas da empresa e sem emoji nos textos.
// POST {acao:"enviar"} com x-chave (resgate_config.chave): pg_net na hora e cron de 15 em 15 min se sobrou aviso.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const SITE = "https://www.lanchaembuzios.com.br";
const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const primeiro = (n: unknown) => { const p = String(n || "").trim().split(/\s+/)[0] || ""; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""; };
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

// e-mail da conta (Rodrigo 2026-11-22: quem perdeu o telefone ainda recebe pelo e-mail). Mesmo caminho dos outros avisos
// por e-mail do site (modelo do link mágico com msg/assunto no user_metadata). Conta só com WhatsApp não tem e-mail de verdade.
const MAIL: Record<string, (sq: boolean, nome: string, v: string, k: string) => any> = {
  pt: (sq, nome, v, k) => ({ oi: `Olá, ${nome}!`, texto: sq ? "Foi pedido um saque na sua conta da Búzios Lanchas." : "A chave Pix de recebimento da sua conta na Búzios Lanchas foi trocada.", linhas: sq ? [`Valor: ${v}`, `Chave Pix: ${k}`] : [`Nova chave Pix: ${k}`], nota: "Se não foi você, fale com a Búzios Lanchas agora pelo WhatsApp (21) 99927-2550.", botao: "Abrir o app" }),
  en: (sq, nome, v, k) => ({ oi: `Hi, ${nome}!`, texto: sq ? "A withdrawal was requested on your Búzios Lanchas account." : "The payout Pix key on your Búzios Lanchas account was changed.", linhas: sq ? [`Amount: ${v}`, `Pix key: ${k}`] : [`New Pix key: ${k}`], nota: "If this wasn't you, contact Búzios Lanchas now on WhatsApp +55 21 99927-2550.", botao: "Open the app" }),
  es: (sq, nome, v, k) => ({ oi: `¡Hola, ${nome}!`, texto: sq ? "Se pidió un retiro en tu cuenta de Búzios Lanchas." : "La llave Pix de cobro de tu cuenta en Búzios Lanchas fue cambiada.", linhas: sq ? [`Valor: ${v}`, `Llave Pix: ${k}`] : [`Nueva llave Pix: ${k}`], nota: "Si no fuiste tú, habla con Búzios Lanchas ahora por WhatsApp +55 21 99927-2550.", botao: "Abrir la app" }),
};
const ASSUNTO: Record<string, (sq: boolean) => string> = {
  pt: (sq) => sq ? "Aviso de segurança: saque pedido" : "Aviso de segurança: chave Pix trocada",
  en: (sq) => sq ? "Security notice: withdrawal requested" : "Security notice: Pix key changed",
  es: (sq) => sq ? "Aviso de seguridad: retiro pedido" : "Aviso de seguridad: llave Pix cambiada",
};
async function email(uid: string, sq: boolean, nome: string, valor: number, ct: string, kc: string) {
  return emailMsg(uid, (lang) => MAIL[lang](sq, nome, brl(valor, lang), chaveTxt(lang, ct, kc)), (lang) => ASSUNTO[lang](sq));
}
// telefone da conta trocado (Rodrigo 2026-11-22): sem modelo de WhatsApp, vai por push e e-mail
const fimTel = (t: string) => { const d = dig(t); return d.length >= 4 ? `final ${d.slice(-4)}` : ""; };
const PUSH_TEL: Record<string, (n: string) => { title: string; body: string }> = {
  pt: (n) => ({ title: "Telefone da conta trocado", body: `O telefone da sua conta agora é o ${n}. Se não foi você, fale com a Búzios Lanchas agora.` }),
  en: (n) => ({ title: "Account phone changed", body: `Your account phone is now the one ending ${n.replace("final ", "")}. If this wasn't you, contact Búzios Lanchas now.` }),
  es: (n) => ({ title: "Teléfono de la cuenta cambiado", body: `El teléfono de tu cuenta ahora termina en ${n.replace("final ", "")}. Si no fuiste tú, habla con Búzios Lanchas ahora.` }),
};
const MAIL_TEL: Record<string, (nome: string, novo: string, antes: string) => any> = {
  pt: (nome, novo, antes) => ({ oi: `Olá, ${nome}!`, texto: "O telefone da sua conta na Búzios Lanchas foi trocado.", linhas: [`Novo telefone: ${novo}`, ...(antes ? [`Telefone anterior: ${antes}`] : [])], nota: "Se não foi você, fale com a Búzios Lanchas agora pelo WhatsApp (21) 99927-2550. Por segurança, saques ficam em espera por 24 horas.", botao: "Abrir o app" }),
  en: (nome, novo, antes) => ({ oi: `Hi, ${nome}!`, texto: "The phone number on your Búzios Lanchas account was changed.", linhas: [`New phone: ${novo}`, ...(antes ? [`Previous phone: ${antes}`] : [])], nota: "If this wasn't you, contact Búzios Lanchas now on WhatsApp +55 21 99927-2550. For security, withdrawals are on hold for 24 hours.", botao: "Open the app" }),
  es: (nome, novo, antes) => ({ oi: `¡Hola, ${nome}!`, texto: "El teléfono de tu cuenta en Búzios Lanchas fue cambiado.", linhas: [`Nuevo teléfono: ${novo}`, ...(antes ? [`Teléfono anterior: ${antes}`] : [])], nota: "Si no fuiste tú, habla con Búzios Lanchas ahora por WhatsApp +55 21 99927-2550. Por seguridad, los retiros quedan en espera 24 horas.", botao: "Abrir la app" }),
};
const ASSUNTO_TEL: Record<string, string> = { pt: "Aviso de segurança: telefone da conta trocado", en: "Security notice: account phone changed", es: "Aviso de seguridad: teléfono de la cuenta cambiado" };
async function emailMsg(uid: string, build: (lang: string) => any, assunto: (lang: string) => string) {
  const { data } = await db.auth.admin.getUserById(uid);
  const u = data?.user;
  if (!u?.email || !u.email_confirmed_at || /@sem-email\.lanchaembuzios\.com\.br$/.test(u.email)) return "sem_email";
  const meta = { ...(u.user_metadata || {}) };
  const lang = ["pt", "en", "es"].includes(meta.lang) ? meta.lang : "pt";
  const msg = { lang, ...build(lang) };
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg, assunto: assunto(lang) } });
  const { error } = await db.auth.signInWithOtp({ email: u.email, options: { shouldCreateUser: false, emailRedirectTo: "https://www.lanchaembuzios.com.br/login/" } });
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg: null, assunto: null } });
  if (error) { console.error("email", error.message); return "falhou"; }
  return "enviado";
}

async function enviar() {
  const { data: fila } = await db.from("avisos_seguranca").select("id").is("enviado_em", null).lt("tentativas", 5)
    .gt("criado_em", new Date(Date.now() - 2 * 864e5).toISOString()).order("id").limit(20);
  if (!fila?.length) return { enviados: 0 };
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
      const { data: pf } = await db.from("perfis").select("nome").eq("user_id", a.user_id).maybeSingle();
      const { data: cl } = await db.from("clientes").select("nome").eq("user_id", a.user_id).maybeSingle();
      const nomeComp = String(pf?.nome || ct?.nome || cl?.nome || "").trim();
      const nome = primeiro(nomeComp) || "parceiro";
      const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", a.user_id);
      if (a.tipo === "telefone") {
        const novo = fimTel(a.chave), antes = fimTel(a.chave_anterior || "");
        if (!admIds.includes(a.user_id)) {
          if (ja.push === undefined) res.push = await push(subs || [], (lg) => PUSH_TEL[lg](novo), `seg-tel-${a.id}`);
          if (ja.email !== "enviado") res.email = await emailMsg(a.user_id, (lg) => MAIL_TEL[lg](nome, novo, antes), (lg) => ASSUNTO_TEL[lg]).catch(() => "falhou");
        }
        await db.from("avisos_seguranca").update({ resultado: res, tentativas: a.tentativas + 1 }).eq("id", a.id);
        out.push({ id: a.id, ...res });
        continue;
      }
      const sq = a.tipo === "saque";
      // só a própria pessoa: o administrador não recebe estes avisos (Rodrigo 2026-11-21, "senão fico recebendo mensagem o dia todo")
      if (!admIds.includes(a.user_id)) {
        if (ja.push === undefined) res.push = await push(subs || [], (lg) => sq ? PUSH_SAQUE[lg](brl(+a.valor, lg), chaveTxt(lg, a.chave_tipo, a.chave)) : PUSH_PIX[lg](chaveTxt(lg, a.chave_tipo, a.chave)), `seg-${a.tipo}-${a.id}`);
        if (ja.email !== "enviado") res.email = await email(a.user_id, sq, nome, +a.valor || 0, a.chave_tipo, a.chave).catch(() => "falhou");
      }
      await db.from("avisos_seguranca").update({ resultado: res, tentativas: a.tentativas + 1 }).eq("id", a.id);
    } catch (e) {
      console.error("aviso", a.id, e);
      await db.from("avisos_seguranca").update({ enviado_em: null, tentativas: a.tentativas + 1, resultado: { ...res, erro: String(e).slice(0, 200) } } /* guarda o push já enviado: a nova tentativa não repete */).eq("id", a.id);
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
    if (b.acao === "enviar") return json(await enviar());
    return json({ erro: "acao" }, 400);
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
