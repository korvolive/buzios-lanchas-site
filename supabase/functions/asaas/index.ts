// Búzios Lanchas: pagamento do sinal pelo Asaas (Rodrigo, 2026-10-24). Conta de produção da Buzios Lanchas Ltda,
// mas só aparece na página escondida /pagar/?p=&k=&asaas=1 até o Rodrigo testar e liberar.
// O cliente paga Pix ou cartão com todas as taxas por conta dele (o valor sobe para a Búzios receber o sinal inteiro).
// Split: a parte do dono (pedidos.repasse_dono) vai direto para a subconta Asaas do dono; o resto (comissão da Búzios + vendedor) fica na conta da Búzios.
// GET  ?p&k                                  valores de Pix e cartão para a página
// POST {acao:"pagar", p, k, metodo, cpf?}    a página: cria (ou reaproveita) a cobrança e devolve o Pix ou o link do cartão
// POST {acao:"conferir", p, k}                a página: confere no Asaas se já foi pago
// POST {acao:"conta", ...dados} (login)      dono: cria a subconta Asaas dele (o Asaas manda o e-mail para ele ativar e mandar os documentos)
// POST {acao:"minha"} (login)                dono: se já tem conta Asaas
// POST {acao:"webhook"} (login admin)         registra o aviso de pagamento no Asaas apontando para esta função
// POST {event, payment} (do Asaas)           aviso de pagamento: confere a cobrança direto no Asaas antes de marcar como paga
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

async function asaas(path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  if (!KEY()) throw new Error("sem_chaves");
  const r = await fetch(API() + path, { method, headers: { access_token: KEY(), "content-type": "application/json", "user-agent": "buzios-lanchas" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch (_) { /* vazio */ }
  if (!r.ok) { console.error("asaas", method, path, r.status, t.slice(0, 800)); const e: any = new Error(j?.errors?.[0]?.description || `asaas ${r.status}`); e.asaas = true; throw e; }
  return j;
}

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
  return { pix: +(data?.pix_fixo ?? 1.99), pct: +(data?.cartao_pct ?? 2.99), fixo: +(data?.cartao_fixo ?? 0.49), ant: +(data?.antecipacao_pct ?? 1.7) };
}
async function totais(sinal: number) {
  const x = await taxas();
  return { pix: up2(sinal + x.pix), cartao: up2((sinal + x.fixo) / (1 - (x.pct + x.ant) / 100)) };
}

// pedido + link da central (/pagar/?p=&k=), com o mesmo token da cobrança
async function carregar(pid: number, k: string) {
  if (!pid || !/^[0-9a-f-]{36}$/i.test(String(k || ""))) return null;
  const { data: c } = await db.from("pagamentos_pp").select("pedido, pago_em").eq("pedido", pid).eq("token", k).maybeSingle();
  if (!c) return null;
  const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, horario, status, sinal_valor, sinal_liberado_em, comprovante_em, repasse_dono").eq("id", pid).maybeSingle();
  return p ? { c, p } : null;
}

// conta Asaas do dono da lancha (a primeira criada, se o barco tiver mais de um dono)
async function carteira(lancha: string) {
  const { data: ds } = await db.from("donos").select("user_id").eq("lancha", lancha);
  const ids = (ds || []).map((d: any) => d.user_id);
  if (!ids.length) return null;
  const { data } = await db.from("asaas_contas").select("wallet_id").in("user_id", ids).order("criado_em").limit(1).maybeSingle();
  return data?.wallet_id || null;
}

async function vaga(pid: number) {
  const { data, error } = await db.rpc("pp_vaga", { pid, segurar: false });
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

const PUSH: Record<string, (n: string, v: string, l: string, d: string) => { title: string; body: string }> = {
  pt: (n, v, l, d) => ({ title: "Sinal pago pelo Asaas ✅", body: `${n} pagou ${v} (${l}, ${d}). Toque para aprovar a reserva.` }),
  en: (n, v, l, d) => ({ title: "Deposit paid via Asaas ✅", body: `${n} paid ${v} (${l}, ${d}). Tap to approve the booking.` }),
  es: (n, v, l, d) => ({ title: "Seña pagada por Asaas ✅", body: `${n} pagó ${v} (${l}, ${d}). Toca para aprobar la reserva.` }),
};
async function avisarAdmins(nome: string, valor: string, lancha: string, dia: string, pid: number) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: adm } = await db.from("admins").select("user_id");
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", (adm || []).map((a: any) => a.user_id));
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...PUSH[l](nome || "—", valor, lancha, dataBR(dia)), url: "/login/", tag: `as-${pid}` }), { TTL: 86400, urgency: "high" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}

