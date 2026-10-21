// Búzios Lanchas: avisa o vendedor (celular e e-mail) quando um cliente pede um passeio pelo link dele.
// POST { id: <pedido> }  (o próprio cliente, logo depois de pedir; uma vez por pedido: pedidos.vendedor_avisado_em)
// O vendedor recebe só o primeiro nome do cliente, sem telefone. Celular: chaves e inscrições do notificar (push_config, push_subs).
// E-mail: mesmo jeito do notificar (modelo "Magic Link" com user_metadata.msg).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const dataBR = (d: string) => d.split("-").reverse().join("/");
const SLOT: Record<string, Record<string, string>> = {
  pt: { manha: "10h às 14h", tarde: "14h às 18h", dia: "10h às 17h", noite: "noite" },
  en: { manha: "10am to 2pm", tarde: "2pm to 6pm", dia: "10am to 5pm", noite: "night" },
  es: { manha: "10h a 14h", tarde: "14h a 18h", dia: "10h a 17h", noite: "noche" },
};
const PUSH: Record<string, (p: any) => { title: string; body: string }> = {
  pt: p => ({ title: "Pedido pelo seu link", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario} · ${p.pessoas} pessoas. A Búzios Lanchas confirma depois do sinal de 50%.` }),
  en: p => ({ title: "Request through your link", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario} · ${p.pessoas} people. Búzios Lanchas confirms after the 50% deposit.` }),
  es: p => ({ title: "Pedido por tu link", body: `${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario} · ${p.pessoas} personas. Búzios Lanchas confirma después de la seña del 50%.` }),
};
const MAIL: Record<string, (p: any) => any> = {
  pt: p => ({ oi: `Olá, ${p.primeiro}!`, texto: `Um cliente pediu um passeio pelo seu link: ${p.lancha}.`, linhas: [`Cliente: ${p.cliente}`, `Data: ${dataBR(p.data)}`, `Horário: ${SLOT.pt[p.horario] || p.horario}`, `Pessoas: ${p.pessoas}`, ...(p.comissao ? [`Sua comissão: ${p.comissao}`] : [])], nota: "A Búzios Lanchas confirma o passeio depois que o cliente pagar o sinal de 50%. Você recebe a sua comissão nesse momento. Acompanhe em Minhas vendas, no app.", botao: "Abrir o app" }),
  en: p => ({ oi: `Hi, ${p.primeiro}!`, texto: `A client requested a tour through your link: ${p.lancha}.`, linhas: [`Client: ${p.cliente}`, `Date: ${dataBR(p.data)}`, `Time: ${SLOT.en[p.horario] || p.horario}`, `People: ${p.pessoas}`, ...(p.comissao ? [`Your commission: ${p.comissao}`] : [])], nota: "Búzios Lanchas confirms the tour once the client pays the 50% deposit. You get your commission at that point. Follow it in My sales, in the app.", botao: "Open the app" }),
  es: p => ({ oi: `¡Hola, ${p.primeiro}!`, texto: `Un cliente pidió un paseo por tu link: ${p.lancha}.`, linhas: [`Cliente: ${p.cliente}`, `Fecha: ${dataBR(p.data)}`, `Horario: ${SLOT.es[p.horario] || p.horario}`, `Personas: ${p.pessoas}`, ...(p.comissao ? [`Tu comisión: ${p.comissao}`] : [])], nota: "Búzios Lanchas confirma el paseo cuando el cliente paga la seña del 50%. Recibes tu comisión en ese momento. Síguelo en Mis ventas, en la app.", botao: "Abrir la app" }),
};

async function push(uid: string, p: any) {
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return 0;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").eq("user_id", uid);
  let n = 0;
  await Promise.all((subs || []).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...(PUSH[s.lang] || PUSH.pt)(p), url: "/login/", tag: `venda-${p.id}` }), { TTL: 86400, urgency: "high" });
      n++;
    } catch (e: any) {
      console.error("push falhou", e?.statusCode);
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }));
  return n;
}

async function email(uid: string, p: any) {
  const { data } = await db.auth.admin.getUserById(uid);
  const u = data?.user;
  if (!u?.email || !u.email_confirmed_at) return false;
  const meta = { ...(u.user_metadata || {}) };
  const lang = ["pt", "en", "es"].includes(meta.lang) ? meta.lang : "pt";
  const msg = { lang, ...MAIL[lang]({ ...p, primeiro: String(p.nomeVend || meta.nome || meta.full_name || "").trim().split(" ")[0] || "" }) };
  msg.oi = msg.oi.replace(/, !$/, "!");
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg } });
  const { error } = await db.auth.signInWithOtp({ email: u.email, options: { shouldCreateUser: false, emailRedirectTo: "https://www.lanchaembuzios.com.br/login/" } });
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg: null } });
  if (error) { console.error("email", error.message); return false; }
  return true;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    const { id } = await req.json().catch(() => ({}));
    const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, horario, pessoas, criado_em, vendedor, preco_base, preco_cliente, vendedor_avisado_em").eq("id", id).maybeSingle();
    if (!p || p.cliente !== uid) return json({ erro: "pedido não encontrado" }, 404);
    if (!p.vendedor || p.vendedor_avisado_em || Date.now() - Date.parse(p.criado_em) > 10 * 60 * 1000) return json({ enviados: 0 });
    const { data: marcado } = await db.from("pedidos").update({ vendedor_avisado_em: new Date().toISOString() }).eq("id", p.id).is("vendedor_avisado_em", null).select("id");
    if (!marcado?.length) return json({ enviados: 0 });
    const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
    const cli = (await db.from("clientes").select("nome").eq("user_id", uid).maybeSingle()).data?.nome || "";
    const com = Math.max((p.preco_cliente || 0) - (p.preco_base || 0), 0);
    const dados = { ...p, lancha, cliente: String(cli).trim().split(" ")[0], comissao: com ? "R$ " + com.toLocaleString("pt-BR") : "" };
    const enviados = await push(p.vendedor, dados);
    const mail = await email(p.vendedor, dados).catch(e => (console.error(e), false));
    return json({ enviados, email: mail });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
