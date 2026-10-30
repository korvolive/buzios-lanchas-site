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
const ES_DDI = ["34", "51", "52", "53", "54", "56", "57", "58", "502", "503", "504", "505", "506", "507", "591", "593", "595", "598"];
// horário combinado diferente do padrão (anotacoes.hora_ini / hora_fim)
const hm = (x: string, lang: string) => { const [h, m] = x.split(":").map(Number); if (lang === "en") return (h % 12 || 12) + (m ? ":" + String(m).padStart(2, "0") : "") + (h < 12 ? "am" : "pm"); return h + "h" + (m ? String(m).padStart(2, "0") : ""); };
const LIGA: Record<string, string> = { pt: "às", en: "to", es: "a" };

// localização dos locais de embarque fixos (pins do Rodrigo); vai só para o cliente, dono e marinheiro já conhecem os lugares
const MAPA: Record<string, string> = {
  "Píer do Golfinho (Praia dos Ossos)": "https://maps.app.goo.gl/Qe2YacVDVvZcgYbN9",
  "Porto Veleiro (Praia dos Ossos)": "https://maps.app.goo.gl/3YanCFbVSmcZjGdCA",
  "BR Marina": "https://maps.app.goo.gl/2cNUHqhBYXmWD8By9",
  "Píer do Centro": "https://maps.app.goo.gl/ZBat1GF7X6DfnJ9W7",
  "Píer Porto da Barra": "https://maps.app.goo.gl/EEHSdyrpAcoogHULA",
  "Azul Marina": "https://maps.app.goo.gl/92BjzPAprjhsMJxm6",
};
// taxa de embarque dos píeres particulares, paga pelo cliente direto no local (BR Marina, Azul Marina, Píer do Centro e Píer Porto da Barra não cobram)
const TAXA: Record<string, [string, number]> = { "Porto Veleiro (Praia dos Ossos)": ["Porto Veleiro", 10], "Píer do Golfinho (Praia dos Ossos)": ["Píer do Golfinho", 5] };
const TAXA_TXT: Record<string, (l: string, v: number) => string> = {
  pt: (l, v) => `Por ser um píer privativo, o ${l} cobra uma pequena taxa de embarque de R$ ${v} por pessoa, paga direto no local.`,
  en: (l, v) => `Because it is a private pier, ${l} charges a small boarding fee of R$ ${v} per person, paid directly there.`,
  es: (l, v) => `Por ser un muelle privado, ${l} cobra una pequeña tasa de embarque de R$ ${v} por persona, que se paga directamente allí.`,
};
const taxa = (e: string, lang: string) => TAXA[e] ? (TAXA_TXT[lang] || TAXA_TXT.pt)(TAXA[e][0], TAXA[e][1]) : "";
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ erro: "login" }, 401);
    const { bid, lang: l0 } = await req.json().catch(() => ({}));
    let lang = ["pt", "en", "es"].includes(l0) ? l0 : "pt";
    const { data: b } = await db.from("bloqueios").select("id, lancha, data, horario").eq("id", bid).maybeSingle();
    if (!b) return json({ erro: "passeio" }, 404);
    const admin = !!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data;
    const dono = !!(await db.from("donos").select("user_id").eq("user_id", uid).eq("lancha", b.lancha).maybeSingle()).data;
    if (!admin && !dono) return json({ erro: "só o administrador ou o dono" }, 403);
    const { data: c } = await db.from("convites").select("email, nome, resgatado_em").eq("bloqueio_id", b.id).maybeSingle();
    if (!c?.email || c.resgatado_em) return json({ status: "sem_email" });
    const { data: an } = await db.from("anotacoes").select("pessoas, embarque, hora_ini, hora_fim, telefone").eq("bloqueio_id", b.id).maybeSingle();
    // o e-mail vai no idioma do cliente, pelo DDI do WhatsApp dele, não no de quem cadastrou o passeio (Rodrigo, 2026-10-22)
    const cc = String(an?.telefone || "").match(/^\s*\+(\d{1,3})\b/)?.[1];
    if (cc) lang = cc === "55" ? "pt" : ES_DDI.includes(cc) ? "es" : "en";
    const nomeL = (await db.from("lanchas").select("nome").eq("slug", b.lancha).maybeSingle()).data?.nome || b.lancha;
    // cupom do dono para quem avaliar depois do passeio (Rodrigo 2026-10-27): sempre o valor de agora
    const cupV = Number((await db.from("cupom_dono").select("valor").eq("lancha", b.lancha).maybeSingle()).data?.valor) || 0;
    const dados = {
      convite: true, lang, assunto: { pt: `Seu passeio na ${nomeL} · ${dataBR(b.data)}`, en: `Your tour on ${nomeL} · ${dataBR(b.data)}`, es: `Tu paseo en ${nomeL} · ${dataBR(b.data)}` }[lang as "pt"], // assunto com o motivo (Rodrigo 2026-10-22)
      nome: c.nome || "", primeiro: (c.nome || "").split(" ")[0] || "",
      lancha: nomeL, data: dataBR(b.data), horario: an?.hora_ini && an?.hora_fim ? `${(SLOT[lang][b.horario] || b.horario).replace(/ \(.*$/, "")} (${hm(an.hora_ini, lang)} ${LIGA[lang]} ${hm(an.hora_fim, lang)})` : SLOT[lang][b.horario] || b.horario,
      pessoas: an?.pessoas ? String(an.pessoas) : "", embarque: an?.embarque ? an.embarque + (MAPA[an.embarque] ? ` · ${{ pt: "Localização", en: "Location", es: "Ubicación" }[lang] || "Localização"}: ${MAPA[an.embarque]}` : "") + (TAXA[an.embarque] ? ` · ${taxa(an.embarque, lang)}` : "") : "",
      cupom: cupV > 0 ? ({ pt: "desconto", en: "discount", es: "descuento" } as Record<string, string>)[lang] || "desconto" : "", // sem o valor antes de ganhar (Rodrigo 2026-10-30); o modelo do e-mail diz "cupom de {{cupom}}"
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
