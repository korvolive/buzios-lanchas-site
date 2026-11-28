// Búzios Lanchas: checagem automática da saúde do Asaas e dos dados (revisão geral 2026-11-16; o split ficou desligado e só se
// descobriu quando um cliente não conseguiu pagar). Roda pelo cron a cada 3 horas e também pela revisão diária.
// POST {} com x-chave (resgate_config) ou a chave de serviço. Só leitura no Asaas, com uma exceção: o teste do split cria uma cobrança
// de R$ 5 para a própria empresa (sem aviso a ninguém) e apaga na hora. Conserta sozinho o que é seguro:
//   - cobrança paga no Asaas e ainda aberta no banco: manda a função asaas conferir (ela confere direto no Asaas antes de marcar).
// Grava o resultado em saude_checagens e avisa o administrador no celular quando aparece problema grave (uma vez por dia por problema).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// iPhone (app da loja): aparelhos "apns:<token>" vão direto para a Apple (chave .p8 nos segredos APNS_*).
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
    throw Object.assign(new Error(t), { statusCode: /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(t) ? 410 : r.status, body: t });
  };
}

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const KEY = () => Deno.env.get("ASAAS_API_KEY") || "";
const API = () => (KEY().includes("_hmlg_") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3");

async function asaas(path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const r = await fetch(API() + path, { method, headers: { access_token: KEY(), "content-type": "application/json", "user-agent": "buzios-lanchas" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch (_) { /* vazio */ }
  if (!r.ok) { const e: any = new Error(j?.errors?.[0]?.description || `asaas ${r.status}`); e.status = r.status; throw e; }
  return j;
}

type Item = { g: "alta" | "media" | "baixa"; t: string; ref?: string; d: string; consertado?: boolean };

async function pushAdmins(title: string, body: string, tag: string) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:contato@lanchaembuzios.com.br", k.publica, k.privada);
  const { data: adm } = await db.from("admins").select("user_id");
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth").in("user_id", (adm || []).map((a: any) => a.user_id));
  for (const s of subs || []) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, url: "/login/", tag }), { TTL: 86400, urgency: "high" }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
}

// teste do split: cobrança de R$ 5 para a própria empresa, com divisão de R$ 0,01 para uma subconta aprovada, apagada logo em seguida
async function testarSplit(): Promise<Item | null> {
  const { data: w } = await db.from("asaas_contas").select("wallet_id").not("aprovada_em", "is", null).not("wallet_id", "is", null).order("aprovada_em").limit(1).maybeSingle();
  if (!w?.wallet_id) return { g: "baixa", t: "split_sem_teste", d: "nenhuma subconta aprovada para testar o split" };
  const { data: cfg } = await db.from("asaas_config").select("cliente_saude").eq("id", 1).maybeSingle();
  let cus = cfg?.cliente_saude || "";
  if (!cus) {
    const ci: any = await asaas("/myAccount/commercialInfo").catch(() => ({}));
    const doc = String(ci?.cpfCnpj || "").replace(/\D/g, "");
    if (!doc) return { g: "baixa", t: "split_sem_teste", d: "não consegui ler o CNPJ da conta para o teste do split" };
    const c: any = await asaas("/customers", { name: "Teste automatico do sistema", cpfCnpj: doc, notificationDisabled: true, externalReference: "SAUDE" });
    cus = c.id;
    await db.from("asaas_config").update({ cliente_saude: cus }).eq("id", 1);
  }
  const venc = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  let pg: any;
  try {
    pg = await asaas("/payments", { customer: cus, billingType: "PIX", value: 5, dueDate: venc, description: "Teste automatico do split (apagado na hora)", externalReference: "SAUDE", split: [{ walletId: w.wallet_id, fixedValue: 0.01 }] });
  } catch (e: any) {
    const m = String(e?.message || "");
    if (/split/i.test(m) && /desabilitad|disabled|habilitar/i.test(m)) return { g: "alta", t: "split_desligado", d: "Split desligado no Asaas. Ligue em Integrações > Segurança > Habilitar Split (pede código por SMS). Enquanto isso as cobranças saem sem divisão e a parte do dono vai pelo saldo." };
    return { g: "media", t: "split_teste_falhou", d: "teste do split recusado pelo Asaas: " + m.slice(0, 200) };
  }
  await asaas(`/payments/${pg.id}`, undefined, "DELETE").catch(async () => { await new Promise((r) => setTimeout(r, 1500)); await asaas(`/payments/${pg.id}`, undefined, "DELETE").catch(() => null); });
  return null;
}

Deno.serve(async (req) => {
  const ch = req.headers.get("x-chave") || "", tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const cfg = ch ? (await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle()).data : null;
  if (!((cfg?.chave && ch === cfg.chave) || (srk && tok === srk))) return json({ erro: "chave" }, 403);
  const b = await req.json().catch(() => ({}));
  const itens: Item[] = [];
  if (!KEY()) itens.push({ g: "alta", t: "asaas_sem_chave", d: "função sem ASAAS_API_KEY" });
  else {
    // 1. conta principal
    try {
      const st: any = await asaas("/myAccount/status");
      for (const k of ["general", "commercialInfo", "bankAccountInfo", "documentation"]) {
        if (st?.[k] && st[k] !== "APPROVED") itens.push({ g: k === "general" ? "alta" : "media", t: "conta_principal", ref: k, d: `conta Asaas da Búzios: ${k} = ${st[k]}` });
      }
    } catch (e: any) { itens.push({ g: "alta", t: "asaas_fora", d: "Asaas não respondeu: " + String(e?.message || e).slice(0, 160) }); }
    // 2. split (pode pular com {split:false})
    if (b?.split !== false) { const s = await testarSplit().catch((e) => ({ g: "media", t: "split_teste_falhou", d: String(e?.message || e).slice(0, 200) } as Item)); if (s) itens.push(s); }
    // 3. saldo x o que a Búzios deve (parte de donos sem divisão + comissões a pagar)
    try {
      const saldo = +(await asaas("/finance/balance")).balance || 0;
      // parte de dono de cobrança paga sem divisão (cartão recém-confirmado ainda não entrou no saldo: fica de fora), ainda não enviada
      const { data: sd } = await db.from("pagamentos_asaas").select("pedido, metodo, status, pago_em, wallet_id, repasse, parcelas, antecipada").not("pago_em", "is", null);
      const comSplit = new Set((sd || []).filter((x: any) => x.wallet_id && +x.repasse > 0).map((x: any) => +x.pedido));
      // Rodrigo 2026-11-17: o dono só recebe quando o dinheiro do pedido cai; cartão que ainda não caiu inteiro não entra no que a Búzios deve hoje
      const caiu = (x: any) => x?.status === "RECEIVED" || x?.status === "RECEIVED_IN_CASH" || !!x?.antecipada;
      const naoCaiu = (x: any) => x.metodo === "cartao" && (Array.isArray(x.parcelas) && x.parcelas.length ? !x.parcelas.every(caiu) : !caiu(x));
      const aCair = new Set((sd || []).filter(naoCaiu).map((x: any) => +x.pedido));
      const ids = [...new Set((sd || []).filter((x: any) => !comSplit.has(+x.pedido) && !aCair.has(+x.pedido)).map((x: any) => +x.pedido))];
      const { data: ps } = ids.length ? await db.from("pedidos").select("id, repasse_dono, lancha").in("id", ids).eq("status", "aprovado").gt("repasse_dono", 0).neq("lancha", "miss-bardot") : { data: [] };
      const { data: rf } = ids.length ? await db.from("repasses_pp").select("pedido").in("pedido", ids).not("enviado_em", "is", null) : { data: [] };
      const feito = new Set((rf || []).map((x: any) => +x.pedido));
      const deve = (ps || []).filter((x: any) => !feito.has(+x.id)).reduce((a: number, x: any) => a + +x.repasse_dono, 0);
      if (deve > saldo + 0.01) itens.push({ g: "alta", t: "saldo_insuficiente", d: `saldo Asaas R$ ${saldo.toFixed(2)} não cobre R$ ${deve.toFixed(2)} de partes de dono já recebidas` });
    } catch (e: any) { itens.push({ g: "baixa", t: "saldo_nao_lido", d: String(e?.message || e).slice(0, 160) }); }
    // 4. cobrança paga no Asaas e aberta no banco: conserta (a função asaas confere de novo no Asaas antes de marcar)
    const { data: abertas } = await db.from("pagamentos_asaas").select("pedido, asaas_id").is("pago_em", null).gt("criado_em", new Date(Date.now() - 7 * 864e5).toISOString()).limit(40);
    for (const a of abertas || []) {
      const p: any = await asaas(`/payments/${encodeURIComponent(a.asaas_id)}`).catch(() => null);
      if (!p || !/^(RECEIVED|CONFIRMED|RECEIVED_IN_CASH)$/.test(String(p.status))) continue;
      await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/asaas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "PAYMENT_" + p.status, payment: { id: a.asaas_id } }) }).catch(() => null);
      const { data: ok } = await db.from("pagamentos_asaas").select("pago_em").eq("asaas_id", a.asaas_id).maybeSingle();
      itens.push({ g: ok?.pago_em ? "media" : "alta", t: "pago_nao_marcado", ref: String(a.pedido), d: ok?.pago_em ? "pagamento estava pago no Asaas e aberto no banco: marcado agora" : "pago no Asaas e a conferência não marcou no banco", consertado: !!ok?.pago_em });
    }
  }
  // 5. dados do banco
  const { data: rd, error: er } = await db.rpc("revisao_dados");
  if (er) itens.push({ g: "media", t: "revisao_dados_erro", d: er.message });
  for (const x of rd || []) itens.push(x as Item);

  const graves = itens.filter((i) => i.g === "alta" && !i.consertado);
  const dia = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  // Rodrigo 27/11: o mesmo aviso tocava no celular a cada 3 horas. Agora cada problema (tipo + pedido) avisa uma vez por dia (dia de Brasília).
  const { data: antes } = await db.from("saude_checagens").select("itens").eq("ok", false).gte("em", dia + "T03:00:00Z");
  const chave = (i: Item) => `${i.t}|${i.ref || ""}`;
  const jaAvisado = new Set((antes || []).flatMap((c: any) => (Array.isArray(c.itens) ? c.itens : []).filter((i: any) => i?.g === "alta" && !i?.consertado).map(chave)));
  await db.from("saude_checagens").insert({ origem: String(b?.origem || "cron").slice(0, 20), ok: !graves.length, itens });
  const titulo: Record<string, string> = { split_desligado: "Asaas: split desligado", repasse_dono_parado: "Repasse ao dono atrasado", saldo_insuficiente: "Asaas: saldo baixo para repasses" };
  for (const i of graves) {
    if (jaAvisado.has(chave(i))) continue;
    jaAvisado.add(chave(i));
    await pushAdmins(titulo[i.t] || "Atenção no sistema", i.d.slice(0, 180), `saude-${i.t}-${i.ref || ""}-${dia}`.slice(0, 64)).catch((e) => console.error("push", e));
  }
  return json({ ok: !graves.length, itens });
});
