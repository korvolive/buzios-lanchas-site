// Búzios Lanchas: o dono aprova (ou recusa) a pré-reserva pelo WhatsApp (Rodrigo 2026-11-17).
// Antes só o administrador aprovava os pedidos das embarcações sem "Reserva automática", ligando para o dono para saber se estava livre.
// Agora, quando a equipe lança um pedido numa dessas embarcações, o dono recebe pelo número oficial (360dialog) o modelo de Utilidade
// dono_aprovar_reserva com um botão que abre /aprovar/?t=<token>, uma página sem login:
//  - "Está livre, aprovar": mesma aprovação do administrador (rpc dono_aprovar -> _aprovar_consulta); o cliente segue para o pagamento
//    pelo caminho de sempre (o Lucas recebe o aviso para mandar o link; se ninguém mandar, o número oficial manda depois).
//  - "Não está disponível" (link pequeno + confirmação na página): a consulta vai para Recusadas e o cliente recebe na hora, no mesmo
//    WhatsApp em que o Lucas atende, uma explicação gentil com até 2 embarcações livres no mesmo horário (ou que está tudo reservado).
//    Fora da janela de 24 h do cliente, sai o modelo reserva_indisponivel (Utilidade) e a resposta do cliente volta para o Lucas.
//  - Se o administrador já tiver aprovado ou recusado, a página só mostra isso.
// Modos:
//  POST {} com x-chave (pg_cron a cada minuto): manda o aviso aos donos das pré-reservas novas, das 7h às 22h de Brasília.
//  POST {acao:"ver"|"aprovar"|"recusar", t}: a página /aprovar/ (o token é a única credencial; validado no servidor).
//  POST {teste:"modelos"} com x-chave: situação dos modelos (só leitura).
// resgate_config.dono_aprov_ativo liga/desliga o envio aos donos. Sem nomes de pessoas da empresa e sem emoji nos textos.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const SITE = "https://www.lanchaembuzios.com.br";
const D360 = "https://waba-v2.360dialog.io";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ES_DDI = ["34", "51", "52", "53", "54", "56", "57", "58", "502", "503", "504", "505", "506", "507", "591", "593", "595", "598"];

const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "");
// telefone para o WhatsApp: BR sem DDI ganha 55; 55 repetido sai; estrangeiro fica como está
function waNum(s: unknown) {
  let d = dig(s);
  if (/^5555\d{10,11}$/.test(d)) d = d.slice(2);
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) d = "55" + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}
const brl = (v: unknown) => "R$ " + Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const SLOT: Record<string, Record<string, string>> = {
  pt: { manha: "manhã", tarde: "tarde", dia: "dia inteiro", noite: "noite" },
  en: { manha: "morning", tarde: "afternoon", dia: "full day", noite: "night" },
  es: { manha: "mañana", tarde: "tarde", dia: "día completo", noite: "noche" },
};
const MES: Record<string, string[]> = {
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
};
const dataLonga = (d: string, l: string) => { const [, m, dd] = d.split("-").map(Number); return l === "en" ? `${MES.en[m - 1]} ${dd}` : `${dd} de ${MES[l][m - 1]}`; };
const hora = (c: any, l: string) => c.hora_ini && c.hora_fim ? `${String(c.hora_ini).slice(0, 5)} - ${String(c.hora_fim).slice(0, 5)}` : (SLOT[l][c.horario] || c.horario);
const primeiro = (n: unknown) => { const p = String(n || "").trim().split(/\s+/)[0] || ""; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""; };
const langCli = (c: any, to: string) => ["pt", "en", "es"].includes(c.lang) && !(c.lang === "pt" && !to.startsWith("55")) ? c.lang : to.startsWith("55") ? "pt" : ES_DDI.some(d => to.startsWith(d)) ? "es" : "en";

