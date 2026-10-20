// Búzios Lanchas: avisa o administrador no celular quando o cliente envia o comprovante do Pix do sinal.
// POST { id: <pedido> }  (só o próprio cliente, logo depois de enviar). Usa as mesmas chaves e inscrições do "notificar".
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
const TXT: Record<string, (p: any) => { title: string; body: string }> = {
  pt: p => ({ title: "Comprovante de Pix enviado", body: `${p.cliente ? p.cliente + " · " : ""}${p.lancha} · ${dataBR(p.data)} · ${SLOT.pt[p.horario] || p.horario}. Confira se o Pix caiu e aprove o pedido.` }),
  en: p => ({ title: "Pix receipt sent", body: `${p.cliente ? p.cliente + " · " : ""}${p.lancha} · ${dataBR(p.data)} · ${SLOT.en[p.horario] || p.horario}. Check the Pix arrived and approve the request.` }),
  es: p => ({ title: "Comprobante de Pix enviado", body: `${p.cliente ? p.cliente + " · " : ""}${p.lancha} · ${dataBR(p.data)} · ${SLOT.es[p.horario] || p.horario}. Revisa que llegó el Pix y aprueba el pedido.` }),
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = (await db.auth.getUser(token)).data?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    const { id } = await req.json().catch(() => ({}));
    const { data: p } = await db.from("pedidos").select("id, cliente, lancha, data, horario, status, comprovante_em").eq("id", id).maybeSingle();
    if (!p || p.cliente !== uid || p.status !== "pendente" || !p.comprovante_em || Date.now() - Date.parse(p.comprovante_em) > 10 * 60 * 1000) return json({ enviados: 0 });
    const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
    if (!k) return json({ enviados: 0 });
    webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
    const lancha = (await db.from("lanchas").select("nome").eq("slug", p.lancha).maybeSingle()).data?.nome || p.lancha;
    const cliente = (await db.from("clientes").select("nome").eq("user_id", uid).maybeSingle()).data?.nome || "";
    const { data: ads } = await db.from("admins").select("user_id");
    const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", (ads || []).map(a => a.user_id));
    let n = 0;
    await Promise.all((subs || []).map(async s => {
      const m = (TXT[s.lang] || TXT.pt)({ ...p, lancha, cliente });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url: "/login/", tag: `comprovante-${p.id}` }), { TTL: 86400, urgency: "high" });
        n++;
      } catch (e: any) {
        console.error("push falhou", e?.statusCode, e?.body || String(e));
        if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
      }
    }));
    return json({ enviados: n });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
