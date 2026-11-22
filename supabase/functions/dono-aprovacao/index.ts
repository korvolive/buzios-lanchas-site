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
// horário exato (o Lucas pode lançar fora do padrão); sem hora lançada, o padrão do app para o turno
const STD: Record<string, string[]> = { manha: ["10:00", "14:00"], tarde: ["14:00", "18:00"], dia: ["10:00", "17:00"] };
const hora = (c: any, l: string) => {
  const [a, b] = c.hora_ini && c.hora_fim ? [String(c.hora_ini).slice(0, 5), String(c.hora_fim).slice(0, 5)] : (STD[c.horario] || []);
  return a ? (l === "en" ? `${a} to ${b}` : l === "es" ? `${a} a ${b}` : `${a} às ${b}`) : (SLOT[l][c.horario] || c.horario);
};
const primeiro = (n: unknown) => { const p = String(n || "").trim().split(/\s+/)[0] || ""; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""; };
const langCli = (c: any, to: string) => ["pt", "en", "es"].includes(c.lang) && !(c.lang === "pt" && !to.startsWith("55")) ? c.lang : to.startsWith("55") ? "pt" : ES_DDI.some(d => to.startsWith(d)) ? "es" : "en";

// ---------- modelos (criados sozinhos, no máximo 1 tentativa a cada 24 h; sem aprovação da Meta não envia) ----------
const MOD_DONO = "dono_aprovar_reserva";
const MOD_DONO_TXT = "Nova pré-reserva para a {{1}}: {{2}}, {{3}}, {{4}} pessoas. Valor para você: {{5}}.\n\nA embarcação está livre nesse horário? Toque no botão abaixo para aprovar. Se não estiver, você também pode avisar por lá.";
const MOD_DONO_EX = ["Midas", "20 de novembro", "14:00 às 18:00", "8", "R$ 2.000"];
// a pré-reserva já foi resolvida pela Búzios Lanchas antes do dono responder: ele fica sabendo e não precisa fazer nada
const MOD_FIM = "dono_reserva_resolvida";
const MOD_FIM_TXT = "A pré-reserva da {{1}} para {{2}}, {{3}}, já foi {{4}} pela Búzios Lanchas. Não precisa fazer mais nada nesse pedido.";
const MOD_FIM_EX = ["Midas", "20 de novembro", "14:00 às 18:00", "aprovada"];
const FIM_PALAVRA: Record<string, string> = { aprovada: "aprovada", recusada: "cancelada", resolvida: "resolvida" };
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
  if (velho(cfg.fim_modelo_em)) {
    cfg.fim_modelo_em = agora;
    await db.from("resgate_config").update({ fim_modelo_em: agora }).eq("id", 1);
    if (!tem(MOD_FIM, "pt_BR")) {
      const c = await fetch(`${D360}/v1/configs/templates`, {
        method: "POST", headers: { "D360-API-KEY": key, "content-type": "application/json" },
        body: JSON.stringify({ name: MOD_FIM, category: "UTILITY", language: "pt_BR", components: [{ type: "BODY", text: MOD_FIM_TXT, example: { body_text: [MOD_FIM_EX] } }] }),
      });
      console.log("modelo resolvida criado", c.status, c.ok ? "" : (await c.text()).slice(0, 300));
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
  if (velho(cfg.dono_modelo_em) || velho(cfg.indisp_modelo_em) || velho(cfg.fim_modelo_em)) {
    const k = await d360Key();
    if (k) await criarModelos(k, await modelos(k), cfg).catch(e => console.error("criar modelos", e));
  }
  const fim = await avisarResolvidas().catch(e => (console.error("resolvidas", e), -1));
  const { data: todas } = await db.from("lanchas").select("slug, nome, reserva_auto, dados");
  const L = new Map((todas || []).map(l => [l.slug, l]));
  const CONF = new Set((todas || []).filter(confirmaDono).map(l => l.slug));
  // Prazo do dono vale para TODA lancha em que o dono aprova (sem reserva automática), em Búzios também (Rodrigo 22/11, viagem):
  // lembrete ao dono + aviso à equipe; sem resposta, o cliente recebe "seguimos aguardando" + até 2 opções livres. Nada espera o Rodrigo.
  const PRZ = new Set((todas || []).filter(l => !l.reserva_auto || confirmaDono(l)).map(l => l.slug));
  const prazos = PRZ.size ? await prazosDono(PRZ, L).catch(e => (console.error("prazos", e), -1)) : 0;
  const COLS = "id, lancha, data, horario, hora_ini, hora_fim, pessoas, telefone, neto_garantido, grupo, criado_em, criado_por";
  const { data: cs0, error } = await db.from("consultas").select(COLS)
    .not("criado_por", "is", null).is("recusada_em", null).is("virou_pedido_em", null).is("grupo", null)
    .gte("data", hoje).gte("criado_em", new Date(agora - 864e5).toISOString()).order("id").limit(30);
  if (error) throw error;
  // Bordazul (dono confirma): o pedido feito direto no site também vai para o dono, 3 minutos depois (o cliente termina a janelinha)
  const { data: cs1 } = CONF.size ? await db.from("consultas").select(COLS)
    .is("criado_por", null).in("lancha", [...CONF]).is("recusada_em", null).is("virou_pedido_em", null).is("grupo", null)
    .gte("data", hoje).gte("criado_em", new Date(agora - 864e5).toISOString()).lte("criado_em", new Date(agora - 3 * 60e3).toISOString())
    .order("id").limit(20) : { data: [] as any[] };
  const cs = [...(cs0 || []), ...(cs1 || [])];
  if (!cs.length) return { pendentes: 0, resolvidas: fim, prazos };
  const slugs = [...new Set(cs.map(c => c.lancha))];
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
  const wa = !!key && aprovado(await modelos(key), MOD_DONO, "pt_BR");
  // aviso no celular (app) sai sempre que o dono tiver o app; o WhatsApp só depois que a Meta aprovar o modelo.
  // Sem nenhum dos dois, não registra: quando o modelo for aprovado, o WhatsApp ainda sai.
  const { data: subs } = await db.from("push_subs").select("user_id").in("user_id", [...new Set(alvos.map(a => a.dono))]);
  const temApp = new Set((subs || []).map(x => x.user_id));
  let n = 0, np = 0;
  for (const { c, dono, to } of alvos.slice(0, 10)) {
    if (!wa && !temApp.has(dono)) continue;
    // Bordazul: o atendimento lançou o mesmo pedido que o cliente já tinha feito no site (que fecha sozinho).
    // O dono já recebeu o botão: o mesmo botão passa a aprovar o pedido novo, sem segundo aviso.
    if (CONF.has(c.lancha) && c.criado_por) {
      const t8 = dig(c.telefone).slice(-8);
      if (t8) {
        const { data: ant } = await db.from("aprovacoes_dono").select("id").eq("dono", dono).eq("lancha", c.lancha).eq("data", c.data)
          .eq("tel_fim", t8).is("resposta", null).neq("consulta_id", c.id).gte("criado_em", new Date(agora - 864e5).toISOString()).order("id", { ascending: false }).limit(1);
        if (ant?.length) {
          await db.from("aprovacoes_dono").update({ consulta_id: c.id, horario: c.horario }).eq("id", ant[0].id).is("resposta", null);
          console.log("aviso dono reaproveitado", c.id);
          continue;
        }
      }
    }
    // registra antes de mandar: trava de duplicidade se o cron rodar duas vezes
    const { data: reg, error: re } = await db.from("aprovacoes_dono")
      .insert({ consulta_id: c.id, dono, lancha: c.lancha, data: c.data, horario: c.horario, tel_fim: dig(c.telefone).slice(-8) || null })
      .select("id, token").single();
    if (re || !reg) { if (!String(re?.message || "").includes("duplicate")) console.error("registro", re?.message); continue; }
    let neto = c.neto_garantido;
    if (neto == null) neto = (await db.rpc("preco_neto_tabela", { l: c.lancha, d: c.data, h: c.horario })).data;
    const nomeL = L.get(c.lancha)!.nome, quando = `${dataLonga(c.data, "pt")}, ${hora(c, "pt")}`;
    const p = temApp.has(dono) ? await push([dono], () => ({ title: `Nova pré-reserva: ${nomeL}`,
      body: `${quando}, ${c.pessoas || "-"} pessoas${+neto > 0 ? `. Você recebe ${brl(neto)}` : ""}. Toque para aprovar.` }),
      `/aprovar/?t=${reg.token}`, `dono_aprov-${c.id}`).catch(e => (console.error("push dono", e), 0)) : 0;
    if (p) np++;
    const ok = wa && await enviar(key, { messaging_product: "whatsapp", recipient_type: "individual", to, type: "template",
      template: { name: MOD_DONO, language: { code: "pt_BR" }, components: [
        { type: "body", parameters: [nomeL, dataLonga(c.data, "pt"), hora(c, "pt"), String(c.pessoas || "-"), +neto > 0 ? brl(neto) : "a combinar"].map(text => ({ type: "text", text })) },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: reg.token }] },
      ] } });
    await db.from("aprovacoes_dono").update({ enviado_em: new Date().toISOString(), envio: [ok ? "whatsapp" : wa ? "whatsapp_falhou" : "", p ? "app" : ""].filter(Boolean).join("+") || "falhou" }).eq("id", reg.id);
    if (ok) { n++; console.log("aviso dono ok", c.id); }
  }
  return { pendentes: cs.length, enviados: n, app: np, prazos, modelo: wa ? "aprovado" : "esperando a Meta" };
}

