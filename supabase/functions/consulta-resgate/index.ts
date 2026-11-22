// Búzios Lanchas: resgate automático da consulta rápida (Rodrigo 2026-10-24).
// Quem preencheu a janelinha e não tocou em "Chamar no WhatsApp" em 60 segundos recebe UMA mensagem
// do número oficial (modelo de Utilidade consulta_recebida, PT/EN/ES), com um botão para falar com a equipe.
// Não é pública: só roda com a chave de resgate_config (o pg_cron "consulta-resgate" chama a cada minuto).
// Travas: liga só com resgate_config.ativo; no máximo 1 mensagem por número a cada 24 h e 30 por hora no total.
// Também lembra quem veio pelo link de um vendedor e não terminou o cadastro (Rodrigo 2026-10-25): depois de 1 hora,
// UMA mensagem (modelo de Utilidade cadastro_pendente, botão /login/?criar=1&v=CÓDIGO); com 24 horas o lead some (cron leads-24h).
// Liga só com resgate_config.lead_ativo (quando a Meta aprovar o modelo).
// Aviso do passeio (Rodrigo 2026-10-27): passeio cadastrado (pelo dono ou pelo administrador) para um cliente sem conta recebe,
// 10 minutos depois, UMA mensagem (modelo de Utilidade passeio_registrado) com o botão "Ver meu passeio":
// /login/?criar=1&c=CONVITE&w=PROVA. O convite põe o passeio na conta; a prova (wa_provas, só foi para aquele número)
// confirma o WhatsApp sem código. Liga só com resgate_config.passeio_ativo.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const TOKEN = Deno.env.get("WA_TOKEN") || "", PHONE = Deno.env.get("WA_PHONE_ID") || "";
const LANG: Record<string, string> = { pt: "pt_BR", en: "en", es: "es" };
const SLOT: Record<string, Record<string, string>> = {
  pt: { dia: "10h às 17h", manha: "10h às 14h", tarde: "14h às 18h", noite: "Réveillon noturno" },
  en: { dia: "10am to 5pm", manha: "10am to 2pm", tarde: "2pm to 6pm", noite: "New Year's Eve night" },
  es: { dia: "10 h a 17 h", manha: "10 h a 14 h", tarde: "14 h a 18 h", noite: "Noche de Nochevieja" },
};
// horário combinado (Entrada/Saída) vale mais que o padrão do período (Rodrigo 2026-10-31: cliente com 13h às 17h recebeu "14h às 18h")
const hm = (x: string, l: string) => { const [h, m] = x.split(":").map(Number); if (l === "en") return (h % 12 || 12) + (m ? ":" + String(m).padStart(2, "0") : "") + (h < 12 ? "am" : "pm"); return l === "es" ? h + (m ? ":" + String(m).padStart(2, "0") : "") + " h" : h + "h" + (m ? String(m).padStart(2, "0") : ""); };
const okHm = (x: unknown) => /^\d{1,2}:\d{2}/.test(String(x || ""));
const horaTxt = (l: string, horario: string, ini?: string | null, fim?: string | null) =>
  okHm(ini) && okHm(fim) ? `${hm(String(ini), l)} ${l === "pt" ? "às" : l === "es" ? "a" : "to"} ${hm(String(fim), l)}` : (SLOT[l][horario] || horario);
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const dig = (x: unknown) => String(x || "").replace(/\D/g, "");
const ES_DDI = ["34", "51", "52", "53", "54", "56", "57", "58", "502", "503", "504", "505", "506", "507", "591", "593", "595", "598"];
const MES: Record<string, string[]> = {
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
};
const dataLonga = (d: string, l: string) => { const [, m, dd] = d.split("-").map(Number); return l === "en" ? `${MES.en[m - 1]} ${dd}` : `${dd} de ${MES[l][m - 1]}`; };
// primeiro nome digitado por outra pessoa: só letras (o número oficial não manda texto livre; revisão de segurança 2026-10-28)
const nomeOk = (v: unknown) => { const n = String(v || "").trim().split(/\s+/)[0] || ""; return /^[\p{L}'-]{2,20}$/u.test(n) ? n : "-"; };
const dataFmt = (d: string, l: string) => { const [y, m, dd] = d.split("-"); return l === "en" ? `${m}/${dd}/${y}` : `${dd}/${m}/${y}`; };

// lead do link do vendedor sem cadastro: 1 lembrete entre 1 e 24 horas depois; quem já tem conta não recebe
async function lembrarLeads(modelo: string) {
  const agora = Date.now();
  const { count } = await db.from("vendedor_leads").select("id", { count: "exact", head: true }).gte("lembrete_em", new Date(agora - 3600e3).toISOString());
  let livre = 30 - (count ?? 0);
  if (livre <= 0) return 0;
  const { data: ls, error } = await db.from("vendedor_leads").select("id, vendedor, nome, telefone, lang")
    .is("concluido_em", null).is("lembrete_em", null)
    .lte("criado_em", new Date(agora - 3600e3).toISOString()).gte("criado_em", new Date(agora - 23 * 3600e3).toISOString())
    .order("criado_em").limit(10);
  if (error) { console.error("leads", error.message); return 0; }
  let n = 0;
  for (const x of ls || []) {
    if (livre <= 0) break;
    const { data: ok } = await db.from("vendedor_leads").update({ lembrete_em: new Date().toISOString() }).eq("id", x.id).is("lembrete_em", null).is("concluido_em", null).select("id").maybeSingle();
    if (!ok) continue;
    const to = dig(x.telefone);
    if (to.length < 10 || to.length > 15) continue;
    // já tem conta com esse WhatsApp: não manda
    const { data: cl } = await db.from("clientes").select("user_id, whatsapp").ilike("whatsapp", `%${to.slice(-4)}`).limit(500);
    if ((cl || []).some(c => dig(c.whatsapp).slice(-10) === to.slice(-10))) continue;
    const { data: v } = await db.from("vendedores").select("codigo, ativo").eq("user_id", x.vendedor).maybeSingle();
    if (!v?.ativo || !v.codigo) continue;
    livre--;
    const l = LANG[x.lang] ? x.lang : "pt";
    const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE}/messages`, {
      method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template",
        template: { name: modelo, language: { code: LANG[l] }, components: [
          { type: "body", parameters: [{ type: "text", text: nomeOk(x.nome) }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: v.codigo }] },
        ] } }),
    });
    if (r.ok) { n++; console.log("lead ok", x.id); }
    else console.error("lead falhou", x.id, r.status, (await r.text()).slice(0, 400));
  }
  return n;
}

const POR_LANCHA_DIA = 10; // avisos por lancha em 24 h
// passeio cadastrado para cliente sem conta: 1 aviso por passeio, entre 30 min (10 min se o passeio é hoje) e 24 h depois de cadastrado, só passeio de hoje em diante.
// Os 30 min dão tempo para o Lucas mandar o link pelo WhatsApp da conversa com o cliente; se mandar, o aviso oficial não sai (Rodrigo 2026-11-05)
async function avisarPasseios(modelo: string) {
  const agora = Date.now();
  const { count } = await db.from("anotacoes").select("bloqueio_id", { count: "exact", head: true }).gte("aviso_wa_em", new Date(agora - 3600e3).toISOString());
  let livre = 30 - (count ?? 0);
  if (livre <= 0) return 0;
  const hoje = new Date(agora - 3 * 3600e3).toISOString().slice(0, 10); // dia de hoje no Brasil
  const ate = new Date(agora - 3 * 3600e3 + 60 * 864e5).toISOString().slice(0, 10); // só passeios até 60 dias para frente
  const { data: bs, error } = await db.from("bloqueios").select("id, lancha, data, horario, criado_em")
    .lte("criado_em", new Date(agora - 2 * 60e3).toISOString()).gte("criado_em", new Date(agora - 24 * 3600e3).toISOString())
    .gte("data", hoje).lte("data", ate).is("revenda", null).order("criado_em").limit(40);
  if (error) { console.error("passeios", error.message); return 0; }
  if (!bs?.length) return 0;
  const { data: ns } = await db.from("anotacoes").select("bloqueio_id, cliente, telefone, cliente_conta, aviso_wa_em, hora_ini, hora_fim").in("bloqueio_id", bs.map(b => b.id));
  const { data: ls } = await db.from("lanchas").select("slug, nome, dados");
  // Bordazul (dono confirma, Rodrigo 2026-11-21): o cliente já esperou o ok do dono, então o link sai logo (2 min), sem esperar o atendimento
  const conf = (s: string) => { const d: any = ls?.find(l => l.slug === s)?.dados || {};
    return Object.prototype.hasOwnProperty.call(d, "confirma_dono") ? d.confirma_dono === true || d.confirma_dono === "true" : String(d.cidade || "buzios") !== "buzios"; };
  const nomeL = (s: string) => ls?.find(l => l.slug === s)?.nome || s.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const { data: rec } = await db.from("anotacoes").select("bloqueio_id, telefone").gte("aviso_wa_em", new Date(agora - 864e5).toISOString());
  const ja = new Set((rec || []).map(r => dig(r.telefone)));
  // quantos avisos cada lancha já mandou em 24 h
  const porL = new Map<string, number>();
  const recIds = (rec || []).map(r => r.bloqueio_id);
  if (recIds.length) { const { data: rb } = await db.from("bloqueios").select("lancha").in("id", recIds); (rb || []).forEach(x => porL.set(x.lancha, (porL.get(x.lancha) || 0) + 1)); }
  let n = 0;
  for (const b of bs) {
    if (livre <= 0) break;
    if (!conf(b.lancha) && Date.parse(b.criado_em) > agora - 10 * 60e3) continue; // Búzios: espera 10 min
    if (!conf(b.lancha) && b.data > hoje && Date.parse(b.criado_em) > agora - 30 * 60e3) continue; // passeio de outro dia: espera 30 min
    const x = ns?.find(a => a.bloqueio_id === b.id);
    if (!x || x.cliente_conta || x.aviso_wa_em || !x.telefone) continue;
    if ((porL.get(b.lancha) || 0) >= POR_LANCHA_DIA) continue; // tenta de novo no próximo ciclo, dentro das 24 h
    const to = dig(x.telefone);
    if (to.length < 10 || to.length > 15) continue;
    // marca antes de mandar (uma vez só, mesmo se o cron rodar duas vezes)
    const { data: ok } = await db.from("anotacoes").update({ aviso_wa_em: new Date().toISOString() }).eq("bloqueio_id", b.id).is("aviso_wa_em", null).is("cliente_conta", null).select("bloqueio_id").maybeSingle();
    if (!ok || ja.has(to)) continue; // fica marcado sem mandar: não tenta de novo
    // já tem conta com esse WhatsApp: não manda (o passeio entra na conta pelo número)
    const { data: cl } = await db.from("clientes").select("whatsapp").ilike("whatsapp", `%${to.slice(-4)}`).limit(500);
    if ((cl || []).some(c => dig(c.whatsapp).slice(-10) === to.slice(-10))) continue;
    // o mesmo convite que o app usa (codigo_convite), criado aqui se ainda não existe
    let { data: cv } = await db.from("convites").select("codigo, resgatado_em").eq("bloqueio_id", b.id).maybeSingle();
    if (!cv) {
      await db.from("convites").insert({ nome: String(x.cliente || "").trim() || null, telefone: String(x.telefone).trim(), tel_dig: to, bloqueio_id: b.id });
      cv = (await db.from("convites").select("codigo, resgatado_em").eq("bloqueio_id", b.id).maybeSingle()).data;
    }
    if (!cv?.codigo || cv.resgatado_em) continue;
    const { data: pv, error: pe } = await db.from("wa_provas").insert({ tel_dig: to, origem: "passeio" }).select("token").single();
    if (pe || !pv) { console.error("prova", pe?.message); continue; }
    const cc = (String(x.telefone).trim().match(/^\+(\d{1,3})\s/) || [])[1] || to.slice(0, 2);
    const l = cc === "55" ? "pt" : ES_DDI.includes(cc) ? "es" : "en";
    ja.add(to); livre--; porL.set(b.lancha, (porL.get(b.lancha) || 0) + 1);
    const p = [nomeOk(x.cliente), nomeL(b.lancha), `${dataLonga(b.data, l)} (${horaTxt(l, b.horario, x.hora_ini, x.hora_fim)})`];
    const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE}/messages`, {
      method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template",
        template: { name: modelo, language: { code: LANG[l] }, components: [
          { type: "body", parameters: p.map(text => ({ type: "text", text })) },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: `?criar=1&c=${cv.codigo}&w=${pv.token}` }] },
        ] } }),
    });
    if (r.ok) { n++; console.log("passeio ok", b.id); }
    else console.error("passeio falhou", b.id, r.status, (await r.text()).slice(0, 400));
  }
  return n;
}

