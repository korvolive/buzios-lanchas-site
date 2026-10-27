// Búzios Lanchas: pagamento do sinal pelo Asaas (Rodrigo, 2026-10-24). Conta de produção da Buzios Lanchas Ltda,
// mas só aparece na página escondida /pagar/?p=&k=&asaas=1 até o Rodrigo testar e liberar.
// O cliente paga Pix ou cartão com todas as taxas por conta dele (o valor sobe para a Búzios receber o sinal inteiro).
// Split: a parte do dono (pedidos.repasse_dono) vai direto para a subconta Asaas do dono; o resto (comissão da Búzios + vendedor) fica na conta da Búzios.
// GET  ?p&k                                  valores de Pix e cartão para a página
// POST {acao:"pagar", p, k, metodo, n?, cpf?} a página: cria (ou reaproveita) a cobrança e devolve o Pix ou o link do cartão (n = 1 a 6 parcelas; cartão só com 7+ dias até o passeio)
// POST {acao:"conferir", p, k}                a página: confere no Asaas se já foi pago
// POST {acao:"conta", ...dados} (login)      dono: cria a subconta Asaas dele (o Asaas manda o e-mail para ele ativar e mandar os documentos)
// POST {acao:"documentos"} (login)          dono/vendedor: link do Asaas para enviar documento e selfie (BaaS), ou a situação da análise
// POST {acao:"minha"} (login)                dono: se já tem conta Asaas
// POST {acao:"faltam"} (login admin)         lanchas com dono sem conta Asaas (+ vendedores com conta)
// POST {acao:"comissao", pid} (login admin)  depois do passeio: transfere a comissão do vendedor para a conta Asaas dele (Rodrigo 2026-10-25, um toque)
// POST {acao:"repasses", pids?} (login admin) "O PayPal caiu": manda do saldo do Asaas a parte de cada dono dos sinais pagos pelo PayPal (Rodrigo 2026-10-25)
// POST {acao:"comprovante", pid} (vendedor do pedido ou admin) link do comprovante da comissão (Asaas ou o anexo do Pix)
// POST {acao:"aprovar"}                       (admin) quantas transferências estão esperando aprovação do Rodrigo no Asaas
// POST {acao:"cancelar", pid|pids} (admin ou chave de serviço) cancela as cobranças abertas do pedido (recusado, sinal trocado)
// POST {acao:"webhook"} (login admin)         registra o aviso de pagamento no Asaas apontando para esta função
// POST {event, payment} (do Asaas)           aviso de pagamento: confere a cobrança direto no Asaas antes de marcar como paga
// POST {acao:"expirar"} (cron a cada 10 min) cancela no Asaas as cobranças com mais de 2 horas sem pagamento (a data volta para o site)
// Pagou: a reserva se confirma sozinha (rpc confirmar_pago), sem o administrador aprovar (Rodrigo, 2026-10-25).
// Gerou o Pix ou o cartão: a data fica segurada por 2 horas para esse cliente (pp_vaga e datas_seguradas).
// Chave (Edge Functions > Secrets, colada pelo Rodrigo): ASAAS_API_KEY. A chave da subconta do dono não é guardada.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

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
const tarde = (d: string, h: string) => Date.parse(`${d}T${String(INICIO[h] ?? 10).padStart(2, "0")}:00:00-03:00`) - 36e5 <= Date.now();
// fim do passeio (Brasília): manhã 14h, dia 17h, tarde 18h, noite no dia seguinte
const FIM: Record<string, number> = { manha: 14, dia: 17, tarde: 18, noite: 24 };
// hora_fim do passeio na agenda ('HH:MM'), quando o dono anotou, vale no lugar do fim do horário
const acabou = (d: string, h: string, fim?: string | null) => { const [fh, fm] = String(fim || "").split(":").map(Number);
  return Date.parse(`${d}T00:00:00-03:00`) + (fim && !isNaN(fh) ? fh + (fm || 0) / 60 : FIM[h] ?? 24) * 36e5 <= Date.now(); };