// ---------- Bordazul: o dono confirma antes do pagamento (Rodrigo 2026-11-21) ----------
// Embarcação com dados.confirma_dono, ou de cidade diferente de Búzios: o dono não mantém a agenda, então todo pedido espera o ok dele.
// Mesma regra do banco (lancha_confirma_dono). Em Búzios nada muda.
// deno-lint-ignore no-explicit-any
function confirmaDono(l: any) {
  const d = l?.dados || {};
  if (Object.prototype.hasOwnProperty.call(d, "confirma_dono")) return d.confirma_dono === true || d.confirma_dono === "true";
  return String(d.cidade || "buzios") !== "buzios";
}
// Dono sem resposta: lembrete em 30 min (15 se o passeio é hoje), com aviso à equipe. Mais 30 min (15) sem resposta: o cliente
// recebe UMA mensagem gentil (seguimos aguardando + até 2 opções parecidas para consultar) e a equipe é avisada. O pedido continua
// valendo: se o dono aprovar depois, segue para o pagamento normalmente. Só roda das 7h às 22h (o cron sai antes fora disso).
const PRAZO_MIN = (hoje: boolean) => hoje ? 15 : 30;
// deno-lint-ignore no-explicit-any
async function prazosDono(CONF: Set<string>, L: Map<string, any>) {
  const agora = Date.now(), hoje = new Date(agora - 3 * 3600e3).toISOString().slice(0, 10);
  const { data: rs, error } = await db.from("aprovacoes_dono").select("id, token, consulta_id, dono, lancha, data, horario, enviado_em, lembrete_em")
    .is("resposta", null).is("sem_resposta_em", null).not("enviado_em", "is", null).in("lancha", [...CONF])
    .gte("criado_em", new Date(agora - 3 * 864e5).toISOString()).order("id").limit(30);
  if (error) throw error;
  let n = 0, key = "";
  const feitos = new Set<number>();
  for (const a of rs || []) {
    const min = PRAZO_MIN(a.data === hoje) * 60e3;
    const base = a.lembrete_em ? Date.parse(a.lembrete_em) : Date.parse(a.enviado_em);
    if (agora - base < min) continue;
    const v = (await db.rpc("dono_aprovacao_ver", { tok: a.token })).data;
    if (v?.estado !== "pendente") continue;
    const nomeL = L.get(a.lancha)?.nome || a.lancha, quando = `${dataLonga(a.data, "pt")}, ${hora({ ...a, hora_ini: v.hora_ini, hora_fim: v.hora_fim }, "pt")}`;
    const cli = v.cliente ? ` · ${v.cliente}` : "";
    if (!a.lembrete_em) {
      // marca antes de mandar: não repete se o cron rodar duas vezes
      const { data: up } = await db.from("aprovacoes_dono").update({ lembrete_em: new Date().toISOString() }).eq("id", a.id).is("lembrete_em", null).select("id");
      if (!up?.length) continue;
      await push([a.dono], () => ({ title: `Pedido esperando você: ${nomeL}`, body: `${quando}, ${v.pessoas || "-"} pessoas. O cliente está aguardando a sua confirmação. Toque para responder.` }),
        `/aprovar/?t=${a.token}`, `dono_aprov-${a.consulta_id}`).catch(() => 0);
      const { data: pf } = await db.from("perfis").select("telefone").eq("user_id", a.dono).maybeSingle();
      const to = waNum(pf?.telefone);
      if (!key) key = await d360Key();
      if (to && key && aprovado(await modelos(key), MOD_DONO, "pt_BR")) {
        await enviar(key, { messaging_product: "whatsapp", recipient_type: "individual", to, type: "template",
          template: { name: MOD_DONO, language: { code: "pt_BR" }, components: [
            { type: "body", parameters: [nomeL, dataLonga(a.data, "pt"), hora({ ...a, hora_ini: v.hora_ini, hora_fim: v.hora_fim }, "pt"), String(v.pessoas || "-"), +v.neto > 0 ? brl(v.neto) : "a combinar"].map(text => ({ type: "text", text })) },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: a.token }] },
          ] } });
      }
      if (!feitos.has(a.consulta_id)) {
        await push(await admins(), () => ({ title: `Dono ainda não respondeu: ${nomeL}`, body: `${quando}${cli}. Mandamos um lembrete ao dono.` }),
          "/login/?pedidos=1", `op_pedido-${a.consulta_id}`).catch(() => 0);
      }
      feitos.add(a.consulta_id); n++;
      continue;
    }
    // segundo prazo: uma vez por pedido (marca todas as linhas do pedido, mesmo com mais de um dono)
    const { data: up } = await db.from("aprovacoes_dono").update({ sem_resposta_em: new Date().toISOString() }).eq("consulta_id", a.consulta_id).is("sem_resposta_em", null).select("id");
    if (!up?.length || feitos.has(a.consulta_id)) continue;
    feitos.add(a.consulta_id);
    const { data: c } = await db.from("consultas").select("id, lancha, data, horario, hora_ini, hora_fim, pessoas, nome, telefone, lang, vendedor").eq("id", a.consulta_id).maybeSingle();
    let envio = "sem_consulta";
    if (c) {
      const ops = (await db.rpc("alternativas_livres", { p_lancha: c.lancha, p_data: c.data, p_horario: c.horario, p_pessoas: c.pessoas, p_hi: c.hora_ini, p_hf: c.hora_fim, p_max: 2 })).data || [];
      envio = await avisarClienteDemora({ ...c, opcoes: ops }, nomeL).catch(e => (console.error("cliente demora", e), "falhou"));
    }
    await db.from("aprovacoes_dono").update({ sem_resposta_envio: envio }).eq("consulta_id", a.consulta_id);
    const avisado = envio === "texto";
    await push(await admins(), () => ({ title: `Dono sem resposta: ${nomeL}`,
      body: `${quando}${cli}. ` + (avisado ? "O cliente recebeu a mensagem de que seguimos aguardando, com outras opções." : c?.vendedor ? "Cliente de vendedor: o vendedor fala com ele." : "Não deu para avisar o cliente automaticamente: fale com ele.") }),
      "/login/?pedidos=1", `op_pedido-${a.consulta_id}`).catch(() => 0);
    n++;
  }
  return n;
}
// deno-lint-ignore no-explicit-any
function textoDemora(l: string, r: any, nomeL: string) {
  const nome = primeiro(r.nome), quando = `${dataLonga(r.data, l)} (${hora(r, l)})`, ops: any[] = r.opcoes || [];
  const lista = ops.map(o => l === "en" ? `- ${o.nome}, up to ${o.cap} people, ${brl(o.preco)}` : l === "es" ? `- ${o.nome}, hasta ${o.cap} personas, ${brl(o.preco)}` : `- ${o.nome}, até ${o.cap} pessoas, ${brl(o.preco)}`).join("\n");
  if (l === "en") return `Hello${nome ? " " + nome : ""}. The person in charge of the ${nomeL} has not confirmed ${quando} yet. We are still waiting and will let you know as soon as they reply.` +
    (ops.length ? `\n\nIf you prefer, we can also check these similar options for the same time:\n${lista}\n\nJust reply here.` : "");
  if (l === "es") return `Hola${nome ? ", " + nome : ""}. El responsable de la ${nomeL} todavía no confirmó el ${quando}. Seguimos esperando y te avisamos apenas responda.` +
    (ops.length ? `\n\nSi prefieres, también podemos consultar estas opciones parecidas para el mismo horario:\n${lista}\n\nSolo responde aquí.` : "");
  return `Olá${nome ? ", " + nome : ""}. O responsável pela ${nomeL} ainda não confirmou ${quando}. Seguimos aguardando e te avisamos assim que ele responder.` +
    (ops.length ? `\n\nSe preferir, também podemos consultar estas opções parecidas para o mesmo horário:\n${lista}\n\nÉ só responder aqui.` : "");
}
// só texto livre: o cliente acabou de falar com a gente (janela de 24 h). Fora dela não manda nada (a equipe é avisada).
// deno-lint-ignore no-explicit-any
async function avisarClienteDemora(r: any, nomeL: string) {
  if (r.vendedor) return "vendedor";
  const to = waNum(r.telefone);
  if (!to) return "sem_telefone";
  const key = await d360Key();
  if (!key) return "sem_chave";
  const l = langCli(r, to);
  return await enviar(key, { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: textoDemora(l, r, nomeL), preview_url: false } }) ? "texto" : "fora_24h";
}