// Convite da consulta vencida (Rodrigo 2026-11-16, "Convite automático e some"): consulta do site de HOJE cujo horário já chegou
// (1 h antes do início, igual ao quadro "Consultas vencidas" do painel) recebe entre 18h e 21h UM aviso do número principal
// (360dialog, modelo de Utilidade consulta_encerrada, PT/EN/ES, sem emoji) e sai do painel. Se o cliente responder, a conversa
// segue pelo atendimento normal do WhatsApp. Sem o modelo aprovado como Utilidade, não envia nada: só tira a consulta do painel.
// Travas: 1 convite por número a cada 30 dias, 10 por rodada, não envia para quem já tem passeio ou outra consulta de hoje em diante.
// resgate_config.convite_ativo liga/desliga; convite_simular = só registra, não envia nem apaga.
const MODELO_TXT: Record<string, string> = {
  pt_BR: "Olá, {{1}}. Sua consulta de passeio na lancha {{2}} para {{3}} foi encerrada, porque o horário já passou. Se quiser escolher outra data, é só responder esta mensagem.",
  en: "Hello {{1}}. Your boat trip inquiry for the {{2}} on {{3}} has been closed because the time has passed. If you would like to choose another date, just reply to this message.",
  es: "Hola, {{1}}. Tu consulta de paseo en la lancha {{2}} para el {{3}} fue cerrada porque el horario ya pasó. Si quieres elegir otra fecha, solo responde este mensaje.",
};
const MODELO_EX: Record<string, string[]> = { pt_BR: ["Ana", "Miss Bardot", "16 de novembro"], en: ["Ana", "Miss Bardot", "November 16"], es: ["Ana", "Miss Bardot", "16 de noviembre"] };
const INI_H: Record<string, number> = { manha: 10, dia: 10, tarde: 14, noite: 20 };
async function d360Key() {
  const env = Deno.env.get("D360_API_KEY") || "";
  if (env) return env;
  const { data } = await db.from("segredos_app").select("valor").eq("nome", "D360_API_KEY").maybeSingle();
  return String(data?.valor || "");
}
// quais idiomas do modelo estão aprovados como Utilidade; os que faltam são criados (no máximo 1 tentativa a cada 24 h)
async function modeloPronto(key: string, nome: string, cfg: any) {
  const r = await fetch("https://waba-v2.360dialog.io/v1/configs/templates?limit=1000", { headers: { "D360-API-KEY": key } });
  if (!r.ok) { console.error("convite modelos", r.status); return new Set<string>(); }
  const j = await r.json().catch(() => ({}));
  const ts: any[] = (j.waba_templates || j.data || []).filter((t: any) => t?.name === nome);
  const ok = new Set<string>(ts.filter(t => String(t.status).toLowerCase() === "approved" && String(t.category).toUpperCase() === "UTILITY").map(t => String(t.language)));
  const falta = Object.keys(MODELO_TXT).filter(l => !ts.some(t => String(t.language) === l));
  if (falta.length && (!cfg.convite_modelo_em || Date.parse(cfg.convite_modelo_em) < Date.now() - 864e5)) {
    await db.from("resgate_config").update({ convite_modelo_em: new Date().toISOString() }).eq("id", 1);
    for (const l of falta) {
      const c = await fetch("https://waba-v2.360dialog.io/v1/configs/templates", {
        method: "POST", headers: { "D360-API-KEY": key, "content-type": "application/json" },
        body: JSON.stringify({ name: nome, category: "UTILITY", language: l, components: [{ type: "BODY", text: MODELO_TXT[l], example: { body_text: [MODELO_EX[l]] } }] }),
      });
      console.log("convite modelo criado", l, c.status, c.ok ? "" : (await c.text()).slice(0, 300));
    }
  }
  return ok;
}
async function convidarVencidas(cfg: any) {
  const agora = Date.now(), br = new Date(agora - 3 * 3600e3), hoje = br.toISOString().slice(0, 10), hBr = br.getUTCHours();
  if (hBr < 18 || hBr >= 21) return 0;
  const { data: cs, error } = await db.from("consultas").select("id, lancha, data, horario, nome, telefone, lang, hora_ini")
    .eq("data", hoje).is("recusada_em", null).is("virou_pedido_em", null).order("criado_em").limit(30);
  if (error) { console.error("convite", error.message); return 0; }
  const venc = (cs || []).filter(c => {
    const m = String(c.hora_ini || "").match(/^(\d{1,2}):(\d{2})/);
    const ini = m ? +m[1] + +m[2] / 60 : (INI_H[c.horario] ?? 10);
    return hBr + br.getUTCMinutes() / 60 >= ini - 1;
  }).slice(0, 10);
  if (!venc.length) return 0;
  const key = await d360Key().catch(() => "");
  const nome = cfg.convite_modelo || "consulta_encerrada";
  const pronto = key ? await modeloPronto(key, nome, cfg).catch(e => (console.error("convite modelos", e), new Set<string>())) : new Set<string>();
  const { data: ls } = await db.from("lanchas").select("slug, nome, dados");
  // Bordazul (dono confirma, Rodrigo 2026-11-21): o cliente já esperou o ok do dono, então o link sai logo (2 min), sem esperar o atendimento
  const conf = (s: string) => { const d: any = ls?.find(l => l.slug === s)?.dados || {};
    return Object.prototype.hasOwnProperty.call(d, "confirma_dono") ? d.confirma_dono === true || d.confirma_dono === "true" : String(d.cidade || "buzios") !== "buzios"; };
  const nomeL = (s: string) => ls?.find(l => l.slug === s)?.nome || s.replace(/-/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
  const ja = new Set<string>();
  let n = 0;
  for (const c of venc) {
    const to = dig(c.telefone), fim8 = to.slice(-8);
    const l = SLOT[c.lang] ? c.lang : "pt", lc = LANG[l];
    let manda = !!key && pronto.has(lc) && to.length >= 10 && to.length <= 15 && !ja.has(to);
    if (manda) {
      // outra consulta do mesmo número de hoje em diante (fora as vencidas desta rodada): o atendimento continua, sem aviso
      const { data: outras } = await db.from("consultas").select("id, telefone, data").gte("data", hoje).is("recusada_em", null).ilike("telefone", `%${to.slice(-4)}`).limit(200);
      if ((outras || []).some(o => dig(o.telefone).slice(-8) === fim8 && !venc.some(v => v.id === o.id))) manda = false;
    }
    if (manda) {
      // já tem passeio marcado de hoje em diante com esse número
      const { data: ans } = await db.from("anotacoes").select("telefone, bloqueios!inner(data)").gte("bloqueios.data", hoje).ilike("telefone", `%${to.slice(-4)}`).limit(200);
      if ((ans || []).some(a => dig(a.telefone).slice(-8) === fim8)) manda = false;
    }
    if (manda) {
      const { data: rec } = await db.from("consulta_convites").select("tel_dig").eq("tel_dig", to).gte("criado_em", new Date(agora - 30 * 864e5).toISOString()).limit(1);
      if (rec?.length) manda = false;
    }
    if (cfg.convite_simular) { console.log("convite simulado", c.id, manda ? "enviaria" : "não enviaria"); continue; }
    if (manda) {
      ja.add(to);
      // registra antes de mandar (trava de duplicidade mesmo se o cron rodar duas vezes)
      const { data: reg, error: re } = await db.from("consulta_convites").insert({ tel_dig: to, consulta_id: c.id, lancha: c.lancha, data: c.data }).select("id").single();
      if (re || !reg) { console.error("convite registro", re?.message); continue; }
      const r = await fetch("https://waba-v2.360dialog.io/messages", {
        method: "POST", headers: { "D360-API-KEY": key, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "template",
          template: { name: nome, language: { code: lc }, components: [
            { type: "body", parameters: [nomeOk(c.nome), nomeL(c.lancha), dataLonga(c.data, l)].map(text => ({ type: "text", text })) },
          ] } }),
      });
      await db.from("consulta_convites").update({ status: r.ok ? "enviado" : "falhou" }).eq("id", reg.id);
      if (r.ok) { n++; console.log("convite ok", c.id); }
      else console.error("convite falhou", c.id, r.status, (await r.text()).slice(0, 300));
    }
    // sai do painel (com ou sem aviso); a limpeza da meia-noite apagaria de qualquer jeito
    await db.from("consultas").delete().eq("id", c.id).is("recusada_em", null);
  }
  return n;
}

