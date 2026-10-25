// Búzios Lanchas: resgate automático da consulta rápida (Rodrigo 2026-10-24).
// Quem preencheu a janelinha e não tocou em "Chamar no WhatsApp" em 60 segundos recebe UMA mensagem
// do número oficial (modelo de Utilidade consulta_recebida, PT/EN/ES), com um botão para falar com a equipe.
// Não é pública: só roda com a chave de resgate_config (o pg_cron "consulta-resgate" chama a cada minuto).
// Travas: liga só com resgate_config.ativo; no máximo 1 mensagem por número a cada 24 h e 30 por hora no total.
// Também lembra quem veio pelo link de um vendedor e não terminou o cadastro (Rodrigo 2026-10-25): depois de 1 hora,
// UMA mensagem (modelo de Utilidade cadastro_pendente, botão /login/?criar=1&v=CÓDIGO); com 24 horas o lead some (cron leads-24h).
// Liga só com resgate_config.lead_ativo (quando a Meta aprovar o modelo).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const TOKEN = Deno.env.get("WA_TOKEN") || "", PHONE = Deno.env.get("WA_PHONE_ID") || "";
const LANG: Record<string, string> = { pt: "pt_BR", en: "en", es: "es" };
const SLOT: Record<string, Record<string, string>> = {
  pt: { dia: "10h às 17h", manha: "10h às 14h", tarde: "14h às 18h", noite: "Réveillon noturno" },
  en: { dia: "10am to 5pm", manha: "10am to 2pm", tarde: "2pm to 6pm", noite: "New Year's Eve night" },
  es: { dia: "10 h a 17 h", manha: "10 h a 14 h", tarde: "14 h a 18 h", noite: "Nochevieja nocturno" },
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const dig = (x: unknown) => String(x || "").replace(/\D/g, "");
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
          { type: "body", parameters: [{ type: "text", text: String(x.nome || "").trim().split(" ")[0].slice(0, 40) || "-" }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: v.codigo }] },
        ] } }),
    });
    if (r.ok) { n++; console.log("lead ok", x.id); }
    else console.error("lead falhou", x.id, r.status, (await r.text()).slice(0, 400));
  }
  return n;
}

Deno.serve(async req => {
  try {
    const { data: cfg } = await db.from("resgate_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg?.chave || req.headers.get("x-chave") !== cfg.chave) return json({ erro: "nao" }, 401);
    const leads = cfg.lead_ativo && TOKEN && PHONE ? await lembrarLeads(cfg.modelo_lead || "cadastro_pendente").catch(e => (console.error("leads", e), 0)) : 0;
    if (!cfg.ativo || !TOKEN || !PHONE) return json({ ok: true, ativo: false, leads });
    const agora = Date.now();
    // trava geral: no máximo 30 por hora
    const { count } = await db.from("consultas").select("id", { count: "exact", head: true }).gte("wa_enviado_em", new Date(agora - 3600e3).toISOString());
    let livre = 30 - (count ?? 0);
    if (livre <= 0) return json({ ok: true, enviados: 0, trava: "hora", leads });
    // consultas de 70 s a 30 min atrás, sem chamar no WhatsApp e sem resgate ainda
    const { data: cs } = await db.from("consultas").select("id, lancha, data, horario, pessoas, nome, telefone, lang")
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
      const p = [c.nome.split(" ")[0].slice(0, 40), nomeL(c.lancha), `${dataFmt(c.data, l)}, ${SLOT[l][c.horario] || c.horario}`, String(c.pessoas || "-")];
      const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE}/messages`, {
        method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template",
          template: { name: cfg.modelo || "consulta_recebida", language: { code: LANG[l] }, components: [{ type: "body", parameters: p.map(text => ({ type: "text", text })) }] } }),
      });
      if (r.ok) { enviados++; console.log("resgate ok", c.id); }
      else console.error("resgate falhou", c.id, r.status, (await r.text()).slice(0, 400));
    }
    return json({ ok: true, enviados, leads });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
