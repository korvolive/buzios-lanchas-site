// Búzios Lanchas: central de pagamento da reserva (/pagar/), para todos os pedidos do site (Rodrigo, 2026-10-22).
// Brasileiro e pedido de vendedor: só Pix (moeda BRL). Estrangeiro sem vendedor: PayPal (pago na hora, conferido aqui) e também Pix.
// A página mostra as etapas: aguardando pagamento, pagamento recebido (PayPal ou comprovante do Pix) e reserva confirmada (quando o administrador aprova).
// Ao "Liberar pagamento", o app cria a cobrança e o cliente recebe por e-mail (e o administrador manda no WhatsApp) o link /pagar/?p=<pedido>&k=<token>.
// O PayPal é conferido aqui direto com o PayPal; quem aprova a reserva continua sendo o administrador.
// GET  ?p&k                                     dados da cobrança para a página (sem login)
// POST {acao:"link", pid, valor, moeda, email?}  só administrador: cria ou muda a cobrança e manda o e-mail
// POST {acao:"criar", p, k}                       a página: cria a ordem no PayPal
// POST {acao:"capturar", p, k, order}             a página: captura, confere e marca como pago
// POST {acao:"wa", p, k, w}                        a página aberta pelo botão do WhatsApp oficial: confirma o WhatsApp do cliente
// Ao liberar (primeira vez), também manda pelo WhatsApp oficial o modelo de Utilidade pagamento_liberado com o botão
// "Pagar a reserva" (/pagar/?p&k&w). w = wa_provas.token, só foi para aquele número, então tocar confirma o WhatsApp (Rodrigo 2026-10-29).
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
// pagamento automático confirma a reserva sozinho (Rodrigo, 2026-10-25); ok=false: a data ficou ocupada nesse meio tempo e o administrador resolve
const PUSH: Record<string, (n: string, v: string, l: string, d: string, ok: boolean) => { title: string; body: string }> = {
  pt: (n, v, l, d, ok) => ok ? { title: "Passeio reservado ✅", body: `${n} pagou ${v} pelo PayPal. ${l}, ${d}: a reserva já está confirmada na agenda.` } : { title: "Sinal pago, mas a data está ocupada ⚠️", body: `${n} pagou ${v} pelo PayPal (${l}, ${d}), mas a lancha já tinha outro passeio. Toque para resolver.` },
  en: (n, v, l, d, ok) => ok ? { title: "Tour booked ✅", body: `${n} paid ${v} with PayPal. ${l}, ${d}: the booking is already confirmed in the calendar.` } : { title: "Deposit paid, but the date is taken ⚠️", body: `${n} paid ${v} with PayPal (${l}, ${d}), but the boat already had another tour. Tap to sort it out.` },
  es: (n, v, l, d, ok) => ok ? { title: "Paseo reservado ✅", body: `${n} pagó ${v} con PayPal. ${l}, ${d}: la reserva ya está confirmada en la agenda.` } : { title: "Seña pagada, pero la fecha está ocupada ⚠️", body: `${n} pagó ${v} con PayPal (${l}, ${d}), pero la lancha ya tenía otro paseo. Toca para resolverlo.` },
};
// pagamento só até 40 minutos antes do início combinado do passeio (Rodrigo 2026-11-11; era 1 hora antes do horário fixo)
// sem horário combinado: manhã e dia 10h, tarde 14h, noite 20h (Brasília, UTC-3); com horário: rpc inicio_combinado (pedido.hora_ini ou anotacoes.hora_ini)
const INICIO: Record<string, number> = { manha: 10, dia: 10, tarde: 14, noite: 20 };
const ANTES_MS = 40 * 6e4;
const tarde = (d: string, h: string) => Date.parse(`${d}T${String(INICIO[h] ?? 10).padStart(2, "0")}:00:00-03:00`) - ANTES_MS <= Date.now();
// PayPal (Rodrigo 2026-11-14): na Miss Bardot sempre; nas outras lanchas só com 5 dias ou mais (os donos querem receber antes do passeio),
// com menos de 5 dias o cliente paga só por Pix. Mesma conta de dias do cartaoOk da função asaas (dia de São Paulo).
const ppPrazo = (p: { lancha: string; data: string }) => p.lancha === "miss-bardot" ||
  (Date.parse(`${p.data}T00:00:00Z`) - Date.parse(new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10) + "T00:00:00Z")) / 864e5 >= 5;
