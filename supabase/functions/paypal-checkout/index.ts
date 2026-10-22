// Búzios Lanchas: central de pagamento da reserva (/pagar/), para todos os pedidos do site (Rodrigo, 2026-10-22).
// Brasileiro e pedido de vendedor: só Pix (moeda BRL). Estrangeiro sem vendedor: PayPal (pago na hora, conferido aqui) e também Pix.
// A página mostra as etapas: aguardando pagamento, pagamento recebido (PayPal ou comprovante do Pix) e reserva confirmada (quando o administrador aprova).
// Ao "Liberar pagamento", o app cria a cobrança e o cliente recebe por e-mail (e o administrador manda no WhatsApp) o link /pagar/?p=<pedido>&k=<token>.
// O PayPal é conferido aqui direto com o PayPal; quem aprova a reserva continua sendo o administrador.
// GET  ?p&k                                     dados da cobrança para a página (sem login)
// POST {acao:"link", pid, valor, moeda, email?}  só administrador: cria ou muda a cobrança e manda o e-mail
// POST {acao:"criar", p, k}                       a página: cria a ordem no PayPal
// POST {acao:"capturar", p, k, order}             a página: captura, confere e marca como pago
// Chaves (Edge Functions > Secrets, coladas pelo Rodrigo): PAYPAL_CLIENT_ID, PAYPAL_SECRET e, para testes, PAYPAL_ENV=sandbox.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const API = Deno.env.get("PAYPAL_ENV") === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
const SITE = "https://www.lanchaembuzios.com.br";
const SYM: Record<string, string> = { USD: "US$", EUR: "€", GBP: "£", BRL: "R$" };
const fmt = (m: string, v: number) => `${SYM[m] || m} ${Number(v).toLocaleString(m === "BRL" ? "pt-BR" : "en-US", { minimumFractionDigits: Number.isInteger(+v) ? 0 : 2, maximumFractionDigits: 2 })}`;
const lang = (x: string) => (["pt", "en", "es"].includes(x) ? x : "en");
const dataBR = (d: string) => d.split("-").reverse().join("/");
const MAIL: Record<string, any> = {
  pt: { oi: (n: string) => `Olá${n ? ", " + n : ""}!`, texto: (l: string, d: string) => `A lancha ${l} está disponível em ${d}. Para confirmar a sua reserva, pague o sinal pelo PayPal (conta PayPal ou cartão de crédito):`, nota: "O restante é pago na hora do embarque, direto ao responsável pela lancha.", botao: "Pagar o sinal" },
  en: { oi: (n: string) => `Hi${n ? " " + n : ""}!`, texto: (l: string, d: string) => `The boat ${l} is available on ${d}. To confirm your booking, pay the deposit with PayPal (PayPal account or credit card):`, nota: "The balance is paid at boarding, directly to the boat's crew.", botao: "Pay the deposit" },
  es: { oi: (n: string) => `¡Hola${n ? " " + n : ""}!`, texto: (l: string, d: string) => `La lancha ${l} está disponible el ${d}. Para confirmar tu reserva, paga la seña con PayPal (cuenta PayPal o tarjeta de crédito):`, nota: "El resto se paga al embarcar, directamente al responsable de la lancha.", botao: "Pagar la seña" },
};
const PUSH: Record<string, (n: string, v: string, l: string, d: string) => { title: string; body: string }> = {
  pt: (n, v, l, d) => ({ title: "Sinal pago pelo PayPal 💳", body: `${n} pagou ${v} (${l}, ${d}). Toque para aprovar a reserva.` }),
  en: (n, v, l, d) => ({ title: "Deposit paid with PayPal 💳", body: `${n} paid ${v} (${l}, ${d}). Tap to approve the booking.` }),
  es: (n, v, l, d) => ({ title: "Seña pagada con PayPal 💳", body: `${n} pagó ${v} (${l}, ${d}). Toca para aprobar la reserva.` }),
};

