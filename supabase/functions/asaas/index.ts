// Búzios Lanchas: pagamento do sinal pelo Asaas (Rodrigo, 2026-10-24). Conta de produção da Buzios Lanchas Ltda,
// mas só aparece na página escondida /pagar/?p=&k=&asaas=1 até o Rodrigo testar e liberar.
// O cliente paga Pix ou cartão com todas as taxas por conta dele (o valor sobe para a Búzios receber o sinal inteiro).
// Split: a parte do dono (pedidos.repasse_dono) vai direto para a subconta Asaas do dono; o resto (comissão da Búzios + vendedor) fica na conta da Búzios.
// GET  ?p&k                                  valores de Pix e cartão para a página
// POST {acao:"pagar", p, k, metodo, n?, cpf?} a página: cria (ou reaproveita) a cobrança e devolve o Pix ou o link do cartão (n = 1 a 6 parcelas; cartão só com 5+ dias até o passeio)
// POST {acao:"conferir", p, k}                a página: confere no Asaas se já foi pago
// POST {acao:"conta", ...dados} (login)      dono: cria a subconta Asaas dele (o Asaas manda o e-mail para ele ativar e mandar os documentos)
// POST {acao:"documentos"} (login)          dono/vendedor: link do Asaas para enviar documento e selfie (BaaS), ou a situação da análise
// POST {acao:"minha"} (login)                dono: se já tem conta Asaas
// POST {acao:"faltam"} (login admin)         lanchas com dono sem conta Asaas (+ vendedores com conta)
// POST {acao:"comissao", pid, antecipar?} (login admin)  depois do passeio (ou antes, com antecipar e o sinal pago): transfere a comissão do vendedor para a conta Asaas dele (Rodrigo 2026-10-25, um toque)
// POST {acao:"repasses", pids?} (login admin) "O PayPal caiu": manda do saldo do Asaas a parte de cada dono dos sinais pagos pelo PayPal (Rodrigo 2026-10-25)
// POST {acao:"comprovante", pid} (vendedor do pedido ou admin) link do comprovante da comissão (Asaas ou o anexo do Pix)
// POST {acao:"aprovar"}                       (admin) quantas transferências estão esperando aprovação do Rodrigo no Asaas
// POST {acao:"cancelar", pid|pids} (admin ou chave de serviço) cancela as cobranças abertas do pedido (recusado, sinal trocado)
// POST {acao:"sacar_buzios", valor, chave, req} (login admin)  saque Pix para chave no CNPJ da Búzios, só até a parte da Búzios
// POST {acao:"buscar_recebedor", q} (login admin)  procura quem tem conta Asaas aprovada para o Transferir do card
// POST {acao:"transferir_buzios", user_id, valor, motivo, req} (login admin)  transfere do saldo só até a parte da Búzios (card da planilha)
// POST {acao:"planilha"} / {acao:"recibo", tipo, pid|id} (login admin)  planilha de vendas: pagamentos, quando caem, repasses e comprovantes
// POST {acao:"webhook"} (login admin)         registra o aviso de pagamento no Asaas apontando para esta função
// POST {event, payment} (do Asaas)           aviso de pagamento: confere a cobrança direto no Asaas antes de marcar como paga
// POST {acao:"expirar"} (cron a cada 10 min) cancela no Asaas as cobranças com mais de 2 horas sem pagamento (a data volta para o site); pré-reserva com pagar_ate só depois desse prazo
// Pagou: a reserva se confirma sozinha (rpc confirmar_pago), sem o administrador aprovar (Rodrigo, 2026-10-25).
// Gerou o Pix ou o cartão: a data fica segurada por 2 horas para esse cliente (pp_vaga e datas_seguradas).
// POST {event:"ACCOUNT_STATUS_..."} (do Asaas, webhook da subconta) a análise do documento e da selfie mudou: confere no Asaas e, aprovada, avisa a pessoa
// Chave (Edge Functions > Secrets, colada pelo Rodrigo): ASAAS_API_KEY. A chave de cada subconta fica em asaas_chaves CIFRADA
// com o segredo ASAAS_CHAVES_SEGREDO (AES-GCM); sem esse segredo a chave não é guardada (a conta principal gera outra no Asaas).
// Saídas de dinheiro sem token/SMS: webhook de validação de saques na função asaas-saques.
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
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const KEY = () => Deno.env.get("ASAAS_API_KEY") || "";
const API = () => (KEY().includes("_hmlg_") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3");
const FN_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1/asaas";
const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const up2 = (v: number) => Math.ceil(Math.round(v * 10000) / 100) / 100; // arredonda para cima, no centavo
const dataBR = (d: string) => d.split("-").reverse().join("/");
const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const SEGURA_MS = 2 * 36e5; // a data fica segurada por 2 horas depois de gerar o pagamento (Rodrigo, 2026-10-25)
// pagamento só até 1 hora antes do início do passeio (Rodrigo, 2026-10-25): manhã e dia 10h, tarde 14h, noite 20h (Brasília, UTC-3)
const INICIO: Record<string, number> = { manha: 10, dia: 10, tarde: 14, noite: 20 };
const ANTES_MS = 40 * 6e4; // pagamento até 40 minutos antes do início (Rodrigo 2026-11-11; era 1 hora)
const tarde = (d: string, h: string) => Date.parse(`${d}T${String(INICIO[h] ?? 10).padStart(2, "0")}:00:00-03:00`) - ANTES_MS <= Date.now();
// horário combinado do passeio (Rodrigo 2026-11-11): usa a hora de entrada do pedido ou do passeio na agenda (rpc inicio_combinado); sem ela, o horário padrão acima
async function tardeCombinado(p: any) {
  const { data, error } = await db.rpc("inicio_combinado", { d: p.data, h: p.horario, hi: p.hora_ini ?? null, bid: p.bloqueio_id ?? null });
  if (error || !data) return tarde(p.data, p.horario);
  return Date.parse(String(data).slice(0, 19) + "-03:00") - ANTES_MS <= Date.now();
}
// fim do passeio (Brasília): manhã 14h, dia 17h, tarde 18h, noite no dia seguinte
const FIM: Record<string, number> = { manha: 14, dia: 17, tarde: 18, noite: 24 };
// hora_fim do passeio na agenda ('HH:MM'), quando o dono anotou, vale no lugar do fim do horário
const acabou = (d: string, h: string, fim?: string | null) => { const [fh, fm] = String(fim || "").split(":").map(Number);
  return Date.parse(`${d}T00:00:00-03:00`) + (fim && !isNaN(fh) ? fh + (fm || 0) / 60 : FIM[h] ?? 24) * 36e5 <= Date.now(); };
// repasse do jetski (Rodrigo 2026-11-17): libera 2 h antes da saída combinada da lancha (rpc inicio_combinado; sem ela, o horário padrão)
const JETSKI_ANTES_MS = 2 * 36e5;
async function jetskiLibera(p: any) {
  const { data, error } = await db.rpc("inicio_combinado", { d: p.data, h: p.horario, hi: p.hora_ini ?? null, bid: p.bloqueio_id ?? null });
  const ini = !error && data ? Date.parse(String(data).slice(0, 19) + "-03:00") : Date.parse(`${p.data}T${String(INICIO[p.horario] ?? 10).padStart(2, "0")}:00:00-03:00`);
  return !isNaN(ini) && ini - JETSKI_ANTES_MS <= Date.now();
}
// fim do horário do jet ski (Rodrigo 2026-11-19): início + tempo pago + cortesia, no dia do passeio (Brasília); sem horário anotado, o fim do passeio
function jetskiAcabou(p: any) {
  const ini = String(p.jetski_ini || "").slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(ini)) return acabou(p.data, p.horario, p.hora_fim);
  const t = Date.parse(`${p.data}T${ini}:00-03:00`) + ((+p.jetski_min || 0) + (+p.jetski_cortesia || 0)) * 60e3;
  return !isNaN(t) && t <= Date.now();
}
// cartão só com 5 dias ou mais até o passeio (Rodrigo 2026-10-25; era 7, mudou para 5 em 2026-10-29): o cartão cai em cerca de 2 dias mesmo com antecipação,
// e o dono está acostumado a receber a parte dele antes do passeio; mais em cima da hora, só Pix (cai na hora)
const CARTAO_DIAS = 5;
// cartão estrangeiro (central em dólar/euro, cartão internacional sem CPF): nunca antecipável no Asaas (risco de chargeback) e
// compensa em 8 dias úteis (Mayara/Asaas 2026-11-19). Lancha parceira: o dono quer receber rápido, antes do passeio, então
// estrangeiro NUNCA paga cartão pelo Asaas em parceira (Rodrigo 2026-11-19); fica Pix e PayPal. Só a Miss Bardot aceita
// Miss Bardot (lancha da Búzios): cartão a qualquer prazo, sem a regra dos dias (Rodrigo 2026-11-17); o fechamento 40 min antes continua
// cartaoDias: dias antes do passeio para o aviso da página (estrangeiro em parceira: -1 = nunca)
const cartaoDias = (lancha?: string, fora = false) => lancha === "miss-bardot" ? 0 : fora ? -1 : CARTAO_DIAS;
const cartaoOk = (d: string, lancha?: string, fora = false) => lancha === "miss-bardot" || (!fora && (Date.parse(`${d}T00:00:00Z`) - Date.parse(new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10) + "T00:00:00Z")) / 864e5 >= CARTAO_DIAS);
// chave da subconta cifrada (revisão de segurança 2026-10-28): no banco só fica "v1:<iv>:<cifra>"
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const de64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function segredo() {
  const s = Deno.env.get("ASAAS_CHAVES_SEGREDO") || "";
  if (s.length < 32) throw new Error("sem_segredo");
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function cifrar(txt: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return `v1:${b64(iv)}:${b64(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await segredo(), new TextEncoder().encode(txt))))}`;
}
async function chaveSub(uid: string) {
  const { data: k } = await db.from("asaas_chaves").select("api_key").eq("user_id", uid).maybeSingle();
  const [v, iv, ct] = String(k?.api_key || "").split(":");
  if (v !== "v1" || !iv || !ct) return "";
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: de64(iv) }, await segredo(), de64(ct))); }
  catch (e) { console.error("chaveSub", uid, e); return ""; }
}
// e-mail de contato (aviso do push e dos webhooks do Asaas): segredo CONTATO_EMAIL ou o e-mail do primeiro administrador; fora do código
let CONTATO = "";
async function contato() {
  if (CONTATO) return CONTATO;
  let e = Deno.env.get("CONTATO_EMAIL") || "";
  if (!e) { const { data: a } = await db.from("admins").select("user_id").limit(1).maybeSingle(); if (a) e = (await db.auth.admin.getUserById(a.user_id)).data?.user?.email || ""; }
  CONTATO = e || "contato@lanchaembuzios.com.br";
  return CONTATO;
}
// ate = prazo da pré-reserva (pedidos.pagar_ate): a cobrança continua valendo até lá
const vale = (r: any, ate?: string | null) => !!r && (!!r.pago_em || Date.now() - new Date(r.criado_em).getTime() < SEGURA_MS || (!!ate && new Date(ate).getTime() > Date.now()));

async function asaas(path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  if (!KEY()) throw new Error("sem_chaves");
  const r = await fetch(API() + path, { method, headers: { access_token: KEY(), "content-type": "application/json", "user-agent": "buzios-lanchas" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch (_) { /* vazio */ }
  if (!r.ok) { console.error("asaas", method, path, r.status, t.slice(0, 800)); const e: any = new Error(j?.errors?.[0]?.description || `asaas ${r.status}`); e.asaas = true; e.status = r.status; throw e; }
  return j;
}
// cancela no Asaas as cobranças ainda não pagas de um pedido (menos a que foi paga): pedido recusado, sinal trocado, ou o cliente já pagou pela outra forma
async function cancelarAbertas(pid: number, menos?: number) {
  const { data: rs } = await db.from("pagamentos_asaas").select("id, asaas_id").eq("pedido", pid).is("pago_em", null);
  let n = 0;
  for (const r of rs || []) {
    if (r.id === menos) continue;
    if (await conferir(r.asaas_id).catch(() => false)) continue; // pagou em cima da hora: fica registrado
    if (await cancelar(r.asaas_id)) { await db.from("pagamentos_asaas").delete().eq("id", r.id).is("pago_em", null); n++; }
  }
  return n;
}
// cancela a cobrança no Asaas; só apaga o registro se o Asaas confirmou (ou ela já não existe), senão um Pix pago em cima da hora se perderia.
// Cartão parcelado: apaga o parcelamento inteiro (todas as parcelas), não só a primeira.
const cancelar = async (id: string) => {
  const inst = await asaas(`/payments/${id}`).then((pg: any) => pg?.installment || null, () => null);
  return asaas(inst ? `/installments/${inst}` : `/payments/${id}`, undefined, "DELETE").then(() => true, (e: any) => { console.error("apagar", id, e?.message); return e?.status === 404; });
};

function cpfOk(c: string) {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10];
}
function cnpjOk(c: string) {
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (n: number) => { const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += +c[i] * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +c[12] && dv(13) === +c[13];
}

// taxas que o cliente paga (Rodrigo: o dono recebe 100% do neto, a Búzios e o vendedor também; as taxas ficam com o cliente)
async function taxas() {
  const { data } = await db.from("asaas_config").select("*").eq("id", 1).maybeSingle();
  return { pix: +(data?.pix_fixo ?? 1.99), pct: +(data?.cartao_pct ?? 2.99), pct6: +(data?.cartao_pct_2a6 ?? 3.49), fixo: +(data?.cartao_fixo ?? 0.49), ant: +(data?.antecipacao_pct ?? 1.34), antP: +(data?.antecipacao_parc_pct ?? 1.78) };
}
// cartão em até 6x (Rodrigo 2026-10-25): cada opção já com a taxa do cartão e a antecipação (ao mês, em média (n+1)/2 meses por parcela),
// para o dinheiro cair na hora e cada um receber cheio; o cliente vê a taxa e escolhe. Parcelas iguais: total = parcela × n.
// Taxas da proposta assinada em 29/10/2026, sempre o valor mais alto (Rodrigo: o cliente paga a taxa, nunca a Búzios): Pix R$ 1,99; 1x 2,99%, 2-6x 3,49% + R$ 0,49;
// antecipação 1,25%/mês (1x) e 1,70%/mês (2x+), com o cartão caindo em 32 dias: 1,34 e 1,78 (SQL 2026-10-29_supabase-asaas-taxas-proposta.sql).
const PARCELAS = 6;
async function totais(sinal: number) {
  const x = await taxas();
  const parcelas = Array.from({ length: PARCELAS }, (_, i) => {
    const n = i + 1, pct = (n === 1 ? x.pct + x.ant : x.pct6 + x.antP * (n + 1) / 2);
    const parcela = up2((sinal + x.fixo) / (1 - pct / 100) / n);
    return { n, parcela, total: Math.round(parcela * n * 100) / 100 };
  });
  return { pix: up2(sinal + x.pix), cartao: parcelas[0].total, parcelas };
}

// pedido + link da central (/pagar/?p=&k=), com o mesmo token da cobrança
async function carregar(pid: number, k: string) {
  if (!pid || !/^[0-9a-f-]{36}$/i.test(String(k || ""))) return null;
  const { data: c } = await db.from("pagamentos_pp").select("pedido, pago_em, moeda, captura").eq("pedido", pid).eq("token", k).maybeSingle();
  if (!c) return null;
  const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, horario, hora_ini, hora_fim, bloqueio_id, status, sinal_valor, sinal_liberado_em, comprovante_em, repasse_dono, jetski_valor, prazo_vencido_em, pagar_ate").eq("id", pid).maybeSingle();
  if (!p) return null;
  // várias lanchas num pagamento só (Rodrigo 2026-11-19): o link de qualquer lancha do grupo cobra pela reserva principal
  const g = await grupo(p.id);
  if (g.length > 1) {
    const pr = g.find((m: any) => m.principal);
    if (!pr) return null;
    if (pr.id !== p.id) {
      const { data: c2 } = await db.from("pagamentos_pp").select("pedido, pago_em, moeda, captura").eq("pedido", pr.id).maybeSingle();
      const { data: p2 } = await db.from("pedidos").select("id, cliente, lancha, data, horario, hora_ini, hora_fim, bloqueio_id, status, sinal_valor, sinal_liberado_em, comprovante_em, repasse_dono, jetski_valor, prazo_vencido_em, pagar_ate").eq("id", pr.id).maybeSingle();
      return c2 && p2 ? { c: c2, p: p2, g } : null;
    }
  }
  return { c, p, g: g.length > 1 ? g : [] };
}
// grupo do pedido (principal primeiro); [] fora de grupo. Erro no banco: para tudo, nunca cobra valor errado
async function grupo(pid: number): Promise<any[]> {
  const { data, error } = await db.rpc("pedido_grupo", { pid });
  if (error) { console.error("pedido_grupo", pid, error.message); throw new Error("grupo"); }
  return data || [];
}
// o que o cliente paga online pelo pedido inteiro: no grupo, a soma das lanchas (e jetskis) ainda pendentes
const onlineTotal = (p: any, g: any[]) => g.length > 1
  ? Math.round(g.filter((m: any) => m.status === "pendente").reduce((a: number, m: any) => a + online(m), 0) * 100) / 100
  : online(p);

// Prazo vencido com preço novo do dono: devolve a resposta de "preço novo" (409) enquanto o cliente não concordar com o valor exato;
// concordou, atualiza o pedido pelo alterar_pedido (o sinal acompanha) e devolve null para a cobrança seguir com o valor novo.
async function precoNovo(p: any, aceito: unknown): Promise<Response | null> {
  const { data: pn, error } = await db.rpc("preco_novo_pedido", { pid: p.id });
  if (error) { console.error("preco_novo_pedido", p.id, error.message); return null; }
  if (!pn?.mudou) return null;
  if (Math.round(+(aceito as number) || 0) !== Math.round(+pn.valor)) return json({ erro: "preco_novo", antigo: pn.antigo, valor: pn.valor }, 409);
  const { data: al, error: ea } = await db.rpc("alterar_pedido", { pid: p.id, p_horario: p.horario, p_hi: p.hora_ini || null, p_hf: p.hora_fim || null, p_valor: pn.valor });
  if (ea || !al?.ok) {
    console.error("preco_novo alterar", p.id, ea?.message || al?.erro);
    const e = String(al?.erro || "");
    return json({ erro: ["ocupada", "pagando", "jetski", "pago"].includes(e) ? (e === "pago" ? "pendente" : e) : "preco_novo_falhou" }, 409);
  }
  return null;
}

// o que o cliente paga online: sinal da lancha + jetski inteiro (Rodrigo 2026-11-15); o sinal_valor continua só da lancha
const online = (p: any) => (+p.sinal_valor || 0) > 0 ? Math.round(((+p.sinal_valor || 0) + (+p.jetski_valor || 0)) * 100) / 100 : 0;
// lanchas da própria Búzios Lanchas: o dono cadastrado não recebe parte nenhuma, tudo fica na conta da Búzios (Rodrigo 2026-10-25)
const SEM_REPASSE = ["miss-bardot"];
// conta Asaas do dono da lancha (um dono por lancha)
async function carteira(lancha: string) {
  if (SEM_REPASSE.includes(lancha)) return null;
  const { data: ds } = await db.from("donos").select("user_id").eq("lancha", lancha);
  const ids = (ds || []).map((d: any) => d.user_id);
  if (!ids.length) return null;
  // só conta aprovada (documento e selfie conferidos) recebe na hora; sem isso, a parte do dono fica no saldo dele (Rodrigo 2026-10-28)
  const { data } = await db.from("asaas_contas").select("wallet_id").in("user_id", ids).not("aprovada_em", "is", null).order("criado_em").limit(1).maybeSingle();
  return data?.wallet_id || null;
}

async function vaga(pid: number, segurar = false) {
  const { data, error } = await db.rpc("pp_vaga", { pid, segurar });
  if (error) { console.error("pp_vaga", error.message); return "livre"; }
  return String(data || "livre");
}

// semDoc: estrangeiro (central em dólar/euro), cobrança sem CPF/CNPJ: cartão internacional (Mayara/Asaas 2026-11-11) e Pix pago
// por app de fora (Mercado Pago da Argentina, Wise etc., Rodrigo 2026-11-17); se digitar um CPF, ele é usado
// CNPJ da Búzios Lanchas: documento do cadastro de estrangeiro no Asaas quando o Pix exige CPF/CNPJ (2026-11-19)
const CNPJ_BUZIOS = "32154099000172";

async function cliente(uid: string, cpfNovo: string, semDoc = false) {
  const { data: ja } = await db.from("asaas_clientes").select("customer_id, cpf").eq("user_id", uid).maybeSingle();
  const { data: cl } = await db.from("clientes").select("nome, cpf, whatsapp").eq("user_id", uid).maybeSingle();
  const cpf = dig(cl?.cpf) || cpfNovo, docOk = cpfOk(cpf) || cnpjOk(cpf);
  if (ja) {
    if (ja.cpf || (semDoc && !docOk)) return ja.customer_id as string;
    // cliente criado sem documento (pagou como estrangeiro) e agora paga em reais: completa o CPF no Asaas
    if (!docOk) return null;
    await asaas(`/customers/${ja.customer_id}`, { cpfCnpj: cpf });
    await db.from("asaas_clientes").update({ cpf }).eq("user_id", uid);
    return ja.customer_id as string;
  }
  if (!docOk && !semDoc) return null;
  const u = (await db.auth.admin.getUserById(uid)).data?.user;
  const email = u?.email && !/@sem-email\.lanchaembuzios\.com\.br$/.test(u.email) ? u.email : undefined;
  const tel = dig(cl?.whatsapp);
  const c = await asaas("/customers", { name: String(cl?.nome || u?.user_metadata?.nome || "Cliente").trim(), ...(docOk ? { cpfCnpj: cpf } : {}), email, mobilePhone: tel.startsWith("55") ? tel.slice(2) : undefined, externalReference: uid, notificationDisabled: true });
  await db.from("asaas_clientes").insert({ user_id: uid, customer_id: c.id, cpf: docOk ? cpf : null });
  return c.id as string;
}

// ok: a reserva já entrou na agenda sozinha; senão (data ocupada nesse meio tempo) o administrador resolve
const PUSH: Record<string, (n: string, v: string, l: string, d: string, ok: boolean) => { title: string; body: string }> = {
  pt: (n, v, l, d, ok) => ok ? { title: "Passeio reservado ✅", body: `${n} pagou ${v} pelo site. ${l}, ${d}: a reserva já está confirmada na agenda.` } : { title: "Sinal pago, mas a data está ocupada ⚠️", body: `${n} pagou ${v} (${l}, ${d}), mas a lancha já tinha outro passeio. Toque para resolver.` },
  en: (n, v, l, d, ok) => ok ? { title: "Tour booked ✅", body: `${n} paid ${v} on the site. ${l}, ${d}: the booking is already confirmed in the calendar.` } : { title: "Deposit paid, but the date is taken ⚠️", body: `${n} paid ${v} (${l}, ${d}), but the boat already had another tour. Tap to sort it out.` },
  es: (n, v, l, d, ok) => ok ? { title: "Paseo reservado ✅", body: `${n} pagó ${v} en el sitio. ${l}, ${d}: la reserva ya está confirmada en la agenda.` } : { title: "Seña pagada, pero la fecha está ocupada ⚠️", body: `${n} pagó ${v} (${l}, ${d}), pero la lancha ya tenía otro paseo. Toca para resolverlo.` },
};
// confirma a reserva sozinha e manda os mesmos avisos do botão Aprovar (dono, cliente, chat, outros pedidos do horário)
async function confirmarSozinho(pid: number) {
  const { data, error } = await db.rpc("confirmar_pago", { pid });
  if (error) { console.error("confirmar_pago", error.message); return false; }
  if (!data?.ok) { if (!data?.ja) console.error("confirmar_pago", JSON.stringify(data)); return !!data?.ja; }
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, base = Deno.env.get("SUPABASE_URL") + "/functions/v1/";
  const chama = (fn: string, b: unknown) => fetch(base + fn, { method: "POST", headers: { authorization: "Bearer " + srk, apikey: srk, "content-type": "application/json" }, body: JSON.stringify(b) })
    .then(async r => { if (!r.ok) console.error(fn, r.status, (await r.text()).slice(0, 300)); }).catch(e => console.error(fn, e));
  await chama("notificar", { tipo: "aprovado", id: data.bloqueio });
  await chama("pedido-indisponivel", { pid });
  return true;
}
// prazo de 2 horas acabou sem pagamento: a data volta para o site e o cliente é avisado no chat e no celular
const EXP: Record<string, (l: string, d: string) => { title: string; body: string }> = {
  pt: (l, d) => ({ title: "O prazo para pagar acabou", body: `A ${l} em ${d} foi liberada. Se ainda estiver livre, gere o pagamento de novo pelo mesmo link.` }),
  en: (l, d) => ({ title: "The time to pay has ended", body: `${l} on ${d} has been released. If it is still free, create the payment again with the same link.` }),
  es: (l, d) => ({ title: "Se acabó el plazo para pagar", body: `La ${l} el ${d} fue liberada. Si sigue libre, genera el pago de nuevo con el mismo link.` }),
};
async function avisarExpirou(pid: number) {
  const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, status").eq("id", pid).maybeSingle();
  if (!p || p.status !== "pendente") return;
  const { data: ainda } = await db.from("pagamentos_asaas").select("id").eq("pedido", pid).limit(1);
  if (ainda?.length) return; // ainda tem outra cobrança valendo (Pix ou cartão)
  // marca o prazo vencido (Rodrigo 2026-11-12): o card mostra "Prazo vencido, data liberada" e, sem pagamento em 24 horas, o pedido é cancelado sozinho
  const { data: mk } = await db.from("pedidos").update({ prazo_vencido_em: new Date().toISOString() }).eq("id", pid).eq("status", "pendente").select("prazo_vencido_em").maybeSingle();
  // pré-reserva com prazo combinado (pagar_ate) ainda valendo: o banco não marca o prazo vencido (a_pre_reserva_prazo_vale)
  // e aqui também não sai aviso nenhum (nem chat, nem celular) dizendo que a lancha foi liberada (revisão 2026-11-16)
  if (!mk?.prazo_vencido_em) return;
  if (!p.cliente) return;
  const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
  const { data: cv } = await db.from("conversas").select("id").eq("tipo", "suporte").eq("cliente", p.cliente).maybeSingle();
  if (cv) {
    const tx = `O prazo de 2 horas para pagar o sinal acabou e a ${lancha} em ${dataBR(p.data)} foi liberada. Se ainda estiver livre, você pode gerar o pagamento de novo pelo mesmo link.`;
    const { data: m } = await db.from("mensagens").insert({ conversa: cv.id, autor: null, texto: tx, sistema: "expirou:", pedido: p.id }).select("id").maybeSingle();
    if (m) await db.from("conversas").update({ ultima_em: new Date().toISOString(), ultima_msg: tx.slice(0, 80), encerrada_em: null }).eq("id", cv.id);
  }
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:" + await contato(), k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", p.cliente);
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...EXP[l](lancha, dataBR(p.data)), url: "/login/", tag: `exp-${p.id}` }), { TTL: 86400, urgency: "high" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}
// pedido que venceu sem pagamento (1 hora antes do início): cancelado, e o cliente recebe uma mensagem gentil no chat e no celular (Rodrigo 2026-10-25)
const PASSOU: Record<string, (l: string, d: string) => { title: string; body: string }> = {
  pt: (l, d) => ({ title: "Que tal outra data?", body: `O seu pedido da ${l} em ${d} foi encerrado. Quando quiser, escolha outra data no site: vai ser um prazer levar você para passear!` }),
  en: (l, d) => ({ title: "How about another date?", body: `Your request for ${l} on ${d} has been closed. Whenever you like, pick another date on the website: we'd love to take you out on the water!` }),
  es: (l, d) => ({ title: "¿Qué tal otra fecha?", body: `Tu pedido de la ${l} el ${d} se cerró. Cuando quieras, elige otra fecha en el sitio: ¡será un placer llevarte a pasear!` }),
};
async function avisarPassou(p: { id: number; cliente: string; lancha: string; data: string }) {
  if (!p.cliente) return;
  const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
  const { data: cv } = await db.from("conversas").select("id").eq("tipo", "suporte").eq("cliente", p.cliente).maybeSingle();
  if (cv) {
    const tx = `A data do seu pedido da ${lancha} em ${dataBR(p.data)} chegou sem a reserva ser concluída, então encerramos o pedido. Ficamos muito felizes com o seu interesse! Quando quiser, escolha outra data no site ou chame a gente aqui: vai ser um prazer levar você para passear em Búzios.`;
    const { data: m } = await db.from("mensagens").insert({ conversa: cv.id, autor: null, texto: tx, sistema: "passou:", pedido: p.id }).select("id").maybeSingle();
    if (m) await db.from("conversas").update({ ultima_em: new Date().toISOString(), ultima_msg: tx.slice(0, 80), encerrada_em: null }).eq("id", cv.id);
  }
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:" + await contato(), k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", p.cliente);
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...PASSOU[l](lancha, dataBR(p.data)), url: "/", tag: `passou-${p.id}` }), { TTL: 86400, urgency: "normal" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}
async function pushAdmins(msg: { title: string; body: string }, tag: string) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:" + await contato(), k.publica, k.privada);
  const { data: adm } = await db.from("admins").select("user_id");
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth").in("user_id", (adm || []).map((a: any) => a.user_id));
  for (const s of subs || []) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...msg, url: "/login/", tag }), { TTL: 86400, urgency: "high" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}