async function tardeCombinado(p: any) {
  const { data, error } = await db.rpc("inicio_combinado", { d: p.data, h: p.horario, hi: p.hora_ini ?? null, bid: p.bloqueio_id ?? null });
  if (error || !data) return tarde(p.data, p.horario);
  return Date.parse(String(data).slice(0, 19) + "-03:00") - ANTES_MS <= Date.now();
}
// mesma confirmação da função asaas: passeio na agenda + os avisos do botão Aprovar
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

// a lancha ainda está livre para este pedido? (Rodrigo 2026-10-22: quem pagar primeiro fica com a lancha, o outro não consegue pagar)
// rpc pp_vaga: "ocupada" (agenda, pedido aprovado, outro cliente pagou ou mandou comprovante), "pagando" (outro está no PayPal agora, 10 min) ou "livre";
// segurar = marca que este cliente está pagando. Se a consulta falhar, deixa pagar (o administrador ainda aprova cada reserva).
async function vaga(pid: number, segurar = false) {
  const { data, error } = await db.rpc("pp_vaga", { pid, segurar });
  if (error) { console.error("pp_vaga", error.message); return "livre"; }
  return String(data || "livre");
}

// pedido + cobrança, conferindo o token do link
async function carregar(pid: number, k: string) {
  if (!pid || !/^[0-9a-f-]{36}$/i.test(String(k || ""))) return null;
  const { data: c } = await db.from("pagamentos_pp").select("*").eq("pedido", pid).eq("token", k).maybeSingle();
  if (!c) return null;
  const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, horario, hora_ini, hora_fim, pessoas, status, sinal_valor, sinal_liberado_em, comprovante_em, vendedor, bloqueio_id, preco_base, preco_cliente, cupom_valor").eq("id", pid).maybeSingle();
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
  if (!u?.email || !u.email_confirmed_at || /@sem-email\.lanchaembuzios\.com\.br$/.test(u.email)) return false; // conta só com WhatsApp: o link vai pelo WhatsApp
  const meta = { ...(u.user_metadata || {}) };
  const l = lang(meta.lang);
  const primeiro = String(meta.nome || meta.full_name || "").trim().split(" ")[0];
  const M = MAIL[l];
  const msg = { lang: l, oi: M.oi(primeiro), texto: pix ? MAIL_PIX[l](lancha, dataBR(dia)) : M.texto(lancha, dataBR(dia)), linhas: [`${pix ? "🧾" : "💳"} ${valor}`], nota: M.nota, botao: M.botao, url };
  const assunto = { pt: `Pagamento da reserva: ${lancha} · ${dataBR(dia)}`, en: `Booking payment: ${lancha} · ${dataBR(dia)}`, es: `Pago de la reserva: ${lancha} · ${dataBR(dia)}` }[l]; // assunto com o motivo (Rodrigo 2026-10-22)
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg, assunto } });
  const { error } = await db.auth.signInWithOtp({ email: u.email, options: { shouldCreateUser: false, emailRedirectTo: `${SITE}/login/` } });
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg: null, assunto: null } });
  if (error) { console.error("email", error.message); return false; }
  return true;
}

