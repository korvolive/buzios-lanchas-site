// Búzios Lanchas: alertas AUTOMÁTICOS de mau tempo no chat da equipe (Rodrigo 2026-10-24).
// A cada 20 min (pg_cron "clima-alertas") lê os avisos oficiais da Marinha (avisos de mau tempo para navegação)
// e do INMET (avisos meteorológicos) e só passa os que pegam Armação dos Búzios:
//  - Marinha: área costeira cujo trecho inclui Búzios (de Arraial do Cabo/Cabo Frio a Rio das Ostras), área oceânica
//    que contém Búzios, ou texto que cita Búzios / Cabo Frio / Arraial do Cabo. E só os FORTES (Rodrigo 2026-10-24):
//    vento força 8+ (muito forte, duro, tempestuoso...), mar muito grosso ou pior, e ressaca. "Vento forte" (força 7)
//    e "mar grosso" ficam de fora: o aviso cobre até 300 milhas e nas enseadas de Búzios muitas vezes ainda dá para sair.
//  - INMET: município 3300233 (Armação dos Búzios) e só nível "Grande Perigo". Rodrigo: só avisar o que impede de sair
//    com a lancha ("Perigo" e "Perigo Potencial" ficam de fora). Calor, frio, geada e umidade baixa também ficam de fora.
// Cada aviso entra UMA vez (tabela clima_avisos) como mensagem da própria Búzios Lanchas (autor vazio, tipo 'auto'):
// texto = resumo em português (apps antigos mostram só isso), local = JSON com título/texto em PT/EN/ES e a validade.
// Toda a equipe recebe no celular. Sem login (a chamada só lê fontes públicas e não repete aviso).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const MARINHA = "https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo";
const INMET = "https://apiprevmet3.inmet.gov.br/avisos/ativos";
const BUZIOS = { lat: -22.75, lon: -41.88, ibge: "3300233" };

// litoral em ordem (sul -> norte); Búzios = 25. Trecho costeiro vale se cobre 24.5..25.5
const COSTA: [string, number][] = [["CHUI", 0], ["RIO GRANDE", 1], ["MOSTARDAS", 2], ["TRAMANDAI", 3], ["TORRES", 4], ["CABO DE SANTA MARTA", 5], ["LAGUNA", 5],
  ["FLORIANOPOLIS", 6], ["ITAJAI", 7], ["SAO FRANCISCO DO SUL", 8], ["PARANAGUA", 9], ["CANANEIA", 10], ["IGUAPE", 11], ["PERUIBE", 11.5], ["SANTOS", 12],
  ["SAO SEBASTIAO", 13], ["ILHABELA", 13], ["UBATUBA", 14], ["PARATY", 15], ["PARATI", 15], ["ANGRA DOS REIS", 16], ["ILHA GRANDE", 16.5], ["GUARATIBA", 17],
  ["RIO DE JANEIRO", 18], ["NITEROI", 18], ["MARICA", 19], ["SAQUAREMA", 20], ["ARRAIAL DO CABO", 24.5], ["CABO FRIO", 24.5], ["BUZIOS", 25],
  ["RIO DAS OSTRAS", 26], ["MACAE", 27], ["CABO DE SAO TOME", 28], ["SAO JOAO DA BARRA", 29], ["ITAPEMIRIM", 30], ["GUARAPARI", 31], ["VITORIA", 32],
  ["REGENCIA", 33], ["SAO MATEUS", 34], ["CONCEICAO DA BARRA", 34.5], ["CARAVELAS", 35], ["PORTO SEGURO", 36], ["ILHEUS", 37], ["SALVADOR", 38],
  ["ARACAJU", 40], ["MACEIO", 41], ["RECIFE", 42], ["CABEDELO", 42.5], ["NATAL", 43], ["FORTALEZA", 45], ["SAO LUIS", 47], ["SALINOPOLIS", 48],
  ["BELEM", 48.5], ["CABO ORANGE", 50], ["OIAPOQUE", 50]].sort((a, b) => b[0].length - a[0].length) as [string, number][];
const sem = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const pos = (nome: string) => { const n = sem(nome); return COSTA.find(([k]) => n.includes(k))?.[1]; };

