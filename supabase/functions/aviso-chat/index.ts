// Búzios Lanchas: avisa quem participa de uma conversa (celular e e-mail) quando chega mensagem nova.
// Conversas permanentes (Rodrigo, 2026-10-22): tipo 'suporte' (cliente + Búzios Lanchas), 'vendedor' (cliente + vendedor)
//   e 'dono' (um passeio confirmado sem vendedor: cliente + dono da lancha). Os admins participam de todas.
// POST { id: <mensagem> }       chamado por quem acabou de escrever. Avisa os outros participantes, admins sempre.
// POST { denuncia: <mensagem> } chamado por quem denunciou. Avisa os admins.
// Celular: chaves e inscrições do notificar (push_config, push_subs). E-mail: modelo "Magic Link" com user_metadata.msg,
//   só para quem não tem celular inscrito, e no máximo um a cada 30 min por conversa (conversa_lidas.email_em).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const dataBR = (d: string) => d.split("-").reverse().join("/");
const SITE = "https://www.lanchaembuzios.com.br";
const T: Record<string, any> = {
  pt: { sup: "Búzios Lanchas", rep: "Mensagem denunciada", repBody: (n: string) => `${n} denunciou uma mensagem. Toque para ver a conversa.`, oi: (n: string) => `Olá, ${n}!`, texto: (a: string, l: string, d: string) => l ? `${a} escreveu sobre o passeio ${l} (${d}):` : `${a} escreveu na sua conversa com a Búzios Lanchas:`, nota: "Responda pelo Chat do app. Não responda a este e-mail.", botao: "Abrir a conversa" },
  en: { sup: "Búzios Lanchas", rep: "Message reported", repBody: (n: string) => `${n} reported a message. Tap to see the conversation.`, oi: (n: string) => `Hi, ${n}!`, texto: (a: string, l: string, d: string) => l ? `${a} wrote about the ${l} tour (${d}):` : `${a} wrote in your Búzios Lanchas conversation:`, nota: "Reply in the app Chat. Do not reply to this e-mail.", botao: "Open the conversation" },
  es: { sup: "Búzios Lanchas", rep: "Mensaje denunciado", repBody: (n: string) => `${n} denunció un mensaje. Toca para ver la conversación.`, oi: (n: string) => `¡Hola, ${n}!`, texto: (a: string, l: string, d: string) => l ? `${a} escribió sobre el paseo ${l} (${d}):` : `${a} escribió en tu conversación con Búzios Lanchas:`, nota: "Responde por el Chat de la app. No respondas a este e-mail.", botao: "Abrir la conversación" },
};
const lang = (x: string) => (["pt", "en", "es"].includes(x) ? x : "pt");

async function nomeDe(uid: string, admins: Set<string>, l: string) {
  const c = (await db.from("clientes").select("nome").eq("user_id", uid).maybeSingle()).data?.nome;
  const p = c || (await db.from("perfis").select("nome").eq("user_id", uid).maybeSingle()).data?.nome;
  let n = p ? String(p).trim().split(" ")[0] : "";
  if (!n) { const { data } = await db.auth.admin.getUserById(uid); const m = data?.user?.user_metadata || {}; n = String(m.nome || m.full_name || "").trim().split(" ")[0]; }
  if (admins.has(uid)) return n ? `${n} (${T[l].sup})` : T[l].sup; // quem atende pela Búzios Lanchas aparece com o nome (Rodrigo, 2026-10-22)
  return n || "—";
}

async function pushAll(uids: string[], mk: (l: string) => { title: string; body: string }, url: string, tag: string) {
  if (!uids.length) return new Set<string>();
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k) return new Set<string>();
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang, user_id").in("user_id", uids);
  const ok = new Set<string>();
  await Promise.all((subs || []).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...mk(lang(s.lang)), url, tag }), { TTL: 86400, urgency: "high" });
      ok.add(s.user_id);
    } catch (e: any) {
      console.error("push falhou", e?.statusCode);
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }));
  return ok;
}