// WhatsApp oficial (mesmo número dos códigos e do aviso de passeio): segredos WA_TOKEN e WA_PHONE_ID; WA_ATIVO=1 liga
const WA_TOKEN = Deno.env.get("WA_TOKEN") || "", WA_PHONE = Deno.env.get("WA_PHONE_ID") || "", WA_ON = Deno.env.get("WA_ATIVO") === "1";
const WA_MODELO = Deno.env.get("WA_MODELO_PAGAMENTO") || "pagamento_liberado";
const WA_LANG: Record<string, string> = { pt: "pt_BR", en: "en", es: "es" };
const ES_DDI = ["34", "51", "52", "53", "54", "56", "57", "58", "502", "503", "504", "505", "506", "507", "591", "593", "595", "598"];
const dig = (x: unknown) => String(x || "").replace(/\D/g, "");
const MES: Record<string, string[]> = {
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
};
const dataLonga = (d: string, l: string) => { const [, m, dd] = d.split("-").map(Number); return l === "en" ? `${MES.en[m - 1]} ${dd}` : `${dd} de ${MES[l][m - 1]}`; };
const nomeOk = (v: unknown) => { const n = String(v || "").trim().split(/\s+/)[0] || ""; return /^[\p{L}'-]{2,20}$/u.test(n) ? n : "-"; };
// Desde 2026-11-12 (Rodrigo: "passar o aviso de pagamento para o número principal"): sai pelo número principal, o mesmo do Lucas
// (360dialog, segredo D360_API_KEY), com o modelo de Utilidade pre_reserva_v3, que leva o link no texto. O botão antigo do
// pagamento_liberado chegava quebrado (a Meta codificava o "?" e o site dava 404). Sem a chave, usa o caminho antigo (0203).
const D360 = Deno.env.get("D360_API_KEY") || "", D360_MODELO = Deno.env.get("D360_MODELO_PAGAMENTO") || "pre_reserva_v3";
const SLOT_H: Record<string, [string, string]> = { manha: ["10", "14"], tarde: ["14", "18"], dia: ["10", "17"], noite: ["20", ""] };
const hh = (x: unknown) => { const m = String(x || "").match(/^(\d{1,2}):(\d{2})/); return m ? (m[2] === "00" ? `${+m[1]}h` : `${+m[1]}h${m[2]}`) : ""; };
function horaTxt(p: { horario?: string; hora_ini?: string | null; hora_fim?: string | null }, l: string) {
  let a = hh(p.hora_ini), b = hh(p.hora_fim);
  if (!a) { const s = SLOT_H[String(p.horario || "")]; if (s) { a = s[0] + "h"; b = s[1] ? s[1] + "h" : ""; } }
  if (!a) return "-";
  return b ? `${a} ${l === "en" ? "to" : l === "es" ? "a" : "às"} ${b}` : a;
}
// chave também pode ficar na tabela segredos_app (só a chave de serviço lê), gravada pela VPS sem passar por ninguém
async function d360Key() {
  if (D360) return D360;
  const { data } = await db.from("segredos_app").select("valor").eq("nome", "D360_API_KEY").maybeSingle();
  return String(data?.valor || "");
}
async function waPagamento(p: { id: number; cliente: string; data: string; horario?: string; hora_ini?: string | null; hora_fim?: string | null }, k: string, lancha: string, valor: string) {
  const KEY360 = await d360Key().catch(() => "");
  if (!WA_ON || (!KEY360 && (!WA_TOKEN || !WA_PHONE))) return false;
  const { data: cl } = await db.from("clientes").select("nome, whatsapp").eq("user_id", p.cliente).maybeSingle();
  const to = dig(cl?.whatsapp);
  if (to.length < 10 || to.length > 15) return false;
  const lg = String((await db.auth.admin.getUserById(p.cliente)).data?.user?.user_metadata?.lang || "");
  const cc = (String(cl?.whatsapp || "").trim().match(/^\+(\d{1,3})\s/) || [])[1] || to.slice(0, 2);
  const l = WA_LANG[lg] ? lg : cc === "55" ? "pt" : ES_DDI.includes(cc) ? "es" : "en";
  const { data: pv, error: pe } = await db.from("wa_provas").insert({ tel_dig: to, origem: "pagamento" }).select("token").single();
  if (pe || !pv) { console.error("prova", pe?.message); return false; }
  const link = `${SITE}/pagar/?p=${p.id}&k=${k}&w=${pv.token}&l=${l}`;
  const r = KEY360
    ? await fetch("https://waba-v2.360dialog.io/messages", {
      method: "POST", headers: { "D360-API-KEY": KEY360, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "template",
        template: { name: D360_MODELO, language: { code: WA_LANG[l] }, components: [
          { type: "body", parameters: [nomeOk(cl?.nome), lancha, dataLonga(p.data, l), horaTxt(p, l), valor, link].map(text => ({ type: "text", text })) },
        ] } }),
    })
    : await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE}/messages`, {
      method: "POST", headers: { authorization: `Bearer ${WA_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template",
        template: { name: WA_MODELO, language: { code: WA_LANG[l] }, components: [
          { type: "body", parameters: [nomeOk(cl?.nome), lancha, dataLonga(p.data, l), valor].map(text => ({ type: "text", text })) },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: `?p=${p.id}&k=${k}&w=${pv.token}&l=${l}` }] },
        ] } }),
    });
  if (!r.ok) { console.error("wa pagamento falhou", p.id, KEY360 ? "360dialog" : "graph", r.status, (await r.text()).slice(0, 400)); return false; }
  // tira o pedido do cartão "WhatsApp pendente" do administrador (senão um toque lá mandaria de novo)
  await db.from("pedidos").update({ wa_central_em: new Date().toISOString() }).eq("id", p.id).is("wa_central_em", null);
  console.log("wa pagamento ok", p.id, KEY360 ? "360dialog" : "graph");
  return true;
}

