// Rodar: deno run -A scripts/testes/conversoes-servidor.ts
// Teste local da função conversoes com Supabase, Meta e GA4 falsos (nenhuma chamada real).
Deno.env.set("SUPABASE_URL", "http://fake.local");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "x");
Deno.env.set("META_PIXEL_ID", "123");
Deno.env.set("META_CAPI_TOKEN", "tok");
Deno.env.set("GA4_API_SECRET", "sec");

const T: Record<string, any[]> = {
  rastreio_visitas: [], conversoes: [],
  consultas: [{ chave: "11111111-1111-4111-8111-111111111111", telefone: "+55 21987654321", email: "Cli@Ex.com", lancha: "miss-bardot", valor: 2500, criado_em: new Date().toISOString(), pais: "BR" }],
  pagamentos_pp: [{ pedido: 90, token: "22222222-2222-4222-8222-222222222222" }],
  resgate_config: [{ id: 1, chave: "seg" }],
  pedidos: [{ id: 90, cliente: "u-1", lancha: "midas", criado_em: new Date().toISOString(), preco_cliente: 2300 }],
  clientes: [{ user_id: "u-1", whatsapp: "+55 21987654321", pais: "BR" }],
};
const meta: any[] = [], ga: any[] = [];
let gaFalha = 0;
let nid = 1;
const match = (row: any, k: string, v: string) => {
  const val = row[k];
  if (v.startsWith("eq.")) return String(val) === decodeURIComponent(v.slice(3));
  if (v.startsWith("in.(")) return v.slice(4, -1).split(",").map((x) => decodeURIComponent(x).replace(/^"|"$/g, "")).includes(String(val));
  if (v === "is.null") return val == null;
  if (v === "not.is.null") return val != null;
  if (v.startsWith("gte.")) return String(val) >= decodeURIComponent(v.slice(4));
  if (v.startsWith("lte.")) return String(val) <= decodeURIComponent(v.slice(4));
  return true;
};
const filtra = (rows: any[], u: URL) => rows.filter((r) => [...u.searchParams].every(([k, v]) => ["select", "order", "limit", "or"].includes(k) || match(r, k, v)));
const resp = (b: unknown, s = 200, h: Record<string, string> = {}) => new Response(b == null ? null : JSON.stringify(b), { status: s, headers: { "content-type": "application/json", ...h } });

globalThis.fetch = (async (input: any, init?: any) => {
  const u = new URL(typeof input === "string" ? input : input.url);
  const method = init?.method || (input?.method) || "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  if (u.host === "graph.facebook.com") { meta.push({ url: u.pathname, body }); return new Response('{"events_received":1}', { status: 200 }); }
  if (u.host === "www.google-analytics.com") {
    if (u.pathname.startsWith("/debug")) return resp({ validationMessages: [] });
    ga.push(body); if (gaFalha > 0) { gaFalha--; return new Response("", { status: 500 }); } return new Response(null, { status: 204 });
  }
  if (u.pathname === "/auth/v1/user") return resp({ id: "u-1", email: "cli@ex.com" });
  if (u.pathname.startsWith("/auth/v1/admin/users/")) return resp({ id: "u-1", email: "Cli@Ex.com" });
  const tb = u.pathname.replace("/rest/v1/", "");
  const rows = T[tb] || [];
  const h = new Headers(init?.headers);
  if (method === "HEAD" || /count=exact/.test(h.get("prefer") || "")) { const n = filtra(rows, u).length; return resp(method === "HEAD" ? null : [], 200, { "content-range": `0-0/${n}` }); }
  if (method === "POST") {
    const novos = Array.isArray(body) ? body : [body];
    for (const r of novos) if (tb === "rastreio_visitas" && r.event_id && rows.some((x) => x.event_id === r.event_id)) return resp({ code: "23505", message: "duplicate key value violates unique constraint" }, 409);
    const ins = novos.map((r) => ({ id: nid++, criado_em: new Date().toISOString(), ...r }));
    rows.push(...ins); T[tb] = rows;
    return resp(/single|object/.test(h.get("accept") || "") ? ins[0] : ins, 201);
  }
  if (method === "PATCH") { filtra(rows, u).forEach((r) => Object.assign(r, body)); return resp([], 200); }
  let out = filtra(rows, u);
  if (tb === "conversoes") out = out.filter((c) => ["pendente", "erro"].includes(c.meta_status) || ["pendente", "erro"].includes(c.ga_status));
  if (/vnd\.pgrst\.object/.test(h.get("accept") || "")) return out.length ? resp(out[0]) : resp(null, 200);
  return resp(out);
}) as typeof fetch;