// confere a cobrança direto no Asaas e, se paga, marca o pedido como pago (igual ao PayPal: o administrador ainda aprova)
async function conferir(asaasId: string) {
  const { data: row } = await db.from("pagamentos_asaas").select("*").eq("asaas_id", asaasId).maybeSingle();
  if (!row) return false;
  if (row.pago_em) return true;
  const pg = await asaas(`/payments/${encodeURIComponent(asaasId)}`);
  await db.from("pagamentos_asaas").update({ status: pg.status }).eq("id", row.id);
  if (!["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(pg.status) || Math.abs(+pg.value - +row.valor) > 0.005 || pg.externalReference !== `PED${row.pedido}`) return false;
  const agora = new Date().toISOString(), texto = `${brl(+row.valor)} (${row.metodo === "pix" ? "Pix" : "cartão"} · Asaas)`;
  const { data: marcou } = await db.from("pagamentos_asaas").update({ pago_em: agora }).eq("id", row.id).is("pago_em", null).select("id");
  if (!marcou?.length) return true; // outro aviso já marcou
  await db.from("pagamentos_pp").update({ pago_em: agora, pago_valor: texto, atualizado_em: agora }).eq("pedido", row.pedido).is("pago_em", null);
  const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data").eq("id", row.pedido).maybeSingle();
  if (!p) return true;
  const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
  const nome = String((await db.from("clientes").select("nome").eq("user_id", p.cliente).maybeSingle()).data?.nome || "").trim().split(/\s+/)[0];
  const { data: cv } = await db.from("conversas").select("id").eq("tipo", "suporte").eq("cliente", p.cliente).maybeSingle();
  if (cv) {
    const tx = `Pagamento do sinal recebido: ${texto}. Agora a Búzios Lanchas confirma a sua reserva.`;
    const { data: m } = await db.from("mensagens").insert({ conversa: cv.id, autor: null, texto: tx, sistema: "pago:" + brl(+row.valor), pedido: p.id }).select("id").maybeSingle();
    if (m) await db.from("conversas").update({ ultima_em: agora, ultima_msg: tx.slice(0, 80), encerrada_em: null }).eq("id", cv.id);
  }
  await avisarAdmins(nome, brl(+row.valor), lancha, p.data, p.id).catch(e => console.error(e));
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
      const { data: cob } = await db.from("pagamentos_asaas").select("metodo, valor, sinal, pix_payload, pix_img, invoice_url, pago_em").eq("pedido", x.p.id);
      return json({ ativo: !!KEY(), sinal: s, ...(s > 0 ? await totais(s) : {}), cpf: !!(ja || cpfOk(dig(cl?.cpf))),
        cob_pix: (cob || []).find((c: any) => c.metodo === "pix" && +c.sinal === s) || null, pago: !!(x.c.pago_em || (cob || []).some((c: any) => c.pago_em)) });
    }
    const b = await req.json().catch(() => ({}));

    // aviso do Asaas: não confia no corpo, confere a cobrança direto no Asaas
    if (b?.event && b?.payment?.id) {
      if (/^PAYMENT_(RECEIVED|CONFIRMED)/.test(String(b.event))) await conferir(String(b.payment.id)).catch(e => console.error("webhook", e));
      return json({ ok: true });
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
      if (p.status !== "pendente" || !p.sinal_liberado_em) return json({ erro: "status" }, 409);
      if ((await vaga(p.id)) === "ocupada") return json({ erro: "ocupada" }, 409);
      const metodo = b.metodo === "cartao" ? "cartao" : "pix", sinal = +p.sinal_valor || 0;
      if (!(sinal > 0)) return json({ erro: "valor" }, 400);
      const wallet = await carteira(p.lancha);
      const rep = wallet ? +(p.repasse_dono ?? -1) : 0;
      if (wallet && rep < 0) return json({ erro: "repasse" }, 409); // o administrador ainda não definiu a parte do dono
      if (rep > sinal) return json({ erro: "repasse" }, 409);
      const tot = (await totais(sinal))[metodo];
      const velha = (cobs || []).find((r: any) => r.metodo === metodo);
      if (velha && +velha.valor === tot && +velha.repasse === rep && velha.wallet_id === (wallet || null)) {
        return json({ metodo, valor: tot, pix_payload: velha.pix_payload, pix_img: velha.pix_img, url: velha.invoice_url });
      }
      if (velha) { await asaas(`/payments/${velha.asaas_id}`, undefined, "DELETE").catch(e => console.error("apagar", e)); await db.from("pagamentos_asaas").delete().eq("id", velha.id); }
      const cus = await cliente(p.cliente, dig(b.cpf));
      if (!cus) return json({ erro: "cpf" }, 400);
      const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
      const venc = new Date(Date.now() + 2 * 864e5 - 3 * 36e5).toISOString().slice(0, 10);
      const pg = await asaas("/payments", {
        customer: cus, billingType: metodo === "pix" ? "PIX" : "CREDIT_CARD", value: tot, dueDate: venc,
        description: `Sinal da reserva · ${lancha} · ${dataBR(p.data)}`.slice(0, 500), externalReference: `PED${p.id}`,
        ...(wallet && rep > 0 ? { split: [{ walletId: wallet, fixedValue: rep }] } : {}),
      });
      let payload = null, img = null;
      if (metodo === "pix") { const q = await asaas(`/payments/${pg.id}/pixQrCode`); payload = q.payload; img = q.encodedImage; }
      await db.from("pagamentos_asaas").insert({ pedido: p.id, metodo, asaas_id: pg.id, valor: tot, sinal, repasse: rep, wallet_id: wallet, invoice_url: pg.invoiceUrl, pix_payload: payload, pix_img: img, status: pg.status });
      return json({ metodo, valor: tot, pix_payload: payload, pix_img: img, url: pg.invoiceUrl });
    }

    const u = await quem(req);
    if (!u) return json({ erro: "login" }, 401);

    if (b.acao === "minha") {
      const { data } = await db.from("asaas_contas").select("nome, cpf_cnpj, email, criado_em").eq("user_id", u.id).maybeSingle();
      return json({ conta: data || null, ativo: !!KEY() });
    }

    if (b.acao === "conta") {
      const { data: ds } = await db.from("donos").select("lancha").eq("user_id", u.id);
      if (!ds?.length) return json({ erro: "dono" }, 403);
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
      return json({ ok: true });
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