const brlv = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
async function avisarAdmins(nome: string, valor: string, lancha: string, dia: string, pid: number, ok: boolean) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return 0;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: adm } = await db.from("admins").select("user_id");
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", (adm || []).map((a: any) => a.user_id));
  let n = 0;
  for (const s of subs || []) {
    const l = ["pt", "en", "es"].includes(s.lang) ? s.lang : "pt";
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...PUSH[l](nome || "—", valor, lancha, dataBR(dia), ok), url: "/login/", tag: `pp-${pid}` }), { TTL: 86400, urgency: "high" }); n++; }
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
      const pp = c.moeda !== "BRL" && !p.vendedor && ppPrazo(p);
      const vg = p.status === "pendente" && !c.pago_em && !p.comprovante_em ? await vaga(p.id) : "livre";
      // restante que o cliente paga no embarque (Rodrigo 2026-10-25): confirmado = o que está no passeio; antes = valor do pedido − cupom − sinal (igual ao confirmar_pago)
      let resto: number | null = null;
      if (p.status === "aprovado" && p.bloqueio_id) {
        const { data: a } = await db.from("anotacoes").select("valor, sinal").eq("bloqueio_id", p.bloqueio_id).maybeSingle();
        if (+a?.valor > 0) resto = Math.max(0, +a.valor - (+a.sinal || 0));
      }
      // pedido recusado ou cancelado: não há restante; passeio sem valor anotado: usa o valor do pedido
      if (resto === null && (p.status === "pendente" || p.status === "aprovado")) {
        const tot = (+p.preco_cliente || +p.preco_base || 0) - (+p.cupom_valor || 0);
        if (tot > 0 && +p.sinal_valor > 0 && tot >= +p.sinal_valor) resto = tot - +p.sinal_valor;
      }
      // recibo (Rodrigo 2026-10-29): só depois do pagamento conferido (PayPal/Asaas automático) ou da reserva confirmada pelo administrador (Pix com comprovante)
      let recibo: Record<string, unknown> | null = null;
      if ((p.status === "aprovado" && p.bloqueio_id) || (c.pago_em && p.status === "pendente")) { // recusado ou cancelado: sem recibo
        const { data: pa } = await db.from("pagamentos_asaas").select("metodo, valor, pago_em").eq("pedido", p.id).not("pago_em", "is", null).order("pago_em", { ascending: false }).limit(1).maybeSingle();
        const a = p.bloqueio_id ? (await db.from("anotacoes").select("sinal").eq("bloqueio_id", p.bloqueio_id).maybeSingle()).data : null;
        const forma = pa ? (pa.metodo === "cartao" ? "cartao" : "pix") : c.pago_em && c.moeda !== "BRL" ? "paypal" : "pix";
        recibo = { nome: String((await db.from("clientes").select("nome").eq("user_id", p.cliente).maybeSingle()).data?.nome || "").trim().slice(0, 80), forma,
          em: pa?.pago_em || c.pago_em || p.comprovante_em || null, valor_brl: pa ? +pa.valor : (+a?.sinal || +p.sinal_valor || (c.moeda === "BRL" ? +c.valor : 0)) || null,
          valor_txt: forma === "paypal" ? c.pago_valor || fmt(c.moeda, +c.valor) : null };
      }
      return json({ recibo, cliente_id: pp ? Deno.env.get("PAYPAL_CLIENT_ID") || "" : "", pp_prazo: !ppPrazo(p), ambiente: API.includes("sandbox") ? "sandbox" : "live",
        pedido: p.id, lancha, data: p.data, horario: p.horario, hora_ini: p.hora_ini, hora_fim: p.hora_fim, pessoas: p.pessoas, nome, moeda: c.moeda, valor: +c.valor, texto: fmt(c.moeda, +c.valor),
        sinal_brl: +p.sinal_valor || null, resto_brl: resto, pago_em: c.pago_em, pago_valor: c.pago_valor, comprovante_em: p.comprovante_em, status: p.status,
        confirmada: p.status === "aprovado" && !!p.bloqueio_id, indisponivel: vg === "ocupada" || (p.status === "recusado" && !c.pago_em), pagando: vg === "pagando", chat: sup, chat_vendedor: vc, vendedor: p.vendedor ? vn || "—" : null });
    }
    const b = await req.json().catch(() => ({}));

    if (b.acao === "link") {
      const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const uid = (await db.auth.getUser(auth)).data?.user?.id;
      if (!uid) return json({ erro: "login" }, 401);
      if (!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const pid = Number(b.pid), valor = Math.round(Number(b.valor) * 100) / 100, moeda = String(b.moeda || "USD").toUpperCase();
      if (!(valor > 0) || !SYM[moeda]) return json({ erro: "valor" }, 400);
      const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, horario, hora_ini, hora_fim, status, sinal_liberado_em, vendedor").eq("id", pid).maybeSingle();
      if (!p || p.status !== "pendente" || !p.sinal_liberado_em) return json({ erro: "pedido" }, 400);
      if (p.vendedor && moeda !== "BRL") return json({ erro: "vendedor" }, 400); // com vendedor: só Pix, sem cobrança automática (Rodrigo, 2026-10-22)
      const { data: old } = await db.from("pagamentos_pp").select("token, pago_em, captura").eq("pedido", pid).maybeSingle();
      if (old?.pago_em || old?.captura) return json({ erro: "pago" }, 409); // pago ou em análise no PayPal: o valor não muda mais
      const { data: c, error } = await db.from("pagamentos_pp").upsert({ pedido: pid, moeda, valor, order_id: null, atualizado_em: new Date().toISOString(), ...(old ? { token: old.token } : {}) }, { onConflict: "pedido" }).select("token").single();
      if (error) throw error;
      const url = `${SITE}/pagar/?p=${pid}&k=${c.token}`, texto = fmt(moeda, valor);
      await db.from("pedidos").update({ paypal_link: url, paypal_valor: texto, atualizado_em: new Date().toISOString() }).eq("id", pid);
      const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
      const enviado = b.email === false ? false : await email(p.cliente, url, lancha, p.data, texto, moeda === "BRL").catch(e => (console.error(e), false));
      // WhatsApp automático: só na primeira vez que o link é criado (mudar o valor depois não manda de novo)
      const wa = b.email === false || old ? false : await waPagamento(p, c.token, lancha, texto).catch(e => (console.error("wa", e), false));
      return json({ link: url, texto, email: enviado, wa });
    }

    // a página aberta pelo botão do WhatsApp oficial: o link só chegou naquele número, então confirma o WhatsApp do cliente do pedido
    if (b.acao === "wa") {
      const x = await carregar(Number(b.p), String(b.k || ""));
      const w = String(b.w || "");
      if (!x || !/^[0-9a-f-]{36}$/i.test(w)) return json({ ok: false });
      // só confirma para o próprio cliente do pedido, logado neste aparelho (revisão de segurança 2026-10-30: quem
      // cadastrasse o número de outra pessoa faria o dono do número confirmar a conta errada só por abrir o link)
      const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const uid = auth ? (await db.auth.getUser(auth)).data?.user?.id : null;
      if (!uid || uid !== x.p.cliente) return json({ ok: false });
      const { data: pv } = await db.from("wa_provas").select("tel_dig, usado_em, criado_em").eq("token", w).eq("origem", "pagamento").maybeSingle();
      if (!pv || pv.usado_em || Date.parse(pv.criado_em) < Date.now() - 30 * 864e5) return json({ ok: false });
      const { data: cl } = await db.from("clientes").select("whatsapp, whatsapp_ok_em").eq("user_id", x.p.cliente).maybeSingle();
      if (!cl || dig(cl.whatsapp).slice(-10) !== String(pv.tel_dig).slice(-10)) return json({ ok: false });
      await db.from("wa_provas").update({ usado_em: new Date().toISOString() }).eq("token", w).is("usado_em", null);
      if (!cl.whatsapp_ok_em) await db.from("clientes").update({ whatsapp_ok_em: new Date().toISOString() }).eq("user_id", x.p.cliente);
      return json({ ok: true });
    }

    // robô (asaas expirar, com a chave de serviço): PayPal em análise que já foi liberado ou recusado
    if (b.acao === "pendentes") {
      const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!srk || tok !== srk) return json({ erro: "chave" }, 403);
      const { data: rs } = await db.from("pagamentos_pp").select("pedido, token, order_id, captura").not("captura", "is", null).is("pago_em", null).limit(20);
      let pagos = 0, recusados = 0;
      for (const r of rs || []) {
        try {
          const x = await carregar(+r.pedido, r.token);
          if (!x || !r.order_id) continue;
          const o = await pp(`/v2/checkout/orders/${r.order_id}`, undefined, "GET");
          const cap = o?.purchase_units?.[0]?.payments?.captures?.find((k: any) => k.id === r.captura);
          if (cap?.status === "COMPLETED") { await fechar({ ...o, purchase_units: [{ ...o.purchase_units[0], payments: { captures: [cap] } }] }, x.c, x.p, x.lancha, x.nome); pagos++; }
          else if (cap && ["DECLINED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(cap.status)) {
            await db.from("pagamentos_pp").update({ captura: null, atualizado_em: new Date().toISOString() }).eq("pedido", r.pedido).is("pago_em", null);
            await pushAdmins({ title: "PayPal recusou o pagamento ❌", body: `O pagamento em análise do pedido ${r.pedido} (${x.lancha}, ${dataBR(x.p.data)}) não foi aprovado pelo PayPal (${cap.status}). A data está livre de novo.` }, `pprec-${r.pedido}`).catch(e => console.error(e));
            recusados++;
          }
        } catch (e) { console.error("pendente", r.pedido, e); }
      }
      return json({ pagos, recusados });
    }

    // troca 4h <-> 7h antes do pagamento (Rodrigo 2026-11-12: quem troca é o administrador, no app, ou o Lucas, pela ponte com a chave de serviço;
    // o cliente pede e a gente troca). A função do banco confere tudo (livre, preço de tabela, sem pagamento).
    if (b.acao === "trocar" || b.acao === "alterar") {
      const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), srk0 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const servico = !!srk0 && tok === srk0;
      const uid = servico ? null : tok ? (await db.auth.getUser(tok)).data?.user?.id : null;
      const adm = !!uid && !!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data;
      // operador = a sessão do painel que a ponte do Lucas usa na VPS
      const opr = !adm && !!uid && !!(await db.from("papeis_painel").select("papel").eq("user_id", uid).eq("papel", "operador").maybeSingle()).data;
      if (!servico && !adm && !opr) return json({ erro: "admin" }, 403);
      const { data: pd } = await db.from("pedidos").select("id, cliente, lancha, data, horario, hora_ini, bloqueio_id").eq("id", Number(b.pid)).maybeSingle();
      if (!pd) return json({ erro: "pedido" }, 404);
      const x = { p: pd, lancha: (await db.from("lanchas").select("nome").eq("slug", pd.lancha).maybeSingle()).data?.nome || pd.lancha,
        nome: String((await db.from("clientes").select("nome").eq("user_id", pd.cliente).maybeSingle()).data?.nome || "").trim().split(/\s+/)[0] };
      if (await tardeCombinado(x.p)) return json({ erro: "passou" }, 409);
      // revisão 2026-11-13: no alterar, confere também o horário NOVO (40 min antes do início combinado)
      if (b.acao === "alterar" && await tardeCombinado({ ...x.p, horario: String(b.horario || x.p.horario), hora_ini: /^\d{2}:\d{2}$/.test(String(b.hora_ini || "")) ? String(b.hora_ini) : null })) return json({ erro: "passou" }, 409);
      // alterar (Lucas pela ponte ou administrador): horário livre, duração e valor; o valor vem de quem chama, já com as regras de cotação
      const hm = (v: unknown) => /^\d{2}:\d{2}$/.test(String(v || "")) ? String(v) : null;
      const { data: r, error: re } = b.acao === "alterar"
        ? await db.rpc("alterar_pedido", { pid: x.p.id, p_horario: String(b.horario || ""), p_hi: hm(b.hora_ini), p_hf: hm(b.hora_fim), p_valor: Number(b.valor), p_sinal: b.sinal == null || b.sinal === "" ? null : Number(b.sinal) })
        : await db.rpc("trocar_horario_pedido", { pid: x.p.id, novo: String(b.h || "") });
      if (re) { console.error("trocar", re.message); return json({ erro: "falhou" }, 500); }
      if (!r?.ok) return json({ erro: r?.erro || "falhou" }, 409);
      // cobrança aberta no Asaas com o sinal antigo: cancela já, para ninguém pagar o valor velho
      const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/asaas", { method: "POST", headers: { authorization: "Bearer " + srk, apikey: srk, "content-type": "application/json" }, body: JSON.stringify({ acao: "cancelar", pid: x.p.id }) })
        .then(async q => { if (!q.ok) console.error("asaas cancelar", q.status, (await q.text()).slice(0, 300)); }).catch(e => console.error("asaas cancelar", e));
      const txt = r.moeda && r.valor ? fmt(r.moeda, +r.valor) : null;
      if (txt) await db.from("pedidos").update({ paypal_valor: txt }).eq("id", x.p.id);
      const H: Record<string, string> = { manha: "manhã (4h)", tarde: "tarde (4h)", dia: "dia todo (7h)" };
      const para = r.hi ? `${String(r.hi).replace(":00", "h")} às ${String(r.hf).replace(":00", "h")}` : H[r.para] || r.para;
      if (servico || opr) await pushAdmins({ title: "Pedido alterado 🔁", body: `Pedido ${x.p.id} de ${x.nome || "cliente"} (${x.lancha}, ${dataBR(x.p.data)}): agora ${para}. Novo total ${brlv(+r.preco)}${r.sinal ? `, sinal ${brlv(+r.sinal)}` : ""}.` }, `troca-${x.p.id}`).catch(e => console.error(e));
      return json({ ok: true, ...r });
    }

    const x = await carregar(Number(b.p), b.k);
    if (!x) return json({ erro: "link" }, 404);
    const { c, p, lancha, nome } = x;
    if (c.pago_em) return json({ pago: true });
    if (p.status !== "pendente") return json({ erro: p.status === "recusado" ? "ocupada" : "status" }, 409);

    if (c.moeda === "BRL" || p.vendedor) return json({ erro: "pix" }, 400); // PayPal só para estrangeiro sem vendedor
    if (b.acao === "criar") {
      if (await tardeCombinado(p)) return json({ erro: "passou" }, 409);
      if (!ppPrazo(p)) return json({ erro: "pix" }, 400); // outra lancha com menos de 5 dias: só Pix
      // a ordem anterior pode ter sido paga e a resposta se perdeu (página fechada): confere antes de criar outra
      if (c.order_id) {
        const ant = await pp(`/v2/checkout/orders/${c.order_id}`, undefined, "GET").catch(() => null);
        if (ant?.status === "COMPLETED") return await fechar(ant, c, p, lancha, nome);
      }
      const v = await vaga(p.id, true);
      if (v !== "livre") return json({ erro: v }, 409);
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
      const v = await vaga(p.id, true); // confere de novo antes de cobrar: se outro cliente pagou antes, não cobra nada
      if (v !== "livre") return json({ erro: v }, 409);
      let o: any;
      try { o = await pp(`/v2/checkout/orders/${oid}/capture`, {}); }
      catch (e) { // já capturada (página recarregada): confere a ordem
        if (!String((e as Error).message).includes("ORDER_ALREADY_CAPTURED")) throw e;
        o = await pp(`/v2/checkout/orders/${oid}`, undefined, "GET");
      }
      return await fechar(o, c, p, lancha, nome);
    }
    return json({ erro: "acao" }, 400);
  } catch (e) {
    console.error(e);
    const m = String((e as Error)?.message || e);
    return json({ erro: m === "sem_chaves" ? "sem_chaves" : "falhou", detalhe: m.slice(0, 200) }, 500);
  }
});