// cartão só com 7 dias ou mais até o passeio (Rodrigo 2026-10-25): o cartão cai em cerca de 2 dias mesmo com antecipação,
// e o dono está acostumado a receber a parte dele antes do passeio; mais em cima da hora, só Pix (cai na hora)
const CARTAO_DIAS = 7;
const cartaoOk = (d: string) => (Date.parse(`${d}T00:00:00Z`) - Date.parse(new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10) + "T00:00:00Z")) / 864e5 >= CARTAO_DIAS;
const vale = (r: any) => !!r && (!!r.pago_em || Date.now() - new Date(r.criado_em).getTime() < SEGURA_MS);

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
  return { pix: +(data?.pix_fixo ?? 1.99), pct: +(data?.cartao_pct ?? 2.99), pct6: +(data?.cartao_pct_2a6 ?? 2.49), fixo: +(data?.cartao_fixo ?? 0.49), ant: +(data?.antecipacao_pct ?? 1.15), antP: +(data?.antecipacao_parc_pct ?? 1.6) };
}
// cartão em até 6x (Rodrigo 2026-10-25): cada opção já com a taxa do cartão e a antecipação (ao mês, em média (n+1)/2 meses por parcela),
// para o dinheiro cair na hora e cada um receber cheio; o cliente vê a taxa e escolhe. Parcelas iguais: total = parcela × n.
// Taxas da conta do Rodrigo (promocionais até 22/01/2027): 1x 1,99%, 2-6x 2,49% + R$ 0,49; antecipação à vista 1,15%/mês, parcelada 1,6%/mês.
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
  const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, horario, status, sinal_valor, sinal_liberado_em, comprovante_em, repasse_dono").eq("id", pid).maybeSingle();
  return p ? { c, p } : null;
}

// lanchas da própria Búzios Lanchas: o dono cadastrado não recebe parte nenhuma, tudo fica na conta da Búzios (Rodrigo 2026-10-25)
const SEM_REPASSE = ["miss-bardot"];
// conta Asaas do dono da lancha (um dono por lancha)
async function carteira(lancha: string) {
  if (SEM_REPASSE.includes(lancha)) return null;
  const { data: ds } = await db.from("donos").select("user_id").eq("lancha", lancha);
  const ids = (ds || []).map((d: any) => d.user_id);
  if (!ids.length) return null;
  const { data } = await db.from("asaas_contas").select("wallet_id").in("user_id", ids).order("criado_em").limit(1).maybeSingle();
  return data?.wallet_id || null;
}

async function vaga(pid: number, segurar = false) {
  const { data, error } = await db.rpc("pp_vaga", { pid, segurar });
  if (error) { console.error("pp_vaga", error.message); return "livre"; }
  return String(data || "livre");
}