function dentro(pts: [number, number][], x: number, y: number) { // ponto no polígono (lon, lat)
  let d = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function pegaBuzios(txt: string) {
  const t = sem(txt);
  if (/BUZIOS|CABO FRIO|ARRAIAL DO CABO/.test(t)) return true;
  const oc = t.match(/AREA OCEANICA ENTRE (.+?) A PARTIR/);
  if (oc) {
    const pts = [...oc[1].matchAll(/(\d+(?:\.\d+)?)S0?(\d+(?:\.\d+)?)W/g)].map(m => [-+m[2], -+m[1]] as [number, number]);
    return pts.length >= 3 && dentro(pts, BUZIOS.lon, BUZIOS.lat);
  }
  const co = t.match(/ENTRE ([A-Z .'\/-]+?) E ([A-Z .'\/-]+?)(?: ATE| A PARTIR|,|\.)/);
  if (co) {
    const a = pos(co[1]), b = pos(co[2]);
    if (a == null || b == null) { console.log("lugar desconhecido", co[1], "|", co[2]); return false; }
    return Math.min(a, b) <= 25.5 && Math.max(a, b) >= 24.5;
  }
  return /AREA CHARLIE/.test(t) && !/ENTRE/.test(t);
}

const limpa = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const titulo = (s: string) => s.toLowerCase().replace(/^./, c => c.toUpperCase());

async function traduz(q: string, to: string) {
  try {
    const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=${to}&dt=t&q=${encodeURIComponent(q)}`);
    if (!r.ok) return q;
    return ((await r.json())[0] as [string][]).map(p => p[0]).join("") || q;
  } catch { return q; }
}

const lidos = { marinha: 0, inmet: 0 }; // quantos avisos cada fonte tem ao todo (para conferir com ?ver)
type Aviso = { chave: string; fonte: "marinha" | "inmet"; tit: string; txt: string; tit_en?: string; txt_en?: string; ini?: string; fim?: string; nivel?: string };

const FORTE = /MUITO|DURO|TEMPESTUOS|FURAC|VIOLENT|RESSACA/; // tipo do aviso da Marinha que impede sair
async function marinha(): Promise<Aviso[]> {
  const r = await fetch(MARINHA, { headers: { "user-agent": "Mozilla/5.0 (BuziosLanchas alertas)" } });
  if (!r.ok) throw new Error("marinha " + r.status);
  const html = await r.text(), por: Record<string, string[]> = {}, datas: Record<string, [string, string]> = {};
  for (const m of html.matchAll(/<div class="aviso-texto" data-numero="([^"]+)" data-inicio-utc="([^"]*)" data-fim-utc="([^"]*)">([\s\S]*?)<\/div>/g)) {
    (por[m[1]] ||= []).push(limpa(m[4])); datas[m[1]] = [m[2], m[3]];
  }
  const out: Aviso[] = [];
  lidos.marinha = Object.keys(por).length;
  for (const [num, [pt, en]] of Object.entries(por)) {
    if (!pt || !pegaBuzios(pt)) continue;
    const tp = sem(pt.match(/AVISO DE (.+?) EMITIDO/)?.[1] || "");
    if (!FORTE.test(tp)) continue;
    const fim = datas[num][1];
    if (fim && new Date(fim).getTime() < Date.now()) continue;
    const tipo = pt.match(/(AVISO DE .+?) EMITIDO/)?.[1] || "AVISO DE MAU TEMPO";
    const corpo = (pt.match(/EMITIDO .+?\/\d{4}\s+(.+?)\s*VÁLIDO/)?.[1] || pt).replace(/ A PARTIR DE \d{6}Z/, "");
    const tipoEn = en?.match(/NR \S+ (.+?) ISSUED/)?.[1];
    const corpoEn = en?.match(/ISSUED AT .+? \d{4}\s+(.+?)\s*VALID/)?.[1]?.replace(/ STARTING AT \d{6}Z/, "");
    out.push({ chave: "marinha-" + num, fonte: "marinha", tit: titulo(tipo) + ` (nº ${num})`, txt: corpo,
      tit_en: tipoEn ? titulo(tipoEn) + ` (no. ${num})` : undefined, txt_en: corpoEn, ini: datas[num][0] || undefined, fim: fim || undefined });
  }
  return out;
}

const FORA = /UMIDADE|CALOR|GEADA|FRIO|DECLINIO|TEMPERATURA/;
async function inmet(): Promise<Aviso[]> {
  const r = await fetch(INMET, { headers: { "user-agent": "Mozilla/5.0 (BuziosLanchas alertas)" } });
  if (!r.ok) throw new Error("inmet " + r.status);
  const j = await r.json(), out: Aviso[] = [];
  lidos.inmet = (j.hoje || []).length + (j.futuro || []).length;
  for (const a of [...(j.hoje || []), ...(j.futuro || [])]) {
    if (!String(a.geocodes || "").split(",").map((s: string) => s.trim()).includes(BUZIOS.ibge)) continue;
    const sev = String(a.severidade || "");
    if (sev !== "Grande Perigo" || FORA.test(sem(String(a.descricao || ""))) || a.encerrado) continue;
    const br = (s: string) => s ? new Date(s.replace(" ", "T") + ":00-03:00").toISOString() : undefined;
    const fim = br(a.fim);
    if (fim && new Date(fim).getTime() < Date.now()) continue;
    const riscos = (a.riscos || []).join(" ").trim(), instr = (a.instrucoes || []).slice(0, 3).join(" ").trim();
    out.push({ chave: "inmet-" + (a.id_aviso || a.id), fonte: "inmet", nivel: sev, tit: `${a.descricao} · ${sev}`,
      txt: [riscos, instr].filter(Boolean).join(" ").slice(0, 700), ini: br(a.inicio), fim });
  }
  return out;
}

const PUSH: Record<string, Record<string, string>> = {
  pt: { marinha: "Aviso da Marinha", inmet: "Alerta do INMET" },
  en: { marinha: "Brazilian Navy warning", inmet: "INMET weather alert" },
  es: { marinha: "Aviso de la Marina", inmet: "Alerta del INMET" },
};

Deno.serve(async req => {
  try {
    const avisos: Aviso[] = [], erros: string[] = [];
    for (const f of [marinha, inmet]) { try { avisos.push(...await f()); } catch (e) { erros.push(String(e)); console.error(String(e)); } }
    if (new URL(req.url).searchParams.has("ver")) return json({ lidos, avisos, erros }); // só olhar, sem gravar nem avisar
    if (!avisos.length) return json({ novos: 0 });
    const { data: novos } = await db.from("clima_avisos").upsert(avisos.map(a => ({ chave: a.chave })), { onConflict: "chave", ignoreDuplicates: true }).select("chave");
    const nov = new Set(((novos || []) as any[]).map(x => x.chave));
    let enviados = 0;
    for (const a of avisos.filter(a => nov.has(a.chave))) {
      const tit = { pt: a.tit, en: a.tit_en || await traduz(a.tit, "en"), es: await traduz(a.tit, "es") };
      const txt = { pt: a.txt, en: a.txt_en || await traduz(a.txt, "en"), es: await traduz(a.txt, "es") };
      const dados = { fonte: a.fonte, nivel: a.nivel, tit, txt, ini: a.ini, fim: a.fim, url: a.fonte === "marinha" ? MARINHA : "https://alertas2.inmet.gov.br/" };
      const { data: m, error } = await db.from("equipe_msgs").insert({ autor: null, tipo: "auto", categoria: a.fonte, texto: `⚠️ ${PUSH.pt[a.fonte]}: ${a.tit}. ${a.txt}`.slice(0, 1000), local: JSON.stringify(dados), avisado_em: new Date().toISOString() }).select("id").single();
      if (error) { console.error("insert", error.message); continue; }
      await db.from("clima_avisos").update({ msg: m.id }).eq("chave", a.chave);
      enviados += await avisar(m.id, a.fonte, tit, txt);
      console.log("aviso", a.chave, "msg", m.id);
    }
    return json({ avisos: avisos.length, novos: nov.size, enviados });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});

async function avisar(id: number, fonte: string, tit: Record<string, string>, txt: Record<string, string>) {
  const { data: ids } = await db.rpc("_eq_membros");
  const users = ((ids || []) as any[]).map(x => typeof x === "string" ? x : Object.values(x)[0] as string).filter(Boolean);
  const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (!k || !users.length) return 0;
  webpush.setVapidDetails("mailto:korvolive@gmail.com", k.publica, k.privada);
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", users);
  let n = 0;
  await Promise.all((subs || []).map(async s => {
    const L = PUSH[s.lang] ? s.lang : "pt";
    const m = { title: `⚠️ ${PUSH[L][fonte]} · Búzios`, body: `${tit[L]}. ${txt[L]}`.slice(0, 200), url: "/login/?equipe=1", tag: `clima-${id}` };
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(m), { TTL: 6 * 3600, urgency: "high" });
      n++;
    } catch (e: any) {
      console.error("push falhou", e?.statusCode, e?.body || String(e));
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }));
  return n;
}
