// Búzios Lanchas: o que falta na conta Asaas de uma pessoa (Rodrigo 2026-11-15).
// POST { user_id } -> { geral, dados, documentos, docs: [{ tipo, status, link }] }  (situação no Asaas, sem links nem dados pessoais)
// POST { user_id, link: true } -> o mesmo + url: link do Asaas para a pessoa enviar o documento e a selfie (só administrador ou robô),
//   para o administrador mandar direto quando a página do Asaas travar no aparelho dela (2026-11-16)
// POST { lembrar: true } (robô, 1 vez por dia) -> push para quem ainda não enviou o documento e a selfie, até concluir (recusado: aviso próprio abaixo)
// POST { rejeitados: true, simular? } (robô, 10 em 10 min e webhook) -> documento recusado: push + WhatsApp com o motivo e o link, lembrete diário
// POST { acao: "reenvio", t } (página /documento/, sem login) -> situação e link novo do Asaas da pessoa dona do token
// POST { todos: true } -> { contas: [{ user_id, nome, ...situação }] }              (todas as contas ainda não aprovadas)
// Quem pode: administrador logado (tabela admins) ou o robô (x-chave = resgate_config.chave). Só leitura no Asaas.
// Se o Asaas já aprovou, marca aprovada_em (o robô de 10 em 10 minutos avisaria a pessoa do mesmo jeito).
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
async function situacao(uid: string, comLink = false, bruto: { dc?: any } = {}) {
  const k = await chaveSub(uid);
  if (!k) return { geral: null, sem_chave: true, docs: [] };
  const h = { headers: { access_token: k, "user-agent": "buzios-lanchas" } };
  const st: any = await fetch(API() + "/myAccount/status", h).then((x) => x.json()).catch(() => ({}));
  const dc: any = await fetch(API() + "/myAccount/documents", h).then((x) => x.json()).catch(() => ({}));
  bruto.dc = dc;
  const docs = (dc?.data || []).map((d: any) => ({ tipo: d.type, status: d.status, link: !!d.onboardingUrl }));
  // recusado primeiro: depois de uma recusa o Asaas gera um link novo só para o que foi recusado
  const falta = (dc?.data || []).find((d: any) => d.status === "REJECTED" && d.onboardingUrl) || (dc?.data || []).find((d: any) => d.status === "NOT_SENT" && d.onboardingUrl);
  // o link vem do próprio Asaas (não é só asaas.com: a 1ª versão filtrava pelo domínio e não devolvia nada); só exige https
  const url = comLink && falta && /^https:\/\//i.test(String(falta.onboardingUrl)) ? String(falta.onboardingUrl) : undefined;
  if (st?.general === "APPROVED") await db.from("asaas_contas").update({ aprovada_em: new Date().toISOString() }).eq("user_id", uid).is("aprovada_em", null);
  return { geral: st?.general || null, dados: st?.commercialInfo || null, documentos: st?.documentation || null, conta_bancaria: st?.bankAccountInfo || null, docs, ...(url ? { url } : {}) };
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

// ---------- documento recusado (Rodrigo 2026-11-17) ----------
// "Se não aprovar o documento, o nosso próprio site avisar: seu documento não foi aprovado, está ilegível, mande novamente."
// O Asaas avisa por webhook (ACCOUNT_STATUS_DOCUMENT_REJECTED, sem o motivo) e este robô confere em /myAccount/documents:
// grupo REJECTED + rejectReasons. A pessoa recebe na hora (8h às 21h de Brasília) push e WhatsApp (modelo de Utilidade
// documento_reenviar, PT/EN/ES, sem emoji, sem nomes da empresa) com o motivo em linguagem simples, dicas e o botão para
// /documento/?t=<token>, que abre o link novo do Asaas. Lembra 1 vez por dia (depois da 7ª, a cada 3 dias) até reenviar.
// Reenviou (PENDING) ou aprovou: para sozinho. resgate_config.docrej_ativo desliga. {rejeitados:true, simular:true} só mostra.
const SITE = "https://www.lanchaembuzios.com.br";
const D360 = "https://waba-v2.360dialog.io";
const MOD_REJ = "documento_reenviar";
const LCW: Record<string, string> = { pt: "pt_BR", en: "en", es: "es" };
const MOD_REJ_TXT: Record<string, string> = {
  pt_BR: "Olá, {{1}}. O Asaas, que processa os pagamentos da Búzios Lanchas, não aprovou o que você enviou para liberar a sua conta de recebimento.\n\nPrecisa enviar de novo: {{2}}\nMotivo: {{3}}\n\nDicas: a CNH digital em PDF, baixada no app CNH do Brasil (gov.br), costuma ser o jeito mais fácil. Se for foto, mostre o documento inteiro, sem cortar as bordas, sem reflexo e em lugar claro.\n\nToque no botão abaixo para enviar de novo. Enquanto isso, o que é seu fica guardado.",
  en: "Hello {{1}}. Asaas, which processes payments for Búzios Lanchas, did not approve what you sent to unlock your payout account.\n\nPlease send again: {{2}}\nReason: {{3}}\n\nTips: if it is a photo, show the whole document, without cutting the edges, without glare and in good light. A digital driver's license in PDF also works.\n\nTap the button below to send it again. Meanwhile, your share stays saved.",
  es: "Hola, {{1}}. Asaas, que procesa los pagos de Búzios Lanchas, no aprobó lo que enviaste para liberar tu cuenta de cobro.\n\nHay que enviar de nuevo: {{2}}\nMotivo: {{3}}\n\nConsejos: si es una foto, muestra el documento entero, sin cortar los bordes, sin reflejo y con buena luz. La licencia de conducir digital en PDF también sirve.\n\nToca el botón de abajo para enviarlo de nuevo. Mientras tanto, lo tuyo queda guardado.",
};
const MOD_REJ_EX: Record<string, string[]> = {
  pt_BR: ["Ana", "documento com foto", "a foto ficou sem nitidez e não deu para ler os dados"],
  en: ["Ana", "photo ID", "the photo was blurry and the details could not be read"],
  es: ["Ana", "documento con foto", "la foto salió borrosa y no se pudieron leer los datos"],
};
const MOD_REJ_BTN: Record<string, string> = { pt_BR: "Enviar de novo", en: "Send again", es: "Enviar de nuevo" };
// o que foi recusado e por quê, em linguagem simples (códigos; os textos ficam aqui, no app e na página /documento/)
const OQUE: Record<string, Record<string, string>> = {
  pt: { doc: "documento com foto", selfie: "selfie", ambos: "documento com foto e selfie" },
  en: { doc: "photo ID", selfie: "selfie", ambos: "photo ID and selfie" },
  es: { doc: "documento con foto", selfie: "selfie", ambos: "documento con foto y selfie" },
};
const MOTIVO: Record<string, Record<string, string>> = {
  pt: { ilegivel: "a foto ficou sem nitidez e não deu para ler os dados", reflexo: "a foto ficou com reflexo e não deu para ler os dados", cortado: "o documento apareceu cortado ou incompleto (precisa aparecer inteiro)", selfie: "a selfie não ficou boa (rosto inteiro, sem óculos escuros nem boné, em lugar claro)", vencido: "o documento está vencido", titular: "o documento não é do titular do cadastro (em empresa, precisa ser do sócio administrador)", outro: "o Asaas não conseguiu conferir o que foi enviado" },
  en: { ilegivel: "the photo was blurry and the details could not be read", reflexo: "the photo had glare and the details could not be read", cortado: "the document was cut off or incomplete (it must show entirely)", selfie: "the selfie was not clear (whole face, no sunglasses or cap, good light)", vencido: "the document is expired", titular: "the document is not from the account holder (for a company, it must be the managing partner)", outro: "Asaas could not verify what was sent" },
  es: { ilegivel: "la foto salió borrosa y no se pudieron leer los datos", reflexo: "la foto tenía reflejo y no se pudieron leer los datos", cortado: "el documento salió cortado o incompleto (tiene que verse entero)", selfie: "la selfie no salió bien (cara entera, sin lentes de sol ni gorra, con buena luz)", vencido: "el documento está vencido", titular: "el documento no es del titular de la cuenta (en empresa, tiene que ser del socio administrador)", outro: "Asaas no pudo verificar lo que se envió" },
};
// texto do Asaas sem quebra de linha nem espaço sobrando (o WhatsApp recusa parâmetro com \n ou 4 espaços), no máximo 160 letras
const limpa = (s: unknown) => String(s ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").replace(/[<>{}]/g, "").trim().slice(0, 160);
function motivoRej(dc: any) {
  const rej = (dc?.data || []).filter((d: any) => d.status === "REJECTED");
  const tipos = new Set(rej.map((d: any) => d.type));
  const oque = tipos.has("IDENTIFICATION_SELFIE") && tipos.size === 1 ? "selfie" : tipos.has("IDENTIFICATION_SELFIE") ? "ambos" : "doc";
  const r = limpa(dc?.rejectReasons);
  const n = r.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const motivo = /reflex|flash|brilho|glare/.test(n) ? "reflexo"
    : /ilegiv|legib|nitid|qualidade|borr|desfoc|escur|resoluc|blur|illegib|leitura/.test(n) ? "ilegivel"
    : /cortad|borda|incomplet|verso|inteir|parcial/.test(n) ? "cortado"
    : /vencid|validade|expirad/.test(n) ? "vencido"
    : /titular|socio|administrador|divergen|nao corresponde|terceiro|outra pessoa|nao pertence/.test(n) ? "titular"
    : /selfie|rosto|face|biometr|prova de vida/.test(n) ? "selfie"
    : oque === "selfie" ? "selfie" : "outro";
  return { oque, motivo, motivo_txt: motivo === "outro" && r.length >= 6 ? r : "", rej };
}
const motivoTexto = (l: string, m: { motivo: string; motivo_txt: string }) => m.motivo === "outro" && m.motivo_txt && l === "pt" ? m.motivo_txt : MOTIVO[l][m.motivo] || MOTIVO[l].outro;
const PUSH_REJ: Record<string, (o: string, m: string) => { title: string; body: string }> = {
  pt: (o, m) => ({ title: "Documento não aprovado: envie de novo", body: `O Asaas não aprovou: ${o}. Motivo: ${m}. Toque para enviar de novo.` }),
  en: (o, m) => ({ title: "Document not approved: send it again", body: `Asaas did not approve: ${o}. Reason: ${m}. Tap to send it again.` }),
  es: (o, m) => ({ title: "Documento no aprobado: envíalo de nuevo", body: `Asaas no aprobó: ${o}. Motivo: ${m}. Toca para enviarlo de nuevo.` }),
};
const ES_DDI = ["34", "51", "52", "53", "54", "56", "57", "58", "502", "503", "504", "505", "506", "507", "591", "593", "595", "598"];
function waNum(s: unknown) {
  let d = String(s ?? "").replace(/\D/g, "");
  if (/^5555\d{10,11}$/.test(d)) d = d.slice(2);
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) d = "55" + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}
const primeiro = (n: unknown) => { const p = String(n || "").trim().split(/\s+/)[0] || ""; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""; };
async function d360Key() {
  const env = Deno.env.get("D360_API_KEY") || "";
  if (env) return env;
  const { data } = await db.from("segredos_app").select("valor").eq("nome", "D360_API_KEY").maybeSingle();
  return String(data?.valor || "");
}
// modelo criado sozinho (no máximo 1 tentativa por dia); sem aprovação da Meta o WhatsApp não sai, só o push
async function modeloRej(key: string, cfg: any) {
  const r = await fetch(`${D360}/v1/configs/templates?limit=1000`, { headers: { "D360-API-KEY": key } });
  if (!r.ok) return [] as string[];
  const jt: any = await r.json().catch(() => ({}));
  const ts: any[] = jt.waba_templates || jt.data || [];
  const meus = ts.filter((t) => t?.name === MOD_REJ);
  const ok = meus.filter((t) => String(t.status).toLowerCase() === "approved" && String(t.category).toUpperCase() === "UTILITY").map((t) => String(t.language));
  if (!cfg?.docrej_modelo_em || Date.parse(cfg.docrej_modelo_em) < Date.now() - 864e5) {
    await db.from("resgate_config").update({ docrej_modelo_em: new Date().toISOString() }).eq("id", 1);
    for (const lc of Object.keys(MOD_REJ_TXT).filter((lc) => !meus.some((t) => String(t.language) === lc))) {
      const c = await fetch(`${D360}/v1/configs/templates`, {
        method: "POST", headers: { "D360-API-KEY": key, "content-type": "application/json" },
        body: JSON.stringify({ name: MOD_REJ, category: "UTILITY", language: lc, components: [
          { type: "BODY", text: MOD_REJ_TXT[lc], example: { body_text: [MOD_REJ_EX[lc]] } },
          { type: "BUTTONS", buttons: [{ type: "URL", text: MOD_REJ_BTN[lc], url: `${SITE}/documento/?t={{1}}`, example: [`${SITE}/documento/?t=3f2b6c1e-8d4a-4b7e-9c2d-1a5e7f9b0c3d`] }] },
        ] }),
      });
      console.log("modelo documento_reenviar criado", lc, c.status, c.ok ? "" : (await c.text()).slice(0, 300));
    }
  }
  return ok;
}
const janela = () => { const h = (new Date().getUTCHours() + 21) % 24; return h >= 8 && h < 21; }; // Brasília, sem horário de verão
async function avisarRejeitados(simular: boolean) {
  const { data: cfg } = await db.from("resgate_config").select("docrej_ativo, docrej_modelo_em").eq("id", 1).maybeSingle();
  const { data: cs } = await db.from("asaas_contas").select("user_id, nome, rejeicao_chave, rejeicao_motivo, rejeicao_em, rejeicao_proximo, rejeicao_avisos, reenvio_token").is("aprovada_em", null).limit(30);
  const out: any[] = [];
  let key = "", modelos: string[] | null = null;
  for (const c of cs || []) {
    const bruto: { dc?: any } = {};
    const s: any = await situacao(c.user_id, false, bruto);
    if (s.sem_chave || !bruto.dc?.data) continue; // o Asaas não respondeu: não mexe em nada
    const m = motivoRej(bruto.dc);
    if (s.geral === "APPROVED" || !m.rej.length) {
      // reenviou (em análise) ou aprovou: para os lembretes
      if (c.rejeicao_em || c.rejeicao_chave) {
        if (!simular) await db.from("asaas_contas").update({ rejeicao_chave: null, rejeicao_em: null, rejeicao_proximo: null, rejeicao_avisos: 0 }).eq("user_id", c.user_id);
        out.push({ user_id: c.user_id, estado: "resolvido" });
      }
      continue;
    }
    const chave = m.rej.map((g: any) => `${g.id}:${(g.documents || []).filter((d: any) => d.status === "REJECTED").map((d: any) => d.id).sort().join(",")}`).sort().join("|");
    let row = { ...c };
    if (chave !== c.rejeicao_chave) {
      // pausa combinada à mão (rejeicao_proximo no futuro sem chave): só guarda a recusa atual, sem avisar antes da hora
      const pausa = !c.rejeicao_chave && c.rejeicao_proximo && Date.parse(c.rejeicao_proximo) > Date.now();
      row = { ...c, rejeicao_chave: chave, rejeicao_motivo: m.motivo, rejeicao_em: new Date().toISOString(), rejeicao_proximo: pausa ? c.rejeicao_proximo : new Date().toISOString(), rejeicao_avisos: 0, reenvio_token: c.reenvio_token || crypto.randomUUID() };
      if (!simular) await db.from("asaas_contas").update({ rejeicao_chave: row.rejeicao_chave, rejeicao_motivo: row.rejeicao_motivo, rejeicao_em: row.rejeicao_em, rejeicao_proximo: row.rejeicao_proximo, rejeicao_avisos: 0, reenvio_token: row.reenvio_token }).eq("user_id", c.user_id);
    }
    const temLink = m.rej.some((g: any) => g.onboardingUrl);
    const vez = !!row.rejeicao_proximo && Date.parse(row.rejeicao_proximo) <= Date.now() && row.rejeicao_avisos < 20;
    const item: any = { user_id: c.user_id, oque: m.oque, motivo: m.motivo, motivo_asaas: m.motivo_txt || null, avisos: row.rejeicao_avisos, proximo: row.rejeicao_proximo, link: temLink };
    out.push(item);
    if (!vez || !temLink || !janela() || cfg?.docrej_ativo === false) { item.envio = !temLink ? "sem_link_ainda" : !vez ? "aguardando" : !janela() ? "fora_do_horario" : "desligado"; continue; }
    if (simular) { item.envio = "simulado"; continue; }
    // trava: só quem conseguir mudar o próximo aviso manda (nunca sai duas vezes)
    const prox = new Date(Date.now() + (row.rejeicao_avisos < 6 ? 24 : 72) * 36e5).toISOString();
    const { data: foi } = await db.from("asaas_contas").update({ rejeicao_proximo: prox, rejeicao_avisos: row.rejeicao_avisos + 1 }).eq("user_id", c.user_id).eq("rejeicao_proximo", row.rejeicao_proximo).select("user_id");
    if (!foi?.length) { item.envio = "outro_robo"; continue; }
    const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", c.user_id);
    const { data: pf } = await db.from("perfis").select("nome, telefone").eq("user_id", c.user_id).maybeSingle();
    const to = waNum(pf?.telefone);
    const l0 = (subs || []).map((x) => x.lang).find((x) => ["pt", "en", "es"].includes(x));
    const l = l0 && !(l0 === "pt" && to && !to.startsWith("55")) ? l0 : !to || to.startsWith("55") ? "pt" : ES_DDI.some((d) => to.startsWith(d)) ? "es" : "en";
    // push (app e iPhone)
    let pushes = 0;
    const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
    if (k) {
      webpush.setVapidDetails(SITE, k.publica, k.privada);
      for (const x of subs || []) {
        const lx = ["pt", "en", "es"].includes(x.lang) ? x.lang : "pt";
        try { await webpush.sendNotification({ endpoint: x.endpoint, keys: { p256dh: x.p256dh, auth: x.auth } }, JSON.stringify({ ...PUSH_REJ[lx](OQUE[lx][m.oque], motivoTexto(lx, m)), url: "/login/", tag: "docs-recusado" }), { TTL: 43200, urgency: "high" }); pushes++; }
        catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", x.endpoint); }
      }
    }
    // WhatsApp pelo número oficial (modelo de Utilidade: sai mesmo fora da janela de 24 h)
    let wa = "sem_telefone";
    if (to) {
      key = key || await d360Key();
      if (key && modelos === null) modelos = await modeloRej(key, cfg).catch(() => []);
      const lc = LCW[l];
      if (!key) wa = "sem_chave";
      else if (!modelos?.includes(lc)) wa = "modelo_em_aprovacao";
      else {
        const nome = primeiro(pf?.nome) || primeiro(c.nome) || (l === "en" ? "there" : "");
        const r = await fetch(`${D360}/messages`, { method: "POST", headers: { "D360-API-KEY": key, "content-type": "application/json" }, body: JSON.stringify({
          messaging_product: "whatsapp", recipient_type: "individual", to, type: "template",
          template: { name: MOD_REJ, language: { code: lc }, components: [
            { type: "body", parameters: [nome, OQUE[l][m.oque], motivoTexto(l, m)].map((text) => ({ type: "text", text: limpa(text) || "-" })) },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: row.reenvio_token }] },
          ] } }) });
        wa = r.ok ? "enviado" : "falhou";
        if (!r.ok) console.error("documento_reenviar falhou", r.status, (await r.text()).slice(0, 300));
      }
    }
    item.envio = { push: pushes, whatsapp: wa };
  }
  return { contas: out };
}
// página /documento/?t= (botão do WhatsApp): sem login; o token só abre o envio do documento da própria pessoa
async function reenvio(t: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return { estado: "invalido" };
  const { data: c } = await db.from("asaas_contas").select("user_id, nome, aprovada_em").eq("reenvio_token", t).maybeSingle();
  if (!c) return { estado: "invalido" };
  if (c.aprovada_em) return { estado: "aprovado" };
  const bruto: { dc?: any } = {};
  const s: any = await situacao(c.user_id, true, bruto);
  const nome = primeiro((await db.from("perfis").select("nome").eq("user_id", c.user_id).maybeSingle()).data?.nome) || primeiro(c.nome);
  if (s.geral === "APPROVED") return { estado: "aprovado", nome };
  if (!bruto.dc?.data) return { estado: "erro" };
  const m = motivoRej(bruto.dc);
  if (m.rej.length) return { estado: s.url ? "recusado" : "preparando", nome, oque: m.oque, motivo: m.motivo, motivo_txt: m.motivo_txt || undefined, url: s.url };
  if (s.url) return { estado: "falta", nome, url: s.url };
  return { estado: "analise", nome };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  try {
    const b0 = await req.clone().json().catch(() => ({}));
    if (b0?.acao === "reenvio") return json(await reenvio(String(b0.t || "")));
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
    if (b.rejeitados === true) {
      if (!ch) return json({ erro: "acesso" }, 403); // só o robô
      return json(await avisarRejeitados(b.simular === true));
    }
    if (b.lembrar === true) {
      if (!ch) return json({ erro: "acesso" }, 403); // só o robô
      const { data: cs } = await db.from("asaas_contas").select("user_id").is("aprovada_em", null).limit(30);
      const falta: string[] = [];
      for (const c of cs || []) { const s = await situacao(c.user_id); if (s.geral !== "APPROVED" && (s.docs || []).some((d: any) => d.status === "NOT_SENT" && d.link) && !(s.docs || []).some((d: any) => d.status === "REJECTED")) falta.push(c.user_id); }
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
    return json(await situacao(alvo, b.link === true));
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