// ---------- modelos (criados sozinhos, no máximo 1 tentativa a cada 24 h; sem aprovação da Meta não envia) ----------
const MOD_DONO = "dono_aprovar_reserva";
const MOD_DONO_TXT = "Nova pré-reserva para a {{1}}: {{2}}, {{3}}, {{4}} pessoas. Valor para você: {{5}}.\n\nA embarcação está livre nesse horário? Toque no botão abaixo para aprovar. Se não estiver, você também pode avisar por lá.";
const MOD_DONO_EX = ["Midas", "20 de novembro", "tarde", "8", "R$ 2.000"];
const MOD_INDISP = "reserva_indisponivel";
const MOD_INDISP_TXT: Record<string, string> = {
  pt_BR: "Olá, {{1}}. Infelizmente a embarcação {{2}} acabou sendo reservada por outro cliente para {{3}} e não está mais disponível nesse horário. Responda esta mensagem que mostramos as outras opções livres para essa data.",
  en: "Hello {{1}}. Unfortunately the {{2}} was just booked by another client for {{3}} and is no longer available at that time. Reply to this message and we will show you the other options available on that date.",
  es: "Hola, {{1}}. Lamentablemente la embarcación {{2}} fue reservada por otro cliente para el {{3}} y ya no está disponible en ese horario. Responde este mensaje y te mostramos las otras opciones libres para esa fecha.",
};
const MOD_INDISP_EX: Record<string, string[]> = { pt_BR: ["Ana", "Midas", "20 de novembro"], en: ["Ana", "Midas", "November 20"], es: ["Ana", "Midas", "20 de noviembre"] };
const LC: Record<string, string> = { pt: "pt_BR", en: "en", es: "es" };

async function d360Key() {
  const env = Deno.env.get("D360_API_KEY") || "";
  if (env) return env;
  const { data } = await db.from("segredos_app").select("valor").eq("nome", "D360_API_KEY").maybeSingle();
  return String(data?.valor || "");
}
async function modelos(key: string) {
  const r = await fetch(`${D360}/v1/configs/templates?limit=1000`, { headers: { "D360-API-KEY": key } });
  if (!r.ok) { console.error("modelos", r.status); return null; }
  const j = await r.json().catch(() => ({}));
  return (j.waba_templates || j.data || []) as any[];
}
const aprovado = (ts: any[] | null, nome: string, lc: string) =>
  !!ts?.some(t => t?.name === nome && String(t.language) === lc && String(t.status).toLowerCase() === "approved" && String(t.category).toUpperCase() === "UTILITY");
const velho = (x: unknown) => !x || Date.parse(String(x)) < Date.now() - 864e5;
// cria o que falta; cada modelo é conferido no máximo 1 vez a cada 24 h (marca em resgate_config)
async function criarModelos(key: string, ts: any[] | null, cfg: any) {
  if (!ts) return;
  const tem = (n: string, lc: string) => ts.some(t => t?.name === n && String(t.language) === lc);
  const agora = new Date().toISOString();
  if (velho(cfg.dono_modelo_em)) {
    cfg.dono_modelo_em = agora;
    await db.from("resgate_config").update({ dono_modelo_em: agora }).eq("id", 1);
    if (!tem(MOD_DONO, "pt_BR")) {
      const c = await fetch(`${D360}/v1/configs/templates`, {
        method: "POST", headers: { "D360-API-KEY": key, "content-type": "application/json" },
        body: JSON.stringify({ name: MOD_DONO, category: "UTILITY", language: "pt_BR", components: [
          { type: "BODY", text: MOD_DONO_TXT, example: { body_text: [MOD_DONO_EX] } },
          { type: "BUTTONS", buttons: [{ type: "URL", text: "Ver e aprovar", url: `${SITE}/aprovar/?t={{1}}`, example: [`${SITE}/aprovar/?t=3f2b6c1e-8d4a-4b7e-9c2d-1a5e7f9b0c3d`] }] },
        ] }),
      });
      console.log("modelo dono criado", c.status, c.ok ? "" : (await c.text()).slice(0, 300));
    }
  }
  if (velho(cfg.indisp_modelo_em)) {
    cfg.indisp_modelo_em = agora;
    await db.from("resgate_config").update({ indisp_modelo_em: agora }).eq("id", 1);
    for (const lc of Object.keys(MOD_INDISP_TXT).filter(lc => !tem(MOD_INDISP, lc))) {
      const c = await fetch(`${D360}/v1/configs/templates`, {
        method: "POST", headers: { "D360-API-KEY": key, "content-type": "application/json" },
        body: JSON.stringify({ name: MOD_INDISP, category: "UTILITY", language: lc, components: [{ type: "BODY", text: MOD_INDISP_TXT[lc], example: { body_text: [MOD_INDISP_EX[lc]] } }] }),
      });
      console.log("modelo indisponivel criado", lc, c.status, c.ok ? "" : (await c.text()).slice(0, 300));
    }
  }
}
async function enviar(key: string, corpo: unknown) {
  const r = await fetch(`${D360}/messages`, { method: "POST", headers: { "D360-API-KEY": key, "content-type": "application/json" }, body: JSON.stringify(corpo) });
  if (!r.ok) console.error("wa falhou", r.status, (await r.text()).slice(0, 300));
  return r.ok;
}