// confere a ordem paga no PayPal e registra: valor, moeda e pedido têm de bater; PENDING (em análise no PayPal) avisa o administrador
async function fechar(o: any, c: any, p: any, lancha: string, nome: string) {
  const cap = o?.purchase_units?.[0]?.payments?.captures?.[0];
  const bate = cap && cap.amount?.currency_code === c.moeda && Math.abs(Number(cap.amount?.value) - Number(c.valor)) < 0.005 && o?.purchase_units?.[0]?.custom_id === String(p.id);
  if (bate && cap.status === "PENDING") {
    console.error("captura pendente", p.id, cap.status_details?.reason);
    // registra a captura em análise: a data fica segurada e o robô de 10 em 10 minutos confere quando o PayPal liberar
    const { data: ja } = await db.from("pagamentos_pp").select("captura").eq("pedido", p.id).maybeSingle();
    if (ja?.captura === cap.id) return json({ erro: "pendente" }, 202); // já avisado
    await db.from("pagamentos_pp").update({ captura: cap.id, atualizado_em: new Date().toISOString() }).eq("pedido", p.id).is("pago_em", null);
    await pushAdmins({ title: "Pagamento PayPal em análise ⏳", body: `${nome || "Cliente"} pagou o sinal da ${lancha} (${dataBR(p.data)}), mas o PayPal deixou em análise (${cap.status_details?.reason || "PENDING"}). A data fica segurada e, quando o PayPal liberar, a reserva se confirma sozinha.` }, `pppend-${p.id}`).catch(e => console.error(e));
    return json({ erro: "pendente" }, 202);
  }
  const okVal = bate && cap.status === "COMPLETED";
  if (!okVal) { console.error("captura não confere", JSON.stringify(o).slice(0, 800)); return json({ erro: "captura", status: cap?.status || o?.status }, 402); }
  const texto = fmt(c.moeda, +c.valor), agora = new Date().toISOString();
  const { data: marcou } = await db.from("pagamentos_pp").update({ captura: cap.id, pago_em: agora, pago_valor: texto, atualizado_em: agora }).eq("pedido", p.id).is("pago_em", null).select("pedido");
  if (!marcou?.length) { // outra chamada já registrou; se foi outro pagamento (Asaas ou outra captura), é pagamento em dobro
    const { data: r } = await db.from("pagamentos_pp").select("captura").eq("pedido", p.id).maybeSingle();
    if (r?.captura !== cap.id) await pushAdmins({ title: "Pagamento em dobro ⚠️", body: `O pedido ${p.id} (${lancha}, ${dataBR(p.data)}) já estava pago e recebeu também ${texto} pelo PayPal. Estorne um dos pagamentos.` }, `dobro-${p.id}`).catch(e => console.error(e));
    return json({ pago: true });
  }
  const ok = await confirmarSozinho(p.id);
  // no chat de atendimento: confirmada, o notificar já escreve "reserva confirmada"; senão registra o pagamento
  const cv = ok ? null : (await db.from("conversas").select("id").eq("tipo", "suporte").eq("cliente", p.cliente).maybeSingle()).data;
  if (cv) {
    const tx = `Pagamento do sinal recebido pelo PayPal: ${texto}. Agora a Búzios Lanchas confirma a sua reserva.`;
    const { data: m } = await db.from("mensagens").insert({ conversa: cv.id, autor: null, texto: tx, sistema: "pago:" + texto, pedido: p.id }).select("id").maybeSingle();
    if (m) await db.from("conversas").update({ ultima_em: agora, ultima_msg: tx.slice(0, 80), encerrada_em: null }).eq("id", cv.id);
  }
  await avisarAdmins(nome, texto, lancha, p.data, p.id, ok).catch(e => console.error(e));
  // repasse ao dono (Rodrigo 2026-10-25): o dinheiro do PayPal fica na Búzios; avisa na hora para mandar a parte do dono o quanto antes
  const { data: rp } = await db.from("pedidos").select("lancha, repasse_dono").eq("id", p.id).maybeSingle();
  if (rp && +rp.repasse_dono > 0 && rp.lancha !== "miss-bardot") await pushAdmins({ title: `💸 Repasse para o dono: ${brlv(+rp.repasse_dono)}`, body: `Pago pelo PayPal: ${lancha} (${dataBR(p.data)}). Saque o PayPal para o Asaas e mande a parte do dono. Está em Usuários › Repasses do PayPal.` }, `rep-${p.id}`).catch(e => console.error(e));
  return json({ pago: true });
}
