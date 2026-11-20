// Búzios Lanchas / Bordazul: rastreio server-side (pedido do Zaaitar/Rodrigo 2026-11-19).
// Meta API de Conversões + Google Analytics 4 Measurement Protocol. Segredos só aqui (variáveis de ambiente, ver .env.example):
//   META_PIXEL_ID, META_CAPI_TOKEN, META_TEST_EVENT_CODE (opcional), META_GRAPH_VERSION (opcional, padrão v23.0),
//   GA4_MEASUREMENT_ID (padrão G-NYEL6BGFBF), GA4_API_SECRET, RASTREIO_SIMULAR=1 (opcional: não manda nada, só grava o que mandaria).
//
// POST do site (sem login, corpo text/plain JSON, por sendBeacon):
//   { ev: "whatsapp_click" | "lead" | "visita_pagar", consent: "ok", event_id, pagina, site, posicao,
//     ga_cid, ga_sid, fbp, fbc, gclid, gbraid, wbraid, utm_*, tok?, consulta?, pedido?, k? }
//   - whatsapp_click: grava a visita e manda "Contact" à Meta (mesmo event_id do Pixel). O Google recebe o clique só pelo navegador.
//   - lead: só se o banco tem a consulta (chave) ou o pedido do cliente logado (tok) criado há menos de 30 min; "Lead" à Meta com
//     event_id fixo lead-c-<chave> / lead-p-<pedido>, o mesmo do Pixel. O generate_lead do GA4 sai só do navegador.
//   - visita_pagar: confere o pedido pela chave k do link /pagar e grava os identificadores, para ligar o pagamento ao anúncio.
//   Lista fechada de eventos e campos; consentimento diferente de "ok" não grava nem manda nada; até 60 registros por IP por hora.
// POST { acao: "enviar" } com x-chave (gatilho do banco e cron): manda as conversões pendentes (purchase/Purchase) com o valor
//   pago de verdade (conversoes.valor, gravado pelo banco a partir do Asaas/PayPal), BRL e transaction_id/event_id "pedido-<id>".
//   O navegador nunca declara pagamento nem valor.
// Dados pessoais: ao GA4 só client_id, session_id e o pedido (nada de nome, telefone, e-mail ou mensagem). À Meta, telefone e e-mail
// vão só como hash SHA-256 (exigência da API), com IP/navegador da visita. Logs sem dados pessoais.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const env = (k: string) => (Deno.env.get(k) || "").trim();
const SIMULAR = env("RASTREIO_SIMULAR") === "1";
const GRAPH = env("META_GRAPH_VERSION") || "v23.0";
const GA_ID = env("GA4_MEASUREMENT_ID") || "G-NYEL6BGFBF";
const ORIGENS = /^https:\/\/([a-z0-9-]+\.)*(lanchaembuzios\.com\.br|bordazul\.com\.br|rjlanchas\.com\.br|lanchasemarraial\.com\.br|cabofriolanchas\.com\.br)$/;
const SITES = /^([a-z0-9-]+\.)*(lanchaembuzios\.com\.br|bordazul\.com\.br|rjlanchas\.com\.br|lanchasemarraial\.com\.br|cabofriolanchas\.com\.br)$/;
const EVENTOS = new Set(["whatsapp_click", "lead", "visita_pagar"]);

const cors = (req: Request) => {
  const o = req.headers.get("origin") || "";
  return { "Access-Control-Allow-Origin": ORIGENS.test(o) ? o : "https://www.lanchaembuzios.com.br", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
};
const json = (req: Request, o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors(req), "content-type": "application/json" } });