async function cliente(uid: string, cpfNovo: string) {
  const { data: ja } = await db.from("asaas_clientes").select("customer_id").eq("user_id", uid).maybeSingle();
  if (ja) return ja.customer_id as string;
  const { data: cl } = await db.from("clientes").select("nome, cpf, whatsapp").eq("user_id", uid).maybeSingle();
  const cpf = dig(cl?.cpf) || cpfNovo;
  if (!cpfOk(cpf) && !cnpjOk(cpf)) return null;
  const u = (await db.auth.admin.getUserById(uid)).data?.user;
  const email = u?.email && !/@sem-email\.lanchaembuzios\.com\.br$/.test(u.email) ? u.email : undefined;
  const tel = dig(cl?.whatsapp);
  const c = await asaas("/customers", { name: String(cl?.nome || u?.user_metadata?.nome || "Cliente").trim(), cpfCnpj: cpf, email, mobilePhone: tel.startsWith("55") ? tel.slice(2) : undefined, externalReference: uid, notificationDisabled: true });
  await db.from("asaas_clientes").insert({ user_id: uid, customer_id: c.id, cpf });
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
  if (!p || p.status !== "pendente" || !p.cliente) return;
  const { data: ainda } = await db.from("pagamentos_asaas").select("id").eq("pedido", pid).limit(1);
  if (ainda?.length) return; // ainda tem outra cobrança valendo (Pix ou cartão)
  const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
  const { data: cv } = await db.from("conversas").select("id").eq("tipo", "suporte").eq("cliente", p.cliente).maybeSingle();
  if (cv) {
    const tx = `O prazo de 2 horas para pagar o sinal acabou e a ${lancha} em ${dataBR(p.data)} foi liberada. Se ainda estiver livre, você pode gerar o pagamento de novo pelo mesmo link.`;
    const { data: m } = await db.from("mensagens").insert({ conversa: cv.id, autor: null, texto: tx, sistema: "expirou:", pedido: p.id }).select("id").maybeSingle();
    if (m) await db.from("conversas").update({ ultima_em: new Date().toISOString(), ultima_msg: tx.slice(0, 80), encerrada_em: null }).eq("id", cv.id);
  }
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", p.cliente);
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...EXP[l](lancha, dataBR(p.data)), url: "/login/", tag: `exp-${p.id}` }), { TTL: 86400, urgency: "high" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}
// pedido que venceu sem pagamento (1 hora antes do início): cancelado, e o cliente recebe uma mensagem gentil no chat e no celular (Rodrigo 2026-10-25)
const PASSOU: Record<string, (l: string, d: string) => { title: string; body: string }> = {
  pt: (l, d) => ({ title: "Que tal outra data? ⛵", body: `O seu pedido da ${l} em ${d} foi encerrado. Quando quiser, escolha outra data no site: vai ser um prazer levar você para passear!` }),
  en: (l, d) => ({ title: "How about another date? ⛵", body: `Your request for ${l} on ${d} has been closed. Whenever you like, pick another date on the website: we'd love to take you out on the water!` }),
  es: (l, d) => ({ title: "¿Qué tal otra fecha? ⛵", body: `Tu pedido de la ${l} el ${d} se cerró. Cuando quieras, elige otra fecha en el sitio: ¡será un placer llevarte a pasear!` }),
};
async function avisarPassou(p: { id: number; cliente: string; lancha: string; data: string }) {
  if (!p.cliente) return;
  const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
  const { data: cv } = await db.from("conversas").select("id").eq("tipo", "suporte").eq("cliente", p.cliente).maybeSingle();
  if (cv) {
    const tx = `A data do seu pedido da ${lancha} em ${dataBR(p.data)} chegou sem a reserva ser concluída, então encerramos o pedido. Ficamos muito felizes com o seu interesse! Quando quiser, escolha outra data no site ou chame a gente aqui: vai ser um prazer levar você para passear em Búzios. ⛵`;
    const { data: m } = await db.from("mensagens").insert({ conversa: cv.id, autor: null, texto: tx, sistema: "passou:", pedido: p.id }).select("id").maybeSingle();
    if (m) await db.from("conversas").update({ ultima_em: new Date().toISOString(), ultima_msg: tx.slice(0, 80), encerrada_em: null }).eq("id", cv.id);
  }
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
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
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: adm } = await db.from("admins").select("user_id");
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth").in("user_id", (adm || []).map((a: any) => a.user_id));
  for (const s of subs || []) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...msg, url: "/login/", tag }), { TTL: 86400, urgency: "high" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}
// dono: a parte dele do sinal pago pelo PayPal chegou na conta Asaas dele
const REP: Record<string, (v: string, l: string, d: string) => { title: string; body: string }> = {
  pt: (v, l, d) => ({ title: "Sua parte chegou 💰", body: `${v} da reserva da ${l} em ${d} foram enviados para a sua conta Asaas.` }),
  en: (v, l, d) => ({ title: "Your share arrived 💰", body: `${v} from the ${l} booking on ${d} was sent to your Asaas account.` }),
  es: (v, l, d) => ({ title: "Tu parte llegó 💰", body: `${v} de la reserva de la ${l} el ${d} se enviaron a tu cuenta Asaas.` }),
};
async function avisarDono(p: { id: number; lancha: string; data: string; repasse_dono: number }) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: ds } = await db.from("donos").select("user_id").eq("lancha", p.lancha);
  if (!ds?.length) return;
  const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", ds.map((d: any) => d.user_id));
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...REP[l](brl(+p.repasse_dono), lancha, dataBR(p.data)), url: "/login/", tag: `rep-${p.id}` }), { TTL: 86400, urgency: "normal" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}
async function avisarAdmins(nome: string, valor: string, lancha: string, dia: string, pid: number, ok: boolean) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: adm } = await db.from("admins").select("user_id");
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", (adm || []).map((a: any) => a.user_id));
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...PUSH[l](nome || "—", valor, lancha, dataBR(dia), ok), url: "/login/", tag: `as-${pid}` }), { TTL: 86400, urgency: "high" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}