// quem trouxe a reserva (Rodrigo 2026-11-13): mesmo texto do notificar; rpc origem_reserva, sem ela o aviso sai igual
const QUEM_ROT: Record<string, string> = { pt: "Quem trouxe", en: "Brought by", es: "Quién lo trajo" };
const QUEM_T: Record<string, Record<string, (n: string) => string>> = {
  pt: { vendedor: n => n ? `vendedor ${n}` : "vendedor", parceiro: n => n ? `parceiro ${n}` : "parceiro", lucas: () => "Lucas, pelo WhatsApp", dono: n => n ? `dono da lancha ${n}` : "dono da lancha", painel: () => "painel da Búzios Lanchas", site: () => "site, cliente direto" },
  en: { vendedor: n => n ? `seller ${n}` : "seller", parceiro: n => n ? `partner ${n}` : "partner", lucas: () => "Lucas, via WhatsApp", dono: n => n ? `boat owner ${n}` : "boat owner", painel: () => "Búzios Lanchas panel", site: () => "website, direct client" },
  es: { vendedor: n => n ? `vendedor ${n}` : "vendedor", parceiro: n => n ? `socio ${n}` : "socio", lucas: () => "Lucas, por WhatsApp", dono: n => n ? `dueño de la lancha ${n}` : "dueño de la lancha", painel: () => "panel de Búzios Lanchas", site: () => "sitio, cliente directo" },
};
const quemTxt = (o: any, l: string) => o?.tipo && QUEM_T[l]?.[o.tipo] ? QUEM_T[l][o.tipo](String(o.nome || "").trim()) : "";
async function origem(q: Record<string, number>) {
  try { const { data, error } = await db.rpc("origem_reserva", q); if (error) { console.error("origem", error.message); return null; } return data; }
  catch (e) { console.error("origem", e); return null; }
}
const comQuem = (m: { title: string; body: string }, o: any, l: string) => { const t = quemTxt(o, l); return t ? { ...m, body: `${m.body} ${QUEM_ROT[l]}: ${t}.` } : m; };
async function avisarAdmins(nome: string, valor: string, lancha: string, dia: string, pid: number, ok: boolean) {
  const o = await origem({ p_pedido: pid });
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:" + await contato(), k.publica, k.privada);
  const { data: adm } = await db.from("admins").select("user_id");
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", (adm || []).map((a: any) => a.user_id));
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...comQuem(PUSH[l](nome || "—", valor, lancha, dataBR(dia), ok), o, l), url: "/login/", tag: `as-${pid}` }), { TTL: 86400, urgency: "high" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}

// planilha de vendas (Rodrigo 2026-11-17): quando o dinheiro de cada pagamento cai na conta da Búzios.
// Pix cai na hora; cartão fica "CONFIRMED" até a data de liberação (cada parcela tem a sua). Guardado em pagamentos_asaas.
const ESTORNO = /REFUND|CHARGEBACK/;
function situacaoCredito(r: any) {
  const parc = Array.isArray(r.parcelas) ? r.parcelas : null;
  if (ESTORNO.test(String(r.status || "")) || parc?.some((x: any) => ESTORNO.test(String(x.status || "")))) return "estornado";
  if (r.status === "AWAITING_RISK_ANALYSIS") return "analise";
  if (parc?.length) return parc.every((x: any) => CAIU(x)) ? "recebido" : "liberar";
  return CAIU(r) ? "recebido" : "liberar";
}
// caiu no saldo da Búzios: recebido no Asaas ou antecipado (antecipação já creditada)
const CAIU = (x: any) => x?.status === "RECEIVED" || x?.status === "RECEIVED_IN_CASH" || !!x?.antecipada;
function creditoFinal(r: any) {
  const s = situacaoCredito(r);
  return (s === "recebido" && r.liquido != null && (r.credito_em || Array.isArray(r.parcelas))) || (s === "estornado" && !!r.conferido_em);
}
async function atualizarCredito(r: any) {
  if (!r?.asaas_id) return null;
  const real = r.asaas_real || r.asaas_id; // grupo: a linha de cada lancha aponta para a cobrança verdadeira
  const pg = await asaas(`/payments/${encodeURIComponent(real)}`);
  const n: any = { status: pg.status || r.status, conferido_em: new Date().toISOString() };
  // antecipação (Rodrigo 2026-11-17): a automática do Asaas pede uma antecipação POR PARCELA (cada cobrança tem a sua).
  // Pedida = em análise no Asaas; creditada = o dinheiro já entrou no saldo (antes da data da parcela), com o líquido da antecipação.
  const ok = (x: any) => x.status === "RECEIVED" || x.status === "RECEIVED_IN_CASH"; // creditDate vem com data futura enquanto o cartão está CONFIRMED
  const antDe = async (x: any) => {
    if (!x?.anticipated || ok(x) || ESTORNO.test(String(x.status || ""))) return null;
    try {
      const la = (await asaas(`/anticipations?payment=${encodeURIComponent(x.id)}&limit=10`))?.data || [];
      const cr = la.find((a: any) => a.status === "CREDITED" || a.status === "DEBITED");
      const ab = la.find((a: any) => ["PENDING", "SCHEDULED"].includes(a.status));
      const a = cr || ab;
      return a ? { st: cr ? "creditada" : "pedida", data: cr ? (cr.anticipationDate || null) : null, liquido: +a.netValue || null } : null;
    } catch (_) { return null; }
  };
  const lista = pg.installment ? ((await asaas(`/payments?installment=${encodeURIComponent(pg.installment)}&limit=24`))?.data || []).sort((a: any, z: any) => (+a.installmentNumber || 0) - (+z.installmentNumber || 0)) : [pg];
  const ants = await Promise.all(lista.map(antDe));
  const sts = ants.filter(Boolean).map((a: any) => a.st);
  n.antecipacao = sts.length ? { status: sts.every((x: string) => x === "creditada") ? "creditada" : "pedida", parcelas: sts.length } : null;
  if (pg.installment && lista.length) {
    n.parcelas = lista.map((x: any, i: number) => {
      const a: any = ants[i], cred = a?.st === "creditada";
      return { n: +x.installmentNumber || i + 1, valor: +x.value, liquido: a?.liquido || +x.netValue || null, status: x.status, previsto: a ? null : (x.estimatedCreditDate || x.creditDate || x.dueDate || null),
        credito: ok(x) ? (x.creditDate || x.paymentDate || null) : cred ? a.data : null, antecipada: cred || undefined, antecipacao: a && !cred ? "pedida" : undefined };
    });
    n.liquido = Math.max(0, Math.round(n.parcelas.reduce((a: number, x: any) => a + (+x.liquido || 0), 0) * 100) / 100);
    const fut = n.parcelas.filter((x: any) => !x.credito).map((x: any) => x.previsto).filter(Boolean).sort();
    n.credito_previsto = fut[0] || null;
    const cs = n.parcelas.map((x: any) => x.credito).filter(Boolean).sort();
    n.credito_em = cs.length === n.parcelas.length ? cs[cs.length - 1] : null;
  } else {
    const a: any = ants[0], cred = a?.st === "creditada";
    if (a?.liquido) n.liquido = a.liquido; else if (pg.netValue != null) n.liquido = Math.max(0, +pg.netValue);
    const rec = ok(pg);
    n.antecipada = cred;
    n.credito_previsto = rec || a ? null : (pg.estimatedCreditDate || pg.creditDate || null);
    n.credito_em = rec ? (pg.creditDate || pg.paymentDate || null) : cred ? a.data : null;
  }
  // grupo (2026-11-19): a cobrança é de várias lanchas; cada linha fica com a sua parte, proporcional ao valor
  const { data: irm } = await db.from("pagamentos_asaas").select("id, valor").or(`asaas_id.eq.${real},asaas_real.eq.${real}`);
  if ((irm || []).length > 1) {
    const total = (irm || []).reduce((a: number, x: any) => a + +x.valor, 0);
    let meu: any = n;
    for (const x of irm || []) {
      const f = total > 0 ? +x.valor / total : 0, c2 = (v: any) => v == null ? v : Math.round(+v * f * 100) / 100;
      const m = { ...n, liquido: c2(n.liquido), ...(Array.isArray(n.parcelas) ? { parcelas: n.parcelas.map((q: any) => ({ ...q, valor: c2(q.valor), liquido: c2(q.liquido) })) } : {}) };
      await db.from("pagamentos_asaas").update(m).eq("id", x.id);
      if (x.id === r.id) meu = m;
    }
    return meu;
  }
  await db.from("pagamentos_asaas").update(n).eq("id", r.id);
  return n;
}

// Rodrigo 2026-11-17: "o dono tem que receber só quando eu receber". Repasse do saldo (dono sem divisão, comissão) só com o dinheiro
// DAQUELE pedido já no saldo da Búzios: Pix na hora; cartão quando a parcela cai (ou a antecipação é creditada). Nunca adianta com
// dinheiro de outra venda. Regra de cobertura: paga de uma vez quando o que já caiu do pedido cobre o valor (no parcelado, costuma ser a
// última parcela); a divisão do Asaas (split) já faz isso sozinha, parcela por parcela.
function caixaPedido(rows: any[]) {
  let caiu = 0, estorno = false;
  const fut: { d: string | null; v: number }[] = [];
  for (const r of rows) {
    if (situacaoCredito(r) === "estornado") { estorno = true; continue; }
    const parc = Array.isArray(r.parcelas) && r.parcelas.length ? r.parcelas : null;
    const itens = parc ? parc.map((x: any) => ({ x, d: x.previsto || null })) : [{ x: r, d: r.credito_previsto || null }];
    for (const { x, d } of itens) {
      const v = +(x.liquido ?? x.valor) || 0;
      if (CAIU(x)) caiu += v; else fut.push({ d, v });
    }
  }
  fut.sort((a, z) => String(a.d || "9999").localeCompare(String(z.d || "9999")));
  return { caiu: Math.round(caiu * 100) / 100, fut, estorno };
}
// data em que o dinheiro do pedido passa a cobrir "precisa": null se já cobre; "?" se nunca cobre pelo que está previsto
function quandoCobre(cx: { caiu: number; fut: { d: string | null; v: number }[] }, precisa: number): string | null {
  if (cx.caiu >= precisa - 0.005) return null;
  let soma = cx.caiu;
  for (const f of cx.fut) { soma += f.v; if (soma >= precisa - 0.005) return f.d || "?"; }
  return "?";
}
// confere no Asaas o cartão que ainda não caiu (no máximo a cada 30 min por cobrança) antes de decidir um repasse
async function refrescar(rows: any[]) {
  for (const r of rows) {
    if (r.metodo !== "cartao" || creditoFinal(r)) continue;
    if (r.conferido_em && Date.now() - new Date(r.conferido_em).getTime() < 30 * 60e3) continue;
    const n = await atualizarCredito(r).catch((e) => (console.error("refrescar", r.pedido, e?.message), null));
    if (n) Object.assign(r, n);
  }
}
const COLS_PG = "id, pedido, metodo, asaas_id, asaas_real, valor, sinal, repasse, wallet_id, status, pago_em, liquido, credito_previsto, credito_em, parcelas, antecipada, conferido_em";
// parte da Búzios no saldo agora, pela mesma conta do card (chama a ação planilha com a sessão do administrador)
async function seuAgora(h: Record<string, string>): Promise<number | null> {
  const pl: any = await fetch(FN_URL, { method: "POST", headers: h, body: JSON.stringify({ acao: "planilha" }) }).then((r) => r.ok ? r.json() : null).catch(() => null);
  return typeof pl?.conta?.seu === "number" ? pl.conta.seu : null;
}
// card do administrador na planilha (Rodrigo 2026-11-20): "meu saldo Asaas, quanto tenho a receber, quanto é meu e quanto não é".
// Agora = saldo real do Asaas. De outros, já no saldo: repasse de dono e comissão ainda não pagos cujo dinheiro do pedido já caiu,
// parte do jet ski ainda não paga. A receber = cartão que ainda não caiu (líquido) + PayPal a caminho (estimado, 90% do sinal,
// a mesma conta da fila do PayPal). De outros, a receber: divisão automática do dono e repasses esperando o cartão/PayPal cair.
async function contaBuzios(vendas: any[], CX: Map<number, any>, pids: number[], cts: any[], eu: string) {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const disponivel = r2(+(await asaas("/finance/balance")).balance || 0);
  const { data: cfg } = await db.from("asaas_config").select("paypal_auto, paypal_desde, paypal_pedidos_desde").eq("id", 1).maybeSingle();
  const ff: any = cfg?.paypal_pedidos_desde ? await filaPaypal(cfg).catch((e) => (console.error("conta paypal", e?.message), null)) : null;
  const naFila = new Set<number>((ff?.fila || []).map((p: any) => +p.id));
  const ppCaiu = (pid: number) => !naFila.has(+pid) || ff.cob.has(+pid); // fora da fila (antes da regra automática): já caiu
  const agora: any[] = [], futuro: any[] = [];
  let cartao = 0;
  for (const cx of CX.values()) if (!cx.estorno) cartao += cx.fut.reduce((a: number, f: any) => a + (+f.v || 0), 0);
  for (const v of vendas) {
    if (v.situacao === "estornado") continue;
    for (const r of v.repasses || []) {
      if (r.ok) continue;
      const it = { tipo: r.tipo, nome: r.nome, valor: +r.valor || 0 };
      if (r.como === "divisao") futuro.push(it);
      else if (v.metodo === "paypal") (ppCaiu(v.pid) ? agora : futuro).push(it);
      else (r.motivo === "aguardando_credito" ? futuro : agora).push(it);
    }
  }
  // jet ski (dono do jet ski): o que falta pagar das duas metades
  const { data: js } = pids.length ? await db.from("pedidos").select("id, jetski, jetski_neto, jetski_metade1, jetski_repasse").in("id", pids)
    .eq("status", "aprovado").not("jetski", "is", null).gt("jetski_neto", 0).is("jetski_repasse2", null) : { data: [] };
  if (js?.length) {
    const { data: jk } = await db.from("jetskis").select("id, nome").in("id", [...new Set(js.map((p: any) => p.jetski))]);
    const JN = new Map((jk || []).map((j: any) => [j.id, j.nome]));
    for (const p of js) {
      const pago = String(p.jetski_repasse || "").startsWith("asaas:") && p.jetski_repasse !== "asaas:enviando" ? +p.jetski_metade1 || 0 : 0;
      const falta = r2(+p.jetski_neto - pago); if (!(falta > 0)) continue;
      const cx = CX.get(+p.id), caiu = cx ? !cx.estorno && cx.caiu >= falta - 0.005 : ppCaiu(+p.id);
      (caiu ? agora : futuro).push({ tipo: "jetski", nome: JN.get(p.jetski) || "Jet ski", valor: falta });
    }
  }
  const pend = (ff?.fila || []).filter((p: any) => !ff.cob.has(+p.id));
  const paypal = r2(pend.reduce((a: number, p: any) => a + (+p.est || 0), 0));
  const soma = (a: any[]) => r2(a.reduce((x, y) => x + y.valor, 0));
  const outros = soma(agora), outrosF = soma(futuro);
  cartao = r2(cartao);
  // de quem é o que não é da Búzios (por pessoa, maior primeiro)
  const G = new Map<string, any>();
  for (const [lista, k] of [[agora, "agora"], [futuro, "futuro"]] as const) for (const x of lista) {
    const c = `${x.tipo}|${x.nome}`; const g = G.get(c) || { tipo: x.tipo, nome: x.nome, agora: 0, futuro: 0 };
    g[k] = r2(g[k] + x.valor); G.set(c, g);
  }
  const quem = [...G.values()].sort((a, z) => (z.agora + z.futuro) - (a.agora + a.futuro)).slice(0, 40);
  const pessoas = cts.filter((c: any) => c.wallet_id && c.aprovada_em && c.user_id !== eu).map((c: any) => ({ id: c.user_id, nome: String(c.nome || "").trim() || "—" }))
    .sort((a: any, z: any) => a.nome.localeCompare(z.nome, "pt-BR"));
  const { data: ult } = await db.from("saques_buzios").select("chave").eq("status", "enviado").order("criado_em", { ascending: false }).limit(1).maybeSingle();
  return { saque_chave: ult?.chave || "", disponivel, seu: r2(disponivel - outros), outros, cartao, paypal, paypal_n: pend.length, receber: r2(cartao + paypal), receber_seu: r2(cartao + paypal - outrosF), receber_outros: outrosF, quem, pessoas };
}
// nome de cada pessoa para a planilha: perfil, cadastro de cliente, conta Asaas ou empresa do vendedor
async function nomes(ids: string[], contas: Map<string, any>) {
  const m = new Map<string, string>();
  if (!ids.length) return m;
  const [pf, cl, vd] = await Promise.all([
    db.from("perfis").select("user_id, nome").in("user_id", ids),
    db.from("clientes").select("user_id, nome").in("user_id", ids),
    db.from("vendedores").select("user_id, empresa").in("user_id", ids),
  ]);
  for (const id of ids) {
    const n = (pf.data || []).find((x: any) => x.user_id === id)?.nome || (cl.data || []).find((x: any) => x.user_id === id)?.nome || contas.get(id)?.nome || (vd.data || []).find((x: any) => x.user_id === id)?.empresa;
    if (n && String(n).trim()) m.set(id, String(n).trim().slice(0, 80));
  }
  return m;
}