// ---------- celular da equipe (web push e app iOS) ----------
let vapid = false;
let apnsJwt: { t: string; em: number } | null = null;
async function apnsToken() {
  if (apnsJwt && Date.now() - apnsJwt.em < 50 * 60e3) return apnsJwt.t;
  const pem = (Deno.env.get("APNS_KEY_P8") || "").replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const enc = (o: unknown) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const head = `${enc({ alg: "ES256", kid: Deno.env.get("APNS_KEY_ID") })}.${enc({ iss: Deno.env.get("APNS_TEAM_ID"), iat: Math.floor(Date.now() / 1000) })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(head)));
  apnsJwt = { t: `${head}.${b64u(sig)}`, em: Date.now() };
  return apnsJwt.t;
}
async function push(ids: string[], msg: (l: string) => { title: string; body: string }, url: string, tag: string) {
  if (!ids.length) return 0;
  if (!vapid) {
    const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
    if (!k) return 0;
    webpush.setVapidDetails(SITE, k.publica, k.privada); vapid = true;
  }
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", ids);
  let n = 0;
  await Promise.all((subs || []).map(async s => {
    const m = msg(["pt", "en", "es"].includes(s.lang) ? s.lang : "pt");
    try {
      if (s.endpoint.startsWith("apns:")) {
        const r = await fetch(`https://api.push.apple.com/3/device/${s.endpoint.slice(5)}`, {
          method: "POST",
          headers: { authorization: `bearer ${await apnsToken()}`, "apns-topic": "br.com.lanchaembuzios.app", "apns-push-type": "alert", "apns-priority": "10", "apns-collapse-id": tag.slice(0, 64) },
          body: JSON.stringify({ aps: { alert: m, sound: "default" }, url }),
        });
        if (!r.ok) throw Object.assign(new Error(await r.text()), { statusCode: r.status });
      } else {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url, tag }), { TTL: 86400, urgency: "high" });
      }
      n++;
    } catch (e: any) {
      const apns = s.endpoint.startsWith("apns:");
      console.error("push falhou", e?.statusCode, apns ? "apns" : new URL(s.endpoint).host);
      if (e?.statusCode === 404 || e?.statusCode === 410 || (apns && /BadDeviceToken|Unregistered/.test(String(e?.message)))) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }));
  return n;
}
const admins = async () => ((await db.from("admins").select("user_id")).data || []).map(a => a.user_id);
const operadores = async () => ((await db.from("papeis_painel").select("user_id").eq("papel", "operador")).data || []).map(a => a.user_id);
const nomeLancha = async (slug: string) => (await db.from("lanchas").select("nome").eq("slug", slug).maybeSingle()).data?.nome || slug;

