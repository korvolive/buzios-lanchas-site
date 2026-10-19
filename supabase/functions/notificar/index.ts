// Búzios Lanchas: notificação no celular (Web Push).
// GET  -> { publica }  chave pública para o celular se inscrever
// POST { tipo: "aprovado", id: <bloqueio> }  (só o administrador) avisa os donos da lancha
// POST { tipo: "pedido",   id: <pedido> }    (o próprio cliente, uma vez) avisa o administrador
// POST { tipo: "teste" }                       avisa só quem chamou
// As chaves do envio são criadas aqui mesmo na primeira vez e ficam em push_config (ninguém do app lê).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const b64u = (a: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let keys: { publica: string; privada: string } | null = null;
async function chaves() {
  if (keys) return keys;
  const { data } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (data) return (keys = data);
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const novo = { id: 1, publica: b64u(await crypto.subtle.exportKey("raw", k.publicKey)), privada: (await crypto.subtle.exportKey("jwk", k.privateKey)).d! };
  await db.from("push_config").upsert(novo, { onConflict: "id", ignoreDuplicates: true });
  const { data: d2 } = await db.from("push_config").select("publica, privada").eq("id", 1).single();
  return (keys = d2!);
}

const SLOT: Record<string, Record<string, string>> = {
  pt: { manha: "manhã", tarde: "tarde", dia: "dia inteiro", noite: "noite" },
  en: { manha: "morning", tarde: "afternoon", dia: "full day", noite: "night" },
  es: { manha: "mañana", tarde: "tarde", dia: "día completo", noite: "noche" },
};
const dataBR = (d: string) => d.split("-").reverse().join("/");
const TXT: Record<string, Record<string, (p: any) => { title: string; body: string }>> = {
  aprovado: {
    pt: p => ({ title: "Passeio novo na sua agenda", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario}. A Búzios Lanchas confirmou o passeio.${p.semMar ? " Escolha quem vai pilotar." : ""}` }),
    en: p => ({ title: "New trip in your schedule", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario}. Búzios Lanchas confirmed the trip.${p.semMar ? " Choose who will drive." : ""}` }),
    es: p => ({ title: "Paseo nuevo en tu agenda", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario}. Búzios Lanchas confirmó el paseo.${p.semMar ? " Elige quién va a pilotar." : ""}` }),
  },
  pedido: {
    pt: p => ({ title: "Pedido novo pelo site", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario} · ${p.pessoas} pessoas` }),
    en: p => ({ title: "New request from the website", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario} · ${p.pessoas} people` }),
    es: p => ({ title: "Pedido nuevo desde el sitio", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario} · ${p.pessoas} personas` }),
  },
  teste: {
    pt: () => ({ title: "Notificações ativadas", body: "Você vai receber os avisos da Búzios Lanchas aqui." }),
    en: () => ({ title: "Notifications are on", body: "You will get Búzios Lanchas alerts here." }),
    es: () => ({ title: "Notificaciones activadas", body: "Recibirás aquí los avisos de Búzios Lanchas." }),
  },
};

async function enviar(users: string[], tipo: string, p: any, url: string) {
  if (!users.length) return 0;
  const k = await chaves();
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", users);
  let n = 0;
  await Promise.all((subs || []).map(async s => {
    const m = (TXT[tipo][s.lang] || TXT[tipo].pt)(p);
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url, tag: `${tipo}-${p.id ?? "t"}` }), { TTL: 86400, urgency: "high" });
      n++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
      else console.error("push", e?.statusCode, e?.body || String(e));
    }
  }));
  return n;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method === "GET") return json({ publica: (await chaves()).publica });
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    const { tipo, id } = await req.json().catch(() => ({}));
    const admin = !!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data;
    const nomeLancha = async (slug: string) => (await db.from("lanchas").select("nome").eq("slug", slug).maybeSingle()).data?.nome || slug;

    if (tipo === "teste") return json({ enviados: await enviar([uid], "teste", {}, "/login/") });

    if (tipo === "aprovado") {
      if (!admin) return json({ erro: "só o administrador" }, 403);
      const { data: b } = await db.from("bloqueios").select("id, lancha, data, horario").eq("id", id).maybeSingle();
      if (!b) return json({ erro: "passeio não encontrado" }, 404);
      const { data: ds } = await db.from("donos").select("user_id").eq("lancha", b.lancha);
      const alvo = (ds || []).map(d => d.user_id).filter(x => x !== uid);
      const { data: an } = await db.from("anotacoes").select("marinheiro").eq("bloqueio_id", b.id).maybeSingle();
      return json({ enviados: await enviar(alvo, "aprovado", { ...b, semMar: !an?.marinheiro, lancha: await nomeLancha(b.lancha) }, "/login/") });
    }

    if (tipo === "pedido") {
      const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, horario, pessoas, criado_em, avisado_em").eq("id", id).maybeSingle();
      if (!p || p.cliente !== uid) return json({ erro: "pedido não encontrado" }, 404);
      if (p.avisado_em || Date.now() - Date.parse(p.criado_em) > 10 * 60 * 1000) return json({ enviados: 0 });
      const { data: marcado } = await db.from("pedidos").update({ avisado_em: new Date().toISOString() }).eq("id", p.id).is("avisado_em", null).select("id");
      if (!marcado?.length) return json({ enviados: 0 });
      const { data: ads } = await db.from("admins").select("user_id");
      return json({ enviados: await enviar((ads || []).map(a => a.user_id), "pedido", { ...p, lancha: await nomeLancha(p.lancha) }, "/login/") });
    }
    return json({ erro: "tipo" }, 400);
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