async function token() {
  const id = Deno.env.get("PAYPAL_CLIENT_ID"), sec = Deno.env.get("PAYPAL_SECRET");
  if (!id || !sec) throw new Error("sem_chaves");
  const a = await fetch(API + "/v1/oauth2/token", { method: "POST", headers: { authorization: "Basic " + btoa(`${id}:${sec}`), "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  if (!a.ok) { console.error("paypal token", a.status, (await a.text()).slice(0, 300)); throw new Error("chaves"); }
  return (await a.json()).access_token as string;
}
async function pp(path: string, body?: unknown, method = "POST") {
  const r = await fetch(API + path, { method, headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json", prefer: "return=representation" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch (_) { /* vazio */ }
  if (!r.ok) { console.error("paypal", path, r.status, t.slice(0, 800)); throw new Error(j?.details?.[0]?.issue || j?.name || `paypal ${r.status}`); }
  return j;
}

// pedido + cobrança, conferindo o token do link
async function carregar(pid: number, k: string) {
  if (!pid || !/^[0-9a-f-]{36}$/i.test(String(k || ""))) return null;
  const { data: c } = await db.from("pagamentos_pp").select("*").eq("pedido", pid).eq("token", k).maybeSingle();
  if (!c) return null;
  const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, horario, pessoas, status, sinal_valor, sinal_liberado_em, comprovante_em, vendedor, bloqueio_id").eq("id", pid).maybeSingle();
  if (!p) return null;
  const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
  const nome = String((await db.from("clientes").select("nome").eq("user_id", p.cliente).maybeSingle()).data?.nome || "").trim().split(/\s+/)[0];
  return { c, p, lancha, nome };
}

const MAIL_PIX: Record<string, (l: string, d: string) => string> = {
  pt: (l, d) => `A lancha ${l} está disponível em ${d}. Para confirmar a sua reserva, pague o sinal pela nossa central de pagamento:`,
  en: (l, d) => `The boat ${l} is available on ${d}. To confirm your booking, pay the deposit in our payment page:`,
  es: (l, d) => `La lancha ${l} está disponible el ${d}. Para confirmar tu reserva, paga la seña en nuestra central de pago:`,
};
async function email(uid: string, url: string, lancha: string, dia: string, valor: string, pix = false) {
  const { data } = await db.auth.admin.getUserById(uid);
  const u = data?.user;
  if (!u?.email) return false;
  const meta = { ...(u.user_metadata || {}) };
  const l = lang(meta.lang);
  const primeiro = String(meta.nome || meta.full_name || "").trim().split(" ")[0];
  const M = MAIL[l];
  const msg = { lang: l, oi: M.oi(primeiro), texto: pix ? MAIL_PIX[l](lancha, dataBR(dia)) : M.texto(lancha, dataBR(dia)), linhas: [`${pix ? "🧾" : "💳"} ${valor}`], nota: M.nota, botao: M.botao, url };
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg } });
  const { error } = await db.auth.signInWithOtp({ email: u.email, options: { shouldCreateUser: false, emailRedirectTo: `${SITE}/login/` } });
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg: null } });
  if (error) { console.error("email", error.message); return false; }
  return true;
}

