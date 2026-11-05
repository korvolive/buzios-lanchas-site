// Búzios Lanchas: o administrador aprovou um pedido do Lucas (operador) que virou pré-reserva (Rodrigo 2026-11-05).
// Avisa o Lucas no celular para mandar o link de pagamento pelo mesmo WhatsApp da conversa com o cliente.
// Se ninguém mandar em 30 minutos, o número oficial manda sozinho (consulta-resgate).
// POST { id: <bloqueio> }  (com login de administrador, até 10 minutos depois de criada a pré-reserva)
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const dataBR = (d: string) => d.split("-").reverse().join("/");
const brl = (v: unknown) => +(v as number) > 0 ? `R$ ${Number(v).toLocaleString("pt-BR")}` : "";
const TXT: Record<string, (p: any) => { title: string; body: string }> = {
  pt: p => ({ title: "Pedido aprovado: mande o link de pagamento", body: `${p.lancha} · ${dataBR(p.data)}${p.cliente ? " · " + p.cliente : ""}${p.sinal ? " · sinal " + p.sinal : ""}. Abra Reservas › Sinais pendentes e mande pelo WhatsApp da conversa com o cliente.` }),
  en: p => ({ title: "Request approved: send the payment link", body: `${p.lancha} · ${dataBR(p.data)}${p.cliente ? " · " + p.cliente : ""}${p.sinal ? " · deposit " + p.sinal : ""}. Open Bookings › Pending deposits and send it in the WhatsApp chat with the client.` }),
  es: p => ({ title: "Pedido aprobado: manda el link de pago", body: `${p.lancha} · ${dataBR(p.data)}${p.cliente ? " · " + p.cliente : ""}${p.sinal ? " · seña " + p.sinal : ""}. Abre Reservas › Señas pendientes y mándalo por el WhatsApp de la charla con el cliente.` }),
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = (await db.auth.getUser(token)).data?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    if (!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data) return json({ erro: "sem acesso" }, 403);
    const { id } = await req.json().catch(() => ({}));
    const { data: b } = await db.from("bloqueios").select("id, lancha, data, criado_em").eq("id", +id || 0).maybeSingle();
    if (!b) return json({ erro: "passeio não encontrado" }, 404);
    if (Date.parse(b.criado_em) < Date.now() - 10 * 60000) return json({ enviados: 0 });
    const { data: a } = await db.from("anotacoes").select("cliente, sinal, sinal_combinado").eq("bloqueio_id", b.id).maybeSingle();
    if (+(a?.sinal || 0) > 0) return json({ enviados: 0 }); // já pago: não tem link para mandar
    const { data: ops } = await db.from("papeis_painel").select("user_id").eq("papel", "operador");
    const alvo = (ops || []).map(x => x.user_id).filter(x => x !== uid);
    if (!alvo.length) return json({ enviados: 0 });
    const { data: l } = await db.from("lanchas").select("nome").eq("slug", b.lancha).maybeSingle();
    const p = { lancha: l?.nome || b.lancha, data: b.data, cliente: a?.cliente || "", sinal: brl(a?.sinal_combinado) };
    const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
    if (!k) return json({ enviados: 0 });
    webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
    const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", alvo);
    let n = 0;
    await Promise.all((subs || []).map(async s => {
      const m = (TXT[s.lang] || TXT.pt)(p);
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url: "/login/?pedidos=1", tag: `op_aprovado-${b.id}` }), { TTL: 86400, urgency: "high" });
        n++;
      } catch (e: any) {
        console.error("push falhou", e?.statusCode, new URL(s.endpoint).host);
        if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
      }
    }));
    return json({ enviados: n, aparelhos: subs?.length || 0 });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