let handler: (r: Request) => Promise<Response>;
(Deno as any).serve = (h: any) => { handler = h; };
await import("../../supabase/functions/conversoes/index.ts");
const site = (b: unknown, ip = "200.1.1.1") => handler(new Request("http://x/", { method: "POST", body: JSON.stringify(b), headers: { origin: "https://www.lanchaembuzios.com.br", "x-forwarded-for": ip, "user-agent": "Mozilla/5.0 iPhone" } }));
const ok = (c: boolean, m: string) => { console.log((c ? "OK   " : "FALHA") + " " + m); if (!c) Deno.exitCode = 1; };

// 1) clique no WhatsApp
let r = await site({ ev: "whatsapp_click", consent: "ok", site: "lanchaembuzios.com.br", pagina: "/lancha/midas/?nome=Joao", posicao: "flutuante", event_id: "wa-abcdef12-3456", ga_cid: "123.456", ga_sid: "1700000000", fbp: "fb.1.1700.999", gclid: "Cj0KCQ" });
ok(r.status === 200, "clique aceito");
ok(meta.length === 1 && meta[0].body.data[0].event_name === "Contact" && meta[0].body.data[0].event_id === "wa-abcdef12-3456", "Meta Contact com o mesmo event_id do Pixel");
ok(meta[0].body.data[0].event_source_url === "https://lanchaembuzios.com.br/lancha/midas/", "URL sem a parte do ? (sem dado pessoal)");
ok(T.rastreio_visitas[0].posicao === "flutuante" && T.rastreio_visitas[0].ip === "200.1.1.1", "visita gravada com posição e IP");
// 2) mesmo clique repetido (retentativa do navegador)
r = await site({ ev: "whatsapp_click", consent: "ok", site: "lanchaembuzios.com.br", event_id: "wa-abcdef12-3456" });
ok(meta.length === 1 && (await r.json()).repetido === true, "repetição do mesmo event_id não manda de novo");
// 3) consentimento negado
r = await site({ ev: "whatsapp_click", consent: "negado", site: "lanchaembuzios.com.br", event_id: "wa-zzzzzzzz-1" });
ok(meta.length === 1 && T.rastreio_visitas.length === 1, "consentimento negado: nada gravado nem enviado");
// 4) evento fora da lista e tentativa de declarar compra pelo navegador
r = await site({ ev: "purchase", consent: "ok", site: "lanchaembuzios.com.br", value: 99999 });
ok(r.status === 400 && meta.length === 1, "navegador não consegue declarar compra (evento fora da lista)");
r = await site({ ev: "whatsapp_click", consent: "ok", site: "evil.com", event_id: "wa-abcdef12-9999" });
ok(r.status === 400, "site fora da lista recusado");
// 5) Lead de consulta inexistente e existente
r = await site({ ev: "lead", tipo: "consulta", consent: "ok", site: "lanchaembuzios.com.br", consulta: "99999999-9999-4999-8999-999999999999" });
ok(r.status === 404, "Lead de consulta que não existe no banco é recusado");
r = await site({ ev: "lead", tipo: "consulta", consent: "ok", site: "lanchaembuzios.com.br", consulta: "11111111-1111-4111-8111-111111111111", ga_cid: "123.456", ga_sid: "1700000000", fbc: "fb.1.1700.IwAR" });
const lead = meta[1]?.body.data[0];
ok(lead?.event_name === "Lead" && lead.event_id === "lead-c-11111111-1111-4111-8111-111111111111", "Lead da consulta com event_id fixo (igual ao Pixel)");
ok(lead?.user_data.ph?.[0]?.length === 64 && lead.user_data.em?.[0]?.length === 64 && !JSON.stringify(lead).includes("98765"), "telefone/e-mail só em hash para a Meta");
// 6) visita ao /pagar com chave errada e certa
r = await site({ ev: "visita_pagar", consent: "ok", site: "lanchaembuzios.com.br", pedido: 90, k: "33333333-3333-4333-8333-333333333333" });
ok(r.status === 404, "visita ao /pagar com chave errada recusada");
r = await site({ ev: "visita_pagar", consent: "ok", site: "lanchaembuzios.com.br", pagina: "/pagar/", pedido: 90, k: "22222222-2222-4222-8222-222222222222", ga_cid: "555.666", ga_sid: "1700000999", fbp: "fb.1.1700.888", fbc: "fb.1.1700.AdClick" });
ok(r.status === 200 && meta.length === 2, "visita ao /pagar gravada (sem evento para a Meta)");
// 7) pagamento confirmado (linha criada pelo gatilho do banco), GA falha 1 vez
T.conversoes.push({ id: 500, event_id: "pedido-90", pedido: 90, valor: 690, moeda: "BRL", origem: "asaas_pix", pago_em: new Date().toISOString(), meta_status: "pendente", meta_tentativas: 0, ga_status: "pendente", ga_tentativas: 0, proxima_em: new Date(0).toISOString() });
gaFalha = 1;
const enviar = (ch = "seg") => handler(new Request("http://x/", { method: "POST", body: '{"acao":"enviar"}', headers: { "x-chave": ch } }));
ok((await enviar("errada")).status === 401, "envio sem a chave do servidor recusado");
await enviar();
const pm = meta[2]?.body.data[0];
ok(pm?.event_name === "Purchase" && pm.event_id === "pedido-90" && pm.custom_data.value === 690 && pm.custom_data.currency === "BRL", "Meta Purchase com valor pago, BRL e id do pedido");
ok(pm?.user_data.fbc === "fb.1.1700.AdClick" && pm.action_source === "website", "Purchase ligado ao clique do anúncio (fbc da visita)");
const g1 = ga[0];
ok(g1?.client_id === "555.666" && g1.events[0].params.session_id === "1700000999" && g1.events[0].params.transaction_id === "pedido-90", "GA4 purchase com client_id/session_id reais e transaction_id");
ok(!/98765|cli@ex|Cli@Ex/i.test(JSON.stringify(g1)), "GA4 sem telefone/e-mail");
const c = T.conversoes[0];
ok(c.meta_status === "ok" && c.ga_status === "erro" && new Date(c.proxima_em) > new Date(), "GA falhou: fica para nova tentativa com espera");
c.proxima_em = new Date(0).toISOString();
await enviar();
ok(meta.length === 3 && ga.length === 2 && ga[1].events[0].params.transaction_id === "pedido-90" && c.ga_status === "ok", "nova tentativa só no GA, mesmo transaction_id; Meta não repete");
await enviar();
ok(meta.length === 3 && ga.length === 2, "nada pendente: nada sai de novo");
// 8) limite por IP
for (let i = 0; i < 61; i++) T.rastreio_visitas.push({ id: nid++, ip: "9.9.9.9", criado_em: new Date().toISOString() });
r = await site({ ev: "whatsapp_click", consent: "ok", site: "lanchaembuzios.com.br", event_id: "wa-limite-0001" }, "9.9.9.9");
ok(r.status === 429, "limite de 60 por IP por hora");
