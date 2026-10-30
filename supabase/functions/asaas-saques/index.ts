// Búzios Lanchas: webhook de validação de saques do Asaas (Rodrigo 2026-10-30, resposta do Asaas sobre transferências automáticas).
// Sem IP fixo, toda transferência pela API esperaria o Rodrigo aprovar com token/SMS. Com este mecanismo ligado no Asaas
// (Integrações > Mecanismos de segurança > Validação de saque via webhook), o Asaas pergunta aqui, cerca de 5 segundos depois
// de cada saída de dinheiro, se pode seguir. Responde {status:"APPROVED"} ou {status:"REFUSED", refuseReason}.
// Sem resposta (ou 3 falhas seguidas) o Asaas cancela a transferência: na dúvida, recusa.
// Libera:
//  - transferências que o nosso sistema criou (repasse ao dono, comissão do vendedor, saque do dono/vendedor), com o mesmo valor;
//  - no saque do dono/vendedor, só se a chave Pix for a cadastrada e for do mesmo CPF/CNPJ da subconta (proteção contra fraude);
//  - saída da conta da Búzios para conta do próprio CNPJ da Búzios (o Rodrigo sacando pelo painel);
//  - devolução de Pix ao cliente (o dinheiro só volta para quem pagou).
// Recusa todo o resto e avisa os administradores no celular. Cada pergunta e resposta fica em asaas_validacoes.
// Segredo (Edge Functions > Secrets): ASAAS_SAQUES_TOKEN, o mesmo "token de autenticação" colado no Asaas (vem no cabeçalho asaas-access-token).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const KEY = () => Deno.env.get("ASAAS_API_KEY") || "";
const API = () => (KEY().includes("_hmlg_") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3");
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const igual = (a: unknown, b: unknown) => Math.round(+(a as number) * 100) === Math.round(+(b as number) * 100);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
// o Asaas manda o CPF/CNPJ do destino mascarado ("***.828.036-**", visto no sandbox em 2026-10-30):
// confere dígito a dígito o que aparece e exige pelo menos 6 dígitos visíveis
function mesmoDoc(mascarado: unknown, real: unknown) {
  const m = String(mascarado ?? "").replace(/[^\d*]/g, ""), r = dig(real);
  if (!m || m.length !== r.length || m.replace(/\*/g, "").length < 6) return false;
  return [...m].every((c, i) => c === "*" || c === r[i]);
}

// comparação em tempo constante do token
function tokenOk(t: string) {
  const s = Deno.env.get("ASAAS_SAQUES_TOKEN") || "";
  if (!s || t.length !== s.length) return false;
  let d = 0; for (let i = 0; i < s.length; i++) d |= s.charCodeAt(i) ^ t.charCodeAt(i);
  return d === 0;
}

let cnpjProprio = "";
async function proprio() { // CNPJ da conta principal da Búzios, lido do Asaas
  if (cnpjProprio || !KEY()) return cnpjProprio;
  const r = await fetch(API() + "/myAccount/commercialInfo", { headers: { access_token: KEY(), "user-agent": "buzios-lanchas" } }).catch(() => null);
  const j: any = r?.ok ? await r.json().catch(() => ({})) : {};
  return (cnpjProprio = dig(j?.cpfCnpj));
}

async function pushAdmins(title: string, body: string, tag: string) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: adm } = await db.from("admins").select("user_id");
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth").in("user_id", (adm || []).map((a: any) => a.user_id));
  for (const s of subs || []) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, url: "/login/", tag }), { TTL: 86400, urgency: "high" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}

// o dono/vendedor fica sabendo por que o saque não saiu
const RECUSA: Record<string, (v: string) => { title: string; body: string }> = {
  pt: (v) => ({ title: "Saque não enviado", body: `O saque de ${v} foi recusado: a chave Pix precisa estar no mesmo CPF/CNPJ da sua conta. Troque a chave na área de vendas e tente de novo.` }),
  en: (v) => ({ title: "Withdrawal not sent", body: `The ${v} withdrawal was refused: the Pix key must belong to the same CPF/CNPJ as your account. Change the key in the sales area and try again.` }),
  es: (v) => ({ title: "Retiro no enviado", body: `El retiro de ${v} fue rechazado: la llave Pix debe estar en el mismo CPF/CNPJ de tu cuenta. Cambia la llave en el área de ventas e inténtalo de nuevo.` }),
};
async function avisarRecusa(uid: string, valor: number) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", uid);
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...RECUSA[l](brl(valor)), url: "/login/", tag: "saque-recusado" }), { TTL: 86400, urgency: "high" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}

