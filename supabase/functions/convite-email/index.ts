// Búzios Lanchas: convite por e-mail para o cliente de um passeio.
// POST { bid: <bloqueio>, lang }  (administrador ou dono da lancha)
// Usa o convite já gravado por convidar_cliente; o Supabase manda o e-mail (modelo "Invite user") pelo SMTP da Brevo.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const SITE = "https://www.lanchaembuzios.com.br";
const SLOT: Record<string, Record<string, string>> = {
  pt: { manha: "Manhã (10h às 14h)", tarde: "Tarde (14h às 18h)", dia: "Dia inteiro (10h às 17h)", noite: "Noite" },
  en: { manha: "Morning (10am to 2pm)", tarde: "Afternoon (2pm to 6pm)", dia: "Full day (10am to 5pm)", noite: "Night" },
  es: { manha: "Mañana (10h a 14h)", tarde: "Tarde (14h a 18h)", dia: "Día completo (10h a 17h)", noite: "Noche" },
};
const dataBR = (d: string) => d.split("-").reverse().join("/");
// horário combinado diferente do padrão (anotacoes.hora_ini / hora_fim)
const hm = (x: string, lang: string) => { const [h, m] = x.split(":").map(Number); if (lang === "en") return (h % 12 || 12) + (m ? ":" + String(m).padStart(2, "0") : "") + (h < 12 ? "am" : "pm"); return h + "h" + (m ? String(m).padStart(2, "0") : ""); };
const LIGA: Record<string, string> = { pt: "às", en: "to", es: "a" };

// localização dos locais de embarque fixos (pins do Rodrigo); vai só para o cliente, dono e marinheiro já conhecem os lugares
const MAPA: Record<string, string> = {
  "Píer do Golfinho (Praia dos Ossos)": "https://maps.app.goo.gl/Qe2YacVDVvZcgYbN9",
  "Porto Veleiro (Praia dos Ossos)": "https://www.google.com/maps/search/?api=1&query=Porto+Veleiro+B%C3%BAzios",
  "BR Marinas Búzios": "https://maps.app.goo.gl/2cNUHqhBYXmWD8By9",
};
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    const { bid, lang: l0 } = await req.json().catch(() => ({}));
    const lang = ["pt", "en", "es"].includes(l0) ? l0 : "pt";
    const { data: b } = await db.from("bloqueios").select("id, lancha, data, horario").eq("id", bid).maybeSingle();
    if (!b) return json({ erro: "passeio" }, 404);
    const admin = !!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data;
    const dono = !!(await db.from("donos").select("user_id").eq("user_id", uid).eq("lancha", b.lancha).maybeSingle()).data;
    if (!admin && !dono) return json({ erro: "só o administrador ou o dono" }, 403);
    const { data: c } = await db.from("convites").select("email, nome, resgatado_em").eq("bloqueio_id", b.id).maybeSingle();
    if (!c?.email || c.resgatado_em) return json({ status: "sem_email" });
    const { data: an } = await db.from("anotacoes").select("pessoas, embarque, hora_ini, hora_fim").eq("bloqueio_id", b.id).maybeSingle();
    const nomeL = (await db.from("lanchas").select("nome").eq("slug", b.lancha).maybeSingle()).data?.nome || b.lancha;
    const dados = {
      convite: true, lang, nome: c.nome || "", primeiro: (c.nome || "").split(" ")[0] || "",
      lancha: nomeL, data: dataBR(b.data), horario: an?.hora_ini && an?.hora_fim ? `${(SLOT[lang][b.horario] || b.horario).replace(/ \(.*$/, "")} (${hm(an.hora_ini, lang)} ${LIGA[lang]} ${hm(an.hora_fim, lang)})` : SLOT[lang][b.horario] || b.horario,
      pessoas: an?.pessoas ? String(an.pessoas) : "", embarque: an?.embarque ? an.embarque + (MAPA[an.embarque] ? ` · ${{ pt: "Localização", en: "Location", es: "Ubicación" }[lang] || "Localização"}: ${MAPA[an.embarque]}` : "") : "",
      pagina: `${SITE}${lang === "pt" ? "" : "/" + lang}/lancha/${b.lancha}/`,
    };
    const { error } = await db.auth.admin.inviteUserByEmail(c.email, { data: dados, redirectTo: `${SITE}/login/` });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) return json({ status: "ja_tem_conta", email: c.email });
      console.error("invite", error.message);
      return json({ status: "falhou", erro: error.message, email: c.email }, 502);
    }
    return json({ status: "enviado", email: c.email });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