// ---------- aviso aos donos (cron) ----------
async function avisarDonos(cfg: any) {
  const agora = Date.now(), br = new Date(agora - 3 * 3600e3), hBR = br.getUTCHours(), hoje = br.toISOString().slice(0, 10);
  if (hBR < 7 || hBR >= 22) return { fora_do_horario: true };
  // modelos cadastrados antes do primeiro pedido, para a Meta já ter aprovado quando precisar (confere 1 vez a cada 24 h)
  if (velho(cfg.dono_modelo_em) || velho(cfg.indisp_modelo_em)) {
    const k = await d360Key();
    if (k) await criarModelos(k, await modelos(k), cfg).catch(e => console.error("criar modelos", e));
  }
  const { data: cs, error } = await db.from("consultas")
    .select("id, lancha, data, horario, hora_ini, hora_fim, pessoas, telefone, neto_garantido, grupo, criado_em")
    .not("criado_por", "is", null).is("recusada_em", null).is("virou_pedido_em", null).is("grupo", null)
    .gte("data", hoje).gte("criado_em", new Date(agora - 864e5).toISOString()).order("id").limit(30);
  if (error) throw error;
  if (!cs?.length) return { pendentes: 0 };
  const slugs = [...new Set(cs.map(c => c.lancha))];
  const { data: ls } = await db.from("lanchas").select("slug, nome, reserva_auto").in("slug", slugs);
  const L = new Map((ls || []).map(l => [l.slug, l]));
  const { data: ds } = await db.from("donos").select("lancha, user_id").in("lancha", slugs);
  const donoIds = [...new Set((ds || []).map(d => d.user_id))];
  const { data: ps } = donoIds.length ? await db.from("perfis").select("user_id, telefone").in("user_id", donoIds) : { data: [] as any[] };
  const tel = new Map((ps || []).map(p => [p.user_id, waNum(p.telefone)]));
  const { data: ja } = await db.from("aprovacoes_dono").select("consulta_id, dono").in("consulta_id", cs.map(c => c.id));
  const feito = new Set((ja || []).map(x => `${x.consulta_id}:${x.dono}`));
  const alvos: { c: any; dono: string; to: string }[] = [];
  for (const c of cs) {
    const l = L.get(c.lancha);
    if (!l || l.reserva_auto) continue; // reserva automática já vira pré-reserva sozinha
    for (const d of (ds || []).filter(d => d.lancha === c.lancha)) {
      const to = tel.get(d.user_id) || "";
      if (to && !feito.has(`${c.id}:${d.user_id}`)) alvos.push({ c, dono: d.user_id, to });
    }
  }
  if (!alvos.length) return { pendentes: cs.length, enviados: 0 };
  const key = await d360Key();
  if (!key) return { erro: "sem chave" };
  const ts = await modelos(key);
  if (!aprovado(ts, MOD_DONO, "pt_BR")) return { pendentes: cs.length, enviados: 0, modelo: "esperando a Meta" };
  let n = 0;
  for (const { c, dono, to } of alvos.slice(0, 10)) {
    // registra antes de mandar: trava de duplicidade se o cron rodar duas vezes
    const { data: reg, error: re } = await db.from("aprovacoes_dono")
      .insert({ consulta_id: c.id, dono, lancha: c.lancha, data: c.data, horario: c.horario, tel_fim: dig(c.telefone).slice(-8) || null })
      .select("id, token").single();
    if (re || !reg) { if (!String(re?.message || "").includes("duplicate")) console.error("registro", re?.message); continue; }
    let neto = c.neto_garantido;
    if (neto == null) neto = (await db.rpc("preco_neto_tabela", { l: c.lancha, d: c.data, h: c.horario })).data;
    const ok = await enviar(key, { messaging_product: "whatsapp", recipient_type: "individual", to, type: "template",
      template: { name: MOD_DONO, language: { code: "pt_BR" }, components: [
        { type: "body", parameters: [L.get(c.lancha)!.nome, dataLonga(c.data, "pt"), hora(c, "pt"), String(c.pessoas || "-"), +neto > 0 ? brl(neto) : "a combinar"].map(text => ({ type: "text", text })) },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: reg.token }] },
      ] } });
    await db.from("aprovacoes_dono").update({ enviado_em: new Date().toISOString(), envio: ok ? "enviado" : "falhou" }).eq("id", reg.id);
    if (ok) { n++; console.log("aviso dono ok", c.id); }
  }
  return { pendentes: cs.length, enviados: n };
}