type Achado = { origem: "repasse" | "comissao" | "saque"; valor?: number; saque?: any };
// procura a transferência nos nossos registros. O id só é gravado depois que o Asaas responde à criação,
// então, se algum envio ainda está "enviando", espera um pouco (o Asaas pergunta uns 5 s depois de criar).
async function procurar(id: string): Promise<Achado | null> {
  for (let i = 0; i < 8; i++) {
    const { data: r } = await db.from("repasses_pp").select("valor").eq("comprovante", "asaas:" + id).maybeSingle();
    if (r) return { origem: "repasse", valor: +r.valor };
    const { data: c } = await db.from("pedidos").select("id").eq("comissao_comprovante", "asaas:" + id).maybeSingle();
    if (c) return { origem: "comissao" };
    const { data: s } = await db.from("saques").select("id, user_id, valor, chave, status").eq("asaas_id", id).maybeSingle();
    if (s) return { origem: "saque", valor: +s.valor, saque: s };
    const pend = await Promise.all([
      db.from("repasses_pp").select("pedido", { count: "exact", head: true }).eq("comprovante", "asaas:enviando"),
      db.from("pedidos").select("id", { count: "exact", head: true }).eq("comissao_comprovante", "asaas:enviando"),
      db.from("saques").select("id", { count: "exact", head: true }).eq("status", "enviando"),
    ]);
    if (!pend.some((p) => (p.count || 0) > 0)) return null;
    await espera(1000);
  }
  return null;
}

async function decidir(b: any): Promise<{ ok: boolean; motivo?: string; id?: string; valor?: number }> {
  const tipo = String(b?.type || "");
  if (tipo === "PIX_REFUND") return { ok: true, motivo: "devolução ao cliente", id: b?.pixRefund?.id, valor: +b?.pixRefund?.value || undefined };
  if (tipo === "PAYMENT_SPLIT") { // liquidação de split: só das cobranças que o site criou
    const sp = b?.paymentSplit || {};
    const pid = String(sp.paymentId || sp.payment || "");
    const { data } = pid ? await db.from("pagamentos_asaas").select("id").eq("asaas_id", pid).maybeSingle() : { data: null };
    return data ? { ok: true, id: sp.id, valor: +sp.totalValue || +sp.fixedValue || undefined } : { ok: false, motivo: "Split de cobrança desconhecida", id: sp.id };
  }
  if (tipo !== "TRANSFER") return { ok: false, motivo: "Operação não permitida pelo sistema da Búzios Lanchas" };
  const t = b?.transfer || {}, id = String(t.id || ""), valor = +t.value;
  const doc = String(t?.bankAccount?.cpfCnpj || ""), chave = String(t?.bankAccount?.pixAddressKey || "");
  if (!id) return { ok: false, motivo: "Transferência sem id" };
  const a = await procurar(id);
  if (a?.origem === "saque") {
    const s = a.saque, { data: ct } = await db.from("asaas_contas").select("cpf_cnpj").eq("user_id", s.user_id).maybeSingle();
    if (!igual(valor, a.valor)) return { ok: false, motivo: "Valor diferente do pedido de saque", id, valor };
    if (chave && dig(chave) !== dig(s.chave) && chave.trim().toLowerCase() !== String(s.chave).trim().toLowerCase()) return { ok: false, motivo: "Chave Pix diferente da cadastrada", id, valor };
    if (!ct?.cpf_cnpj || !mesmoDoc(doc, ct.cpf_cnpj)) {
      await db.from("saques").update({ status: "falhou", motivo: "cpf" }).eq("id", s.id);
      await avisarRecusa(s.user_id, valor).catch((e) => console.error("avisarRecusa", e));
      return { ok: false, motivo: "A chave Pix não é do mesmo CPF/CNPJ da conta", id, valor };
    }
    return { ok: true, id, valor };
  }
  if (a) {
    if (a.valor !== undefined && !igual(valor, a.valor)) return { ok: false, motivo: "Valor diferente do registrado", id, valor };
    return { ok: true, id, valor };
  }
  // feita fora do site (painel do Asaas): só para conta do próprio CNPJ da Búzios
  const meu = await proprio();
  if (meu && mesmoDoc(doc, meu)) return { ok: true, motivo: "conta do próprio CNPJ", id, valor };
  return { ok: false, motivo: "Transferência não reconhecida pelo sistema da Búzios Lanchas", id, valor };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  if (!tokenOk(req.headers.get("asaas-access-token") || "")) return json({ erro: "token" }, 401);
  const b = await req.json().catch(() => null);
  if (!b) return json({ status: "REFUSED", refuseReason: "Corpo inválido" });
  let d: { ok: boolean; motivo?: string; id?: string; valor?: number };
  try { d = await decidir(b); }
  catch (e) { console.error("validar", e); d = { ok: false, motivo: "Erro ao conferir" }; }
  const tipo = String(b?.type || "?");
  await db.from("asaas_validacoes").insert({ tipo, asaas_id: d.id || null, valor: Number.isFinite(d.valor) ? d.valor : null, decisao: d.ok ? "APPROVED" : "REFUSED", motivo: d.motivo || null, corpo: b })
    .then(({ error }) => error && console.error("asaas_validacoes", error.message));
  if (!d.ok) await pushAdmins("🚫 Saída recusada no Asaas", `${d.valor ? brl(d.valor) + ": " : ""}${d.motivo}. Se foi você, peça para liberar esse tipo de saída.`, "asaas-recusa-" + (d.id || Date.now()))
    .catch((e) => console.error("push", e));
  return json(d.ok ? { status: "APPROVED" } : { status: "REFUSED", refuseReason: String(d.motivo || "Recusado").slice(0, 200) });
});
