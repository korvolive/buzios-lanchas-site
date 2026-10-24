// Búzios Lanchas: consulta rápida que não virou conversa (Rodrigo 2026-10-23).
// O site chama logo depois de salvar os dados da janelinha. Se em 60 segundos o cliente não tocar em
// "Chamar no WhatsApp", os administradores recebem no celular um aviso para chamar ele.
// POST { k: <chave da consulta> }  (sem login: só age numa consulta existente, uma vez por consulta)
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const SLOT: Record<string, Record<string, string>> = {
  pt: { manha: "manhã", tarde: "tarde", dia: "dia inteiro", noite: "noite" },
  en: { manha: "morning", tarde: "afternoon", dia: "full day", noite: "night" },
  es: { manha: "mañana", tarde: "tarde", dia: "día completo", noite: "noche" },
};
const dataBR = (d: string) => d.split("-").reverse().join("/");
const TXT: Record<string, (c: any) => { title: string; body: string }> = {
  pt: c => ({ title: "Cliente interessado não chamou no WhatsApp", body: `${c.nome} · ${c.lancha} · ${dataBR(c.data)} · ${SLOT.pt[c.horario] || c.horario}${c.pessoas ? ` · ${c.pessoas} pessoas` : ""}. Toque para chamar ele.` }),
  en: c => ({ title: "Interested client didn't message on WhatsApp", body: `${c.nome} · ${c.lancha} · ${dataBR(c.data)} · ${SLOT.en[c.horario] || c.horario}${c.pessoas ? ` · ${c.pessoas} people` : ""}. Tap to reach out.` }),
  es: c => ({ title: "Cliente interesado no escribió por WhatsApp", body: `${c.nome} · ${c.lancha} · ${dataBR(c.data)} · ${SLOT.es[c.horario] || c.horario}${c.pessoas ? ` · ${c.pessoas} personas` : ""}. Toca para contactarlo.` }),
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function avisar(id: number) {
  await new Promise(r => setTimeout(r, 60_000));
  // ainda não chamou? marca como avisada (uma vez só) e manda o aviso
  const { data: c } = await db.from("consultas").update({ avisado_em: new Date().toISOString() }).eq("id", id).eq("chamou", false).is("avisado_em", null).select("id, nome, lancha, data, horario, pessoas").maybeSingle();
  if (!c) return;
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const lancha = (await db.from("lanchas").select("nome").eq("slug", c.lancha).maybeSingle()).data?.nome || c.lancha;
  const { data: ads } = await db.from("admins").select("user_id");
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", (ads || []).map(a => a.user_id));
  await Promise.all((subs || []).map(async s => {
    const m = (TXT[s.lang] || TXT.pt)({ ...c, lancha });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url: "/login/?consulta=" + c.id, tag: `consulta-${c.id}` }), { TTL: 86400, urgency: "high" });
      console.log("push ok consulta", c.id);
    } catch (e: any) {
      console.error("push falhou", e?.statusCode, e?.body || String(e));
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }));
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { k } = await req.json().catch(() => ({}));
    if (typeof k !== "string" || !UUID.test(k)) return json({ ok: false }, 400);
    // trava contra abuso: no máximo 20 avisos por hora para os administradores
    const hora = new Date(Date.now() - 3600e3).toISOString();
    const { count } = await db.from("consultas").select("id", { count: "exact", head: true }).gte("agendado_em", hora);
    if ((count ?? 0) >= 20) return json({ ok: true, agendado: false });
    // marca uma vez só: chamadas repetidas não geram outro aviso
    const { data: c } = await db.from("consultas").update({ agendado_em: new Date().toISOString() }).eq("chave", k).eq("chamou", false).is("agendado_em", null).select("id").maybeSingle();
    if (!c) return json({ ok: true, agendado: false });
    // @ts-ignore EdgeRuntime existe no Supabase
    EdgeRuntime.waitUntil(avisar(c.id).catch(e => console.error(e)));
    return json({ ok: true, agendado: true });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
