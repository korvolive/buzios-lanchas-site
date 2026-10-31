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
  es: { dia: "10 h a 17 h", manha: "10 h a 14 h", tarde: "14 h a 18 h", noite: "Nochevieja nocturno" },
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
// passeio cadastrado para cliente sem conta: 1 aviso por passeio, entre 10 min e 24 h depois de cadastrado, só passeio de hoje em diante
async function avisarPasseios(modelo: string) {
  const agora = Date.now();
  const { count } = await db.from("anotacoes").select("bloqueio_id", { count: "exact", head: true }).gte("aviso_wa_em", new Date(agora - 3600e3).toISOString());
  let livre = 30 - (count ?? 0);
  if (livre <= 0) return 0;
  const hoje = new Date(agora - 3 * 3600e3).toISOString().slice(0, 10); // dia de hoje no Brasil
  const ate = new Date(agora - 3 * 3600e3 + 60 * 864e5).toISOString().slice(0, 10); // só passeios até 60 dias para frente
  const { data: bs, error } = await db.from("bloqueios").select("id, lancha, data, horario")
    .lte("criado_em", new Date(agora - 10 * 60e3).toISOString()).gte("criado_em", new Date(agora - 24 * 3600e3).toISOString())
    .gte("data", hoje).lte("data", ate).is("revenda", null).order("criado_em").limit(40);
  if (error) { console.error("passeios", error.message); return 0; }
  if (!bs?.length) return 0;
  const { data: ns } = await db.from("anotacoes").select("bloqueio_id, cliente, telefone, cliente_conta, aviso_wa_em, hora_ini, hora_fim").in("bloqueio_id", bs.map(b => b.id));
  const { data: ls } = await db.from("lanchas").select("slug, nome");
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

Deno.serve(async req => {
  try {
    const { data: cfg } = await db.from("resgate_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg?.chave || req.headers.get("x-chave") !== cfg.chave) return json({ erro: "nao" }, 401);
    const leads = cfg.lead_ativo && TOKEN && PHONE ? await lembrarLeads(cfg.modelo_lead || "cadastro_pendente").catch(e => (console.error("leads", e), 0)) : 0;
    const passeios = cfg.passeio_ativo && TOKEN && PHONE ? await avisarPasseios(cfg.modelo_passeio || "passeio_registrado").catch(e => (console.error("passeios", e), 0)) : 0;
    if (!cfg.ativo || !TOKEN || !PHONE) return json({ ok: true, ativo: false, leads, passeios });
    const agora = Date.now();
    // trava geral: no máximo 30 por hora
    const { count } = await db.from("consultas").select("id", { count: "exact", head: true }).gte("wa_enviado_em", new Date(agora - 3600e3).toISOString());
    let livre = 30 - (count ?? 0);
    if (livre <= 0) return json({ ok: true, enviados: 0, trava: "hora", leads, passeios });
    // consultas de 70 s a 30 min atrás, sem chamar no WhatsApp e sem resgate ainda
    const { data: cs } = await db.from("consultas").select("id, lancha, data, horario, pessoas, nome, telefone, lang, hora_ini, hora_fim")
      .eq("chamou", false).is("wa_enviado_em", null)
      .lte("criado_em", new Date(agora - 70e3).toISOString()).gte("criado_em", new Date(agora - 30 * 60e3).toISOString())
      .order("criado_em").limit(10);
    const { data: ls } = await db.from("lanchas").select("slug, nome");
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
    return json({ ok: true, enviados, leads, passeios });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