// ---------- dono avisado quando a Búzios Lanchas resolveu antes dele (Rodrigo 2026-11-18) ----------
// Aviso que já saiu, dono ainda não respondeu e a consulta foi aprovada, recusada ou fechada pela equipe: avisa uma vez
// (celular se tiver o app; WhatsApp pelo modelo dono_reserva_resolvida, ou texto livre enquanto a Meta não aprova o modelo).
async function avisarResolvidas() {
  const { data: rs, error } = await db.from("aprovacoes_dono").select("id, token, dono, lancha, data, horario, consulta_id")
    .is("resposta", null).is("fim_avisado_em", null).not("enviado_em", "is", null)
    .gte("criado_em", new Date(Date.now() - 3 * 864e5).toISOString()).order("id").limit(20);
  if (error) throw error;
  if (!rs?.length) return 0;
  let key = "", ts: any[] | null = null, n = 0;
  for (const a of rs) {
    const v = (await db.rpc("dono_aprovacao_ver", { tok: a.token })).data;
    const est = v?.estado;
    if (est === "pendente") continue;
    // marca antes de mandar: não repete se o cron rodar duas vezes
    const { data: up } = await db.from("aprovacoes_dono").update({ fim_avisado_em: new Date().toISOString(), fim_estado: est })
      .eq("id", a.id).is("fim_avisado_em", null).select("id");
    if (!up?.length || !FIM_PALAVRA[est]) continue; // vencida ou link inválido: nada a avisar
    const nomeL = v.lancha || await nomeLancha(a.lancha), quando = hora({ ...a, hora_ini: v.hora_ini, hora_fim: v.hora_fim }, "pt"), dia = dataLonga(a.data, "pt");
    const pal = FIM_PALAVRA[est];
    const p = await push([a.dono], () => ({ title: `Pré-reserva já ${pal}: ${nomeL}`,
      body: `${dia}, ${quando}. A Búzios Lanchas já resolveu esse pedido. Não precisa fazer mais nada.` }),
      `/aprovar/?t=${a.token}`, `dono_aprov-${a.consulta_id}`).catch(() => 0);
    const { data: pf } = await db.from("perfis").select("telefone").eq("user_id", a.dono).maybeSingle();
    const to = waNum(pf?.telefone);
    let w = "";
    if (to) {
      if (!key) { key = await d360Key(); ts = key ? await modelos(key) : null; }
      if (key) {
        const txt = `A pré-reserva da ${nomeL} para ${dia}, ${quando}, já foi ${pal} pela Búzios Lanchas. Não precisa fazer mais nada nesse pedido.`;
        // o modelo chega sempre; o texto livre só chega se o dono falou com o número nas últimas 24 h (por isso fica de reserva)
        if (aprovado(ts, MOD_FIM, "pt_BR")) w = await enviar(key, { messaging_product: "whatsapp", recipient_type: "individual", to, type: "template",
          template: { name: MOD_FIM, language: { code: "pt_BR" }, components: [{ type: "body", parameters: [nomeL, dia, quando, pal].map(text => ({ type: "text", text })) }] } }) ? "modelo" : "modelo_falhou";
        else w = await enviar(key, { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: txt, preview_url: false } }) ? "texto" : "texto_falhou";
      }
    }
    await db.from("aprovacoes_dono").update({ fim_estado: `${est}:${[w, p ? "app" : ""].filter(Boolean).join("+") || "nada"}` }).eq("id", a.id);
    n++;
  }
  return n;
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
          const nomeL = await nomeLancha(r.lancha), quando = `${dataLonga(r.data, "pt")} (${hora(r, "pt")})`, cli = primeiro(r.cliente);
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
        const quando = `${dataLonga(r.data, "pt")} (${hora(r, "pt")})`, cli = primeiro(r.nome);
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
      return json({ modelos: (ts || []).filter(x => [MOD_DONO, MOD_INDISP, MOD_FIM].includes(x?.name)).map(x => ({ name: x.name, language: x.language, status: x.status, category: x.category, rejected_reason: x.rejected_reason || null })) });
    }
    if (cfg.dono_aprov_ativo === false) return json({ ok: true, ativo: false });
    return json({ ok: true, ...(await avisarDonos(cfg)) });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