async function avisarAdmins(nome: string, valor: string, lancha: string, dia: string, pid: number) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return 0;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: adm } = await db.from("admins").select("user_id");
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", (adm || []).map((a: any) => a.user_id));
  let n = 0;
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...PUSH[l](nome || "—", valor, lancha, dataBR(dia)), url: "/login/", tag: `pp-${pid}` }), { TTL: 86400, urgency: "high" }); n++; }
    catch (e: any) { console.error("push falhou", e?.statusCode); if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
  return n;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method === "GET") {
      const u = new URL(req.url);
      const x = await carregar(Number(u.searchParams.get("p")), u.searchParams.get("k") || "");
      if (!x) return json({ erro: "link" }, 404);
      const { c, p, lancha, nome } = x;
      const sup = (await db.from("conversas").select("id").eq("tipo", "suporte").eq("cliente", p.cliente).maybeSingle()).data?.id || null;
      const vc = p.vendedor ? (await db.from("conversas").select("id").eq("tipo", "vendedor").eq("cliente", p.cliente).eq("vendedor", p.vendedor).maybeSingle()).data?.id || null : null;
      let vn = "";
      if (p.vendedor) for (const t of ["perfis", "clientes", "freelancers", "marinheiros"]) { // o vendedor pode ser dono, cliente ou marinheiro
        const n = (await db.from(t).select("nome").eq("user_id", p.vendedor).limit(1).maybeSingle()).data?.nome;
        if (n) { vn = String(n).trim().split(/\s+/)[0]; break; }
      }
      const pp = c.moeda !== "BRL" && !p.vendedor;
      return json({ cliente_id: pp ? Deno.env.get("PAYPAL_CLIENT_ID") || "" : "", ambiente: API.includes("sandbox") ? "sandbox" : "live",
        pedido: p.id, lancha, data: p.data, horario: p.horario, pessoas: p.pessoas, nome, moeda: c.moeda, valor: +c.valor, texto: fmt(c.moeda, +c.valor),
        sinal_brl: +p.sinal_valor || null, pago_em: c.pago_em, pago_valor: c.pago_valor, comprovante_em: p.comprovante_em, status: p.status,
        confirmada: p.status === "aprovado" && !!p.bloqueio_id, chat: sup, chat_vendedor: vc, vendedor: p.vendedor ? vn || "—" : null });
    }
    const b = await req.json().catch(() => ({}));

    if (b.acao === "link") {
      const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const uid = (await db.auth.getUser(auth)).data?.user?.id;
      if (!uid) return json({ erro: "login" }, 401);
      if (!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const pid = Number(b.pid), valor = Math.round(Number(b.valor) * 100) / 100, moeda = String(b.moeda || "USD").toUpperCase();
      if (!(valor > 0) || !SYM[moeda]) return json({ erro: "valor" }, 400);
      const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, status, sinal_liberado_em, vendedor").eq("id", pid).maybeSingle();
      if (!p || p.status !== "pendente" || !p.sinal_liberado_em) return json({ erro: "pedido" }, 400);
      if (p.vendedor && moeda !== "BRL") return json({ erro: "vendedor" }, 400); // com vendedor: só Pix, sem cobrança automática (Rodrigo, 2026-10-22)
      const { data: old } = await db.from("pagamentos_pp").select("token, pago_em").eq("pedido", pid).maybeSingle();
      if (old?.pago_em) return json({ erro: "pago" }, 409);
      const { data: c, error } = await db.from("pagamentos_pp").upsert({ pedido: pid, moeda, valor, order_id: null, atualizado_em: new Date().toISOString(), ...(old ? { token: old.token } : {}) }, { onConflict: "pedido" }).select("token").single();
      if (error) throw error;
      const url = `${SITE}/pagar/?p=${pid}&k=${c.token}`, texto = fmt(moeda, valor);
      await db.from("pedidos").update({ paypal_link: url, paypal_valor: texto, atualizado_em: new Date().toISOString() }).eq("id", pid);
      const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
      const enviado = b.email === false ? false : await email(p.cliente, url, lancha, p.data, texto, moeda === "BRL").catch(e => (console.error(e), false));
      return json({ link: url, texto, email: enviado });
    }

    const x = await carregar(Number(b.p), b.k);
    if (!x) return json({ erro: "link" }, 404);
    const { c, p, lancha, nome } = x;
    if (c.pago_em) return json({ pago: true });
    if (p.status !== "pendente") return json({ erro: "status" }, 409);

    if (c.moeda === "BRL" || p.vendedor) return json({ erro: "pix" }, 400); // PayPal só para estrangeiro sem vendedor
    if (b.acao === "criar") {
      const o = await pp("/v2/checkout/orders", {
        intent: "CAPTURE",
        purchase_units: [{ reference_id: `PED${p.id}`, custom_id: String(p.id), description: `Búzios Lanchas · ${lancha} · ${dataBR(p.data)}`.slice(0, 127),
          amount: { currency_code: c.moeda, value: Number(c.valor).toFixed(2) } }],
        application_context: { brand_name: "Búzios Lanchas", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
      });
      await db.from("pagamentos_pp").update({ order_id: o.id, atualizado_em: new Date().toISOString() }).eq("pedido", p.id);
      return json({ id: o.id });
    }

    if (b.acao === "capturar") {
      const oid = String(b.order || "");
      if (!oid || oid !== c.order_id) return json({ erro: "ordem" }, 400);
      let o: any;
      try { o = await pp(`/v2/checkout/orders/${oid}/capture`, {}); }
      catch (e) { // já capturada (página recarregada): confere a ordem
        if (!String((e as Error).message).includes("ORDER_ALREADY_CAPTURED")) throw e;
        o = await pp(`/v2/checkout/orders/${oid}`, undefined, "GET");
      }
      const cap = o?.purchase_units?.[0]?.payments?.captures?.[0];
      const okVal = cap && cap.status === "COMPLETED" && cap.amount?.currency_code === c.moeda && Math.abs(Number(cap.amount?.value) - Number(c.valor)) < 0.005 && o?.purchase_units?.[0]?.custom_id === String(p.id);
      if (!okVal) { console.error("captura não confere", JSON.stringify(o).slice(0, 800)); return json({ erro: "captura", status: cap?.status || o?.status }, 402); }
      const texto = fmt(c.moeda, +c.valor), agora = new Date().toISOString();
      await db.from("pagamentos_pp").update({ captura: cap.id, pago_em: agora, pago_valor: texto, atualizado_em: agora }).eq("pedido", p.id);
      // no chat de atendimento: a Búzios Lanchas registra o pagamento
      const { data: cv } = await db.from("conversas").select("id").eq("tipo", "suporte").eq("cliente", p.cliente).maybeSingle();
      if (cv) {
        const tx = `Pagamento do sinal recebido pelo PayPal: ${texto}. Agora a Búzios Lanchas confirma a sua reserva.`;
        const { data: m } = await db.from("mensagens").insert({ conversa: cv.id, autor: null, texto: tx, sistema: "pago:" + texto, pedido: p.id }).select("id").maybeSingle();
        if (m) await db.from("conversas").update({ ultima_em: agora, ultima_msg: tx.slice(0, 80), encerrada_em: null }).eq("id", cv.id);
      }
      await avisarAdmins(nome, texto, lancha, p.data, p.id).catch(e => console.error(e));
      return json({ pago: true });
    }
    return json({ erro: "acao" }, 400);
  } catch (e) {
    console.error(e);
    const m = String((e as Error)?.message || e);
    return json({ erro: m === "sem_chaves" ? "sem_chaves" : "falhou", detalhe: m.slice(0, 200) }, 500);
  }
});