async function email(uid: string, cid: number, autor: string, lancha: string, dia: string, texto: string) {
  const { data: lida } = await db.from("conversa_lidas").select("email_em").eq("conversa", cid).eq("user_id", uid).maybeSingle();
  if (lida?.email_em && Date.now() - Date.parse(lida.email_em) < 30 * 60 * 1000) return false;
  const { data } = await db.auth.admin.getUserById(uid);
  const u = data?.user;
  if (!u?.email || !u.email_confirmed_at) return false;
  const meta = { ...(u.user_metadata || {}) };
  const l = lang(meta.lang);
  const primeiro = String(meta.nome || meta.full_name || "").trim().split(" ")[0];
  const msg = { lang: l, oi: T[l].oi(primeiro).replace(/, !$/, "!"), texto: T[l].texto(autor, lancha, dia ? dataBR(dia) : ""), linhas: [`“${texto.slice(0, 300)}${texto.length > 300 ? "…" : ""}”`], nota: T[l].nota, botao: T[l].botao, url: `${SITE}/login/?chat=${cid}` };
  await db.from("conversa_lidas").upsert({ conversa: cid, user_id: uid, ate: lida ? undefined : 0, email_em: new Date().toISOString() } as any, { onConflict: "conversa,user_id" });
  await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg } });
  const { error } = await db.auth.signInWithOtp({ email: u.email, options: { shouldCreateUser: false, emailRedirectTo: `${SITE}/login/` } });
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
    const { id, denuncia } = await req.json().catch(() => ({}));
    const admins = new Set<string>(((await db.from("admins").select("user_id")).data || []).map((a: any) => a.user_id));
    const mid = Number(denuncia || id);
    const { data: m } = await db.from("mensagens").select("id, conversa, autor, texto, criado_em, pedido, sistema").eq("id", mid).maybeSingle();
    if (!m) return json({ erro: "mensagem não encontrada" }, 404);
    const { data: c } = await db.from("conversas").select("id, tipo, cliente, vendedor, ref").eq("id", m.conversa).maybeSingle();
    if (!c?.tipo) return json({ erro: "conversa não encontrada" }, 404);
    // o passeio do aviso: o da conversa com o dono, ou o marcado na mensagem ("Sobre: lancha · data")
    const pid = c.tipo === "dono" ? c.ref : m.pedido;
    const p: any = pid ? (await db.from("pedidos").select("lancha, data, status, vendedor").eq("id", pid).maybeSingle()).data : null;
    const lancha = p ? (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha : "";
    const url = `/login/?chat=${c.id}`;

    if (denuncia) {
      const { data: d } = await db.from("denuncias").select("id").eq("mensagem", mid).eq("por", uid).limit(1);
      if (!d?.length) return json({ erro: "denúncia não encontrada" }, 403);
      const quem = await nomeDe(uid, admins, "pt");
      const ok = await pushAll([...admins], l => ({ title: T[l].rep, body: T[l].repBody(quem) }), url, `den-${mid}`);
      return json({ enviados: ok.size });
    }

    // pagamento liberado pelo administrador: a mensagem é da Búzios Lanchas (sem autor) e avisa o cliente (Rodrigo, 2026-10-22)
    const sys = String(m.sistema || "").startsWith("sinal:") && admins.has(uid);
    if ((m.autor !== uid && !sys) || Date.now() - Date.parse(m.criado_em) > 10 * 60 * 1000) return json({ enviados: 0 });
    const dest = new Set<string>();
    if (c.cliente) dest.add(c.cliente);
    if (c.tipo === "vendedor" && c.vendedor) dest.add(c.vendedor);
    // o dono da lancha só participa depois do pedido aprovado e nunca quando há vendedor (regra do Rodrigo, 2026-10-22)
    if (c.tipo === "dono" && p && p.status === "aprovado" && !p.vendedor) ((await db.from("donos").select("user_id").eq("lancha", p.lancha)).data || []).forEach((d: any) => dest.add(d.user_id));
    admins.forEach(a => dest.add(a)); // a Búzios Lanchas participa de todas as conversas e é avisada sempre (Rodrigo, 2026-10-22)
    dest.delete(uid);
    const autor = sys ? "Búzios Lanchas" : await nomeDe(uid, admins, "pt");
    const prev = m.texto.length > 120 ? m.texto.slice(0, 117) + "…" : m.texto;
    const ok = await pushAll([...dest], () => ({ title: p ? `${autor} · ${lancha} ${dataBR(p.data)}` : autor, body: prev }), url, `chat-${c.id}`);
    let mails = 0;
    for (const d of dest) if (!ok.has(d) && (await email(d, c.id, autor, lancha, p?.data || "", m.texto).catch(e => (console.error(e), false)))) mails++;
    return json({ enviados: ok.size, emails: mails });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