// confere a cobrança direto no Asaas e, se paga, marca o pedido como pago e confirma a reserva sozinha
async function conferir(asaasId: string) {
  const { data: row } = await db.from("pagamentos_asaas").select("*").eq("asaas_id", asaasId).maybeSingle();
  if (!row) return false;
  if (row.pago_em) return true;
  const pg = await asaas(`/payments/${encodeURIComponent(asaasId)}`);
  await db.from("pagamentos_asaas").update({ status: pg.status }).eq("id", row.id);
  // parcelado: o registro guarda o total (parcela × n), e a primeira parcela vale total / n
  const n = pg.installment ? Math.round(+row.valor / +pg.value) : 1;
  if (!["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(pg.status) || n < 1 || n > PARCELAS || Math.abs(+pg.value * n - +row.valor) > 0.005 || pg.externalReference !== `PED${row.pedido}`) return false;
  const agora = new Date().toISOString(), texto = `${brl(+row.valor)} (${row.metodo === "pix" ? "Pix" : n > 1 ? `cartão em ${n}x` : "cartão"} · Asaas)`;
  const { data: marcou } = await db.from("pagamentos_asaas").update({ pago_em: agora }).eq("id", row.id).is("pago_em", null).select("id");
  if (!marcou?.length) return true; // outro aviso já marcou
  // primeiro registra e confirma a reserva (o robô de 1 hora antes não cancela pedido com pagamento); depois cancela as outras cobranças
  const { data: ppMarcou } = await db.from("pagamentos_pp").update({ pago_em: agora, pago_valor: texto, atualizado_em: agora }).eq("pedido", row.pedido).is("pago_em", null).select("pedido");
  const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data").eq("id", row.pedido).maybeSingle();
  const ok = p ? await confirmarSozinho(p.id) : false;
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

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method === "GET") {
      const u = new URL(req.url);
      const x = await carregar(Number(u.searchParams.get("p")), u.searchParams.get("k") || "");
      if (!x) return json({ erro: "link" }, 404);
      const s = +x.p.sinal_valor || 0;
      const { data: cl } = await db.from("clientes").select("cpf").eq("user_id", x.p.cliente).maybeSingle();
      const { data: ja } = await db.from("asaas_clientes").select("user_id").eq("user_id", x.p.cliente).maybeSingle();
      const { data: cob } = await db.from("pagamentos_asaas").select("metodo, valor, sinal, pix_payload, pix_img, invoice_url, pago_em, criado_em").eq("pedido", x.p.id);
      return json({ ativo: !!KEY(), sinal: s, ...(s > 0 ? await totais(s) : {}), cpf: !!(ja || cpfOk(dig(cl?.cpf))),
        cob_pix: (cob || []).find((c: any) => c.metodo === "pix" && +c.sinal === s && vale(c)) || null, cartao_ok: cartaoOk(x.p.data), cartao_dias: CARTAO_DIAS, segura_h: SEGURA_MS / 36e5, pago: !!(x.c.pago_em || (cob || []).some((c: any) => c.pago_em)) });
    }
    const b = await req.json().catch(() => ({}));

    // aviso do Asaas: não confia no corpo, confere a cobrança direto no Asaas
    if (b?.event && b?.payment?.id) {
      if (/^PAYMENT_(RECEIVED|CONFIRMED)/.test(String(b.event))) await conferir(String(b.payment.id)).catch(e => console.error("webhook", e));
      return json({ ok: true });
    }

    if (b.acao === "expirar") {
      // só o robô (chave interna do resgate_config) ou a chave de serviço
      const ch = req.headers.get("x-chave") || "", tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const cfg = ch ? (await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle()).data : null;
      if (!((cfg?.chave && ch === cfg.chave) || (srk && tok === srk))) return json({ erro: "chave" }, 403);
      const lim = new Date(Date.now() - SEGURA_MS).toISOString();
      const { data: velhas } = await db.from("pagamentos_asaas").select("*").is("pago_em", null).lt("criado_em", lim).limit(50);
      let n = 0;
      for (const r of velhas || []) {
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
      for (const p of venc || []) await avisarPassou(p).catch(e => console.error("passou", p.id, e));
      // cobrança aberta de pedido que não está mais pendente (recusado, cancelado, vencido) ou cujo sinal mudou: cancela para ninguém pagar à toa
      const { data: abertas } = await db.from("pagamentos_asaas").select("pedido, sinal").is("pago_em", null).limit(200);
      const ids = [...new Set((abertas || []).map((r: any) => r.pedido))];
      const { data: ps } = ids.length ? await db.from("pedidos").select("id, status, sinal_valor").in("id", ids) : { data: [] };
      let fora = 0;
      for (const pid of ids) {
        const p = (ps || []).find((x: any) => x.id === pid);
        const ruim = !p || p.status !== "pendente" || (abertas || []).some((r: any) => r.pedido === pid && +r.sinal !== +p.sinal_valor);
        if (ruim) fora += await cancelarAbertas(pid).catch(e => (console.error("fora", pid, e), 0));
      }
      // PayPal em análise: confere se o PayPal já liberou (ou recusou)
      const srk2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const ppr = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/paypal-checkout", { method: "POST", headers: { authorization: "Bearer " + srk2, apikey: srk2, "content-type": "application/json" }, body: JSON.stringify({ acao: "pendentes" }) })
        .then(r => r.json()).catch(e => (console.error("pendentes", e), null));
      return json({ expiradas: n, vencidos: (venc || []).length, canceladas: fora, paypal: ppr });
    }

    if (b.acao === "pagar" || b.acao === "conferir") {
      const x = await carregar(Number(b.p), b.k);
      if (!x) return json({ erro: "link" }, 404);
      const { p, c } = x;
      const { data: cobs } = await db.from("pagamentos_asaas").select("*").eq("pedido", p.id);
      if (b.acao === "conferir") {
        let pago = !!c.pago_em;
        for (const r of cobs || []) if (!pago) pago = await conferir(r.asaas_id).catch(() => false);
        return json({ pago });
      }
      if (c.pago_em || (cobs || []).some((r: any) => r.pago_em)) return json({ pago: true });
      if (c.captura) return json({ erro: "pendente" }, 409); // PayPal em análise: não cobra de novo
      if (String(c.moeda || "BRL") !== "BRL") return json({ erro: "moeda" }, 409); // central em dólar/euro: só PayPal
      if (p.status !== "pendente" || !p.sinal_liberado_em) return json({ erro: "status" }, 409);
      if (tarde(p.data, p.horario)) return json({ erro: "passou" }, 409);
      const vg = await vaga(p.id, true); // segura a data por 10 min já agora, com trava, para dois clientes não gerarem cobrança juntos
      if (vg === "ocupada") return json({ erro: "ocupada" }, 409);
      if (vg === "pagando") return json({ erro: "pagando" }, 409); // outro cliente gerou o pagamento antes e está com a data segurada
      const metodo = b.metodo === "cartao" ? "cartao" : "pix", sinal = +p.sinal_valor || 0;
      if (metodo === "cartao" && !cartaoOk(p.data)) return json({ erro: "cartao_prazo" }, 409);
      if (!(sinal > 0)) return json({ erro: "valor" }, 400);
      const wallet = await carteira(p.lancha);
      const rep = wallet ? +(p.repasse_dono ?? -1) : 0;
      if (wallet && rep < 0) return json({ erro: "repasse" }, 409); // o administrador ainda não definiu a parte do dono
      if (rep > sinal) return json({ erro: "repasse" }, 409);
      const tt = await totais(sinal), np = metodo === "cartao" ? Math.min(PARCELAS, Math.max(1, Math.floor(+b.n || 1))) : 1;
      const op = tt.parcelas[np - 1], tot = metodo === "cartao" ? op.total : tt.pix;
      const velha = (cobs || []).find((r: any) => r.metodo === metodo);
      if (velha && vale(velha) && +velha.valor === tot && +velha.repasse === rep && velha.wallet_id === (wallet || null)) {
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
      const cus = await cliente(p.cliente, dig(b.cpf));
      if (!cus) return json({ erro: "cpf" }, 400);
      const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
      const venc = new Date(Date.now() + 2 * 864e5 - 3 * 36e5).toISOString().slice(0, 10);
      const pg = await asaas("/payments", {
        customer: cus, billingType: metodo === "pix" ? "PIX" : "CREDIT_CARD", dueDate: venc,
        ...(np > 1 ? { installmentCount: np, installmentValue: op.parcela } : { value: tot }),
        description: `Sinal da reserva · ${lancha} · ${dataBR(p.data)}${np > 1 ? ` · ${np}x` : ""}`.slice(0, 500), externalReference: `PED${p.id}`,
        ...(wallet && rep > 0 ? { split: [{ walletId: wallet, ...(np > 1 ? { totalFixedValue: rep } : { fixedValue: rep }) }] } : {}),
      });
      let payload = null, img = null;
      try {
        if (metodo === "pix") { const q = await asaas(`/payments/${pg.id}/pixQrCode`); payload = q.payload; img = q.encodedImage; }
        const { error: ei } = await db.from("pagamentos_asaas").insert({ pedido: p.id, metodo, asaas_id: pg.id, valor: tot, sinal, repasse: rep, wallet_id: wallet, invoice_url: pg.invoiceUrl, pix_payload: payload, pix_img: img, status: pg.status });
        if (ei) throw new Error(ei.message);
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

    if (b.acao === "minha") {
      const { data } = await db.from("asaas_contas").select("nome, cpf_cnpj, email, criado_em").eq("user_id", u.id).maybeSingle();
      return json({ conta: data || null, ativo: !!KEY() });
    }

    // administrador: transferências que o Asaas segura até o Rodrigo aprovar (token do app ou SMS), para o app mostrar o botão de aprovar
    if (b.acao === "aprovar") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const l = (await asaas("/transfers?limit=100")).data || [];
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
      if (!ds?.length && !vd) return json({ erro: "dono" }, 403); // dono de lancha ou vendedor (comissão)
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
      let a: any;
      try {
        a = await asaas("/accounts", {
          name: nome, email, cpfCnpj: doc, mobilePhone: tel, incomeValue: renda,
          ...(pf ? { birthDate: b.nascimento } : { companyType: b.tipo }),
          address: String(b.rua).trim(), addressNumber: String(b.numero).trim(), complement: String(b.complemento || "").trim() || undefined,
          province: String(b.bairro).trim(), postalCode: dig(b.cep),
        });
      } catch (e: any) { if (e.asaas) return json({ erro: "asaas", detalhe: String(e.message).slice(0, 300) }, 400); throw e; }
      await db.from("asaas_contas").insert({ user_id: u.id, conta_id: a.id, wallet_id: a.walletId, nome, cpf_cnpj: doc, email });
      // a chave da subconta só vem na criação: guardada numa tabela que só esta função lê, para buscar o link do documento e da selfie
      if (a.apiKey) { const { error } = await db.from("asaas_chaves").insert({ user_id: u.id, api_key: a.apiKey }); if (error) console.error("asaas_chaves", error.message); }
      return json({ ok: true });
    }

    // BaaS: documento e selfie pelo link do Asaas, sem a pessoa entrar no Asaas (Rodrigo 2026-10-27)
    if (b.acao === "documentos") {
      const { data: k } = await db.from("asaas_chaves").select("api_key").eq("user_id", u.id).maybeSingle();
      if (!k?.api_key) return json({ status: "sem" });
      const r = await fetch(API() + "/myAccount/documents", { headers: { access_token: k.api_key, "user-agent": "buzios-lanchas" } });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) { console.error("documentos", r.status, JSON.stringify(j).slice(0, 400)); return json({ status: "sem" }); }
      const l: any[] = j.data || [];
      const falta = l.find((d) => ["NOT_SENT", "REJECTED"].includes(d.status) && d.onboardingUrl);
      if (falta) return json({ status: "pendente", url: falta.onboardingUrl, rejeitado: falta.status === "REJECTED" });
      if (l.some((d) => d.status === "PENDING")) return json({ status: "analise" });
      return json({ status: l.length ? "ok" : "sem" });
    }

    // comissão do vendedor pelo Asaas, depois do passeio, com um toque do administrador (Rodrigo 2026-10-25)
    if (b.acao === "comissao") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const pid = Number(b.pid);
      const { data: p } = await db.from("pedidos").select("id, vendedor, status, data, horario, bloqueio_id, preco_cliente, preco_base, comissao_paga").eq("id", pid).maybeSingle();
      if (!p?.vendedor || p.status !== "aprovado") return json({ erro: "pedido" }, 409);
      if (p.comissao_paga) return json({ erro: "ja" }, 409);
      const fim = p.bloqueio_id ? (await db.from("anotacoes").select("hora_fim").eq("bloqueio_id", p.bloqueio_id).maybeSingle()).data?.hora_fim : null;
      if (!acabou(p.data, p.horario, fim)) return json({ erro: "depois_do_passeio" }, 409);
      if (p.bloqueio_id && (await db.from("realizados").select("aconteceu").eq("bloqueio_id", p.bloqueio_id).maybeSingle()).data?.aconteceu === false) return json({ erro: "nao_aconteceu" }, 409);
      const { data: vv } = await db.from("vendedores").select("indicado_por, indicacao_pct").eq("user_id", p.vendedor).maybeSingle();
      const bruto = Math.max(+p.preco_cliente - +p.preco_base, 0);
      const parte = vv?.indicado_por && +vv.indicacao_pct ? Math.round(bruto * +vv.indicacao_pct) / 100 : 0; // parte de quem convidou o sócio (paga por Pix)
      const com = Math.round((bruto - parte) * 100) / 100;
      if (!(com > 0)) return json({ erro: "valor" }, 409);
      const { data: ok } = await db.rpc("vendedor_ok", { uid: p.vendedor });
      if (ok === false) return json({ erro: "falta_confirmar" }, 409); // WhatsApp e e-mail confirmados (Rodrigo 2026-10-27)
      const { data: ct } = await db.from("asaas_contas").select("wallet_id").eq("user_id", p.vendedor).maybeSingle();
      if (!ct?.wallet_id) return json({ erro: "sem_conta" }, 409);
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
      // marca paga com o login do administrador (o banco só deixa o administrador marcar)
      const comAdm = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false }, global: { headers: { Authorization: req.headers.get("authorization") || "" } } });
      const { error: em } = await comAdm.rpc("pagar_comissao", { pid, sim: true });
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
        await avisarDono(p).catch(e => console.error("avisarDono", e));
      }
      const precisa = fila.filter((p: any) => falta.includes(p.id)).reduce((a: number, p: any) => a + +p.repasse_dono, 0);
      return json({ enviados, sem_conta: sem.length, falta: falta.length, saldo: Math.round(saldo * 100) / 100, precisa: Math.round(precisa * 100) / 100 });
    }

    // comprovante da comissão: o vendedor vê que recebeu (Rodrigo 2026-10-25)
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

    if (b.acao === "webhook") {
      if (!(await db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const lista = await asaas("/webhooks");
      const ja = (lista?.data || []).find((w: any) => w.url === FN_URL);
      const corpo = { name: "Site Búzios Lanchas", url: FN_URL, email: "korvolive@gmail.com", enabled: true, interrupted: false, apiVersion: 3, sendType: "SEQUENTIALLY", events: ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"] };
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