// ---------- cliente avisado quando o dono recusa ----------
function textoCliente(l: string, r: any, nomeL: string) {
  const nome = primeiro(r.nome), quando = `${dataLonga(r.data, l)} (${hora(r, l)})`, ops: any[] = r.opcoes || [];
  const lista = ops.map(o => l === "en" ? `- ${o.nome}, up to ${o.cap} people, ${brl(o.preco)}` : l === "es" ? `- ${o.nome}, hasta ${o.cap} personas, ${brl(o.preco)}` : `- ${o.nome}, até ${o.cap} pessoas, ${brl(o.preco)}`).join("\n");
  if (l === "en") return `Hello${nome ? " " + nome : ""}. Unfortunately, while we were finishing your booking, the owner of the ${nomeL} closed ${quando} with another client, and it is no longer available at that time. We are sorry for the inconvenience.\n\n` +
    (ops.length ? `These options are available at the same time:\n${lista}\n\nIf you would like one of them, just reply here and we will continue with your booking.` : `Unfortunately all our options for that time are already booked. If you like, we can look at another date or time, just reply here.`);
  if (l === "es") return `Hola${nome ? ", " + nome : ""}. Lamentablemente, mientras terminábamos tu reserva, el dueño de la ${nomeL} cerró el ${quando} con otro cliente, y ya no está disponible en ese horario. Disculpa las molestias.\n\n` +
    (ops.length ? `Tenemos estas opciones libres en el mismo horario:\n${lista}\n\nSi quieres una de ellas, solo responde aquí y seguimos con la reserva.` : `Lamentablemente todas nuestras opciones para ese horario ya están reservadas. Si quieres, podemos ver otra fecha u horario, solo responde aquí.`);
  return `Olá${nome ? ", " + nome : ""}. Infelizmente, enquanto finalizávamos a sua reserva, o dono da ${nomeL} acabou fechando ${quando} com outro cliente, e ela não está mais disponível nesse horário. Pedimos desculpas pelo transtorno.\n\n` +
    (ops.length ? `Temos estas opções livres no mesmo horário:\n${lista}\n\nSe quiser uma delas, é só responder aqui que seguimos com a reserva.` : `Infelizmente todas as nossas opções para esse horário já estão reservadas. Se quiser, podemos ver outra data ou horário, é só responder aqui.`);
}
async function avisarCliente(r: any, nomeL: string) {
  if (r.vendedor) return "vendedor"; // cliente de vendedor: quem fala com ele é o vendedor (avisado no celular)
  const to = waNum(r.telefone);
  if (!to) return "sem_telefone";
  const key = await d360Key();
  if (!key) return "sem_chave";
  const l = langCli(r, to);
  // dentro das 24 h da última mensagem do cliente: texto livre; fora, a API recusa e vai o modelo
  if (await enviar(key, { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: textoCliente(l, r, nomeL), preview_url: false } })) return "texto";
  const ts = await modelos(key);
  if (!aprovado(ts, MOD_INDISP, LC[l])) return "fora_24h_sem_modelo";
  const ok = await enviar(key, { messaging_product: "whatsapp", recipient_type: "individual", to, type: "template",
    template: { name: MOD_INDISP, language: { code: LC[l] }, components: [
      { type: "body", parameters: [primeiro(r.nome) || (l === "en" ? "there" : l === "es" ? "hola" : "tudo bem"), nomeL, dataLonga(r.data, l)].map(text => ({ type: "text", text })) },
    ] } });
  return ok ? "modelo" : "falhou";
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    // ----- página do dono -----
    if (b?.acao) {
      const t = String(b.t || "");
      if (!UUID.test(t)) return json({ estado: "invalido" });
      if (b.acao === "ver") return json((await db.rpc("dono_aprovacao_ver", { tok: t })).data || { estado: "invalido" });
      if (b.acao === "aprovar") {
        const { data: r, error } = await db.rpc("dono_aprovar", { tok: t });
        if (error) { console.error("aprovar", error.message); return json({ estado: "erro" }, 500); }
        if (r?.estado === "aprovou") {
          const nomeL = await nomeLancha(r.lancha), quando = `${dataLonga(r.data, "pt")} (${SLOT.pt[r.horario] || r.horario})`, cli = primeiro(r.cliente);
          // a etiqueta do aviso de aprovação pendente: substitui o "esperando aprovação" no celular do administrador
          await push(await admins(), l => l === "en" ? { title: "Owner approved the booking", body: `${nomeL} · ${quando}${cli ? " · " + cli : ""}. The client moves on to payment.` }
            : l === "es" ? { title: "El dueño aprobó la reserva", body: `${nomeL} · ${quando}${cli ? " · " + cli : ""}. El cliente sigue al pago.` }
            : { title: "O dono aprovou a pré-reserva", body: `${nomeL} · ${quando}${cli ? " · " + cli : ""}. O cliente segue para o pagamento.` },
            "/login/?pedidos=1", `op_pedido-${r.consulta}`).catch(e => console.error("push admin", e));
          // pedido do Lucas virou pré-reserva: mesmo aviso de quando o administrador aprova (ele manda o link; senão o número oficial manda)
          if (r.pendente && !r.vendedor && !r.pedido) {
            const ops = await operadores();
            await push(ops, l => l === "en" ? { title: "Request approved: send the payment link", body: `${nomeL} · ${quando}${cli ? " · " + cli : ""}. The owner approved it.` }
              : l === "es" ? { title: "Pedido aprobado: manda el link de pago", body: `${nomeL} · ${quando}${cli ? " · " + cli : ""}. El dueño lo aprobó.` }
              : { title: "Pedido aprovado: mande o link de pagamento", body: `${nomeL} · ${quando}${cli ? " · " + cli : ""}. O dono aprovou.` },
              "/login/?pedidos=1", `op_aprovado-${r.bid}`).catch(e => console.error("push operador", e));
          }
        }
        return json(r?.estado === "aprovou" ? { estado: "aprovou" } : r?.estado === "erro" ? { estado: "erro", msg: r.msg } : (r || { estado: "invalido" }));
      }
      if (b.acao === "recusar") {
        const { data: r, error } = await db.rpc("dono_recusar", { tok: t });
        if (error) { console.error("recusar", error.message); return json({ estado: "erro" }, 500); }
        if (r?.estado !== "recusou") return json(r || { estado: "invalido" });
        const nomeL = await nomeLancha(r.lancha);
        const cliente = await avisarCliente(r, nomeL).catch(e => (console.error("cliente", e), "falhou"));
        await db.from("aprovacoes_dono").update({ envio: "recusa:" + cliente }).eq("token", t);
        const quando = `${dataLonga(r.data, "pt")} (${SLOT.pt[r.horario] || r.horario})`, cli = primeiro(r.nome);
        const avisado = ["texto", "modelo"].includes(cliente);
        const alvo = [...new Set([...(await admins()), ...(await operadores()), ...(r.vendedor ? [r.vendedor] : [])])];
        await push(alvo, () => ({ title: "O dono recusou a pré-reserva",
          body: `${nomeL} · ${quando}${cli ? " · " + cli : ""}: não está disponível. ` + (avisado ? `O cliente já foi avisado${(r.opcoes || []).length ? " com as opções livres" : ""}.` : r.vendedor ? "Avise o cliente." : "O cliente não recebeu o aviso automático: fale com ele.") }),
          "/login/?pedidos=1", `op_pedido-${r.consulta}`).catch(e => console.error("push recusa", e));
        return json({ estado: "recusou" });
      }
      return json({ erro: "acao" }, 400);
    }
    // ----- cron (servidor) -----
    const { data: cfg } = await db.from("resgate_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg?.chave || req.headers.get("x-chave") !== cfg.chave) return json({ erro: "nao" }, 401);
    if (b?.teste === "modelos") {
      const key = await d360Key(); const ts = key ? await modelos(key) : null;
      return json({ modelos: (ts || []).filter(x => [MOD_DONO, MOD_INDISP].includes(x?.name)).map(x => ({ name: x.name, language: x.language, status: x.status, category: x.category, rejected_reason: x.rejected_reason || null })) });
    }
    if (cfg.dono_aprov_ativo === false) return json({ ok: true, ativo: false });
    return json({ ok: true, ...(await avisarDonos(cfg)) });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