// Pix sem vencimento para estrangeiro (2026-11-19): o Mercado Pago da Argentina recusou o QR com vencimento (cobv) do Asaas.
// QR estático com o valor, na chave da Búzios; quem paga gera uma cobrança no Asaas com pixQrCodeId. ligarEstatico acha o pedido
// (pelo QR, ou pelo valor exato quando o cliente digitou a chave e só um pedido espera esse valor) e cria a linha de pagamento
// sem divisão: a parte do dono sai pelo saldo assim que o Pix cai (enviarSaldos), como em qualquer Pix sem split.
async function chavePix(): Promise<string | null> {
  const l = await asaas("/pix/addressKeys?status=ACTIVE&limit=20").catch(() => null);
  const ks = (l?.data || []).filter((k: any) => String(k.status || "ACTIVE") === "ACTIVE" && k.key);
  return (ks.find((k: any) => k.type === "CNPJ") || ks.find((k: any) => k.type === "EVP") || ks[0])?.key || null;
}
async function pixEstatico(pid: number, valor: number, sinal = valor) {
  const { data: ja } = await db.from("pix_estatico").select("*").eq("pedido", pid).maybeSingle();
  if (ja && Math.abs(+ja.valor - valor) < 0.005 && !ja.pago_asaas) return ja;
  const chave = await chavePix();
  if (!chave) throw new Error("sem chave Pix ativa no Asaas");
  const q = await asaas("/pix/qrCodes/static", { addressKey: chave, description: `Reserva ${pid}`, value: valor, format: "ALL", allowsMultiplePayments: false });
  if (!q?.id || !q?.payload) throw new Error("QR estático sem resposta");
  const lin = { pedido: pid, valor, sinal, qr_id: String(q.id), payload: String(q.payload), img: q.encodedImage || null, chave, pago_asaas: null, criado_em: new Date().toISOString() };
  await db.from("pix_estatico").upsert(lin, { onConflict: "pedido" });
  return lin;
}
async function ligarEstatico(asaasId: string) {
  if ((await db.from("pagamentos_asaas").select("id").eq("asaas_id", asaasId).maybeSingle()).data) return;
  const pg = await asaas(`/payments/${encodeURIComponent(asaasId)}`).catch(() => null);
  if (!pg || pg.billingType !== "PIX" || /^PED\d+$/.test(String(pg.externalReference || ""))) return;
  let est: any = null;
  if (pg.pixQrCodeId) est = (await db.from("pix_estatico").select("*").eq("qr_id", String(pg.pixQrCodeId)).maybeSingle()).data;
  else if (!/paypal/i.test(JSON.stringify(pg))) { // digitou a chave: só um pedido esperando exatamente este valor, nos últimos 3 dias
    const { data: l } = await db.from("pix_estatico").select("*").is("pago_asaas", null).gte("criado_em", new Date(Date.now() - 3 * 864e5).toISOString());
    const c = (l || []).filter((e: any) => Math.abs(+e.valor - +pg.value) < 0.005);
    if (c.length === 1) est = c[0];
  }
  if (!est || Math.abs(+est.valor - +pg.value) > 0.005) return;
  const { data: pa } = await db.from("pix_estatico").update({ pago_asaas: asaasId }).eq("pedido", est.pedido).is("pago_asaas", null).select("pedido");
  if (!pa?.length) return;
  // uma linha de Pix por pedido (pedido, metodo único): a cobrança com vencimento que estava aberta vira este pagamento,
  // sem divisão (a parte do dono sai pelo saldo), e a cobrança velha é cancelada no Asaas (19/11: o insert batia na chave única)
  const lin = { asaas_id: asaasId, valor: +est.valor, sinal: +(est.sinal ?? est.valor), repasse: 0, wallet_id: null, status: pg.status, pix_qr: est.qr_id, pix_payload: null, pix_img: null, invoice_url: null };
  const { data: velha } = await db.from("pagamentos_asaas").select("id, asaas_id, pago_em, sinal").eq("pedido", est.pedido).eq("metodo", "pix").maybeSingle();
  if (velha && +velha.sinal > 0) lin.sinal = +velha.sinal; // sinal sem a taxa do Pix, como na cobrança de antes
  let error: any = null;
  if (velha?.pago_em) error = { message: "Pix já pago neste pedido" };
  else if (velha) ({ error } = await db.from("pagamentos_asaas").update(lin).eq("id", velha.id).is("pago_em", null));
  else ({ error } = await db.from("pagamentos_asaas").insert({ pedido: est.pedido, metodo: "pix", ...lin, criado_em: new Date().toISOString() }));
  if (error) {
    console.error("ligarEstatico", est.pedido, error.message);
    await db.from("pix_estatico").update({ pago_asaas: null }).eq("pedido", est.pedido).eq("pago_asaas", asaasId); // deixa tentar de novo
    await pushAdmins({ title: "Pix recebido: conferir ⚠️", body: `Entrou um Pix de ${brl(+pg.value)} do pedido ${est.pedido} pelo QR sem vencimento, mas não deu para registrar sozinho (${String(error.message).slice(0, 80)}). Confira no painel.` }, `pix-est-${est.pedido}`).catch(e => console.error(e));
    return;
  }
  if (velha?.asaas_id && velha.asaas_id !== asaasId) await cancelar(velha.asaas_id).catch(e => console.error("cancelar cobv", e?.message));
}

// confere a cobrança direto no Asaas e, se paga, marca o pedido como pago e confirma a reserva sozinha
async function conferir(asaasId: string, status = false) {
  const { data: row } = await db.from("pagamentos_asaas").select("*").eq("asaas_id", asaasId).maybeSingle();
  if (!row) return false;
  if (row.pago_em) {
    // já paga: o aviso do Asaas só atualiza a situação (cartão "CONFIRMED" vira "RECEIVED" quando cai no saldo), conferindo direto no Asaas
    if (status && row.status !== "RECEIVED") { const pg = await asaas(`/payments/${encodeURIComponent(asaasId)}`); if (pg?.status && pg.status !== row.status) await db.from("pagamentos_asaas").update({ status: pg.status }).eq("id", row.id); }
    return true;
  }
  const pg = await asaas(`/payments/${encodeURIComponent(asaasId)}`);
  await db.from("pagamentos_asaas").update({ status: pg.status }).eq("id", row.id);
  // parcelado: o registro guarda o total (parcela × n), e a primeira parcela vale total / n
  const n = pg.installment ? Math.round(+row.valor / +pg.value) : 1;
  if (!["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(pg.status) || n < 1 || n > PARCELAS || Math.abs(+pg.value * n - +row.valor) > 0.005 || (pg.externalReference !== `PED${row.pedido}` && !row.pix_qr)) return false; // pix_qr: Pix sem vencimento (ligarEstatico)
  const agora = new Date().toISOString(), texto = `${brl(+row.valor)} (${row.metodo === "pix" ? "Pix" : n > 1 ? `cartão em ${n}x` : "cartão"} · Asaas)`;
  const { data: marcou } = await db.from("pagamentos_asaas").update({ pago_em: agora }).eq("id", row.id).is("pago_em", null).select("id");
  if (!marcou?.length) return true; // outro aviso já marcou
  // primeiro registra e confirma a reserva (o robô de 1 hora antes não cancela pedido com pagamento); depois cancela as outras cobranças
  const { data: ppMarcou } = await db.from("pagamentos_pp").update({ pago_em: agora, pago_valor: texto, atualizado_em: agora }).eq("pedido", row.pedido).is("pago_em", null).select("pedido");
  const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data").eq("id", row.pedido).maybeSingle();
  // grupo: uma linha paga por lancha e cada reserva confirmada (cada dono recebe o aviso da sua)
  let outros: number[] = [];
  if (Array.isArray(row.partes) && row.partes.length > 1) {
    const { data: ms, error: eg } = await db.rpc("espelhar_pagamento_grupo", { p_row: row.id });
    if (eg) {
      console.error("espelhar_pagamento_grupo", row.id, eg.message);
      await pushAdmins({ title: "Pagamento de grupo: conferir ⚠️", body: `O pedido ${row.pedido} (várias lanchas) foi pago, mas não deu para separar as lanchas. Confira no painel.` }, `grupo-${row.pedido}`).catch(e => console.error(e));
    } else outros = (ms || []).map(Number);
  }
  const ok = p ? await confirmarSozinho(p.id) : false;
  for (const m of outros) await confirmarSozinho(m).catch(e => console.error("confirmar grupo", m, e));
  if (outros.length) { // lancha do grupo cancelada enquanto a cobrança estava aberta: o dinheiro entrou, alguém confere
    const { data: st } = await db.from("pedidos").select("id, status").in("id", outros);
    const fora = (st || []).filter((x: any) => x.status === "cancelado" || x.status === "recusado");
    if (fora.length) await pushAdmins({ title: "Pagamento de grupo: lancha cancelada ⚠️", body: `O pedido ${row.pedido} foi pago com a parte do(s) pedido(s) ${fora.map((x: any) => x.id).join(", ")}, que já estava(m) cancelado(s). Confira e devolva essa parte.` }, `grupo-cancel-${row.pedido}`).catch(e => console.error(e));
  }
  const { data: dobro } = await db.from("pagamentos_asaas").select("id").eq("pedido", row.pedido).neq("id", row.id).not("pago_em", "is", null);
  // pago também pelo PayPal (a central já estava paga): avisa para estornar um dos dois
  const { data: ppJa } = ppMarcou?.length ? { data: null } : await db.from("pagamentos_pp").select("captura").eq("pedido", row.pedido).maybeSingle();
  if (dobro?.length || ppJa?.captura) await pushAdmins({ title: "Pagamento em dobro ⚠️", body: `O pedido ${row.pedido} foi pago duas vezes (${ppJa?.captura ? "PayPal e Asaas" : "Asaas"}). Estorne um dos pagamentos.` }, `dobro-${row.pedido}`).catch(e => console.error(e));
  await cancelarAbertas(row.pedido, row.id).catch(e => console.error("abertas", e));
  if (!p) return true;
  const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
  const nome = String((await db.from("clientes").select("nome").eq("user_id", p.cliente).maybeSingle()).data?.nome || "").trim().split(/\s+/)[0];
  // confirmada: o chat já recebe "reserva confirmada" pelo notificar; só fala do pagamento se a data deu problema
  const cv = ok ? null : (await db.from("conversas").select("id").eq("tipo", "suporte").eq("cliente", p.cliente).maybeSingle()).data;
  if (cv) {
    const tx = `Pagamento do sinal recebido: ${texto}. Agora a Búzios Lanchas confirma a sua reserva.`;
    const { data: m } = await db.from("mensagens").insert({ conversa: cv.id, autor: null, texto: tx, sistema: "pago:" + brl(+row.valor), pedido: p.id }).select("id").maybeSingle();
    if (m) await db.from("conversas").update({ ultima_em: agora, ultima_msg: tx.slice(0, 80), encerrada_em: null }).eq("id", cv.id);
  }
  await avisarAdmins(nome, brl(+row.valor), lancha, p.data, p.id, ok).catch(e => console.error(e));
  return true;
}

async function quem(req: Request) {
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return (await db.auth.getUser(auth)).data?.user || null;
}

// saldo a receber (Rodrigo 2026-10-28): a parte do dono (pago online sem divisão) e a comissão do vendedor/parceiro ficam na conta
// da Búzios até a pessoa ter a conta de recebimento aprovada. Aprovou, este robô (cron asaas-expirar) envia sozinho.
// Só com asaas_config.saldo_auto ligado; só enquanto o saldo do Asaas cobre; cada envio travado para nunca sair duas vezes.
// O PayPal fica de fora: o dinheiro só chega ao Asaas quando o Rodrigo saca, e segue pelo toque "O PayPal caiu".
// contas esperando aprovação: confere no Asaas (com a chave da subconta) e avisa quem foi aprovado.
// Roda no robô de 10 em 10 minutos e na hora em que o Asaas avisa (webhook da subconta, eventos ACCOUNT_STATUS_*).
async function conferirContas() {
  const { data: esp } = await db.from("asaas_contas").select("user_id").is("aprovada_em", null).limit(20);
  for (const c of esp || []) {
    const k = await chaveSub(c.user_id);
    if (!k) continue;
    const st: any = await fetch(API() + "/myAccount/status", { headers: { access_token: k, "user-agent": "buzios-lanchas" } }).then((x) => x.json()).catch(() => ({}));
    if (st?.general !== "APPROVED") { await avisarDocsLiberados(c.user_id, k).catch((e) => console.error("docsLiberados", e)); continue; }
    const { data: foi } = await db.from("asaas_contas").update({ aprovada_em: new Date().toISOString() }).eq("user_id", c.user_id).is("aprovada_em", null).select("user_id");
    if (foi?.length) await avisarAprovada(c.user_id).catch((e) => console.error("avisarAprovada", e));
  }
}
// o link do documento e da selfie só aparece depois que o Asaas confere os dados do cadastro (no sandbox 2026-11-11 onboardingUrl vinha null logo após criar):
// quando o link fica disponível, avisa a pessoa uma vez para ela enviar
const DOCS_OK: Record<string, { title: string; body: string }> = {
  pt: { title: "Agora falta o documento e a selfie", body: "Seu cadastro foi conferido. Abra o app e toque em Enviar documento e selfie para liberar a sua conta." },
  en: { title: "Now send your ID and selfie", body: "Your details were checked. Open the app and tap Send ID and selfie to unlock your account." },
  es: { title: "Ahora falta el documento y la selfie", body: "Tus datos fueron revisados. Abre la app y toca Enviar documento y selfie para liberar tu cuenta." },
};
async function avisarDocsLiberados(uid: string, k: string) {
  const { data: ct } = await db.from("asaas_contas").select("docs_avisado_em").eq("user_id", uid).maybeSingle();
  if (!ct || ct.docs_avisado_em) return;
  const j: any = await fetch(API() + "/myAccount/documents", { headers: { access_token: k, "user-agent": "buzios-lanchas" } }).then((x) => x.json()).catch(() => ({}));
  if (!(j?.data || []).some((d: any) => ["NOT_SENT", "REJECTED"].includes(d.status) && d.onboardingUrl)) return;
  const { data: foi } = await db.from("asaas_contas").update({ docs_avisado_em: new Date().toISOString() }).eq("user_id", uid).is("docs_avisado_em", null).select("user_id");
  if (!foi?.length) return;
  const { data: kk } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!kk) return;
  webpush.setVapidDetails("mailto:" + await contato(), kk.publica, kk.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", uid);
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...DOCS_OK[l], url: "/login/", tag: "docs-liberados" }), { TTL: 86400, urgency: "normal" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}
const APROVADA: Record<string, { title: string; body: string }> = {
  pt: { title: "Conta de recebimento aprovada ✅", body: "Seus documentos foram aprovados. A partir de agora, o que é seu cai direto na sua conta." },
  en: { title: "Payout account approved ✅", body: "Your documents were approved. From now on, your share goes straight to your account." },
  es: { title: "Cuenta de cobro aprobada ✅", body: "Tus documentos fueron aprobados. Desde ahora, lo tuyo cae directo en tu cuenta." },
};
async function avisarAprovada(uid: string, msgs: Record<string, { title: string; body: string }> = APROVADA, tag = "conta-aprovada") {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:" + await contato(), k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", uid);
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...msgs[l], url: "/login/", tag }), { TTL: 86400, urgency: "normal" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}

// comissão antecipada de passeio que foi cancelado ou não aconteceu (Rodrigo 2026-11-12): sem débito nem desconto em comissões futuras.
// Se o valor ainda está na conta Asaas do vendedor, volta sozinho para a Búzios; se ele já sacou, avisa o administrador para combinar direto.
const AV_DEV: Record<string, (v: string) => { title: string; body: string }> = {
  pt: (v) => ({ title: "Comissão devolvida", body: `O passeio não aconteceu, então a comissão antecipada de ${v} voltou para a Búzios Lanchas.` }),
  en: (v) => ({ title: "Commission returned", body: `The tour did not happen, so the advance commission of ${v} went back to Búzios Lanchas.` }),
  es: (v) => ({ title: "Comisión devuelta", body: `El paseo no ocurrió, así que la comisión anticipada de ${v} volvió a Búzios Lanchas.` }),
};
async function subApi(k: string, path: string, body?: unknown) {
  const r = await fetch(API() + path, { method: body === undefined ? "GET" : "POST", headers: { access_token: k, "content-type": "application/json", "user-agent": "buzios-lanchas" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("subApi", path, r.status, JSON.stringify(j).slice(0, 500)); throw new Error(j?.errors?.[0]?.description || `asaas ${r.status}`); }
  return j;
}
async function devolverAntecipada(p: any): Promise<number> {
  const tid = String(p.comissao_comprovante || "").startsWith("asaas:") ? String(p.comissao_comprovante).slice(6) : "";
  if (!tid || !p.vendedor) return 0;
  const tr = await asaas(`/transfers/${encodeURIComponent(tid)}`);
  const valor = Math.round(+tr.value * 100) / 100;
  if (!(valor > 0)) return 0;
  const k = await chaveSub(p.vendedor);
  if (!k) return 0;
  const saldo = +(await subApi(k, "/finance/balance")).balance || 0;
  if (saldo < valor) return 0;
  const wb = (await asaas("/wallets"))?.data?.[0]?.id;
  if (!wb) return 0;
  await subApi(k, "/transfers", { value: valor, walletId: wb, description: `Devolução de comissão antecipada (pedido ${p.id})` });
  return valor;
}
async function avisarAntecipadas() {
  const { data: ps } = await db.from("pedidos").select("id, lancha, data, status, bloqueio_id, vendedor, vendedor_cod, comissao_comprovante").not("comissao_antecipada", "is", null).is("comissao_antecipada_aviso", null).limit(50);
  for (const p of ps || []) {
    let ruim = ["cancelado", "recusado"].includes(p.status);
    if (!ruim && p.bloqueio_id) ruim = (await db.from("realizados").select("aconteceu").eq("bloqueio_id", p.bloqueio_id).maybeSingle()).data?.aconteceu === false;
    if (!ruim) continue;
    const { data: foi } = await db.from("pedidos").update({ comissao_antecipada_aviso: new Date().toISOString() }).eq("id", p.id).is("comissao_antecipada_aviso", null).select("id");
    if (!foi?.length) continue;
    const nome = String((await db.from("clientes").select("nome").eq("user_id", p.vendedor).maybeSingle()).data?.nome || p.vendedor_cod || "vendedor").trim();
    const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
    const dev = await devolverAntecipada(p).catch((e) => { console.error("devolver", p.id, e); return 0; });
    if (dev > 0) {
      await pushAdmins({ title: "Comissão antecipada devolvida", body: `O passeio de ${nome} (${lancha}, ${dataBR(p.data)}) não aconteceu. Os ${brl(dev)} da comissão antecipada voltaram sozinhos da conta dele para a Búzios.` }, `antecip-${p.id}`).catch((e) => console.error("antecipada", e));
      await avisarAprovada(p.vendedor, Object.fromEntries(Object.entries(AV_DEV).map(([l, f]) => [l, f(brl(dev))])), `devolvida-${p.id}`).catch((e) => console.error("avDev", e));
    } else {
      await pushAdmins({ title: "Comissão antecipada: passeio não aconteceu", body: `Você antecipou a comissão de ${nome} (${lancha}, ${dataBR(p.data)}), mas o passeio foi cancelado ou não aconteceu e o valor já não está na conta dele. Combine a devolução direto com o vendedor.` }, `antecip-${p.id}`).catch((e) => console.error("antecipada", e));
    }
  }
}

// aviso "Você recebeu R$ X" (Rodrigo 2026-11-17, estilo banco): lê o extrato da subconta de cada dono/vendedor aprovado e avisa por push
// cada entrada que já caiu no saldo disponível para saque (extrato só mostra o que já entrou; cartão a cair, em análise ou agendado não aparece).
// Vale para repasse de passeio, divisão do pagamento (split), comissão, jet ski e "Transferir Saldo". A primeira leitura de cada conta só
// marca o que já existia, sem avisar. Sem emoji, sem nome de pessoa da empresa.
const ENT: Record<string, { tr: string; pg: string; corpo: (v: string, r: string) => string; ref: Record<string, (x: any) => string> }> = {
  pt: { tr: "Transferência recebida", pg: "Pagamento recebido", corpo: (v, r) => `Você recebeu ${v} na sua conta${r ? ` · ${r}` : ""}. Já disponível para saque.`,
    ref: { rep: x => `repasse do passeio ${x.lancha} ${x.dia}`, div: x => `passeio ${x.lancha} ${x.dia}`, com: x => `comissão do passeio ${x.lancha} ${x.dia}`, jet: x => `jet ski do passeio ${x.dia}`, jet1: x => `metade do jet ski do passeio ${x.dia}. A outra metade cai sozinha às ${x.hora}, no fim do horário do jet ski`, jet1s: x => `metade do jet ski do passeio ${x.dia}. A outra metade cai sozinha no fim do passeio`, jet2: x => `segunda metade do jet ski do passeio ${x.dia}`, sal: x => x.motivo } },
  en: { tr: "Transfer received", pg: "Payment received", corpo: (v, r) => `You received ${v} in your account${r ? ` · ${r}` : ""}. Available to withdraw.`,
    ref: { rep: x => `payout for the ${x.lancha} trip ${x.dia}`, div: x => `${x.lancha} trip ${x.dia}`, com: x => `commission for the ${x.lancha} trip ${x.dia}`, jet: x => `jet ski on the ${x.dia} trip`, jet1: x => `half of the jet ski on the ${x.dia} trip. The other half arrives automatically at ${x.hora}, when the jet ski time ends`, jet1s: x => `half of the jet ski on the ${x.dia} trip. The other half arrives automatically when the trip ends`, jet2: x => `second half of the jet ski on the ${x.dia} trip`, sal: x => x.motivo } },
  es: { tr: "Transferencia recibida", pg: "Pago recibido", corpo: (v, r) => `Recibiste ${v} en tu cuenta${r ? ` · ${r}` : ""}. Ya disponible para retirar.`,
    ref: { rep: x => `pago del paseo ${x.lancha} ${x.dia}`, div: x => `paseo ${x.lancha} ${x.dia}`, com: x => `comisión del paseo ${x.lancha} ${x.dia}`, jet: x => `moto de agua del paseo ${x.dia}`, jet1: x => `mitad de la moto de agua del paseo ${x.dia}. La otra mitad llega sola a las ${x.hora}, al terminar el horario de la moto`, jet1s: x => `mitad de la moto de agua del paseo ${x.dia}. La otra mitad llega sola al terminar el paseo`, jet2: x => `segunda mitad de la moto de agua del paseo ${x.dia}`, sal: x => x.motivo } },
};
const NAO_ENTRADA = /REVERSAL|REFUND|CHARGEBACK|CANCEL|BLOCK|ESTORNO/i; // estorno, bloqueio e devolução não são "dinheiro recebido"
const diaCurto = (d: string) => String(d || "").slice(0, 10).split("-").slice(1).reverse().join("/");
async function nomeLancha(slug: string) { return (await db.from("lanchas").select("nome").eq("slug", slug).maybeSingle()).data?.nome || slug; }
async function valorTransf(c: string) {
  if (!String(c || "").startsWith("asaas:") || c === "asaas:enviando") return null;
  const tr = await asaas("/transfers/" + encodeURIComponent(c.slice(6))).catch(() => null);
  return tr ? +tr.value : null;
}
// de onde veio a entrada: devolve { k, id, ...dados } ou null (aviso sai sem a referência)
async function refEntrada(uid: string, t: any, usados: Set<string>) {
  const igual = (x: number | null) => x != null && Math.abs(+x - +t.value) < 0.005;
  if (t.paymentId) { // divisão do pagamento do cliente (split): a cobrança é da conta principal, com externalReference PED<id>
    const pg = await asaas("/payments/" + encodeURIComponent(t.paymentId)).catch(() => null);
    const pid = /^PED(\d+)$/.exec(String(pg?.externalReference || ""))?.[1];
    if (!pid) return null;
    const { data: p } = await db.from("pedidos").select("lancha, data").eq("id", +pid).maybeSingle();
    return p ? { k: "div", id: `pd:${pid}:${t.paymentId}`, lancha: await nomeLancha(p.lancha), dia: diaCurto(p.data) } : null;
  }
  const desde = new Date(Date.now() - 4 * 864e5).toISOString();
  const { data: ts } = await db.from("transferencias_saldo").select("id, valor, motivo").eq("user_id", uid).eq("status", "enviado").gte("criado_em", desde);
  for (const x of ts || []) if (!usados.has(`ts:${x.id}`) && igual(+x.valor)) return { k: "sal", id: `ts:${x.id}`, motivo: String(x.motivo || "").slice(0, 80) };
  const lanchas = ((await db.from("donos").select("lancha").eq("user_id", uid)).data || []).map((d: any) => d.lancha);
  if (lanchas.length) {
    const { data: rp } = await db.from("repasses_pp").select("pedido, valor").gte("enviado_em", desde).like("comprovante", "asaas:%");
    const cand = (rp || []).filter((r: any) => !usados.has(`rp:${r.pedido}`) && igual(+r.valor));
    if (cand.length) {
      const { data: ps } = await db.from("pedidos").select("id, lancha, data").in("id", cand.map((r: any) => r.pedido)).in("lancha", lanchas);
      const p = (ps || [])[0];
      if (p) return { k: "rep", id: `rp:${p.id}`, lancha: await nomeLancha(p.lancha), dia: diaCurto(p.data) };
    }
  }
  const { data: cs } = await db.from("pedidos").select("id, lancha, data, comissao_comprovante").eq("vendedor", uid).gte("comissao_paga", desde).like("comissao_comprovante", "asaas:%").limit(10);
  for (const p of cs || []) if (!usados.has(`cm:${p.id}`) && igual(await valorTransf(p.comissao_comprovante))) return { k: "com", id: `cm:${p.id}`, lancha: await nomeLancha(p.lancha), dia: diaCurto(p.data) };
  const jets = ((await db.from("jetskis").select("id").eq("dono", uid)).data || []).map((j: any) => j.id);
  if (jets.length) {
    // duas metades (Rodrigo 2026-11-19): o aviso da 1ª já diz quando cai a 2ª
    const { data: js } = await db.from("pedidos").select("id, data, jetski_repasse, jetski_metade1, jetski_repasse2, jetski_ini, jetski_min, jetski_cortesia").in("jetski", jets).or(`jetski_repasse_em.gte.${desde},jetski_repasse2_em.gte.${desde}`).limit(10);
    for (const p of js || []) {
      if (String(p.jetski_repasse2 || "").startsWith("asaas:") && !usados.has(`js2:${p.id}`) && igual(await valorTransf(p.jetski_repasse2))) return { k: "jet2", id: `js2:${p.id}`, dia: diaCurto(p.data) };
      if (String(p.jetski_repasse || "").startsWith("asaas:") && !usados.has(`js:${p.id}`) && igual(await valorTransf(p.jetski_repasse))) {
        if (p.jetski_metade1 == null) return { k: "jet", id: `js:${p.id}`, dia: diaCurto(p.data) };
        const [h, m] = String(p.jetski_ini || "").split(":").map(Number), f = h * 60 + m + (+p.jetski_min || 0) + (+p.jetski_cortesia || 0);
        const hora = isNaN(f) ? "" : `${String(Math.floor(f / 60) % 24).padStart(2, "0")}h${String(f % 60).padStart(2, "0")}`;
        return { k: hora ? "jet1" : "jet1s", id: `js:${p.id}`, dia: diaCurto(p.data), hora };
      }
    }
  }
  return null;
}
async function pushEntrada(uid: string, valor: number, ref: any, transf: boolean, tag: string) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return 0;
  webpush.setVapidDetails("mailto:" + await contato(), k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", uid);
  let n = 0;
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    const E = ENT[l];
    const r = ref && E.ref[ref.k] ? E.ref[ref.k](ref) : "";
    const title = ref ? (ref.k === "div" ? E.pg : E.tr) : (transf ? E.tr : E.pg);
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body: E.corpo(brl(valor), r), url: "/login/", tag }), { TTL: 86400, urgency: "high" }); n++; }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
  return n;
}
async function avisarEntradas(ver = false) {
  const { data: cs } = await db.from("asaas_contas").select("user_id").not("aprovada_em", "is", null).not("wallet_id", "is", null);
  const desde = new Date(Date.now() - 3 * 864e5 - 3 * 36e5).toISOString().slice(0, 10);
  const out: any[] = [];
  let avisos = 0;
  for (const c of cs || []) {
    const uid = c.user_id;
    const k = await chaveSub(uid).catch(() => null);
    if (!k) { out.push({ conta: out.length + 1, erro: "sem_chave" }); continue; }
    let lista: any[] = [];
    try { lista = (await subApi(k, `/financialTransactions?startDate=${desde}&order=asc&limit=100`))?.data || []; }
    catch (e: any) { out.push({ conta: out.length + 1, erro: String(e?.message || e).slice(0, 120) }); continue; }
    const ent = lista.filter((t: any) => t?.id && +t.value > 0 && !NAO_ENTRADA.test(String(t.type || "")));
    if (ver) { const tipos: Record<string, number> = {}; for (const t of lista) tipos[`${t.type}${+t.value > 0 ? "+" : "-"}${t.paymentId ? ":pg" : ""}${t.transferId ? ":tr" : ""}`] = (tipos[`${t.type}${+t.value > 0 ? "+" : "-"}${t.paymentId ? ":pg" : ""}${t.transferId ? ":tr" : ""}`] || 0) + 1; out.push({ conta: out.length + 1, itens: lista.length, entradas: ent.length, tipos }); continue; }
    const { data: ja } = await db.from("avisos_entrada").select("tx_id, ref").eq("user_id", uid).gte("criado_em", new Date(Date.now() - 10 * 864e5).toISOString());
    const visto = new Set((ja || []).map((r: any) => r.tx_id));
    const marco = `marco:${uid}`;
    if (!(await db.from("avisos_entrada").select("tx_id").eq("tx_id", marco).maybeSingle()).data) {
      // primeira leitura desta conta: só registra o que já estava lá, sem avisar
      await db.from("avisos_entrada").upsert([{ tx_id: marco, user_id: uid, valor: 0, tipo: "marco" }, ...ent.map((t: any) => ({ tx_id: String(t.id), user_id: uid, valor: +t.value, tipo: String(t.type || "").slice(0, 60) }))], { onConflict: "tx_id", ignoreDuplicates: true });
      out.push({ conta: out.length + 1, marcadas: ent.length });
      continue;
    }
    const usados = new Set((ja || []).map((r: any) => r.ref).filter(Boolean));
    for (const t of ent) {
      if (visto.has(String(t.id))) continue;
      const ref = await refEntrada(uid, t, usados).catch((e) => (console.error("refEntrada", e?.message), null));
      // trava: grava antes de avisar; se outra rodada já gravou, não avisa de novo
      const { data: novo, error } = await db.from("avisos_entrada").upsert({ tx_id: String(t.id), user_id: uid, valor: +t.value, tipo: String(t.type || "").slice(0, 60), ref: ref?.id || null }, { onConflict: "tx_id", ignoreDuplicates: true }).select("tx_id");
      if (error || !novo?.length) continue;
      if (ref?.id) usados.add(ref.id);
      const transf = !!t.transferId || /TRANSFER/i.test(String(t.type || ""));
      const n = await pushEntrada(uid, Math.round(+t.value * 100) / 100, ref, transf, `ent-${t.id}`).catch((e) => (console.error("pushEntrada", e?.message), 0));
      await db.from("avisos_entrada").update({ avisado: n > 0 }).eq("tx_id", String(t.id));
      avisos++;
    }
  }
  return ver ? { contas: out } : { avisos, contas: out.filter((x) => x.erro || x.marcadas != null) };
}

