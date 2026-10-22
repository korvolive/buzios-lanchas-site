// Búzios Lanchas: chat inativo (Rodrigo, 2026-10-22). Chamada a cada 15 min pelo pg_cron (job "chat-inativo").
// O banco (inativar_chats) marca os chats sem mensagem há 24 h, com a última palavra de quem atende, e grava no chat
// a mensagem de sistema 'inativo'. Aqui só avisa o cliente no celular. Sem login: repetir a chamada não faz nada novo.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const T: Record<string, { title: string; body: string }> = {
  pt: { title: "Atendimento inativo", body: "Seu chat com a Búzios Lanchas ficou inativo. Se precisar de algo, é só escrever de novo que a gente responde." },
  en: { title: "Chat inactive", body: "Your Búzios Lanchas chat is now inactive. If you need anything, just write again and we'll reply." },
  es: { title: "Atención inactiva", body: "Tu chat con Búzios Lanchas quedó inactivo. Si necesitas algo, solo escribe de nuevo y te respondemos." },
};
const lang = (x: string) => (["pt", "en", "es"].includes(x) ? x : "pt");

Deno.serve(async () => {
  try {
    const { data: rows, error } = await db.rpc("inativar_chats");
    if (error) throw error;
    if (!rows?.length) return new Response(JSON.stringify({ chats: 0 }), { headers: { "content-type": "application/json" } });
    const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
    let enviados = 0;
    if (k) {
      webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
      const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang, user_id").in("user_id", rows.map((r: any) => r.cliente));
      await Promise.all((subs || []).map(async (s: any) => {
        const r: any = rows.find((x: any) => x.cliente === s.user_id);
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ ...T[lang(s.lang)], url: `/login/?chat=${r.cid}`, tag: `chat-${r.cid}` }), { TTL: 86400 });
          enviados++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
        }
      }));
    }
    return new Response(JSON.stringify({ chats: rows.length, enviados }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ erro: "falhou" }), { status: 500 });
  }
});