// campo de texto da lista fechada: tamanho e formato conferidos; qualquer outra coisa vira null
const txt = (v: unknown, max: number, re = /^[\w.~%:$\-]+$/) => { const s = typeof v === "string" ? v.trim() : ""; return s && s.length <= max && re.test(s) ? s : null; };
const caminho = (v: unknown) => { const s = typeof v === "string" ? v.split(/[?#]/)[0] : ""; return /^\/[\w\-./%]{0,150}$/.test(s) ? s : null; }; // sem "?": nada de dado pessoal da URL
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
const ipDe = (req: Request) => (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "").trim().slice(0, 64) || null;

// ---------- Meta API de Conversões ----------
async function meta(ev: Record<string, unknown>) {
  const pixel = env("META_PIXEL_ID"), token = env("META_CAPI_TOKEN");
  if (!pixel || !token) return { status: "sem_chave", resposta: "META_PIXEL_ID/META_CAPI_TOKEN ausentes" };
  const body: Record<string, unknown> = { data: [ev] };
  if (env("META_TEST_EVENT_CODE")) body.test_event_code = env("META_TEST_EVENT_CODE");
  if (SIMULAR) return { status: "simulado", resposta: JSON.stringify(body).slice(0, 1500) };
  try {
    const r = await fetch(`https://graph.facebook.com/${GRAPH}/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const t = (await r.text()).slice(0, 500);
    return { status: r.ok ? (body.test_event_code ? "teste" : "ok") : "erro", resposta: `${r.status} ${t}` };
  } catch (e) { return { status: "erro", resposta: String((e as Error)?.message || e).slice(0, 300) }; }
}
const userData = async (v: { ip?: string | null; ua?: string | null; fbp?: string | null; fbc?: string | null }, pessoal?: { tel?: string | null; email?: string | null; uid?: string | null; pais?: string | null }) => {
  const u: Record<string, unknown> = {};
  if (v.ip) u.client_ip_address = v.ip;
  if (v.ua) u.client_user_agent = v.ua;
  if (v.fbp) u.fbp = v.fbp;
  if (v.fbc) u.fbc = v.fbc;
  const tel = String(pessoal?.tel || "").replace(/\D/g, ""), em = String(pessoal?.email || "").trim().toLowerCase();
  if (tel.length >= 10) u.ph = [await sha(tel)];
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(em) && !/@sem-email\./.test(em)) u.em = [await sha(em)];
  if (pessoal?.uid) u.external_id = [await sha(pessoal.uid)];
  if (/^[A-Za-z]{2}$/.test(String(pessoal?.pais || ""))) u.country = [await sha(String(pessoal!.pais).toLowerCase())];
  return u;
};

// ---------- GA4 Measurement Protocol ----------
async function ga4(payload: Record<string, unknown>) {
  const secret = env("GA4_API_SECRET");
  if (!secret) return { status: "sem_chave", resposta: "GA4_API_SECRET ausente" };
  if (SIMULAR) return { status: "simulado", resposta: JSON.stringify(payload).slice(0, 1500) };
  const q = `measurement_id=${encodeURIComponent(GA_ID)}&api_secret=${encodeURIComponent(secret)}`;
  try {
    // validação primeiro (endpoint de debug não registra nada); com erro de formato, não manda
    const dv = await fetch(`https://www.google-analytics.com/debug/mp/collect?${q}`, { method: "POST", body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
    const vj = await dv.json().catch(() => ({}));
    if ((vj?.validationMessages || []).length) return { status: "erro", resposta: "validacao " + JSON.stringify(vj.validationMessages).slice(0, 400) };
    const r = await fetch(`https://www.google-analytics.com/mp/collect?${q}`, { method: "POST", body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
    return { status: r.ok ? "ok" : "erro", resposta: String(r.status) };
  } catch (e) { return { status: "erro", resposta: String((e as Error)?.message || e).slice(0, 300) }; }
}

// ---------- visita / clique / lead (vindos do site) ----------
async function doSite(req: Request, b: any) {
  if (!b || typeof b !== "object" || !EVENTOS.has(b.ev)) return json(req, { erro: "evento" }, 400);
  if (b.consent !== "ok") return json(req, { ok: true, ignorado: "consentimento" }); // negado: nada é gravado nem enviado
  const site = txt(b.site, 80, SITES);
  if (!site) return json(req, { erro: "site" }, 400);
  const ip = ipDe(req), ua = (req.headers.get("user-agent") || "").slice(0, 400) || null;
  if (ip) {
    const { count } = await db.from("rastreio_visitas").select("id", { count: "exact", head: true }).eq("ip", ip).gte("criado_em", new Date(Date.now() - 3600e3).toISOString());
    if ((count || 0) >= 60) return json(req, { erro: "limite" }, 429);
  }
  const v: Record<string, unknown> = {
    evento: b.ev, consentimento: "ok", site, pagina: caminho(b.pagina), posicao: txt(b.posicao, 30),
    ga_client_id: txt(b.ga_cid, 40, /^\d{1,20}\.\d{1,20}$/), ga_session_id: txt(b.ga_sid, 20, /^\d{1,20}$/),
    fbp: txt(b.fbp, 120, /^fb\.\d\.\d+\.[\w-]+$/), fbc: txt(b.fbc, 400, /^fb\.\d\.\d+\.[\w.~%\-]+$/),
    gclid: txt(b.gclid, 250), gbraid: txt(b.gbraid, 250), wbraid: txt(b.wbraid, 250),
    utm_source: txt(b.utm_source, 100), utm_medium: txt(b.utm_medium, 100), utm_campaign: txt(b.utm_campaign, 150),
    ip, ua,
  };
  // usuário logado (token do próprio site): liga a visita à conta, para achar depois a reserva paga dele
  let uid: string | null = null;
  if (typeof b.tok === "string" && b.tok.length < 4000) { try { const { data } = await db.auth.getUser(b.tok); uid = data?.user?.id || null; } catch (_) { /* token vencido: segue sem */ } }
  v.usuario = uid;
  let pessoal: { tel?: string | null; email?: string | null; uid?: string | null; pais?: string | null } | undefined;
  let metaEv: string | null = null, eventId: string | null = null, valor: number | null = null, lancha: string | null = null;

  if (b.ev === "whatsapp_click") {
    eventId = txt(b.event_id, 60, /^wa-[\w-]{8,50}$/);
    if (!eventId) return json(req, { erro: "event_id" }, 400);
    metaEv = "Contact";
  } else if (b.ev === "lead") {
    if (b.tipo === "consulta") {
      const k = txt(b.consulta, 36, /^[0-9a-f-]{36}$/i);
      const { data: c } = k ? await db.from("consultas").select("chave, telefone, email, lancha, valor, criado_em, pais").eq("chave", k).maybeSingle() : { data: null };
      if (!c || Date.now() - Date.parse(c.criado_em) > 30 * 60e3) return json(req, { erro: "consulta" }, 404);
      eventId = "lead-c-" + c.chave; v.consulta = c.chave; lancha = c.lancha; valor = +c.valor || null;
      pessoal = { tel: c.telefone, email: c.email, uid, pais: c.pais };
    } else if (b.tipo === "pedido") {
      const pid = Number(b.pedido);
      if (!uid || !Number.isInteger(pid) || pid <= 0) return json(req, { erro: "pedido" }, 400);
      const { data: p } = await db.from("pedidos").select("id, cliente, lancha, preco_cliente, preco_base, criado_em").eq("id", pid).maybeSingle();
      if (!p || p.cliente !== uid || Date.now() - Date.parse(p.criado_em) > 30 * 60e3) return json(req, { erro: "pedido" }, 404);
      eventId = "lead-p-" + p.id; v.pedido = p.id; lancha = p.lancha; valor = +p.preco_cliente || +p.preco_base || null;
      const { data: cl } = await db.from("clientes").select("whatsapp, pais").eq("user_id", uid).maybeSingle();
      let email: string | null = null; try { email = (await db.auth.admin.getUserById(uid)).data?.user?.email || null; } catch (_) { /* sem e-mail */ }
      pessoal = { tel: cl?.whatsapp, email, uid, pais: cl?.pais };
    } else return json(req, { erro: "tipo" }, 400);
    metaEv = "Lead";
  } else if (b.ev === "visita_pagar") {
    const pid = Number(b.pedido), k = txt(b.k, 36, /^[0-9a-f-]{36}$/i);
    if (!Number.isInteger(pid) || pid <= 0 || !k) return json(req, { erro: "pedido" }, 400);
    const { data: c } = await db.from("pagamentos_pp").select("pedido").eq("pedido", pid).eq("token", k).maybeSingle();
    if (!c) return json(req, { erro: "pedido" }, 404);
    v.pedido = pid;
  }
  v.event_id = eventId;
  const { data: ins, error } = await db.from("rastreio_visitas").insert(v).select("id").maybeSingle();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return json(req, { ok: true, repetido: true }); // mesmo event_id: não manda de novo
    console.error("rastreio_visitas", error.code); return json(req, { erro: "banco" }, 500);
  }
  if (metaEv && eventId && ins) {
    const custom: Record<string, unknown> = {};
    if (metaEv === "Contact") { custom.content_category = "whatsapp"; if (v.posicao) custom.posicao = v.posicao; }
    if (metaEv === "Lead") { custom.content_category = b.tipo; custom.currency = "BRL"; if (valor) custom.value = valor; if (lancha) custom.content_name = lancha; }
    const r = await meta({ event_name: metaEv, event_time: Math.floor(Date.now() / 1000), event_id: eventId, action_source: "website", event_source_url: `https://${site}${v.pagina || "/"}`, user_data: await userData(v as any, pessoal), custom_data: custom });
    await db.from("rastreio_visitas").update({ meta_status: r.status, meta_resposta: r.resposta.slice(0, 500) }).eq("id", ins.id);
  }
  return json(req, { ok: true });
}

// ---------- pagamentos confirmados (purchase) ----------
// visitas que pertencem ao pedido: a do /pagar (chave k), a do cliente logado e a da consulta com o mesmo WhatsApp (30 dias)
async function visitasDo(p: any, cl: any, ate: string) {
  const desde = new Date(Date.parse(ate) - 30 * 864e5).toISOString();
  const sel = "criado_em, consentimento, site, pagina, ga_client_id, ga_session_id, fbp, fbc, gclid, gbraid, wbraid, ip, ua";
  const listas: any[][] = [];
  listas.push((await db.from("rastreio_visitas").select(sel).eq("pedido", p.id).gte("criado_em", desde).lte("criado_em", ate).limit(50)).data || []);
  if (p.cliente) listas.push((await db.from("rastreio_visitas").select(sel).eq("usuario", p.cliente).gte("criado_em", desde).lte("criado_em", ate).limit(50)).data || []);
  const tel = String(cl?.whatsapp || "").replace(/\D/g, "");
  if (tel.length >= 10) {
    const { data: cs } = await db.from("consultas").select("chave, telefone").gte("criado_em", desde).not("chave", "is", null).limit(2000);
    const ks = (cs || []).filter((c: any) => String(c.telefone || "").replace(/\D/g, "") === tel).map((c: any) => c.chave);
    if (ks.length) listas.push((await db.from("rastreio_visitas").select(sel).in("consulta", ks.slice(0, 100)).lte("criado_em", ate).limit(50)).data || []);
  }
  return listas.flat().sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em)); // mais recente primeiro
}

async function enviarPendentes() {
  const { data: fila } = await db.from("conversoes").select("*").lte("proxima_em", new Date().toISOString())
    .or("meta_status.in.(pendente,erro),ga_status.in.(pendente,erro)").order("id").limit(20);
  const res: unknown[] = [];
  for (const c of fila || []) {
    const { data: p } = await db.from("pedidos").select("id, cliente, lancha").eq("id", c.pedido).maybeSingle();
    const { data: cl } = p?.cliente ? await db.from("clientes").select("whatsapp, pais").eq("user_id", p.cliente).maybeSingle() : { data: null };
    const vs = p ? await visitasDo(p, cl, new Date(Date.parse(c.pago_em) + 60e3).toISOString()) : [];
    const upd: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
    // a escolha mais recente vale: se a última visita conhecida negou, nada sai (o site já não grava visita negada; isto é a segunda trava)
    if (vs[0] && vs[0].consentimento !== "ok") {
      upd.meta_status = "sem_consentimento"; upd.ga_status = "sem_consentimento";
      await db.from("conversoes").update(upd).eq("id", c.id); continue;
    }
    // sem nenhuma visita registrada não há consentimento conhecido (quem recusa não grava visita): nada pessoal sai;
    // a Meta fica sem envio e o Analytics recebe a venda com consentimento de anúncios negado
    const semConsent = vs.length === 0;
    if (semConsent && (c.meta_status === "pendente" || c.meta_status === "erro")) { upd.meta_status = "sem_consentimento"; c.meta_status = "sem_consentimento"; }
    const comFb = vs.find((x) => x.fbc) || null, comFbp = vs.find((x) => x.fbp) || null, comUa = vs.find((x) => x.ua) || null;
    const comGa = vs.find((x) => x.ga_client_id && x.ga_session_id) || vs.find((x) => x.ga_client_id) || null;
    const tempo = Math.floor(Date.parse(c.pago_em) / 1000);
    const site = (comUa || vs[0])?.site || "lanchaembuzios.com.br";

    if (c.meta_status === "pendente" || c.meta_status === "erro") {
      let email: string | null = null;
      if (p?.cliente) { try { email = (await db.auth.admin.getUserById(p.cliente)).data?.user?.email || null; } catch (_) { /* sem e-mail */ } }
      const ud = await userData({ ip: comUa?.ip, ua: comUa?.ua, fbp: comFbp?.fbp, fbc: comFb?.fbc }, { tel: cl?.whatsapp, email, uid: p?.cliente, pais: cl?.pais });
      const r = await meta({
        event_name: "Purchase", event_time: Math.max(tempo, Math.floor(Date.now() / 1000) - 6 * 86400), event_id: c.event_id,
        // pagamento na página /pagar com o navegador conhecido = evento do site; sem ele, conversão registrada pelo sistema
        action_source: comUa?.ua ? "website" : "system_generated",
        ...(comUa?.ua ? { event_source_url: `https://${site}/pagar/` } : {}),
        user_data: ud,
        custom_data: { currency: c.moeda, value: +c.valor, order_id: c.event_id, content_name: p?.lancha || undefined, content_type: "product" },
      });
      upd.meta_status = r.status; upd.meta_resposta = r.resposta.slice(0, 500); upd.meta_tentativas = c.meta_tentativas + 1;
    }
    if (c.ga_status === "pendente" || c.ga_status === "erro") {
      // client_id real da visita; sem visita conhecida, um id fixo do pedido (a venda entra no Analytics, sem campanha)
      const cid = comGa?.ga_client_id || `${parseInt((await sha("pedido-" + c.pedido)).slice(0, 8), 16)}.${tempo}`;
      const params: Record<string, unknown> = {
        transaction_id: c.event_id, value: +c.valor, currency: c.moeda, engagement_time_msec: 1,
        items: [{ item_id: p?.lancha || "lancha", item_name: p?.lancha || "lancha", price: +c.valor, quantity: 1 }],
        origem_pagamento: c.origem,
      };
      if (comGa?.ga_session_id) params.session_id = comGa.ga_session_id;
      const microsAtras = Date.now() - Date.parse(c.pago_em);
      const r = await ga4({
        client_id: cid,
        ...(microsAtras < 70 * 3600e3 ? { timestamp_micros: Date.parse(c.pago_em) * 1000 } : {}),
        consent: semConsent ? { ad_user_data: "DENIED", ad_personalization: "DENIED" } : { ad_user_data: "GRANTED", ad_personalization: "GRANTED" },
        events: [{ name: "purchase", params }],
      });
      upd.ga_status = r.status; upd.ga_resposta = r.resposta.slice(0, 500); upd.ga_tentativas = c.ga_tentativas + 1;
    }
    // chave ainda não cadastrada: fica pendente e tenta de hora em hora (assim que o segredo entra, as vendas recentes saem)
    let semChave = false;
    if (upd.meta_status === "sem_chave") { upd.meta_status = "pendente"; upd.meta_tentativas = c.meta_tentativas; semChave = true; }
    if (upd.ga_status === "sem_chave") { upd.ga_status = "pendente"; upd.ga_tentativas = c.ga_tentativas; semChave = true; }
    if (semChave) upd.proxima_em = new Date(Date.now() + 3600e3).toISOString();
    // erro: tenta de novo com espera crescente (5 min, 10, 20... até 8 vezes), sempre com o mesmo event_id/transaction_id
    const tent = Math.max(Number(upd.meta_tentativas || 0), Number(upd.ga_tentativas || 0));
    if ((upd.meta_status === "erro" || upd.ga_status === "erro") && tent < 8) upd.proxima_em = new Date(Date.now() + 5 * 60e3 * 2 ** (tent - 1)).toISOString();
    else if (upd.meta_status === "erro" || upd.ga_status === "erro") { if (upd.meta_status === "erro") upd.meta_status = "desistiu"; if (upd.ga_status === "erro") upd.ga_status = "desistiu"; }
    await db.from("conversoes").update(upd).eq("id", c.id);
    res.push({ id: c.id, meta: upd.meta_status ?? c.meta_status, ga: upd.ga_status ?? c.ga_status, visitas: vs.length });
  }
  return res;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { erro: "metodo" }, 405);
  const raw = await req.text();
  if (raw.length > 8000) return json(req, { erro: "grande" }, 413);
  let b: any = null; try { b = JSON.parse(raw); } catch (_) { return json(req, { erro: "json" }, 400); }
  try {
    if (b?.acao === "enviar") {
      const { data: cfg } = await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle();
      if (!cfg?.chave || req.headers.get("x-chave") !== cfg.chave) return json(req, { erro: "nao" }, 401);
      return json(req, { ok: true, enviados: await enviarPendentes() });
    }
    return await doSite(req, b);
  } catch (e) {
    console.error("conversoes", String((e as Error)?.message || e).slice(0, 200));
    return json(req, { erro: "falha" }, 500);
  }
});