// ---------- PayPal -> Asaas -> dono (Rodrigo 2026-11-17) ----------
// O PayPal saca sozinho para a conta Asaas da Búzios, somando vários pagamentos (e já convertido para reais, com taxa e câmbio).
// Não dá para casar valor com valor; a regra é a da fila: o PayPal saca o saldo em ordem, então cada entrada cobre os pedidos
// pagos ANTES dela, na ordem em que os clientes pagaram. Cada pedido "gasta" 90% do sinal em reais (taxa e câmbio comem até ~10%).
// Um pedido só é coberto se o dinheiro que já caiu paga ele e todos os anteriores; se a entrada cobriu todos os anteriores,
// a sobra (câmbio a favor) fica na Búzios e a conta zera, para a diferença não se acumular. Se faltar, espera a próxima entrada.
const PP_FATOR = 0.9;
function paypalCobertos(entradas: { em: number; valor: number }[], pedidos: { id: number; pago: number; est: number }[]) {
  const E = [...entradas].sort((a, b) => a.em - b.em), P = [...pedidos].sort((a, b) => a.pago - b.pago || a.id - b.id);
  const cob = new Set<number>(); let pool = 0, i = 0;
  for (const e of E) {
    pool += e.valor;
    while (i < P.length && P[i].pago < e.em && pool + 0.005 >= P[i].est) { pool -= P[i].est; cob.add(P[i].id); i++; }
    if (i >= P.length || P[i].pago >= e.em) pool = 0; // cobriu todos os anteriores: sobra de câmbio fica na Búzios
  }
  return cob;
}
const veioDoPaypal = (t: any) => /paypal/i.test(`${t?.description || ""} ${t?.type || ""}`);
// o saque do PayPal chega como Pix recebido (18/11/2026: "Pix de PAYPAL (BANCO CITIBANK S.A.)"); o Asaas registra Pix recebido
// como uma cobrança própria (paymentId). Vale como PayPal se não é cobrança nossa de cliente (externalReference PED<id>) e
// o nome PayPal aparece na movimentação, na cobrança ou na transação Pix.
async function entradaPaypal(t: any) {
  if (!t?.id || !(+t.value > 0) || NAO_ENTRADA.test(String(t.type || ""))) return false;
  if (!t.paymentId) return veioDoPaypal(t);
  const pg = await asaas("/payments/" + encodeURIComponent(t.paymentId)).catch(() => null);
  if (!pg || /^PED\d+$/.test(String(pg.externalReference || ""))) return false;
  if ((await db.from("pagamentos_asaas").select("id").eq("asaas_id", String(t.paymentId)).maybeSingle()).data) return false;
  if (veioDoPaypal(t) || /paypal/i.test(JSON.stringify(pg))) return true;
  const px = pg.pixTransaction ? await asaas("/pix/transactions/" + encodeURIComponent(pg.pixTransaction)).catch(() => null) : null;
  return !!px && /paypal/i.test(JSON.stringify(px));
}
// lê o extrato da conta principal e registra as entradas vindas do PayPal (paypal_entradas, uma linha por movimentação)
async function lerEntradasPaypal(desde: string) {
  const ini = new Date(Date.parse(desde) - 3 * 36e5).toISOString().slice(0, 10);
  const novas: any[] = [];
  for (let off = 0, i = 0; i < 10; i++, off += 100) {
    const l = await asaas(`/financialTransactions?startDate=${ini}&order=asc&limit=100&offset=${off}`);
    for (const t of l?.data || []) if (+t.value > 0 && await entradaPaypal(t)) novas.push(t);
    if (!l?.hasMore) break;
  }
  if (novas.length) {
    const { error } = await db.from("paypal_entradas").upsert(novas.map((t: any) => ({ tx_id: String(t.id), valor: Math.round(+t.value * 100) / 100, data: String(t.date || "").slice(0, 10) || null, tipo: String(t.type || "").slice(0, 60) })), { onConflict: "tx_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}
// fila dos pedidos pagos no PayPal (com captura) e quais o dinheiro que já caiu cobre
async function filaPaypal(cfg: any) {
  const { data: ent } = await db.from("paypal_entradas").select("valor, visto_em");
  const { data: gs } = await db.from("pagamentos_pp").select("pedido, pago_em").not("pago_em", "is", null).not("captura", "is", null).gte("pago_em", cfg.paypal_pedidos_desde);
  const ids = [...new Set((gs || []).map((g: any) => +g.pedido))];
  const { data: ps } = ids.length ? await db.from("pedidos").select("id, lancha, data, status, sinal_valor, jetski_valor, repasse_dono").in("id", ids) : { data: [] };
  const { data: pa } = ids.length ? await db.from("pagamentos_asaas").select("pedido").in("pedido", ids).not("pago_em", "is", null) : { data: [] };
  const peloAsaas = new Set((pa || []).map((r: any) => +r.pedido));
  const fila = (ps || []).filter((p: any) => !peloAsaas.has(+p.id) && online(p) > 0)
    .map((p: any) => ({ ...p, pago: Date.parse((gs || []).find((g: any) => +g.pedido === +p.id)!.pago_em), est: Math.round(online(p) * PP_FATOR * 100) / 100 }));
  const cob = paypalCobertos((ent || []).map((e: any) => ({ em: Date.parse(e.visto_em), valor: +e.valor })), fila.map((p: any) => ({ id: +p.id, pago: p.pago, est: p.est })));
  return { fila, cob, caiu: (ent || []).reduce((a: number, e: any) => a + +e.valor, 0) };
}
async function repassarPaypal(saldo: number) {
  const { data: cfg } = await db.from("asaas_config").select("paypal_auto, paypal_desde, paypal_pedidos_desde").eq("id", 1).maybeSingle();
  if (!cfg?.paypal_auto || !cfg.paypal_desde || !cfg.paypal_pedidos_desde) return null;
  await lerEntradasPaypal(cfg.paypal_desde);
  const { fila, cob } = await filaPaypal(cfg);
  let enviados = 0, esperando = 0;
  const { data: feitos } = fila.length ? await db.from("repasses_pp").select("pedido").in("pedido", fila.map((p: any) => p.id)) : { data: [] };
  const ja = new Set((feitos || []).map((r: any) => +r.pedido));
  for (const p of fila.sort((a: any, b: any) => a.pago - b.pago)) {
    if (p.status !== "aprovado" || SEM_REPASSE.includes(p.lancha) || !(+p.repasse_dono > 0) || ja.has(+p.id)) continue;
    if (!cob.has(+p.id)) { esperando++; continue; } // o dinheiro deste pedido ainda não caiu do PayPal
    const w = await carteira(p.lancha); if (!w) continue; // dono sem conta aprovada: fica no saldo dele e sai quando aprovar
    const v = Math.round(+p.repasse_dono * 100) / 100;
    if (v > online(p) + 0.005) { console.error("paypal repasse maior que o sinal", p.id); continue; }
    if (v > saldo) break;
    const { error: et } = await db.from("repasses_pp").insert({ pedido: p.id, valor: v, comprovante: "asaas:enviando" });
    if (et) continue; // outra rodada já pegou
    let tr: any;
    try { tr = await asaas("/transfers", { value: v, walletId: w }); }
    catch (e: any) {
      console.error("paypal dono", p.id, e?.status, e?.message);
      if (e?.status >= 400 && e?.status < 500) await db.from("repasses_pp").delete().eq("pedido", p.id).eq("comprovante", "asaas:enviando");
      continue; // sem resposta clara: fica travado para conferir no Asaas, nunca manda duas vezes
    }
    await db.from("repasses_pp").update({ comprovante: "asaas:" + tr.id, enviado_em: new Date().toISOString() }).eq("pedido", p.id);
    saldo -= v; enviados++;
    const nome = await nomeLancha(p.lancha);
    await pushAdmins({ title: `PayPal caiu: ${brl(v)} enviado ao dono`, body: `${nome} (${dataBR(p.data)}): a parte do dono saiu do Asaas para a conta dele.` }, `pprep-${p.id}`).catch(e => console.error(e));
  }
  return { saldo, enviados, esperando };
}

// lancha parceira paga no cartão cujo dinheiro ainda não caiu a 2 dias do passeio (antecipação recusada, cartão não antecipável):
// o dono não receberia antes de sair (Rodrigo 2026-11-19). Nunca adianta com dinheiro de outra venda: avisa o administrador uma vez
// (pedidos.aviso_cartao_em) para ele decidir.
async function avisarCartaoAtrasado() {
  const hoje = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  const ate = new Date(Date.now() - 3 * 36e5 + 2 * 864e5).toISOString().slice(0, 10);
  const { data: rs } = await db.from("pagamentos_asaas").select(COLS_PG).eq("metodo", "cartao").not("pago_em", "is", null);
  const ids = [...new Set((rs || []).map((r: any) => +r.pedido))];
  if (!ids.length) return 0;
  const { data: ps } = await db.from("pedidos").select("id, lancha, data, repasse_dono").in("id", ids).eq("status", "aprovado")
    .gte("data", hoje).lte("data", ate).is("aviso_cartao_em", null).gt("repasse_dono", 0);
  let n = 0;
  for (const p of ps || []) {
    if (SEM_REPASSE.includes(p.lancha)) continue;
    const { data: feito } = await db.from("repasses_pp").select("pedido").eq("pedido", p.id).maybeSingle();
    if (feito) continue;
    const rows = (rs || []).filter((r: any) => +r.pedido === +p.id); await refrescar(rows);
    const cx = caixaPedido(rows);
    const q = quandoCobre(cx, +p.repasse_dono);
    if (cx.estorno || q === null) continue;
    const { data: foi } = await db.from("pedidos").update({ aviso_cartao_em: new Date().toISOString() }).eq("id", p.id).is("aviso_cartao_em", null).select("id");
    if (!foi?.length) continue;
    const { data: l } = await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle();
    await pushAdmins({ title: "Cartão ainda não caiu: dono sem repasse", body: `Pedido ${p.id} (${l?.nome || p.lancha}, ${dataBR(p.data)}): o cartão do cliente ainda não caiu no Asaas${q && q !== "?" ? ` (previsto ${dataBR(q)})` : ""}. O dono não recebe a parte dele antes do passeio sem você decidir.` }, `cartao-atrasado-${p.id}`);
    n++;
  }
  return n;
}

async function enviarSaldos() {
  const { data: cfg } = await db.from("asaas_config").select("saldo_auto").eq("id", 1).maybeSingle();
  if (!cfg?.saldo_auto) return { ligado: false };
  await conferirContas();
  const { data: ok } = await db.from("asaas_contas").select("user_id, wallet_id").not("aprovada_em", "is", null);
  if (!ok?.length) return { ligado: true, enviados: 0 };
  let saldo = +(await asaas("/finance/balance")).balance || 0, n = 0, esperando = 0;
  // antecipação automática de cartão ligada na conta? (só informa; a regra usa o que de fato caiu em cada cobrança)
  const antAuto = await asaas("/anticipations/configurations").then((c: any) => c?.creditCardAutomaticEnabled ?? null).catch(() => null);
  // 1. parte do dono: pago pelo Asaas sem divisão (o dono ainda não tinha conta aprovada)
  const { data: pg } = await db.from("pagamentos_asaas").select(COLS_PG).not("pago_em", "is", null);
  const doPedido = (id: number) => (pg || []).filter((r: any) => +r.pedido === +id);
  const semDiv = [...new Set((pg || []).filter((r: any) => !r.wallet_id || !(+r.repasse > 0)).map((r: any) => +r.pedido))]
    .filter((id) => !(pg || []).some((r: any) => +r.pedido === id && r.wallet_id && +r.repasse > 0));
  if (semDiv.length) {
    const { data: ps } = await db.from("pedidos").select("id, lancha, data, repasse_dono").in("id", semDiv).eq("status", "aprovado").gt("repasse_dono", 0).order("data").limit(30);
    const { data: feitos } = await db.from("repasses_pp").select("pedido").in("pedido", semDiv);
    const ja = new Set((feitos || []).map((r: any) => +r.pedido));
    for (const p of ps || []) {
      if (SEM_REPASSE.includes(p.lancha) || ja.has(+p.id)) continue;
      const w = await carteira(p.lancha); if (!w) continue; // dono ainda sem conta aprovada: fica no saldo dele
      const v = Math.round(+p.repasse_dono * 100) / 100;
      // só com o dinheiro deste pedido já no saldo (cartão: parcelas que caíram); senão espera, nunca adianta com outra venda
      const rows = doPedido(p.id); await refrescar(rows);
      const cx = caixaPedido(rows);
      if (cx.estorno || quandoCobre(cx, v) !== null) { esperando++; continue; }
      if (v > saldo) break;
      const { error: et } = await db.from("repasses_pp").insert({ pedido: p.id, valor: v, comprovante: "asaas:enviando" });
      if (et) continue;
      let tr: any;
      try { tr = await asaas("/transfers", { value: v, walletId: w }); }
      catch (e: any) {
        console.error("saldo dono", p.id, e?.status, e?.message);
        if (e?.status >= 400 && e?.status < 500) await db.from("repasses_pp").delete().eq("pedido", p.id).eq("comprovante", "asaas:enviando");
        continue; // sem resposta clara: fica travado para conferir no Asaas, nunca manda duas vezes
      }
      await db.from("repasses_pp").update({ comprovante: "asaas:" + tr.id, enviado_em: new Date().toISOString() }).eq("pedido", p.id);
      saldo -= v; n++;
    }
  }
  // 1b. PayPal (Rodrigo 2026-11-17): o saque automático do PayPal cai no Asaas da Búzios; a parte do dono sai sozinha
  // quando o dinheiro do pedido dele já caiu (paypalCobertos). Miss Bardot fica na Búzios. Desligar: asaas_config.paypal_auto = false
  const ppr = await repassarPaypal(saldo).catch(e => (console.error("paypal repasse", e?.message), null));
  if (ppr) { saldo = ppr.saldo; n += ppr.enviados; esperando += ppr.esperando; }
  // 2. comissão do vendedor/parceiro: depois do passeio, se ele aconteceu
  const vend = ok.map((c: any) => c.user_id);
  const { data: cs } = await db.from("pedidos").select("id, lancha, vendedor, data, horario, bloqueio_id, preco_cliente, preco_base, repasse_dono")
    .in("vendedor", vend).eq("status", "aprovado").is("comissao_paga", null).is("comissao_comprovante", null).order("data").limit(30);
  for (const p of cs || []) {
    const fim = p.bloqueio_id ? (await db.from("anotacoes").select("hora_fim").eq("bloqueio_id", p.bloqueio_id).maybeSingle()).data?.hora_fim : null;
    if (!acabou(p.data, p.horario, fim)) continue;
    if (p.bloqueio_id && (await db.from("realizados").select("aconteceu").eq("bloqueio_id", p.bloqueio_id).maybeSingle()).data?.aconteceu === false) continue;
    const { data: vv } = await db.from("vendedores").select("indicado_por, indicacao_pct").eq("user_id", p.vendedor).maybeSingle();
    const bruto = Math.max(+p.preco_cliente - +p.preco_base, 0);
    const parte = vv?.indicado_por && +vv.indicacao_pct ? Math.round(bruto * +vv.indicacao_pct) / 100 : 0;
    const com = Math.round((bruto - parte) * 100) / 100;
    if (!(com > 0) || com > saldo) continue;
    // pago pelo Asaas: só quando o dinheiro deste pedido já caído cobre a parte do dono + a comissão (o dono vem primeiro)
    const rows = doPedido(p.id);
    if (rows.length) {
      await refrescar(rows);
      const cx = caixaPedido(rows);
      const split = rows.filter((r: any) => r.wallet_id && +r.repasse > 0).reduce((a: number, r: any) => a + +r.repasse, 0);
      const dono = split > 0 ? split : SEM_REPASSE.includes(p.lancha) ? 0 : Math.max(+p.repasse_dono || 0, 0);
      if (cx.estorno || quandoCobre(cx, dono + com) !== null) { esperando++; continue; }
    }
    const { data: vok } = await db.rpc("vendedor_ok", { uid: p.vendedor });
    if (vok !== true) continue;
    const w = ok.find((c: any) => c.user_id === p.vendedor)?.wallet_id; if (!w) continue;
    const { data: trava } = await db.from("pedidos").update({ comissao_comprovante: "asaas:enviando" }).eq("id", p.id).is("comissao_comprovante", null).is("comissao_paga", null).select("id");
    if (!trava?.length) continue;
    let tr: any;
    try { tr = await asaas("/transfers", { value: com, walletId: w }); }
    catch (e: any) {
      console.error("saldo comissao", p.id, e?.status, e?.message);
      if (e?.status >= 400 && e?.status < 500) await db.from("pedidos").update({ comissao_comprovante: null }).eq("id", p.id).eq("comissao_comprovante", "asaas:enviando");
      continue;
    }
    const { error: em } = await db.from("pedidos").update({ comissao_comprovante: "asaas:" + tr.id, comissao_paga: new Date().toISOString() }).eq("id", p.id);
    if (em) console.error("comissao_paga", p.id, em.message);
    saldo -= com; n++;
  }
  // 3. jetski: o líquido do jetski vai para o dono do jetski (pago online junto com o sinal), em duas metades (Rodrigo 2026-11-19):
  // 1ª metade no dia do passeio, 2 h antes da saída da lancha (o dono nunca sai sem receber); 2ª metade sozinha no fim do horário
  // do jet ski. Cancelado/devolvido depois da 1ª: a 2ª fica na Búzios e o administrador acerta direto com o dono (jetski_acertos).
  const hoje = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  // pagamento do cliente que cobre o jetski: cobrança do Asaas com o sinal + jetski; PayPal em reais com o valor certo
  const pagoJet = async (pid: number) => {
    const { data: pq } = await db.from("pedidos").select("sinal_valor, jetski_valor").eq("id", pid).maybeSingle();
    const deve = online(pq || {});
    const pas = (await db.from("pagamentos_asaas").select("sinal").eq("pedido", pid).not("pago_em", "is", null)).data || [];
    const pp = (await db.from("pagamentos_pp").select("moeda, valor").eq("pedido", pid).not("pago_em", "is", null).maybeSingle()).data;
    const cobre = deve > 0 && (pas.some((r: any) => +r.sinal >= deve - 0.005) || (!!pp && (pp.moeda !== "BRL" || +pp.valor >= deve - 0.005)));
    return { pq, asaas: pas.length > 0, algum: pas.length > 0 || !!pp, cobre };
  };
  const { data: js } = await db.from("pedidos").select("id, data, horario, hora_ini, bloqueio_id, jetski, jetski_neto")
    .eq("status", "aprovado").not("jetski", "is", null).gt("jetski_neto", 0).is("jetski_repasse", null).lte("data", hoje).order("data").limit(100);
  for (const p of js || []) {
    if (!(await jetskiLibera(p))) continue;
    if (p.bloqueio_id && (await db.from("realizados").select("aconteceu").eq("bloqueio_id", p.bloqueio_id).maybeSingle()).data?.aconteceu === false) continue;
    const pg1 = await pagoJet(p.id);
    if (!pg1.algum) continue; // pago fora do site (Pix com comprovante): a Búzios repassa à mão
    if (!pg1.cobre) { console.error("saldo jetski: pagamento não cobre o jetski", p.id); continue; }
    const v = Math.round(+p.jetski_neto * 50) / 100; // metade, em centavos (a 2ª leva o que sobrar)
    // Rodrigo 2026-11-17 (escolheu "2h antes, só se já caiu"): pago pelo Asaas, o dinheiro deste pedido já tem de estar no saldo
    // (Pix na hora; cartão ainda a cair espera a parcela cair, nunca adianta com dinheiro de outra venda)
    if (pg1.asaas) {
      const rows = doPedido(p.id); await refrescar(rows);
      const cx = caixaPedido(rows);
      if (cx.estorno || quandoCobre(cx, v) !== null) { esperando++; continue; }
    }
    const dono = (await db.from("jetskis").select("dono").eq("id", p.jetski).maybeSingle()).data?.dono;
    const w = ok.find((c: any) => c.user_id === dono)?.wallet_id; if (!w) continue; // dono do jetski sem conta aprovada: a Búzios paga por Pix
    if (!(v > 0) || v > saldo) continue;
    // revisão de segurança 2026-11-17: o líquido nunca passa do que o cliente pagou pelo jetski
    if (+p.jetski_neto > (+pg1.pq?.jetski_valor || 0) + 0.005) { console.error("saldo jetski: líquido maior que o valor pago", p.id); continue; }
    // trava só se o pedido continua aprovado e com o mesmo jet ski (cancelado ou trocado entre a leitura e o envio não recebe)
    const { data: trava } = await db.from("pedidos").update({ jetski_repasse: "asaas:enviando", jetski_metade1: v }).eq("id", p.id).eq("status", "aprovado").eq("jetski", p.jetski).is("jetski_repasse", null).select("id");
    if (!trava?.length) continue;
    let tr: any;
    try { tr = await asaas("/transfers", { value: v, walletId: w }); }
    catch (e: any) {
      console.error("saldo jetski", p.id, e?.status, e?.message);
      if (e?.status >= 400 && e?.status < 500) await db.from("pedidos").update({ jetski_repasse: null, jetski_metade1: null }).eq("id", p.id).eq("jetski_repasse", "asaas:enviando");
      continue; // sem resposta clara: fica travado para conferir no Asaas, nunca manda duas vezes
    }
    const { error: ej } = await db.from("pedidos").update({ jetski_repasse: "asaas:" + tr.id, jetski_repasse_em: new Date().toISOString() }).eq("id", p.id);
    if (ej) console.error("jetski_repasse", p.id, ej.message);
    saldo -= v; n++;
  }
  // 3b. 2ª metade do jetski: no fim do horário do jet ski. Cliente desistiu ou não apareceu (pedido aprovado, ou virou crédito):
  // sai normalmente. Cancelado de outro jeito ou estornado: fica na Búzios e vira acerto com aviso ao administrador.
  const { data: js2 } = await db.from("pedidos").select("id, data, horario, hora_fim, status, motivo, jetski, jetski_neto, jetski_metade1, jetski_ini, jetski_min, jetski_cortesia")
    .not("jetski", "is", null).not("jetski_metade1", "is", null).like("jetski_repasse", "asaas:%").neq("jetski_repasse", "asaas:enviando")
    .is("jetski_repasse2", null).lte("data", hoje).order("data").limit(100);
  for (const p of js2 || []) {
    if (!jetskiAcabou(p)) continue;
    const v2 = Math.round((+p.jetski_neto - +p.jetski_metade1) * 100) / 100;
    const pg2 = await pagoJet(p.id);
    let cx: any = null;
    if (pg2.asaas) { const rows = doPedido(p.id); await refrescar(rows); cx = caixaPedido(rows); }
    const desistiu = p.status === "aprovado" || (p.status === "cancelado" && p.motivo === "credito");
    if (!desistiu || cx?.estorno) {
      const { data: tv } = await db.from("pedidos").update({ jetski_repasse2: "buzios", jetski_repasse2_em: new Date().toISOString() }).eq("id", p.id).is("jetski_repasse2", null).select("id");
      if (!tv?.length) continue;
      const dono = (await db.from("jetskis").select("dono").eq("id", p.jetski).maybeSingle()).data?.dono || null;
      const { error: ea } = await db.from("jetski_acertos").upsert({ pedido: p.id, jetski: p.jetski, dono, pago: +p.jetski_metade1, retido: Math.max(v2, 0),
        motivo: cx?.estorno ? "pagamento estornado" : "pedido cancelado" }, { onConflict: "pedido,jetski", ignoreDuplicates: true });
      if (ea) console.error("jetski_acertos", p.id, ea.message);
      continue;
    }
    if (!(v2 > 0)) { await db.from("pedidos").update({ jetski_repasse2: "sem_valor", jetski_repasse2_em: new Date().toISOString() }).eq("id", p.id).is("jetski_repasse2", null); continue; }
    if (!pg2.algum) continue; // pago fora do site: a Búzios repassa à mão
    // o dinheiro do pedido inteiro do jetski tem de já ter caído (nunca adianta com dinheiro de outra venda)
    if (cx && quandoCobre(cx, +p.jetski_neto || 0) !== null) { esperando++; continue; }
    const dono = (await db.from("jetskis").select("dono").eq("id", p.jetski).maybeSingle()).data?.dono;
    const w = ok.find((c: any) => c.user_id === dono)?.wallet_id; if (!w) continue;
    if (v2 > saldo) continue;
    if (+p.jetski_neto > (+pg2.pq?.jetski_valor || 0) + 0.005) { console.error("saldo jetski 2: líquido maior que o valor pago", p.id); continue; }
    const { data: trava } = await db.from("pedidos").update({ jetski_repasse2: "asaas:enviando" }).eq("id", p.id).eq("jetski", p.jetski).eq("status", p.status).is("jetski_repasse2", null).select("id");
    if (!trava?.length) continue;
    let tr: any;
    try { tr = await asaas("/transfers", { value: v2, walletId: w }); }
    catch (e: any) {
      console.error("saldo jetski 2", p.id, e?.status, e?.message);
      if (e?.status >= 400 && e?.status < 500) await db.from("pedidos").update({ jetski_repasse2: null }).eq("id", p.id).eq("jetski_repasse2", "asaas:enviando");
      continue;
    }
    const { error: ej } = await db.from("pedidos").update({ jetski_repasse2: "asaas:" + tr.id, jetski_repasse2_em: new Date().toISOString() }).eq("id", p.id);
    if (ej) console.error("jetski_repasse2", p.id, ej.message);
    saldo -= v2; n++;
  }
  return { ligado: true, enviados: n, esperando_dinheiro: esperando, antecipacao_auto: antAuto };
}

// jet ski cancelado/devolvido depois de o dono já ter recebido (Rodrigo 2026-11-19): avisa o administrador uma vez para acertar direto com o dono
async function avisarAcertosJetski() {
  const { data: L } = await db.from("jetski_acertos").select("id, pedido, jetski, pago, retido, motivo").is("avisado_em", null).is("resolvido_em", null).limit(20);
  for (const a of L || []) {
    const { data: tv } = await db.from("jetski_acertos").update({ avisado_em: new Date().toISOString() }).eq("id", a.id).is("avisado_em", null).select("id");
    if (!tv?.length) continue;
    const nome = a.jetski ? (await db.from("jetskis").select("nome").eq("id", a.jetski).maybeSingle()).data?.nome || "jet ski" : "jet ski";
    const { data: p } = await db.from("pedidos").select("data").eq("id", a.pedido).maybeSingle();
    await pushAdmins({ title: "Jet ski: acertar com o dono ⚠️",
      body: `Pedido ${a.pedido}${p?.data ? ` (${diaCurto(p.data)})` : ""}: ${a.motivo || "cancelado"} depois de o dono do ${nome} receber ${brl(+a.pago)}.` +
        (+a.retido > 0 ? ` A outra metade (${brl(+a.retido)}) ficou na Búzios.` : "") + " Combine direto com ele e marque como resolvido no painel." }, `jetacerto-${a.id}`);
  }
}

let ultimaVarreduraConta = 0;
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method === "GET") {
      const u = new URL(req.url);
      const x = await carregar(Number(u.searchParams.get("p")), u.searchParams.get("k") || "");
      if (!x) return json({ erro: "link" }, 404);
      const s = onlineTotal(x.p, x.g);
      const foraG = String(x.c?.moeda || "BRL") !== "BRL"; // estrangeiro: prazo maior do cartão nas lanchas parceiras
      const { data: cl } = await db.from("clientes").select("cpf").eq("user_id", x.p.cliente).maybeSingle();
      const { data: ja } = await db.from("asaas_clientes").select("user_id").eq("user_id", x.p.cliente).not("cpf", "is", null).maybeSingle();
      const { data: cob } = await db.from("pagamentos_asaas").select("metodo, valor, sinal, pix_payload, pix_img, invoice_url, pago_em, criado_em").eq("pedido", x.p.id);
      return json({ ativo: !!KEY(), sinal: s, ...(s > 0 ? await totais(s) : {}), cpf: !!(ja || cpfOk(dig(cl?.cpf))),
        cob_pix: (cob || []).find((c: any) => c.metodo === "pix" && +c.sinal === s && vale(c, x.p.pagar_ate)) || null, cartao_ok: (x.g.length > 1 ? x.g : [x.p]).every((m: any) => cartaoOk(x.p.data, m.lancha, foraG)), cartao_dias: ((ds: number[]) => ds.includes(-1) ? -1 : Math.max(...ds))((x.g.length > 1 ? x.g : [x.p]).map((m: any) => cartaoDias(m.lancha, foraG))), segura_h: SEGURA_MS / 36e5, pago: !!(x.c.pago_em || (cob || []).some((c: any) => c.pago_em)) });
    }
    const b = await req.json().catch(() => ({}));

    // aviso do Asaas: não confia no corpo, confere a cobrança direto no Asaas
    if (b?.event && b?.payment?.id) {
      if (/^PAYMENT_(RECEIVED|CONFIRMED)/.test(String(b.event))) await ligarEstatico(String(b.payment.id)).catch(e => console.error("webhook estatico", e?.message));
      if (/^PAYMENT_(RECEIVED|CONFIRMED)/.test(String(b.event))) await conferir(String(b.payment.id), true).catch(e => console.error("webhook", e));
      if (/^PAYMENT_/.test(String(b.event)) && b.payment?.id) { const { data: rw } = await db.from("pagamentos_asaas").select("id, asaas_id").eq("asaas_id", String(b.payment.id)).not("pago_em", "is", null).maybeSingle(); if (rw) await atualizarCredito(rw).catch(e => console.error("webhook credito", e?.message)); }
      return json({ ok: true });
    }
    // aviso da subconta (documento e selfie): também não confia no corpo, só manda conferir no Asaas
    if (/^ACCOUNT_STATUS_/.test(String(b?.event || ""))) {
      // o aviso não tem token (subcontas antigas foram criadas sem): no máximo uma varredura a cada 2 min por instância,
      // para ninguém estourar o limite da API do Asaas chamando em loop (revisão 2026-11-18); o robô de 10 em 10 min cobre o resto
      if (Date.now() - ultimaVarreduraConta < 120_000) return json({ ok: true });
      ultimaVarreduraConta = Date.now();
      await conferirContas().catch(e => console.error("conta webhook", e));
      // documento recusado: o aviso com o motivo e o link sai na hora (função asaas-docs; o robô de 10 em 10 min cobre se falhar)
      if (/DOCUMENT_REJECTED|GENERAL_APPROVAL_REJECTED/.test(String(b.event))) {
        const ch = (await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle()).data?.chave;
        // em segundo plano: o Asaas recebe o "ok" na hora
        const p = ch ? fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/asaas-docs", { method: "POST", headers: { "content-type": "application/json", "x-chave": ch }, body: JSON.stringify({ rejeitados: true }) }).catch(e => console.error("rejeitados webhook", e)) : null;
        // deno-lint-ignore no-explicit-any
        if (p) { const er = (globalThis as any).EdgeRuntime; if (er?.waitUntil) er.waitUntil(p); else await p; }
      }
      return json({ ok: true });
    }

    // antecipação de cartão (Rodrigo 2026-11-17: "tem que ser antecipado"): só o robô. simular = mostra taxa e líquido;
    // pedir = pede a antecipação no Asaas das vendas de cartão já confirmadas que a antecipação automática não pegou
    // aviso de dinheiro na conta: só o robô. ver = tipos do extrato de cada subconta (sem nomes nem valores); sem ver = roda agora
    if (b.acao === "entradas") {
      const ch = req.headers.get("x-chave") || "";
      const cfg = ch ? (await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle()).data : null;
      if (!(cfg?.chave && ch === cfg.chave)) return json({ erro: "chave" }, 403);
      return json(await avisarEntradas(b.ver === true));
    }
    // PayPal -> Asaas: só o robô. ver = entradas sem cobrança no extrato (data, tipo, valor, se veio do PayPal; sem descrição) e a fila
    if (b.acao === "paypal") {
      const ch = req.headers.get("x-chave") || "";
      const cfg = ch ? (await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle()).data : null;
      if (!(cfg?.chave && ch === cfg.chave)) return json({ erro: "chave" }, 403);
      const { data: pc } = await db.from("asaas_config").select("paypal_auto, paypal_desde, paypal_pedidos_desde").eq("id", 1).maybeSingle();
      const dias = Math.min(Math.max(Number(b.dias) || 30, 1), 90);
      const ini = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
      const l = await asaas(`/financialTransactions?startDate=${ini}&order=desc&limit=100`).catch((e: any) => ({ erro: e?.message }));
      const sem: any[] = [];
      for (const t of (l?.data || []).filter((t: any) => +t.value > 0).slice(0, 30)) sem.push({ data: t.date, tipo: t.type, valor: +t.value, cobranca: !!t.paymentId, paypal: await entradaPaypal(t).catch(() => null) });
      if (pc?.paypal_desde && b.ler === true) await lerEntradasPaypal(pc.paypal_desde);
      const f = pc?.paypal_pedidos_desde ? await filaPaypal(pc) : null;
      const { data: rp } = f?.fila.length ? await db.from("repasses_pp").select("pedido, enviado_em").in("pedido", f.fila.map((p: any) => p.id)) : { data: [] };
      return json({ config: pc, entradas_sem_cobranca: sem, erro: l?.erro, caiu_paypal: f?.caiu ?? 0,
        fila: (f?.fila || []).map((p: any) => ({ pedido: p.id, lancha: p.lancha, status: p.status, gasta: p.est, dono: +p.repasse_dono || 0, coberto: f!.cob.has(+p.id), repassado: (rp || []).some((r: any) => +r.pedido === +p.id && r.enviado_em) })) });
    }
    if (b.acao === "antecipacao") {
      const ch = req.headers.get("x-chave") || "";
      const cfg = ch ? (await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle()).data : null;
      if (!(cfg?.chave && ch === cfg.chave)) return json({ erro: "chave" }, 403);
      const conf = await asaas("/anticipations/configurations").catch((e: any) => ({ erro: e?.message }));
      if (b.ver && Number(b.ver) > 0) { // diagnóstico: campos de antecipação das parcelas de um pedido (sem dados do cliente)
        const { data: r } = await db.from("pagamentos_asaas").select("asaas_id, asaas_real").eq("pedido", Number(b.ver)).not("pago_em", "is", null).maybeSingle();
        if (!r) return json({ erro: "pedido" }, 404);
        const pg = await asaas(`/payments/${encodeURIComponent(r.asaas_real || r.asaas_id)}`);
        const l = pg.installment ? ((await asaas(`/payments?installment=${encodeURIComponent(pg.installment)}&limit=24`))?.data || []) : [pg];
        const an = await asaas(`/anticipations?limit=20`).catch((e: any) => ({ erro: e?.message }));
        return json({ parcelas: l.map((x: any) => ({ n: x.installmentNumber, status: x.status, anticipated: x.anticipated, anticipable: x.anticipable, creditDate: x.creditDate, estimatedCreditDate: x.estimatedCreditDate, netValue: x.netValue })),
          antecipacoes: (an?.data || []).map((a: any) => ({ status: a.status, installment: a.installment === pg.installment, payment: a.payment, anticipationDate: a.anticipationDate, requestDate: a.requestDate, netValue: a.netValue, fee: a.fee })), erro: an?.erro });
      }
      const { data: rs } = await db.from("pagamentos_asaas").select(COLS_PG + ", antecipacao").eq("metodo", "cartao").not("pago_em", "is", null);
      const so = Array.isArray(b.pids) ? new Set(b.pids.map(Number)) : null;
      const out: any[] = [];
      const vistos = new Set<string>(); // grupo: várias linhas, uma cobrança só; antecipa uma vez
      for (const r of rs || []) {
        if (so && !so.has(+r.pedido)) continue;
        if (creditoFinal(r) || situacaoCredito(r) !== "liberar" || r.antecipacao) continue;
        const real = r.asaas_real || r.asaas_id;
        if (vistos.has(real)) continue;
        vistos.add(real);
        const pg = await asaas(`/payments/${encodeURIComponent(real)}`).catch(() => null);
        if (!pg) continue;
        const alvo = pg.installment ? { installment: pg.installment } : { payment: real };
        const sim = await asaas("/anticipations/simulate", alvo).catch((e: any) => ({ erro: e?.message, status: e?.status }));
        const item: any = { pedido: r.pedido, anticipable: pg.anticipable ?? null, sim: { valor: sim?.value, liquido: sim?.netValue, taxa: sim?.fee, dias: sim?.anticipationDays, documentos: sim?.isDocumentationRequired, erro: sim?.erro } };
        if (b.pedir === true && !sim?.erro && sim?.isDocumentationRequired !== true) {
          const feito = await asaas("/anticipations", alvo).catch((e: any) => ({ erro: e?.message, status: e?.status }));
          item.pedido_antecipacao = { status: feito?.status, data: feito?.anticipationDate, erro: feito?.erro };
          if (!feito?.erro) await atualizarCredito(r).catch(() => null);
        }
        out.push(item);
      }
      return json({ config: conf, itens: out });
    }

    // nome do cliente no Asaas igual ao do cadastro (ex.: conta criada com o nome do perfil do Google "Acesso E-mail",
    // Rodrigo 2026-11-21): só o robô (chave interna do resgate_config) ou a chave de serviço
    if (b.acao === "nome_cliente") {
      const ch = req.headers.get("x-chave") || "", tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const cfg = ch ? (await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle()).data : null;
      if (!((cfg?.chave && ch === cfg.chave) || (srk && tok === srk))) return json({ erro: "chave" }, 403);
      const uid = String(b.uid || "");
      if (!/^[0-9a-f-]{36}$/i.test(uid)) return json({ erro: "dados" }, 400);
      const { data: ja } = await db.from("asaas_clientes").select("customer_id").eq("user_id", uid).maybeSingle();
      const { data: cl } = await db.from("clientes").select("nome").eq("user_id", uid).maybeSingle();
      const nome = String(cl?.nome || "").replace(/\s+/g, " ").trim();
      if (!ja?.customer_id || nome.length < 3 || nome.length > 120) return json({ erro: "sem_cliente" }, 404);
      const r = await asaas(`/customers/${ja.customer_id}`, { name: nome });
      return json({ ok: true, nome: r?.name || null });
    }
    if (b.acao === "expirar") {
      // só o robô (chave interna do resgate_config) ou a chave de serviço
      const ch = req.headers.get("x-chave") || "", tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const cfg = ch ? (await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle()).data : null;
      if (!((cfg?.chave && ch === cfg.chave) || (srk && tok === srk))) return json({ erro: "chave" }, 403);
      const lim = new Date(Date.now() - SEGURA_MS).toISOString();
      const { data: velhas } = await db.from("pagamentos_asaas").select("*").is("pago_em", null).lt("criado_em", lim).limit(50);
      // pré-reserva com prazo combinado (pagar_ate): a cobrança vale até esse prazo, não só 2 horas (Rodrigo 2026-11-16, caso Elka)
      const pids = [...new Set((velhas || []).map((r: any) => r.pedido))];
      const { data: comPrazo } = pids.length ? await db.from("pedidos").select("id, pagar_ate").in("id", pids).gt("pagar_ate", new Date().toISOString()) : { data: [] };
      const noPrazo = new Set((comPrazo || []).map((x: any) => x.id));
      let n = 0;
      for (const r of velhas || []) {
        if (noPrazo.has(r.pedido)) continue;
        try {
          if (await conferir(r.asaas_id)) continue; // pagou em cima da hora
          if (!await cancelar(r.asaas_id)) continue; // tenta de novo na próxima rodada
          await db.from("pagamentos_asaas").delete().eq("id", r.id).is("pago_em", null); n++;
          await avisarExpirou(r.pedido).catch(e => console.error("avisar", e));
        } catch (e) { console.error("expirar", r.asaas_id, e); }
      }
      // pedidos que venceram (1 hora antes do início) sem pagamento: cancela e avisa o cliente
      const { data: venc, error: ev } = await db.rpc("pedidos_vencidos");
      if (ev) console.error("pedidos_vencidos", ev.message);
      // prazo vencido há mais de 24 horas sem pagar: cancela em silêncio (o cliente já recebeu o aviso do prazo; Rodrigo 2026-11-12)
      const { data: semPg, error: ep } = await db.rpc("pedidos_prazo_vencido");
      if (ep) console.error("pedidos_prazo_vencido", ep.message);
      for (const p of venc || []) await avisarPassou(p).catch(e => console.error("passou", p.id, e));
      // cobrança aberta de pedido que não está mais pendente (recusado, cancelado, vencido) ou cujo sinal mudou: cancela para ninguém pagar à toa
      const { data: abertas } = await db.from("pagamentos_asaas").select("pedido, sinal").is("pago_em", null).limit(200);
      const ids = [...new Set((abertas || []).map((r: any) => r.pedido))];
      const { data: ps } = ids.length ? await db.from("pedidos").select("id, status, sinal_valor, jetski_valor").in("id", ids) : { data: [] };
      let fora = 0;
      for (const pid of ids) {
        const p = (ps || []).find((x: any) => x.id === pid);
        let esperado = p ? online(p) : 0;
        if (p && p.status === "pendente") { const g = await grupo(pid).catch(() => null); if (g === null) continue; esperado = onlineTotal(p, g); }
        const ruim = !p || p.status !== "pendente" || (abertas || []).some((r: any) => r.pedido === pid && +r.sinal !== esperado);
        if (ruim) fora += await cancelarAbertas(pid).catch(e => (console.error("fora", pid, e), 0));
      }
      // PayPal em análise: confere se o PayPal já liberou (ou recusou)
      const srk2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const ppr = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/paypal-checkout", { method: "POST", headers: { authorization: "Bearer " + srk2, apikey: srk2, "content-type": "application/json" }, body: JSON.stringify({ acao: "pendentes" }) })
        .then(r => r.json()).catch(e => (console.error("pendentes", e), null));
      const saldos = await enviarSaldos().catch(e => (console.error("saldos", e), null));
      await avisarAntecipadas().catch(e => console.error("antecipadas", e));
      await avisarCartaoAtrasado().catch(e => console.error("cartao atrasado", e));
      await avisarAcertosJetski().catch(e => console.error("acertos jetski", e));
      const entradas = await avisarEntradas().catch(e => (console.error("entradas", e), null));
      return json({ expiradas: n, vencidos: (venc || []).length, prazo_vencido: (semPg || []).length, canceladas: fora, paypal: ppr, saldos, entradas });
    }

    if (b.acao === "pix_estatico") {
      const x = await carregar(Number(b.p), b.k);
      if (!x) return json({ erro: "link" }, 404);
      const { p, c } = x;
      if (String(c.moeda || "BRL") === "BRL" || x.g.length > 1) return json({ erro: "pix" }, 400);
      if (c.pago_em) return json({ pago: true });
      if (p.status !== "pendente" || !p.sinal_liberado_em || p.prazo_vencido_em) return json({ erro: "status" }, 409);
      if (await tardeCombinado(p)) return json({ erro: "passou" }, 409);
      const s = onlineTotal(p, x.g);
      if (!(s > 0)) return json({ erro: "status" }, 409);
      const e = await pixEstatico(p.id, (await totais(s)).pix, s); // mesmo valor do Pix com vencimento
      return json({ payload: e.payload, img: e.img, chave: e.chave, valor: +e.valor });
    }
    if (b.acao === "pagar" || b.acao === "conferir") {
      const x = await carregar(Number(b.p), b.k);
      if (!x) return json({ erro: "link" }, 404);
      let { p, c } = x;
      const { data: cobs } = await db.from("pagamentos_asaas").select("*").eq("pedido", p.id);
      if (b.acao === "conferir") {
        let pago = !!c.pago_em;
        for (const r of cobs || []) if (!pago) pago = await conferir(r.asaas_id).catch(() => false);
        // Pix sem vencimento: se o aviso do Asaas se perdeu, procura o pagamento pelo QR
        const { data: est } = pago ? { data: null } : await db.from("pix_estatico").select("qr_id").eq("pedido", p.id).maybeSingle();
        if (est) for (const y of (await asaas(`/payments?pixQrCodeId=${encodeURIComponent(est.qr_id)}&limit=5`).catch(() => null))?.data || []) {
          await ligarEstatico(String(y.id)).catch(e => console.error("conferir estatico", e?.message));
          if (!pago) pago = await conferir(String(y.id)).catch(() => false);
        }
        return json({ pago });
      }
      if (c.pago_em || (cobs || []).some((r: any) => r.pago_em)) return json({ pago: true });
      if (c.captura) return json({ erro: "pendente" }, 409); // PayPal em análise: não cobra de novo
      // central em dólar/euro (estrangeiro): só cartão internacional, cobrado em reais, à vista e sem CPF (Rodrigo 2026-11-11); o PayPal continua como opção
      const fora = String(c.moeda || "BRL") !== "BRL";
      // estrangeiro também paga por Pix em reais (Rodrigo 2026-11-14), com o CPF de quem paga; só o cartão internacional vai sem CPF
      if (p.status !== "pendente" || !p.sinal_liberado_em) return json({ erro: "status" }, 409);
      if (await tardeCombinado(p)) return json({ erro: "passou" }, 409);
      // prazo vencido e o dono subiu o preço (Rodrigo 2026-11-15): mostra o valor novo e só cobra depois de o cliente concordar
      if (p.prazo_vencido_em && x.g.length > 1) return json({ erro: "status" }, 409); // grupo com prazo vencido: a pré-reserva acabou (sem preço novo por lancha)
      if (p.prazo_vencido_em) {
        const r = await precoNovo(p, b.aceito);
        if (r) return r;
        const y = await carregar(Number(b.p), b.k);
        if (!y) return json({ erro: "link" }, 404);
        ({ p, c } = y);
      }
      const vg = await vaga(p.id, true); // segura a data por 10 min já agora, com trava, para dois clientes não gerarem cobrança juntos
      if (vg === "ocupada") return json({ erro: "ocupada" }, 409);
      if (vg === "pagando") return json({ erro: "pagando" }, 409); // outro cliente gerou o pagamento antes e está com a data segurada
      if (vg === "jetski") return json({ erro: "jetski" }, 409); // prazo vencido e o jetski foi para outro cliente: não cobra (Rodrigo 2026-11-15)
      for (const m of x.g.length > 1 ? x.g.filter((m: any) => m.id !== p.id) : []) { // grupo: cada lancha tem de continuar livre para este cliente
        const v2 = await vaga(+m.id, true);
        if (v2 === "ocupada" || v2 === "pagando" || v2 === "jetski") return json({ erro: v2 }, 409);
      }
      const metodo = b.metodo === "cartao" ? "cartao" : "pix"; // sinal da lancha + jetski
      // grupo: uma cobrança só, com a parte de cada dono separada (cada lancha com o seu sinal, jetski e repasse)
      const membros = x.g.length > 1 ? x.g.filter((m: any) => m.status === "pendente") : [p];
      if (x.g.length > 1 && (membros.length !== x.g.length || membros[0]?.id !== p.id)) return json({ erro: "status" }, 409);
      if (metodo === "cartao" && membros.some((m: any) => !cartaoOk(p.data, m.lancha, fora))) return json({ erro: "cartao_prazo", dias: ((ds: number[]) => ds.includes(-1) ? -1 : Math.max(...ds))(membros.map((m: any) => cartaoDias(m.lancha, fora))) }, 409);
      const partes: any[] = [];
      for (const m of membros) {
        const s1 = online(m);
        if (!(s1 > 0)) return json({ erro: "valor" }, 400);
        const w1 = await carteira(m.lancha);
        const r1 = w1 ? +(m.repasse_dono ?? -1) : 0;
        if (w1 && r1 < 0) return json({ erro: "repasse" }, 409); // o administrador ainda não definiu a parte do dono
        if (r1 > s1) return json({ erro: "repasse" }, 409);
        partes.push({ pedido: +m.id, sinal: s1, repasse: r1, wallet_id: w1 || null });
      }
      const sinal = Math.round(partes.reduce((a, q) => a + q.sinal, 0) * 100) / 100;
      const wallet = partes[0].wallet_id, rep = Math.round(partes.reduce((a, q) => a + q.repasse, 0) * 100) / 100;
      const divisao = Object.entries(partes.filter((q) => q.wallet_id && q.repasse > 0).reduce((acc: Record<string, number>, q) => { acc[q.wallet_id] = Math.round(((acc[q.wallet_id] || 0) + q.repasse) * 100) / 100; return acc; }, {}));
      const ehGrupo = partes.length > 1;
      const tt = await totais(sinal), np = metodo === "cartao" && !fora ? Math.min(PARCELAS, Math.max(1, Math.floor(+b.n || 1))) : 1;
      const op = tt.parcelas[np - 1], tot = metodo === "cartao" ? op.total : tt.pix;
      const velha = (cobs || []).find((r: any) => r.metodo === metodo);
      // grupo: a cobrança velha só vale se as lanchas, os sinais e as partes dos donos são os mesmos
      const chaveP = (ps: any) => JSON.stringify((Array.isArray(ps) ? ps : []).map((q: any) => [+q.pedido, +q.sinal, +q.repasse, q.wallet_id || null]));
      const mesmoGrupo = !ehGrupo ? !velha?.partes : chaveP(velha?.partes) === chaveP(partes) || (chaveP((velha?.partes || []).map((q: any) => ({ ...q, repasse: 0, wallet_id: null }))) === chaveP(partes.map((q) => ({ ...q, repasse: 0, wallet_id: null }))) && !velha?.wallet_id && !(+velha?.repasse > 0));
      // sem divisão (split desligado no Asaas): a cobrança velha sem divisão continua valendo, a parte do dono sai depois pelo saldo
      if (velha && mesmoGrupo && vale(velha, p.pagar_ate) && +velha.valor === tot && ((+velha.repasse === rep && velha.wallet_id === (wallet || null)) || (!velha.wallet_id && !(+velha.repasse > 0)))) {
        return json({ metodo, valor: tot, pix_payload: velha.pix_payload, pix_img: velha.pix_img, url: velha.invoice_url });
      }
      if (velha) {
        if (await conferir(velha.asaas_id).catch(() => false)) return json({ pago: true }); // pagou em cima da hora
        if (!await cancelar(velha.asaas_id)) return json({ erro: "asaas" }, 502);
        await db.from("pagamentos_asaas").delete().eq("id", velha.id).is("pago_em", null);
      }
      // trocou de Pix para cartão (ou o contrário): a outra cobrança é cancelada, para o cliente não pagar duas vezes
      for (const r of (cobs || []).filter((r: any) => r.metodo !== metodo && !r.pago_em)) {
        if (await conferir(r.asaas_id).catch(() => false)) return json({ pago: true });
        if (await cancelar(r.asaas_id)) await db.from("pagamentos_asaas").delete().eq("id", r.id).is("pago_em", null);
      }
      const cus = await cliente(p.cliente, dig(b.cpf), fora);
      if (!cus) return json({ erro: "cpf" }, 400);
      // termo de aceite (Rodrigo 2026-11-22): o CPF de quem paga costuma chegar só agora; completa o registro do aceite
      {
        const cpfAc = dig((await db.from("asaas_clientes").select("cpf").eq("user_id", p.cliente).maybeSingle()).data?.cpf);
        if (cpfAc.length === 11 || cpfAc.length === 14) {
          const { error: eac } = await db.from("aceites_termo").update({ cpf: cpfAc }).eq("pedido", p.id).is("cpf", null);
          if (eac) console.error("aceites_termo cpf", p.id, eac.message);
        }
      }
      // Pix de estrangeiro sem CPF: se o Asaas recusar a cobrança sem documento, a página volta a pedir o CPF de quem paga (como antes)
      const pixSemDoc = fora && metodo === "pix" && !(await db.from("asaas_clientes").select("cpf").eq("user_id", p.cliente).maybeSingle()).data?.cpf;
      const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
      const venc = new Date(Math.max(Date.now() + 2 * 864e5, p.pagar_ate ? new Date(p.pagar_ate).getTime() + 864e5 : 0) - 3 * 36e5).toISOString().slice(0, 10); // nunca vence antes do prazo da pré-reserva
      const corpo: any = {
        customer: cus, billingType: metodo === "pix" ? "PIX" : "CREDIT_CARD", dueDate: venc,
        ...(np > 1 ? { installmentCount: np, installmentValue: op.parcela } : { value: tot }),
        description: `Sinal da reserva · ${ehGrupo ? `${partes.length} lanchas` : lancha}${membros.some((m: any) => +m.jetski_valor > 0) ? " + jetski" : ""} · ${dataBR(p.data)}${np > 1 ? ` · ${np}x` : ""}`.slice(0, 500), externalReference: `PED${p.id}`,
        ...(divisao.length ? { split: divisao.map(([w, v]) => ({ walletId: w, ...(np > 1 ? { totalFixedValue: v } : { fixedValue: v }) })) } : {}),
      };
      // Split desligado na conta Asaas (2026-11-16, caso Rafaella): o cliente nunca fica sem pagar. Cobra sem divisão,
      // registra sem carteira/repasse e a parte do dono vai pelo saldo (enviarSaldos, "pago sem divisão"), como dono sem conta aprovada.
      let semSplit = false, pg: any;
      try { pg = await asaas("/payments", corpo); }
      catch (e: any) {
        // O Asaas exige CPF/CNPJ no cliente para Pix (caso pedido 77, argentino, 2026-11-19). O Pix aceita pagamento de qualquer
        // pagador, então o cadastro do estrangeiro no Asaas recebe o CNPJ da própria Búzios Lanchas e a cobrança sai na hora.
        // asaas_clientes.cpf continua vazio: se um dia ele pagar com CPF dele, cliente() troca o documento.
        if (pixSemDoc && e?.asaas && e?.status === 400 && /cpf|cnpj|documento/i.test(String(e?.message || ""))) {
          console.error("pix sem CPF recusado pelo Asaas; usando o CNPJ da Búzios no cadastro do estrangeiro", p.id, e?.message);
          try {
            await asaas(`/customers/${cus}`, { cpfCnpj: CNPJ_BUZIOS });
            pg = await asaas("/payments", corpo);
          } catch (e2: any) {
            if (!corpo.split || !(e2?.asaas && e2?.status === 400 && /split/i.test(String(e2?.message || "")))) {
              console.error("pix sem CPF: CNPJ da Búzios também recusado", p.id, e2?.message);
              pushAdmins({ title: "Asaas recusou Pix sem CPF", body: `Pedido ${p.id}: o Asaas não aceitou Pix de estrangeiro nem com o CNPJ da Búzios. A página voltou a pedir o CPF.` }, `pix-sem-cpf-${new Date().toISOString().slice(0, 10)}`).catch((x) => console.error("push pix sem cpf", x));
              return json({ erro: "cpf" }, 400);
            }
            delete corpo.split; semSplit = true;
            pg = await asaas("/payments", corpo);
          }
        } else {
          if (!corpo.split || !(e?.asaas && e?.status === 400 && /split/i.test(String(e?.message || "")))) throw e;
          console.error("split desligado no Asaas: cobrando sem divisão", p.id, e?.message);
          delete corpo.split; semSplit = true;
          pg = await asaas("/payments", corpo);
          pushAdmins({ title: "Asaas: split desligado", body: `A cobrança do pedido ${p.id} saiu sem divisão; a parte do dono vai pelo saldo. Ative o split em Integrações > Segurança no Asaas.` }, `split-off-${new Date().toISOString().slice(0, 10)}`).catch((x) => console.error("push split", x));
        }
      }
      let payload = null, img = null;
      try {
        if (metodo === "pix") { const q = await asaas(`/payments/${pg.id}/pixQrCode`); payload = q.payload; img = q.encodedImage; }
        // grupo: guarda a parte de cada lancha (valor pago proporcional ao sinal); pago, vira uma linha por pedido (espelhar_pagamento_grupo)
        let resto = tot;
        const pts = ehGrupo ? partes.map((q, i) => {
          const v = i === partes.length - 1 ? Math.round(resto * 100) / 100 : Math.round(tot * q.sinal / sinal * 100) / 100;
          resto = Math.round((resto - v) * 100) / 100;
          return { ...q, repasse: semSplit ? 0 : q.repasse, wallet_id: semSplit ? null : q.wallet_id, valor: v };
        }) : null;
        const { error: ei } = await db.from("pagamentos_asaas").insert({ pedido: p.id, metodo, asaas_id: pg.id, valor: tot, sinal, repasse: semSplit ? 0 : rep, wallet_id: semSplit ? null : wallet, invoice_url: pg.invoiceUrl, pix_payload: payload, pix_img: img, status: pg.status, partes: pts });
        if (ei) throw new Error(ei.message);
        // gerou de novo: volta a valer, e o horário do jetski volta para este cliente (o banco recusa se outro pegou no meio tempo)
        const { error: ev } = await db.from("pedidos").update({ prazo_vencido_em: null }).eq("id", p.id);
        if (ev && /JETSKI_/.test(ev.message)) {
          // só apaga o registro se o Asaas cancelou mesmo; senão a cobrança fica registrada e o cron confere/cancela depois
          if (await cancelar(pg.id)) await db.from("pagamentos_asaas").delete().eq("asaas_id", pg.id).is("pago_em", null);
          return json({ erro: "jetski" }, 409);
        }
        if (ev) console.error("prazo_vencido_em", p.id, ev.message);
      } catch (e) { await cancelar(pg.id); throw e; } // sem registro, a cobrança não pode ficar aberta no Asaas
      return json({ metodo, valor: tot, pix_payload: payload, pix_img: img, url: pg.invoiceUrl });
    }

    if (b.acao === "cancelar") {
      const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const eu = !!srk && tok === srk ? null : await quem(req);
      if (!(!!srk && tok === srk) && !(eu && (await db.from("admins").select("user_id").eq("user_id", eu.id).maybeSingle()).data)) return json({ erro: "admin" }, 403);
      let n = 0;
      for (const pid of (Array.isArray(b.pids) ? b.pids : [b.pid]).map(Number).filter(Boolean).slice(0, 50)) n += await cancelarAbertas(pid);
      return json({ canceladas: n });
    }

    const u = await quem(req);
    if (!u) return json({ erro: "login" }, 401);

    // status da conta na ficha da pessoa (Rodrigo 2026-11-16): só administrador. Conta criada/aprovada, chave Pix, saldo para sacar e último saque,
    // para ele responder "não consigo sacar" sem perguntar a ninguém. Não devolve a chave da API nem o documento.
    if (b.acao === "status_conta") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const alvo = String(b.user_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(alvo)) return json({ erro: "user_id" }, 400);
      const { data: ct } = await db.from("asaas_contas").select("aprovada_em, wallet_id").eq("user_id", alvo).maybeSingle();
      if (!ct) return json({ estado: "sem_conta" });
      const { data: px } = await db.from("vendedores").select("pix_tipo, pix_chave").eq("user_id", alvo).maybeSingle();
      const { data: sq } = await db.from("saques").select("valor, status, criado_em").eq("user_id", alvo).order("criado_em", { ascending: false }).limit(1).maybeSingle();
      let saldo: number | null = null;
      if (ct.aprovada_em) {
        const k = await chaveSub(alvo);
        if (k) {
          const r = await fetch(API() + "/finance/balance", { headers: { access_token: k, "user-agent": "buzios-lanchas" } }).catch(() => null);
          if (r?.ok) saldo = Math.floor((+(await r.json().catch(() => ({})))?.balance || 0) * 100) / 100;
        }
      }
      return json({ estado: ct.aprovada_em && ct.wallet_id ? "ativa" : "analise", pix: px?.pix_chave ? { tipo: px.pix_tipo, chave: px.pix_chave } : null, saldo, saque: sq || null });
    }

    // saque (Rodrigo 2026-10-28): o dono/vendedor tira o dinheiro da conta de recebimento dele pelo nosso app, sem entrar no Asaas.
    // Só para a chave Pix cadastrada por ele na área de vendas (lida aqui do banco, nunca do navegador); um saque por vez.
    if (b.acao === "saque_info" || b.acao === "sacar") {
      const k = await chaveSub(u.id);
      const { data: ct } = await db.from("asaas_contas").select("aprovada_em").eq("user_id", u.id).maybeSingle();
      if (!k || !ct?.aprovada_em) return json({ erro: "sem_conta" }, 409);
      const sub = async (path: string, body?: unknown) => {
        const r = await fetch(API() + path, { method: body === undefined ? "GET" : "POST", headers: { access_token: k, "content-type": "application/json", "user-agent": "buzios-lanchas" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch (_) { /* vazio */ }
        if (!r.ok) { console.error("saque", path, r.status, t.slice(0, 600)); const e: any = new Error(j?.errors?.[0]?.description || `asaas ${r.status}`); e.status = r.status; throw e; }
        return j;
      };
      const disp = Math.floor((+(await sub("/finance/balance")).balance || 0) * 100) / 100;
      const { data: hist } = await db.from("saques").select("id, valor, chave, tipo, status, motivo, asaas_id, criado_em").eq("user_id", u.id).order("criado_em", { ascending: false }).limit(5);
      for (const h of hist || []) { // saque a caminho: confere se o Pix já caiu
        if (h.status !== "processando" || !h.asaas_id) continue;
        const st = String((await sub("/transfers/" + encodeURIComponent(h.asaas_id)).catch(() => ({})))?.status || "");
        const novo = st === "DONE" ? "feito" : ["FAILED", "CANCELLED"].includes(st) ? "falhou" : "";
        if (novo) { h.status = novo; await db.from("saques").update({ status: novo }).eq("id", h.id); }
      }
      if (b.acao === "saque_info") return json({ disponivel: disp, saques: hist || [] });
      const valor = Math.round(+b.valor * 100) / 100;
      if (!(valor >= 1) || valor > disp) return json({ erro: "valor", disponivel: disp }, 409);
      const { data: px } = await db.from("vendedores").select("pix_tipo, pix_chave").eq("user_id", u.id).maybeSingle();
      const TIPO: Record<string, string> = { cpf: "CPF", cnpj: "CNPJ", email: "EMAIL", telefone: "PHONE", aleatoria: "EVP" };
      if (!px?.pix_chave || !TIPO[px.pix_tipo]) return json({ erro: "sem_pix" }, 409);
      // no máximo 3 saques por dia (Brasília) por pessoa, menos o administrador (Rodrigo 2026-11-21); o trigger a0_limite_dia confere de novo no banco
      const hojeBr = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
      const { count: nDia } = await db.from("saques").select("id", { count: "exact", head: true }).eq("user_id", u.id).neq("status", "falhou").gte("criado_em", hojeBr + "T03:00:00Z");
      // o administrador não tem limite (Rodrigo 2026-11-21)
      if ((nDia || 0) >= 3 && !(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "limite_dia" }, 409);
      // trava: um saque por vez (índice único em saques com status "enviando")
      const { data: sq, error: es } = await db.from("saques").insert({ user_id: u.id, valor, chave: px.pix_chave, tipo: px.pix_tipo, status: "enviando" }).select("id").single();
      if (es || !sq) return json({ erro: /limite_dia/.test(es?.message || "") ? "limite_dia" : /espera_troca/.test(es?.message || "") ? "espera_troca" : "andamento" }, 409); // espera_troca: telefone ou chave Pix trocados há menos de 24 h (Rodrigo 2026-11-22)
      let tr: any;
      try { tr = await sub("/transfers", { value: valor, operationType: "PIX", pixAddressKey: px.pix_chave, pixAddressKeyType: TIPO[px.pix_tipo], description: "Saque Búzios Lanchas" }); }
      catch (e: any) {
        // recusa clara: apaga e deixa tentar de novo; sem resposta clara fica "verificar" para conferir no Asaas, nunca manda duas vezes
        if (e?.status >= 400 && e?.status < 500) { await db.from("saques").delete().eq("id", sq.id); return json({ erro: "asaas", detalhe: String(e?.message || e).slice(0, 300) }, 400); }
        await db.from("saques").update({ status: "verificar" }).eq("id", sq.id);
        return json({ erro: "asaas" }, 502);
      }
      await db.from("saques").update({ status: tr.status === "DONE" ? "feito" : "processando", asaas_id: tr.id }).eq("id", sq.id);
      return json({ ok: true, status: tr.status || null });
    }

    if (b.acao === "minha") {
      const { data } = await db.from("asaas_contas").select("nome, cpf_cnpj, email, criado_em").eq("user_id", u.id).maybeSingle();
      return json({ conta: data || null, ativo: !!KEY() });
    }

    // administrador: transferências que o Asaas segura até o Rodrigo aprovar (token do app ou SMS), para o app mostrar o botão de aprovar
    if (b.acao === "aprovar") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      // chave sem permissão de transferência (403): responde zero em vez de erro (revisão 2026-11-11)
      const l = (await asaas("/transfers?limit=100").catch((e: any) => { if (e?.status === 403) return { data: [] }; throw e; })).data || [];
      const pend = l.filter((x: any) => x.status === "PENDING" && x.authorized === false);
      return json({ n: pend.length, valor: Math.round(pend.reduce((a: number, x: any) => a + +x.value, 0) * 100) / 100 });
    }

    // administrador: lanchas cujos donos ainda não têm conta Asaas (a parte deles cai na Búzios e é repassada por fora)
    if (b.acao === "faltam") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const { data: ds } = await db.from("donos").select("lancha, user_id");
      const { data: cs } = await db.from("asaas_contas").select("user_id");
      const tem = new Set((cs || []).map((c: any) => c.user_id)), com = new Set((ds || []).filter((d: any) => tem.has(d.user_id)).map((d: any) => d.lancha));
      const sem = [...new Set((ds || []).map((d: any) => d.lancha))].filter(l => !com.has(l) && !SEM_REPASSE.includes(l));
      const { data: ls } = sem.length ? await db.from("lanchas").select("slug, nome").in("slug", sem) : { data: [] };
      const { data: vs } = await db.from("vendedores").select("user_id");
      return json({ lanchas: sem.map(l => (ls || []).find((x: any) => x.slug === l)?.nome || l).sort(), vend_conta: (vs || []).map((v: any) => v.user_id).filter((id: string) => tem.has(id)) });
    }

    if (b.acao === "conta") {
      const { data: ds } = await db.from("donos").select("lancha").eq("user_id", u.id);
      const { data: vd } = await db.from("vendedores").select("user_id").eq("user_id", u.id).eq("ativo", true).maybeSingle();
      // dono de jet ski (Rodrigo 2026-11-17: quem só tem jet ski também recebe pelo Asaas, igual ao dono de lancha)
      const { data: jd } = await db.from("jetskis").select("id").eq("dono", u.id).eq("ativo", true).limit(1);
      if (!ds?.length && !vd && !jd?.length) return json({ erro: "dono" }, 403); // dono de lancha, de jet ski ou vendedor (comissão)
      if ((await db.from("asaas_contas").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "ja" }, 409);
      const doc = dig(b.cpfCnpj), pf = doc.length === 11;
      if (pf ? !cpfOk(doc) : !cnpjOk(doc)) return json({ erro: "doc" }, 400);
      const tel = dig(b.celular).replace(/^55(?=\d{10,11}$)/, "");
      const nome = String(b.nome || "").trim(), email = String(b.email || "").trim().toLowerCase();
      if (nome.length < 3 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || tel.length < 10) return json({ erro: "dados" }, 400);
      if (pf && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.nascimento || ""))) return json({ erro: "nascimento" }, 400);
      const tipos = ["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"];
      if (!pf && !tipos.includes(b.tipo)) return json({ erro: "tipo" }, 400);
      const renda = Number(b.renda);
      if (!(renda > 0)) return json({ erro: "renda" }, 400);
      if (dig(b.cep).length !== 8 || !String(b.rua || "").trim() || !String(b.numero || "").trim() || !String(b.bairro || "").trim()) return json({ erro: "endereco" }, 400);
      // chave da subconta com permissão de saque (Mayara/Asaas 2026-11-11: accessTokenConfig com TRANSFER READ_WRITE).
      // Se o Asaas recusar o accessTokenConfig, cria do jeito antigo (sem ele) para o cadastro do dono nunca travar; a conferência abaixo avisa o administrador.
      // testado no sandbox 2026-11-11: sem ACCOUNT_DOCUMENT/ACCOUNT_INFO/FINANCIAL_TRANSACTION a chave leva 403 em documentos, situação e saldo
      const ACESSO = { name: "Chave Búzios Lanchas", permissions: [{ name: "PAYMENT", scope: "READ_WRITE" }, { name: "TRANSFER", scope: "READ_WRITE" }, { name: "WEBHOOK", scope: "READ_WRITE" }, { name: "ACCOUNT_DOCUMENT", scope: "READ_WRITE" }, { name: "ACCOUNT_INFO", scope: "READ_WRITE" }, { name: "FINANCIAL_TRANSACTION", scope: "READ" }, { name: "PIX_TRANSACTION", scope: "READ_WRITE" }, { name: "PIX_ADDRESS_KEY", scope: "READ_WRITE" }] };
      const corpo: any = {
        name: nome, email, cpfCnpj: doc, mobilePhone: tel, incomeValue: renda,
        ...(pf ? { birthDate: b.nascimento } : { companyType: b.tipo }),
        address: String(b.rua).trim(), addressNumber: String(b.numero).trim(), complement: String(b.complemento || "").trim() || undefined,
        province: String(b.bairro).trim(), postalCode: dig(b.cep),
        // o Asaas avisa esta função quando a análise do documento e da selfie mudar (aprovada: a pessoa recebe o aviso na hora)
        webhooks: [{ name: "Situação da conta", url: FN_URL, email: await contato(), enabled: true, interrupted: false, apiVersion: 3, sendType: "SEQUENTIALLY",
          events: ["ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED", "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED", "ACCOUNT_STATUS_DOCUMENT_APPROVED", "ACCOUNT_STATUS_DOCUMENT_REJECTED"] }],
      };
      let a: any;
      try {
        try { a = await asaas("/accounts", { ...corpo, accessTokenConfig: ACESSO }); }
        catch (e: any) {
          if (!(e?.asaas && e.status === 400)) throw e; // recusa por dado errado volta a falhar abaixo e mostra o erro
          console.error("accounts sem accessTokenConfig", String(e.message).slice(0, 200));
          a = await asaas("/accounts", corpo);
        }
      } catch (e: any) { if (e.asaas) return json({ erro: "asaas", detalhe: String(e.message).slice(0, 300) }, 400); throw e; }
      await db.from("asaas_contas").insert({ user_id: u.id, conta_id: a.id, wallet_id: a.walletId, nome, cpf_cnpj: doc, email });
      // a chave da subconta só vem na criação: guardada numa tabela que só esta função lê, para buscar o link do documento e da selfie
      // a chave vem em accessToken.apiKey (visto no sandbox em 2026-10-30; antes vinha em apiKey)
      const chave = a.accessToken?.apiKey || a.apiKey;
      // cifrada; se falhar, a conta principal gera outra chave no Asaas (Minhas contas > subconta)
      if (chave) {
        try { const { error } = await db.from("asaas_chaves").insert({ user_id: u.id, api_key: await cifrar(chave) }); if (error) console.error("asaas_chaves", error.message); }
        catch (e) { console.error("asaas_chaves", e); }
        // confere a chave nova: documentos (selfie) e saque precisam funcionar; se faltar permissão, avisa o administrador para ajustar no Asaas
        const teste = async (path: string) => (await fetch(API() + path, { headers: { access_token: chave, "user-agent": "buzios-lanchas" } }).catch(() => null))?.status ?? 0;
        const testes: Record<string, string> = { documentos: "/myAccount/documents", situacao: "/myAccount/status", saldo: "/finance/balance", saque: "/transfers?limit=1" };
        const sem: string[] = [];
        for (const [n, path] of Object.entries(testes)) { const r = await teste(path); if (r === 401 || r === 403) sem.push(n); }
        console.log("subconta chave", a.id, "sem permissao:", sem.join(",") || "nenhuma", "permissoes", JSON.stringify(a.accessToken?.permissions || null).slice(0, 300));
        if (sem.length) await pushAdmins({ title: "Subconta Asaas sem permissão", body: `A conta de ${nome} foi criada, mas a chave dela não tem permissão para: ${sem.join(", ")}. Avise o suporte técnico.` }, `subperm-${a.id}`).catch((e) => console.error(e));
      }
      return json({ ok: true });
    }

    // BaaS: documento e selfie pelo link do Asaas, sem a pessoa entrar no Asaas (Rodrigo 2026-10-27)
    if (b.acao === "documentos") {
      // conta já aprovada no nosso cadastro é sempre "ok": um documento que o Asaas ainda marca como PENDING não pode esconder o saldo e o Sacar (Rodrigo 2026-11-12)
      const { data: ap } = await db.from("asaas_contas").select("aprovada_em").eq("user_id", u.id).not("aprovada_em", "is", null).limit(1);
      if (ap?.length) return json({ status: "ok" });
      const k = await chaveSub(u.id);
      if (!k) return json({ status: "sem" });
      const r = await fetch(API() + "/myAccount/documents", { headers: { access_token: k, "user-agent": "buzios-lanchas" } });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) { console.error("documentos", r.status, JSON.stringify(j).slice(0, 400)); return json({ status: "sem" }); }
      const l: any[] = j.data || [];
      const falta = l.find((d) => ["NOT_SENT", "REJECTED"].includes(d.status) && d.onboardingUrl);
      // recusado: o que foi recusado e o motivo (código gravado pelo robô de documento recusado, função asaas-docs) para o aviso na tela
      const rejs = l.filter((d) => d.status === "REJECTED");
      const rejT = new Set(rejs.map((d) => d.type));
      if (rejs.length) {
        const ur = (rejs.find((d) => d.onboardingUrl) || falta)?.onboardingUrl;
        const { data: cr } = await db.from("asaas_contas").select("rejeicao_motivo").eq("user_id", u.id).maybeSingle();
        if (ur) return json({ status: "pendente", url: ur, rejeitado: true, oque: rejT.has("IDENTIFICATION_SELFIE") ? (rejT.size === 1 ? "selfie" : "ambos") : "doc", motivo: cr?.rejeicao_motivo || null });
      }
      if (falta) return json({ status: "pendente", url: falta.onboardingUrl, rejeitado: falta.status === "REJECTED" });
      // documento ainda não enviado, mas o Asaas ainda não liberou o link (está conferindo os dados do cadastro): não é "em análise"
      if (l.some((d) => ["NOT_SENT", "REJECTED"].includes(d.status))) return json({ status: "aguardando" });
      if (!l.length) return json({ status: "sem" });
      // a conta só recebe quando o Asaas aprova tudo (status geral APPROVED); se aprovou, vale mesmo com algum documento ainda PENDING
      const st: any = await fetch(API() + "/myAccount/status", { headers: { access_token: k, "user-agent": "buzios-lanchas" } }).then((x) => x.json()).catch(() => ({}));
      if (st?.general !== "APPROVED") return json({ status: "analise" });
      await db.from("asaas_contas").update({ aprovada_em: new Date().toISOString() }).eq("user_id", u.id).is("aprovada_em", null); // a partir daqui, a parte dele cai na hora
      return json({ status: "ok" });
    }

    // comissão do vendedor pelo Asaas, depois do passeio, com um toque do administrador (Rodrigo 2026-10-25)
    if (b.acao === "comissao") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const pid = Number(b.pid);
      const { data: p } = await db.from("pedidos").select("id, vendedor, status, data, horario, bloqueio_id, preco_cliente, preco_base, comissao_paga").eq("id", pid).maybeSingle();
      if (!p?.vendedor || p.status !== "aprovado") return json({ erro: "pedido" }, 409);
      if (p.comissao_paga) return json({ erro: "ja" }, 409);
      // antecipar (Rodrigo 2026-11-12): o administrador paga antes do passeio, mas só com o sinal do cliente já pago (o dinheiro já está na Búzios)
      const ant = b.antecipar === true;
      const fim = p.bloqueio_id ? (await db.from("anotacoes").select("hora_fim").eq("bloqueio_id", p.bloqueio_id).maybeSingle()).data?.hora_fim : null;
      if (ant) {
        const pgA = (await db.from("pagamentos_asaas").select("id").eq("pedido", pid).not("pago_em", "is", null).limit(1)).data?.length;
        const pgP = (await db.from("pagamentos_pp").select("pedido").eq("pedido", pid).not("pago_em", "is", null).limit(1)).data?.length;
        if (!pgA && !pgP) return json({ erro: "sinal" }, 409);
      } else if (!acabou(p.data, p.horario, fim)) return json({ erro: "depois_do_passeio" }, 409);
      if (p.bloqueio_id && (await db.from("realizados").select("aconteceu").eq("bloqueio_id", p.bloqueio_id).maybeSingle()).data?.aconteceu === false) return json({ erro: "nao_aconteceu" }, 409);
      const { data: vv } = await db.from("vendedores").select("indicado_por, indicacao_pct").eq("user_id", p.vendedor).maybeSingle();
      const bruto = Math.max(+p.preco_cliente - +p.preco_base, 0);
      const parte = vv?.indicado_por && +vv.indicacao_pct ? Math.round(bruto * +vv.indicacao_pct) / 100 : 0; // parte de quem convidou o sócio (paga por Pix)
      const com = Math.round((bruto - parte) * 100) / 100;
      if (!(com > 0)) return json({ erro: "valor" }, 409);
      const { data: ok, error: okErr } = await db.rpc("vendedor_ok", { uid: p.vendedor });
      if (okErr || ok !== true) return json({ erro: "falta_confirmar" }, 409); // na dúvida, não transfere // WhatsApp e e-mail confirmados (Rodrigo 2026-10-27)
      const { data: ct } = await db.from("asaas_contas").select("wallet_id, aprovada_em").eq("user_id", p.vendedor).maybeSingle();
      if (!ct?.wallet_id) return json({ erro: "sem_conta" }, 409);
      if (!ct.aprovada_em) return json({ erro: "nao_aprovada" }, 409); // a comissão fica no saldo do vendedor até o cadastro ser aprovado
      // trava: dois toques não transferem duas vezes
      const { data: trava } = await db.from("pedidos").update({ comissao_comprovante: "asaas:enviando" }).eq("id", pid).is("comissao_comprovante", null).is("comissao_paga", null).select("id");
      if (!trava?.length) return json({ erro: "comprovante" }, 409);
      let tr: any;
      try { tr = await asaas("/transfers", { value: com, walletId: ct.wallet_id }); }
      catch (e: any) {
        // recusa clara do Asaas (4xx): libera para tentar de novo. Sem resposta clara, a transferência pode ter saído: fica travada para conferir no Asaas
        if (e?.status >= 400 && e?.status < 500) await db.from("pedidos").update({ comissao_comprovante: null }).eq("id", pid).eq("comissao_comprovante", "asaas:enviando");
        else return json({ erro: "asaas", detalhe: "Sem resposta do Asaas. Confira no extrato do Asaas se a transferência saiu antes de tentar de novo." }, 502);
        return json({ erro: "asaas", detalhe: String(e?.message || e).slice(0, 300) }, 400);
      }
      await db.from("pedidos").update({ comissao_comprovante: "asaas:" + tr.id }).eq("id", pid);
      // marca paga com o login do administrador (o banco só deixa o administrador marcar); antecipada: pagar_comissao recusa antes do passeio, então marca pela chave de serviço
      const comAdm = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false }, global: { headers: { Authorization: req.headers.get("authorization") || "" } } });
      const agoraC = new Date().toISOString();
      const { error: em } = ant ? await db.from("pedidos").update({ comissao_paga: agoraC, comissao_antecipada: agoraC }).eq("id", pid) : await comAdm.rpc("pagar_comissao", { pid, sim: true });
      if (em) console.error("pagar_comissao", em.message);
      else await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/aviso-vendedor", { method: "POST", headers: { authorization: req.headers.get("authorization") || "", apikey: Deno.env.get("SUPABASE_ANON_KEY") || "", "content-type": "application/json" }, body: JSON.stringify({ tipo: "pago", id: pid }) }).catch(e => console.error("aviso-vendedor", e));
      return json({ ok: true, valor: com, status: tr.status || null });
    }

    // repasse do PayPal (Rodrigo 2026-10-25): o Rodrigo saca o PayPal para a conta Asaas (mesmo CNPJ) e toca em "O PayPal caiu".
    // O saque chega somado, sem dizer de qual reserva é; por isso o envio é pelo toque, e só enquanto o saldo do Asaas cobre.
    if (b.acao === "repasses") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const { data: gs } = await db.from("pagamentos_pp").select("pedido").not("pago_em", "is", null).not("captura", "is", null);
      let ids = (gs || []).map((g: any) => +g.pedido);
      if (Array.isArray(b.pids)) { const so = new Set(b.pids.map(Number)); ids = ids.filter(i => so.has(i)); }
      if (!ids.length) return json({ enviados: [], sem_conta: 0 });
      const { data: ps } = await db.from("pedidos").select("id, lancha, data, repasse_dono, bloqueio_id").in("id", ids).eq("status", "aprovado").gt("repasse_dono", 0).order("data").order("id");
      const { data: feitos } = await db.from("repasses_pp").select("pedido, enviado_em, comprovante").in("pedido", ids);
      const ja = new Set((feitos || []).filter((r: any) => r.enviado_em || r.comprovante).map((r: any) => +r.pedido));
      const { data: asPg } = await db.from("pagamentos_asaas").select("pedido").in("pedido", ids).not("pago_em", "is", null);
      const viaAs = new Set((asPg || []).map((r: any) => +r.pedido)); // pago também pelo Asaas: a parte do dono já foi no split
      const fila = (ps || []).filter((p: any) => !SEM_REPASSE.includes(p.lancha) && !ja.has(+p.id) && !viaAs.has(+p.id));
      let saldo = +(await asaas("/finance/balance")).balance || 0;
      const enviados: any[] = [], sem: number[] = [], falta: number[] = [], vai: any[] = [];
      for (const p of fila) { const w = await carteira(p.lancha); if (w) vai.push({ ...p, wallet: w }); else sem.push(p.id); }
      // saldo não cobre o total: não manda nada (Rodrigo 2026-10-25)
      const total = Math.round(vai.reduce((a: number, p: any) => a + +p.repasse_dono, 0) * 100) / 100;
      if (total > saldo) return json({ erro: "saldo", saldo: Math.round(saldo * 100) / 100, precisa: total }, 409);
      for (const p of vai) {
        const v = Math.round(+p.repasse_dono * 100) / 100, wallet = p.wallet;
        // trava: dois toques não mandam duas vezes
        const { error: et } = await db.from("repasses_pp").insert({ pedido: p.id, valor: v, comprovante: "asaas:enviando" });
        if (et) continue;
        let tr: any;
        try { tr = await asaas("/transfers", { value: v, walletId: wallet }); }
        catch (e: any) {
          console.error("repasse", p.id, e?.status, e?.message);
          // recusa clara do Asaas (4xx): libera para tentar de novo; sem resposta clara fica travado ("enviando…") para conferir no Asaas, nunca manda duas vezes
          if (e?.status >= 400 && e?.status < 500) await db.from("repasses_pp").delete().eq("pedido", p.id).eq("comprovante", "asaas:enviando");
          falta.push(p.id); continue;
        }
        await db.from("repasses_pp").update({ comprovante: "asaas:" + tr.id, enviado_em: new Date().toISOString() }).eq("pedido", p.id);
        saldo -= v; enviados.push({ pid: p.id, valor: v });
      }
      const precisa = fila.filter((p: any) => falta.includes(p.id)).reduce((a: number, p: any) => a + +p.repasse_dono, 0);
      return json({ enviados, sem_conta: sem.length, falta: falta.length, saldo: Math.round(saldo * 100) / 100, precisa: Math.round(precisa * 100) / 100 });
    }

    // comprovante da comissão: o vendedor vê que recebeu (Rodrigo 2026-10-25)
    // comprovante do repasse ao dono (Meus recebimentos, Rodrigo 2026-10-29): transferência do Asaas ou arquivo do Pix por fora
    if (b.acao === "comprovante" && b.tipo === "repasse") {
      const pid = Number(b.pid);
      const { data: p } = await db.from("pedidos").select("id, lancha").eq("id", pid).maybeSingle();
      if (!p) return json({ erro: "pedido" }, 404);
      const dono = !!(await db.from("donos").select("user_id").eq("user_id", u.id).eq("lancha", p.lancha).maybeSingle()).data;
      if (!dono && !(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const c = String((await db.from("repasses_pp").select("comprovante").eq("pedido", pid).maybeSingle()).data?.comprovante || "");
      if (c.startsWith("asaas:") && c.length > 6 && c !== "asaas:enviando") {
        const tr = await asaas("/transfers/" + encodeURIComponent(c.slice(6)));
        return tr?.transactionReceiptUrl ? json({ url: tr.transactionReceiptUrl, status: tr.status || null }) : json({ erro: "pendente", status: tr?.status || null }, 409);
      }
      if (!c.startsWith("fora:repasses/")) return json({ erro: "sem" }, 404);
      const { data: sg, error } = await db.storage.from("comprovantes").createSignedUrl(c.slice(5), 600);
      return sg?.signedUrl ? json({ url: sg.signedUrl }) : json({ erro: "sem", detalhe: error?.message }, 404);
    }
    if (b.acao === "comprovante") {
      const pid = Number(b.pid);
      const { data: p } = await db.from("pedidos").select("id, vendedor, comissao_paga, comissao_comprovante").eq("id", pid).maybeSingle();
      if (!p) return json({ erro: "pedido" }, 404);
      if (p.vendedor !== u.id && !(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const c = String(p.comissao_comprovante || "");
      if (!c) return json({ erro: "sem" }, 404);
      if (c === "asaas:enviando" || c === "asaas:") return json({ erro: "pendente" }, 409);
      if (c.startsWith("asaas:")) {
        const tr = await asaas("/transfers/" + encodeURIComponent(c.slice(6)));
        return tr?.transactionReceiptUrl ? json({ url: tr.transactionReceiptUrl, status: tr.status || null }) : json({ erro: "pendente", status: tr?.status || null }, 409);
      }
      const { data: sg, error } = await db.storage.from("comprovantes").createSignedUrl(c, 600);
      return sg?.signedUrl ? json({ url: sg.signedUrl }) : json({ erro: "sem", detalhe: error?.message }, 404);
    }

    // planilha de vendas (Rodrigo 2026-11-17): só administrador. Tudo que entrou pelo Asaas (e PayPal), quando cai na conta
    // (cartão: data de liberação de cada parcela, atualizada aqui direto no Asaas) e para quem saiu cada parte (dono, vendedor),
    // com o comprovante. Mais as transferências avulsas do saldo (diárias etc.). Não devolve CPF, telefone, chave nem Pix copia e cola.
    if (b.acao === "planilha") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const { data: pgs } = await db.from("pagamentos_asaas").select(COLS_PG + ", antecipacao").not("pago_em", "is", null).order("pago_em", { ascending: false }).limit(1000);
      // confere no Asaas só o que ainda pode mudar (no máximo 25 por vez, cada um no máximo a cada 5 minutos)
      const muda = (pgs || []).filter((r: any) => !creditoFinal(r) && (!r.conferido_em || Date.now() - new Date(r.conferido_em).getTime() > 5 * 60e3)).slice(0, 25);
      await Promise.all(muda.map((r: any) => atualizarCredito(r).then((n: any) => n && Object.assign(r, n)).catch(e => console.error("planilha credito", r.pedido, e?.message))));
      const { data: pps } = await db.from("pagamentos_pp").select("pedido, moeda, valor, pago_em, pago_valor").not("pago_em", "is", null).not("captura", "is", null).limit(500);
      const pids = [...new Set([...(pgs || []).map((r: any) => r.pedido), ...(pps || []).map((r: any) => r.pedido)])];
      const { data: peds } = pids.length ? await db.from("pedidos").select("id, cliente, lancha, data, horario, status, vendedor, preco_base, preco_cliente, repasse_dono, comissao_paga, comissao_comprovante").in("id", pids) : { data: [] };
      const { data: rps } = pids.length ? await db.from("repasses_pp").select("pedido, valor, comprovante, enviado_em").in("pedido", pids) : { data: [] };
      const { data: lns } = await db.from("lanchas").select("slug, nome");
      const { data: dns } = await db.from("donos").select("user_id, lancha");
      const { data: cts } = await db.from("asaas_contas").select("user_id, wallet_id, nome, aprovada_em");
      const { data: trs } = await db.from("transferencias_saldo").select("id, user_id, valor, motivo, comprovante, status, criado_em").order("criado_em", { ascending: false }).limit(500);
      const P = new Map((peds || []).map((p: any) => [p.id, p])), R = new Map((rps || []).map((r: any) => [r.pedido, r]));
      // data prevista do repasse (Rodrigo 2026-11-17): quando o dinheiro já caído do pedido cobre a parte de cada um
      const CX = new Map<number, any>();
      for (const r of pgs || []) { const k = +r.pedido; if (!CX.has(k)) CX.set(k, caixaPedido((pgs || []).filter((x: any) => +x.pedido === k))); }
      const L = new Map((lns || []).map((l: any) => [l.slug, l.nome])), W = new Map((cts || []).filter((c: any) => c.wallet_id).map((c: any) => [c.wallet_id, c.user_id]));
      const C = new Map((cts || []).map((c: any) => [c.user_id, c]));
      // dono que recebe: o que tem conta Asaas aprovada; senão o primeiro cadastrado
      const donoDe = (l: string) => { const ds = (dns || []).filter((d: any) => d.lancha === l).map((d: any) => d.user_id); return ds.find((x: string) => C.get(x)?.aprovada_em) || ds.find((x: string) => C.get(x)) || ds[0] || null; };
      const uids = new Set<string>();
      for (const p of peds || []) { if (p.cliente) uids.add(p.cliente); if (p.vendedor) uids.add(p.vendedor); const d = donoDe(p.lancha); if (d) uids.add(d); }
      for (const r of pgs || []) if (r.wallet_id && W.get(r.wallet_id)) uids.add(W.get(r.wallet_id));
      for (const t of trs || []) uids.add(t.user_id);
      const N = await nomes([...uids], C);
      const { data: sqs } = await db.from("saques").select("user_id, valor, status, criado_em").in("user_id", [...uids]).neq("status", "falhou").order("criado_em", { ascending: true }).limit(2000);
      const saqueDe = (uid: string | null, desde: string | null) => uid && desde ? (sqs || []).find((x: any) => x.user_id === uid && String(x.criado_em).slice(0, 10) >= desde) : null;
      const sq = (x: any) => x ? { valor: Math.round(+x.valor * 100) / 100, quando: String(x.criado_em).slice(0, 10), feito: x.status === "feito" } : null;
      const r2 = (v: number) => Math.round(v * 100) / 100, dia = (s: any) => s ? String(s).slice(0, 10) : null;
      const vendas: any[] = [];
      // repasse do dono, parte pendente e comissão são do pedido: só no primeiro card de cada pedido
      // (pedido com dois pagamentos contava em dobro em "A repassar", revisão 2026-11-18)
      const jaPed = new Set<number>();
      const uma = (p: any, base: any) => {
        const rep: any[] = [];
        const prim = !jaPed.has(+p.id); jaPed.add(+p.id);
        const donoU = base.split_user || donoDe(p.lancha);
        if (base.split > 0) { const q = base.situacao === "recebido" ? (base.credito_em || dia(base.pago_em)) : null; rep.push({ tipo: "dono", nome: N.get(donoU) || "Dono", valor: base.split, como: "divisao", quando: q, previsto: base.situacao === "recebido" ? null : base.previsto, ok: base.situacao === "recebido", saque: sq(saqueDe(donoU, q)) }); }
        const rp: any = prim ? R.get(p.id) : null;
        if (rp) {
          const c = String(rp.comprovante || "");
          rep.push({ tipo: "dono", nome: N.get(donoU) || "Dono", valor: r2(+rp.valor), como: c === "asaas:enviando" ? "enviando" : c.startsWith("asaas:") ? "asaas" : "fora", quando: dia(rp.enviado_em), ok: c !== "asaas:enviando", saque: c.startsWith("asaas:") ? sq(saqueDe(donoU, dia(rp.enviado_em))) : null, comprovante: (c.startsWith("asaas:") && c !== "asaas:enviando") || c.startsWith("fora:repasses/") ? "repasse" : null });
        } else if (prim && !(base.split > 0) && p.status === "aprovado" && +p.repasse_dono > 0) {
          const ct = donoU ? C.get(donoU) : null;
          const cx = base.metodo !== "paypal" ? CX.get(+p.id) : null, prev = cx ? quandoCobre(cx, +p.repasse_dono) : null;
          rep.push({ tipo: "dono", nome: N.get(donoU) || "Dono", valor: r2(+p.repasse_dono), como: "pendente", motivo: !ct ? "sem_conta" : !ct.aprovada_em ? "conta_analise" : base.metodo === "paypal" ? "paypal" : prev ? "aguardando_credito" : "aguardando", previsto: prev && prev !== "?" ? prev : null, ok: false });
        }
        const com = prim && p.vendedor ? r2(Math.max(0, +p.preco_cliente - +p.preco_base)) : 0;
        if (com > 0) {
          const c = String(p.comissao_comprovante || "");
          const cx = !p.comissao_paga && base.metodo !== "paypal" ? CX.get(+p.id) : null;
          const donoV = base.split > 0 ? base.split : SEM_REPASSE.includes(p.lancha) ? 0 : Math.max(+p.repasse_dono || 0, 0);
          const prev = cx ? quandoCobre(cx, donoV + com) : null;
          rep.push({ tipo: "vendedor", nome: N.get(p.vendedor) || "Vendedor", valor: com, como: p.comissao_paga ? (c.startsWith("asaas:") ? "asaas" : "fora") : "pendente", motivo: prev ? "aguardando_credito" : undefined, previsto: prev && prev !== "?" ? (prev > String(p.data) ? prev : String(p.data)) : null, quando: dia(p.comissao_paga), ok: !!p.comissao_paga, saque: c.startsWith("asaas:") ? sq(saqueDe(p.vendedor, dia(p.comissao_paga))) : null, comprovante: p.comissao_paga && c && c !== "asaas:enviando" ? "comissao" : null }); }
        const saiu = rep.reduce((a, x) => a + x.valor, 0);
        vendas.push({ pid: p.id, data: p.data, horario: p.horario, lancha: L.get(p.lancha) || p.lancha, cliente: N.get(p.cliente) || "Cliente", pedido: p.status, total: r2(+p.preco_cliente || 0), ...base, split_user: undefined, buzios: base.liquido != null ? r2(Math.max(0, base.liquido - saiu)) : null, repasses: rep });
      };
      for (const r of pgs || []) {
        const p: any = P.get(r.pedido); if (!p) continue;
        const sit = situacaoCredito(r), parc = Array.isArray(r.parcelas) ? r.parcelas : null;
        uma(p, { metodo: r.metodo === "pix" ? "pix" : "cartao", n: parc?.length || 1, valor: r2(+r.valor), sinal: r2(+r.sinal), liquido: r.liquido != null ? r2(+r.liquido) : null, pago_em: r.pago_em, situacao: sit, status: r.status, previsto: sit === "recebido" ? null : (parc?.find((x: any) => x.status !== "RECEIVED")?.previsto || r.credito_previsto), credito_em: r.credito_em, recebidas: parc ? parc.filter((x: any) => x.status === "RECEIVED").length : null, parcelas: parc, split: r.wallet_id && +r.repasse > 0 ? r2(+r.repasse) : 0, split_user: r.wallet_id ? W.get(r.wallet_id) : null, recibo: r.status === "RECEIVED" || r.status === "CONFIRMED" });
      }
      for (const x of pps || []) {
        const p: any = P.get(x.pedido); if (!p) continue;
        uma(p, { metodo: "paypal", n: 1, valor: r2(+x.valor), moeda: x.moeda, sinal: r2(+x.valor), liquido: null, pago_em: x.pago_em, situacao: "recebido", previsto: null, credito_em: dia(x.pago_em), split: 0 });
      }
      vendas.sort((a, z) => a.pago_em < z.pago_em ? 1 : -1);
      const transf = (trs || []).map((t: any) => ({ id: t.id, nome: N.get(t.user_id) || "—", valor: r2(+t.valor), motivo: String(t.motivo || "").slice(0, 140), quando: t.criado_em, status: t.status, comprovante: String(t.comprovante || "").startsWith("asaas:") && t.status === "enviado" }));
      // card do administrador no topo (Rodrigo 2026-11-20): saldo do Asaas agora e a receber, quanto é da Búzios e quanto é de outros
      const conta = await contaBuzios(vendas, CX, pids, cts || [], u.id).catch((e) => (console.error("planilha conta", e?.message), null));
      return json({ vendas, transf, conta, em: new Date().toISOString() });
    }
    // busca de quem recebe no Transferir (Rodrigo 2026-11-20: "lista vai ser uma loucura; quero digitar nome ou qualquer informação").
    // Só quem tem conta Asaas aprovada. Procura no servidor (nome, e-mail, telefone, CPF/CNPJ); devolve só nome, documento mascarado e papel.
    if (b.acao === "buscar_recebedor") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const q = String(b.q || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 60), dq = q.replace(/\D/g, "");
      if (q.length < 2) return json({ lista: [] });
      const { data: cs } = await db.from("asaas_contas").select("user_id, nome, email, cpf_cnpj").not("wallet_id", "is", null).not("aprovada_em", "is", null).neq("user_id", u.id).limit(2000);
      const ids = (cs || []).map((c: any) => c.user_id);
      const { data: pf } = ids.length ? await db.from("perfis").select("user_id, nome, telefone").in("user_id", ids) : { data: [] };
      const PF = new Map((pf || []).map((x: any) => [x.user_id, x]));
      const sem = (t: unknown) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const ach = (cs || []).filter((c: any) => {
        const p: any = PF.get(c.user_id) || {};
        if (sem(`${c.nome} ${p.nome || ""} ${c.email || ""}`).includes(q)) return true;
        return dq.length >= 4 && (String(c.cpf_cnpj || "").replace(/\D/g, "").includes(dq) || String(p.telefone || "").replace(/\D/g, "").includes(dq));
      }).slice(0, 8);
      const aid = ach.map((c: any) => c.user_id);
      const { data: dn } = aid.length ? await db.from("donos").select("user_id, lancha").in("user_id", aid) : { data: [] };
      const { data: vd } = aid.length ? await db.from("vendedores").select("user_id").in("user_id", aid) : { data: [] };
      const { data: ln } = (dn || []).length ? await db.from("lanchas").select("slug, nome").in("slug", [...new Set((dn || []).map((d: any) => d.lancha))]) : { data: [] };
      const LN = new Map((ln || []).map((l: any) => [l.slug, l.nome])), VD = new Set((vd || []).map((v: any) => v.user_id));
      const doc = (d: unknown) => { const x = String(d ?? "").replace(/\D/g, ""); return x.length === 11 ? `***.${x.slice(3, 6)}.${x.slice(6, 9)}-**` : x.length === 14 ? `**.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-**` : ""; };
      return json({ lista: ach.map((c: any) => {
        const ls = (dn || []).filter((d: any) => d.user_id === c.user_id).map((d: any) => LN.get(d.lancha) || d.lancha);
        return { id: c.user_id, nome: String(c.nome || PF.get(c.user_id)?.nome || "—").trim(), doc: doc(c.cpf_cnpj), papel: ls.length ? "dono:" + ls.join(", ") : VD.has(c.user_id) ? "vendedor" : "" };
      }) });
    }
    // Sacar do card do administrador (Rodrigo 2026-11-20: "sacar pro meu pix, só uma parte se eu quiser"). Vai para uma chave Pix
    // no CNPJ da própria Búzios: chave CPF ou CNPJ de outro recusada aqui; e-mail/telefone/aleatória de outro dono é recusada pela
    // validação de saques do Asaas (asaas-saques só aprova saída sem registro para o próprio CNPJ). Só até a parte da Búzios.
    if (b.acao === "sacar_buzios") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const valor = Math.round(+b.valor * 100) / 100, chave = String(b.chave || "").trim().slice(0, 80), pedido = String(b.req || "").slice(0, 64);
      if (!(valor >= 1) || valor > 50000) return json({ erro: "valor" }, 400);
      if (pedido.length < 8) return json({ erro: "req" }, 400);
      const d = chave.replace(/\D/g, "");
      const tipo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave) ? "EMAIL" : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chave) ? "EVP"
        : /^\+?55/.test(chave.replace(/[\s()-]/g, "")) && (d.length === 12 || d.length === 13) ? "PHONE" : d.length === 14 ? "CNPJ" : d.length === 11 ? "CPF" : "";
      if (!tipo) return json({ erro: "chave" }, 400);
      // pedido repetido (rede caiu e o admin tocou de novo) responde antes de conferir o saldo, que já baixou (revisão 21/11)
      const ja = (await db.from("saques_buzios").select("status, valor").eq("req", pedido).maybeSingle()).data;
      if (ja) return ja.status === "falhou" ? json({ erro: "falhou" }, 409) : json({ ok: true, valor: +ja.valor, repetido: true });
      const ci: any = await asaas("/myAccount/commercialInfo").catch(() => null), meu = String(ci?.cpfCnpj || "").replace(/\D/g, "");
      // sem conseguir ler o CNPJ da conta, chave CNPJ não passa (na dúvida, recusa)
      if (tipo === "CPF" || (tipo === "CNPJ" && (!meu || d !== meu))) return json({ erro: "chave_cnpj" }, 409);
      const h = { authorization: req.headers.get("authorization") || "", apikey: Deno.env.get("SUPABASE_ANON_KEY") || "", "content-type": "application/json" };
      const seu = await seuAgora(h);
      if (seu === null) return json({ erro: "conta" }, 502);
      if (valor > seu + 0.005) return json({ erro: "so_buzios", saldo: Math.max(0, seu) }, 409);
      const key = tipo === "PHONE" ? "+" + d : tipo === "CNPJ" ? d : chave;
      const { data: row, error: ei } = await db.from("saques_buzios").insert({ req: pedido, valor, chave: key, criado_por: u.id }).select("id").single();
      if (ei) return ei.code === "23505" ? json({ ok: true, valor, repetido: true }) : json({ erro: "registro" }, 500);
      let tr: any;
      try { tr = await asaas("/transfers", { value: valor, operationType: "PIX", pixAddressKey: key, pixAddressKeyType: tipo, description: "Saque Búzios Lanchas" }); }
      catch (e: any) {
        await db.from("saques_buzios").update({ status: "falhou", erro: String(e?.message || e).slice(0, 300) }).eq("id", row.id);
        return json({ erro: "asaas", detalhe: String(e?.message || "").slice(0, 200) }, 502);
      }
      await db.from("saques_buzios").update({ asaas_id: String(tr.id) }).eq("id", row.id); // "enviado" só depois da validação do Asaas (revisão 21/11)
      // a validação do Asaas responde uns 5 s depois: espera até ~14 s para dizer se foi recusada (chave de outro CPF/CNPJ)
      let st = String(tr.status || "");
      for (let i = 0; i < 7 && ["PENDING", ""].includes(st); i++) {
        await new Promise((r) => setTimeout(r, 2000));
        st = String((await asaas("/transfers/" + encodeURIComponent(tr.id)).catch(() => null))?.status || st);
      }
      if (st === "CANCELLED" || st === "FAILED") {
        await db.from("saques_buzios").update({ status: "falhou", erro: "recusado: " + st }).eq("id", row.id);
        return json({ erro: "recusado" }, 409);
      }
      await db.from("saques_buzios").update({ status: "enviado" }).eq("id", row.id);
      return json({ ok: true, valor, status: st });
    }
    // transferir do card do administrador (Rodrigo 2026-11-20): só até a parte que é da Búzios; o dinheiro de donos, vendedores
    // e jet skis fica. Confere a conta na hora (mesma conta do card) e usa a mesma transferência do "Transferir Saldo".
    if (b.acao === "transferir_buzios") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const valor = Math.round(+b.valor * 100) / 100;
      if (!(valor >= 1) || valor > 50000) return json({ erro: "valor" }, 400);
      const h = { authorization: req.headers.get("authorization") || "", apikey: Deno.env.get("SUPABASE_ANON_KEY") || "", "content-type": "application/json" };
      // pedido repetido: deixa o asaas-transferir responder "repetido" sem conferir o saldo, que já baixou (revisão 21/11)
      const rq = String(b.req || "").slice(0, 64);
      const jaTr = rq.length >= 8 ? (await db.from("transferencias_saldo").select("id").eq("req", rq).maybeSingle()).data : null;
      const seu = jaTr ? Infinity : await seuAgora(h);
      if (seu === null) return json({ erro: "conta" }, 502);
      if (valor > seu + 0.005) return json({ erro: "so_buzios", saldo: Math.max(0, seu) }, 409);
      const r = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/asaas-transferir", { method: "POST", headers: h,
        body: JSON.stringify({ acao: "transferir", user_id: String(b.user_id || ""), valor, motivo: String(b.motivo || ""), req: String(b.req || "") }) });
      return new Response(await r.text(), { status: r.status, headers: { ...CORS, "content-type": "application/json" } });
    }
    // comprovante na planilha (administrador): os dados do comprovante para o painel mostrar numa janela própria, sem sair da página
    // (Rodrigo 2026-11-17). Pagamento do cliente, repasse ao dono, comissão do vendedor ou transferência avulsa do saldo.
    // Transferência pelo Asaas: dados lidos direto no Asaas (+ link do comprovante oficial). Pix por fora: link assinado do arquivo anexado.
    if (b.acao === "recibo") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const brl2 = (v: any) => (+v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const dt = (s: any) => s ? String(s).slice(0, 10).split("-").reverse().join("/") : null;
      const ST: Record<string, string> = { DONE: "Concluída", PENDING: "Aguardando", BANK_PROCESSING: "Em processamento no banco", CANCELLED: "Cancelada", FAILED: "Falhou", RECEIVED: "Recebido", CONFIRMED: "Confirmado (cartão a cair)", REFUNDED: "Estornado", RECEIVED_IN_CASH: "Recebido" };
      const arquivo = async (path: string) => {
        const { data: sg } = await db.storage.from("comprovantes").createSignedUrl(path, 600);
        if (!sg?.signedUrl) return json({ erro: "sem" }, 404);
        return json({ arquivo: sg.signedUrl, tipo: /\.pdf$/i.test(path) ? "pdf" : "img" });
      };
      const transf = async (id: string, titulo: string, para: string | null, sobre: string | null) => {
        const tr = await asaas("/transfers/" + encodeURIComponent(id));
        const linhas: [string, string][] = [];
        if (para) linhas.push(["Para", para]);
        if (sobre) linhas.push(["Referente a", sobre]);
        linhas.push(["Valor", brl2(tr.value)]);
        if (+tr.transferFee > 0) linhas.push(["Tarifa", brl2(tr.transferFee)]);
        linhas.push(["Situação", ST[tr.status] || String(tr.status || "—")]);
        const d = dt(tr.effectiveDate || tr.scheduleDate || tr.dateCreated); if (d) linhas.push(["Data", d]);
        linhas.push(["Forma", tr.operationType === "PIX" ? "Pix" : tr.walletId || tr.operationType === "INTERNAL" ? "Transferência entre contas Asaas" : "Transferência bancária"]);
        if (tr.endToEndIdentifier) linhas.push(["Identificador Pix", String(tr.endToEndIdentifier)]);
        linhas.push(["Nº no Asaas", String(tr.id)]);
        return json({ titulo, linhas, url: tr.transactionReceiptUrl || null });
      };
      const nomeDe = async (uid: string | null) => uid ? ((await nomes([uid], new Map((await db.from("asaas_contas").select("user_id, nome").eq("user_id", uid)).data?.map((c: any) => [c.user_id, c]) || []))).get(uid) || null) : null;
      if (b.tipo === "pagamento") {
        const pid = Number(b.pid);
        const { data: r } = await db.from("pagamentos_asaas").select("asaas_id, asaas_real, metodo").eq("pedido", pid).not("pago_em", "is", null).order("pago_em", { ascending: false }).limit(1).maybeSingle();
        if (!r?.asaas_id) return json({ erro: "sem" }, 404);
        const pg = await asaas(`/payments/${encodeURIComponent(r.asaas_real || r.asaas_id)}`);
        const { data: p } = await db.from("pedidos").select("cliente, lancha, data").eq("id", pid).maybeSingle();
        const n = pg.installment ? ((await asaas(`/payments?installment=${encodeURIComponent(pg.installment)}&limit=24`).catch(() => null))?.data || []).length : 1;
        const linhas: [string, string][] = [];
        const cli = await nomeDe(p?.cliente || null); if (cli) linhas.push(["Cliente", cli]);
        if (p) linhas.push(["Passeio", `${(await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha} · ${dt(p.data)}`]);
        linhas.push(["Valor", n > 1 ? `${brl2(+pg.value * n)} (${n}x de ${brl2(pg.value)})` : brl2(pg.value)]);
        linhas.push(["Forma", pg.billingType === "PIX" ? "Pix" : pg.billingType === "CREDIT_CARD" ? (n > 1 ? `Cartão em ${n}x` : "Cartão") : String(pg.billingType || "—")]);
        linhas.push(["Situação", ST[pg.status] || String(pg.status || "—")]);
        const d = dt(pg.clientPaymentDate || pg.paymentDate || pg.confirmedDate); if (d) linhas.push(["Pago em", d]);
        linhas.push(["Pedido", `#${pid}`]);
        linhas.push(["Nº no Asaas", String(pg.id)]);
        return json({ titulo: "Pagamento do cliente", linhas, url: pg.transactionReceiptUrl || pg.invoiceUrl || null });
      }
      if (b.tipo === "transf") {
        const { data: t } = await db.from("transferencias_saldo").select("user_id, motivo, comprovante").eq("id", Number(b.id)).maybeSingle();
        const c = String(t?.comprovante || "");
        if (!c.startsWith("asaas:") || c.length < 8) return json({ erro: "sem" }, 404);
        return await transf(c.slice(6), "Transferência do saldo", await nomeDe(t?.user_id || null), t?.motivo ? String(t.motivo).slice(0, 140) : null);
      }
      if (b.tipo === "repasse" || b.tipo === "comissao") {
        const pid = Number(b.pid);
        const { data: p } = await db.from("pedidos").select("lancha, data, vendedor, comissao_comprovante").eq("id", pid).maybeSingle();
        if (!p) return json({ erro: "pedido" }, 404);
        const sobre = `Pedido #${pid} · ${(await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha} · ${dt(p.data)}`;
        if (b.tipo === "comissao") {
          const c = String(p.comissao_comprovante || "");
          if (!c || c === "asaas:" || c === "asaas:enviando") return json({ erro: c ? "pendente" : "sem" }, c ? 409 : 404);
          return c.startsWith("asaas:") ? await transf(c.slice(6), "Comissão do vendedor", await nomeDe(p.vendedor), sobre) : await arquivo(c);
        }
        const c = String((await db.from("repasses_pp").select("comprovante").eq("pedido", pid).maybeSingle()).data?.comprovante || "");
        if (c.startsWith("asaas:") && c.length > 6 && c !== "asaas:enviando") {
          const ds = (await db.from("donos").select("user_id").eq("lancha", p.lancha)).data || [];
          const ct = ds.length ? (await db.from("asaas_contas").select("user_id").in("user_id", ds.map((d: any) => d.user_id)).not("aprovada_em", "is", null).limit(1).maybeSingle()).data : null;
          return await transf(c.slice(6), "Repasse ao dono", await nomeDe(ct?.user_id || ds[0]?.user_id || null), sobre);
        }
        if (c.startsWith("fora:repasses/")) return await arquivo(c.slice(5));
        return json({ erro: c === "asaas:enviando" ? "pendente" : "sem" }, c === "asaas:enviando" ? 409 : 404);
      }
      return json({ erro: "tipo" }, 400);
    }

    if (b.acao === "webhook") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const lista = await asaas("/webhooks");
      const ja = (lista?.data || []).find((w: any) => w.url === FN_URL);
      const corpo = { name: "Site Búzios Lanchas", url: FN_URL, email: await contato(), enabled: true, interrupted: false, apiVersion: 3, sendType: "SEQUENTIALLY", events: ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"] };
      const w = ja ? await asaas(`/webhooks/${ja.id}`, corpo, "PUT") : await asaas("/webhooks", corpo);
      return json({ ok: true, id: w.id });
    }
    return json({ erro: "acao" }, 400);
  } catch (e) {
    console.error(e);
    const m = String((e as Error)?.message || e);
    return json({ erro: m === "sem_chaves" ? "sem_chaves" : "falhou", detalhe: m.slice(0, 200) }, 500);
  }
});