Deno.serve(async req => {
  try {
    const { data: cfg } = await db.from("resgate_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg?.chave || req.headers.get("x-chave") !== cfg.chave) return json({ erro: "nao" }, 401);
    // conferência (só leitura): status do modelo do convite da consulta vencida em cada idioma; não envia nada
    const corpo = await req.json().catch(() => ({}));
    if (corpo?.modelo_status) {
      const key = await d360Key().catch(() => "");
      if (!key) return json({ ok: false, erro: "sem chave" });
      const r = await fetch("https://waba-v2.360dialog.io/v1/configs/templates?limit=1000", { headers: { "D360-API-KEY": key } });
      const j = await r.json().catch(() => ({}));
      const nome = cfg.convite_modelo || "consulta_encerrada";
      return json({ ok: r.ok, modelos: (j.waba_templates || j.data || []).filter((t: any) => t?.name === nome).map((t: any) => ({ language: t.language, status: t.status, category: t.category, rejected_reason: t.rejected_reason || null })) });
    }
    const leads = cfg.lead_ativo && TOKEN && PHONE ? await lembrarLeads(cfg.modelo_lead || "cadastro_pendente").catch(e => (console.error("leads", e), 0)) : 0;
    const passeios = cfg.passeio_ativo && TOKEN && PHONE ? await avisarPasseios(cfg.modelo_passeio || "passeio_registrado").catch(e => (console.error("passeios", e), 0)) : 0;
    const convites = cfg.convite_ativo ? await convidarVencidas(cfg).catch(e => (console.error("convite", e), 0)) : 0;
    if (!cfg.ativo || !TOKEN || !PHONE) return json({ ok: true, ativo: false, leads, passeios, convites });
    const agora = Date.now();
    // trava geral: no máximo 30 por hora
    const { count } = await db.from("consultas").select("id", { count: "exact", head: true }).gte("wa_enviado_em", new Date(agora - 3600e3).toISOString());
    let livre = 30 - (count ?? 0);
    if (livre <= 0) return json({ ok: true, enviados: 0, trava: "hora", leads, passeios, convites });
    // consultas de 70 s a 30 min atrás, sem chamar no WhatsApp e sem resgate ainda
    const { data: cs } = await db.from("consultas").select("id, lancha, data, horario, pessoas, nome, telefone, lang, hora_ini, hora_fim")
      .eq("chamou", false).is("wa_enviado_em", null)
      .lte("criado_em", new Date(agora - 70e3).toISOString()).gte("criado_em", new Date(agora - 30 * 60e3).toISOString())
      .order("criado_em").limit(10);
    const { data: ls } = await db.from("lanchas").select("slug, nome, dados");
  // Bordazul (dono confirma, Rodrigo 2026-11-21): o cliente já esperou o ok do dono, então o link sai logo (2 min), sem esperar o atendimento
  const conf = (s: string) => { const d: any = ls?.find(l => l.slug === s)?.dados || {};
    return Object.prototype.hasOwnProperty.call(d, "confirma_dono") ? d.confirma_dono === true || d.confirma_dono === "true" : String(d.cidade || "buzios") !== "buzios"; };
    const nomeL = (s: string) => ls?.find(l => l.slug === s)?.nome || s.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    // números que já receberam nas últimas 24 h
    const { data: rec } = await db.from("consultas").select("telefone").gte("wa_enviado_em", new Date(agora - 864e5).toISOString());
    const ja = new Set((rec || []).map(r => dig(r.telefone)));
    let enviados = 0;
    for (const c of cs || []) {
      if (livre <= 0) break;
      const to = dig(c.telefone);
      // marca antes de mandar (uma vez só, mesmo se o cron rodar duas vezes)
      const { data: ok } = await db.from("consultas").update({ wa_enviado_em: new Date().toISOString() }).eq("id", c.id).is("wa_enviado_em", null).eq("chamou", false).select("id").maybeSingle();
      if (!ok) continue;
      if (to.length < 10 || to.length > 15 || ja.has(to)) continue; // fica marcada sem mandar: não tenta de novo
      ja.add(to); livre--;
      const l = SLOT[c.lang] ? c.lang : "pt";
      const p = [nomeOk(c.nome), nomeL(c.lancha), `${dataFmt(c.data, l)}, ${horaTxt(l, c.horario, c.hora_ini, c.hora_fim)}`, String(c.pessoas || "-")];
      const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE}/messages`, {
        method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template",
          template: { name: cfg.modelo || "consulta_recebida", language: { code: LANG[l] }, components: [{ type: "body", parameters: p.map(text => ({ type: "text", text })) }] } }),
      });
      if (r.ok) { enviados++; console.log("resgate ok", c.id); }
      else console.error("resgate falhou", c.id, r.status, (await r.text()).slice(0, 400));
    }
    return json({ ok: true, enviados, leads, passeios, convites });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
