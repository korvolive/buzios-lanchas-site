/* Gera, antes de cada envio para a HostGator, uma página HTML pronta para cada
   endereço do site (início e cada lancha, em pt, en e es) e o sitemap.xml.
   Assim o Google e as prévias de link do WhatsApp leem o conteúdo e as
   etiquetas certas de cada página sem depender do JavaScript.
   Uso: node scripts/prerender.mjs  (precisa do pacote playwright) */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { lanchasDB, precosDB, fotosDB } from "./lanchas-db.mjs";
import { gerarPaginas, guiaPath } from "./paginas.mjs";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let SOURCE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const SITE = SOURCE.match(/const SITE = (?:CID \? CID\.site : )?"([^"]+)"/)[1];
/* lanchas cadastradas no app ficam no banco (Supabase): a página lê lanchas, fotos, valores e itens de lá */
const DB = SOURCE.match(/const AGENDA_URL = "([^"]+)\/bloqueios"/)[1], KEY = SOURCE.match(/const AGENDA_KEY = "([^"]+)"/)[1];
const DB_READ = new RegExp("^" + DB.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/(lanchas|fotos|precos|itens)\\?");
const LANGS = ["pt", "en", "es"];
const pathFor = (l, slug) => (l === "pt" ? "/" : `/${l}/`) + (slug ? `lancha/${slug}/` : "");
const TYPES = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4" };

/* servidor local: arquivos reais (fotos) ou o index.html original para qualquer página */
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(ROOT, p);
  if (file.startsWith(ROOT) && path.extname(p) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(SOURCE);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
await page.addInitScript(() => { window.PRERENDER = true; }); /* o site gera também a página da lancha oculta */
/* fontes e outros endereços externos não são necessários para gerar o HTML */
await page.route("**/*", r => (r.request().url().startsWith(base) || (r.request().method() === "GET" && DB_READ.test(r.request().url())) ? r.continue() : r.abort()));
const ready = () => page.waitForFunction(() => window.dbBoatsDone && window.precosDone && window.fotosDone, null, { timeout: 30000 })
  .then(() => page.waitForLoadState("networkidle", { timeout: 10000 })).catch(() => {});

const pages = [];
async function snap(l, slug) {
  const url = pathFor(l, slug);
  await page.goto(base + url, { waitUntil: "domcontentloaded" });
  const final = new URL(page.url()).pathname;
  if (final !== url) throw new Error(`${url} foi redirecionado para ${final}`);
  await ready();
  /* tira os scripts que o Google Tag Manager e o Meta Pixel acrescentam; eles são carregados de novo na visita */
  const html = "<!doctype html>\n" + (await page.evaluate(() => {
    /* lanchas do banco que ganharam página nesta publicação: o site só mostra estas (as novas entram na próxima) */
    document.documentElement.dataset.pub = [...BOATS, ...[...HIDDEN.values()].map(x => x.b)].filter(b => b.db).map(b => b.slug).join(",");
    document.documentElement.dataset.hide = HIDE_LIST.join(","); /* ocultas pelo administrador: a página existe, mas não aparece */
    /* dados do banco desta publicação: a visita já abre com eles e não precisa redesenhar a página quando o banco responde */
    const F = ["name", "feet", "capacity", "tagline", "description", "i18n", "boarding", "db", "prices", "prices7", "semFer", "pf", "pr", "pr7", "pc", "pc7", "cx", "cx7", "ds", "esp", "rx", "rx7", "photos"];
    const snapDB = BOATS.map(b => b.dbNew ? b : Object.fromEntries(F.filter(k => b[k] !== undefined).map(k => [k, b[k]]).concat([["slug", b.slug]])));
    const js = document.createElement("script"); js.type = "application/json"; js.id = "dbsnap";
    js.textContent = JSON.stringify(snapDB).replace(/</g, "\\u003c"); document.head.appendChild(js);
    if (route.slug && HIDE_LIST.includes(route.slug)) document.head.insertAdjacentHTML("beforeend", '<meta name="robots" content="noindex">');
    document.querySelectorAll('script[src*="googletagmanager.com"],script[src*="connect.facebook.net"]').forEach(s => s.remove());
    return document.documentElement.outerHTML;
  }));
  if (!html.includes(`rel="canonical" href="${SITE}${url}"`)) throw new Error(`${url} sem canonical`);
  pages.push({ url, slug, html });
}
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await ready();
const { slugs, dbSlugs, hidden, llm } = await page.evaluate(() => { const all = [...BOATS, ...[...HIDDEN.values()].map(x => x.b)];
  /* dados para o llms.txt (resumo do site para as IAs): só o que o site já mostra ao público */
  const txt = x => String(x || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  const llm = { boats: BOATS.filter(b => !b.example && !HIDE_LIST.includes(b.slug)).map(b => ({ slug: b.slug, name: b.name, feet: b.feet || null, cap: b.capacity || null, tag: txt(b.tagline),
      emb: [...new Set(Object.values(b.boarding || {}).flat())] })),
    faq: faqOf("pt").map(([q, a]) => [txt(q), txt(a)]), faqEn: faqOf("en").map(([q, a]) => [txt(q), txt(a)]), route: ROUTE.map(r => r[0]) };
  /* dados das páginas de roteiro e de grupos (scripts/paginas.mjs) */
  llm.guias = { piso4: pisoSite("4"), piso7: pisoSite("7"),
    boats: BOATS.filter(b => !b.example && !HIDE_LIST.includes(b.slug)).map(b => ({ slug: b.slug, name: b.name, feet: b.feet || null, cap: b.capacity || null,
      tag: Object.fromEntries(["pt", "en", "es"].map(l => [l, txt(b.i18n?.[l]?.tagline ?? b.tagline)])), img: b.photos?.[0] ? imgSrc(b.photos[0], "m") : "" })),
    route: ROUTE.map((r, i) => ({ name: r[0], desc: Object.fromEntries(["pt", "en", "es"].map(l => [l, UI[l].stops?.[i] || ""])),
      img: ROUTE_PHOTOS.includes(i + 1) ? `/img/rt-${String(i + 1).padStart(2, "0")}-m.webp` : "", credit: ROUTE_CREDITS[i] || null })) };
  return { slugs: all.map(b => b.slug), dbSlugs: all.filter(b => b.db).map(b => b.slug), hidden: HIDE_LIST, llm }; });
/* fotos do banco: cópia de 800 px para o celular (2026-11-09). Se falhar, a publicação segue com as originais */
try {
  const urls = await page.evaluate(() => [...new Set([...BOATS, ...[...HIDDEN.values()].map(x => x.b)].map(b => b.photos?.[0]?.[0]).filter(u => /^https?:/.test(u || "")))]);
  const M = JSON.parse(execFileSync("python3", ["-I", path.join(ROOT, "scripts/fotos-db.py"), path.join(ROOT, "img"), ...urls], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], timeout: 180000 }));
  if (!SOURCE.includes("const FOTO_M = {}; /*FOTO_M*/")) throw new Error("marcador FOTO_M não encontrado");
  SOURCE = SOURCE.replace("const FOTO_M = {}; /*FOTO_M*/", () => `const FOTO_M = ${JSON.stringify(M)};`);
  for (const b of llm.guias.boats) { const k = (b.img || "").replace(/\.jpg$/, ""); if (M[k]) b.img = M[k]; }
  console.log(`fotos do banco: ${Object.keys(M).length} de ${urls.length} com versão de celular`);
} catch (e) { console.error("fotos do banco: usando as originais:", e.message); }
/* enquadramento da galeria (2026-11-13): corte que mostra as pessoas inteiras (pés incluídos). Se falhar, a galeria fica centralizada */
try {
  const fotos = await page.evaluate(() => [...new Set([...BOATS, ...[...HIDDEN.values()].map(x => x.b)].flatMap(b => (b.photos || []).map(p => p[0])).filter(Boolean))]);
  const E = JSON.parse(execFileSync("python3", ["-I", path.join(ROOT, "scripts/enquadrar.py"), path.join(ROOT, "img"), ...fotos], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], timeout: 600000 }));
  if (!SOURCE.includes("const FOTO_P = {}; /*FOTO_P*/")) throw new Error("marcador FOTO_P não encontrado");
  SOURCE = SOURCE.replace("const FOTO_P = {}; /*FOTO_P*/", () => `const FOTO_P = ${JSON.stringify(E).replace(/</g, "\\u003c")};`);
  console.log(`enquadramento: ${Object.keys(E).length} de ${fotos.length} fotos com corte ajustado`);
} catch (e) { console.error("enquadramento: galeria centralizada:", e.message); }
for (const slug of [null, ...slugs]) for (const l of LANGS) await snap(l, slug);
await browser.close();
server.close();

for (const p of pages) {
  const out = path.join(ROOT, p.url, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, p.html);
}

const today = new Date().toISOString().slice(0, 10);
/* páginas de roteiro e de grupos/aniversários em pt, en e es */
const guias = gerarPaginas(ROOT, SITE, llm.guias);
const altG = g => [["pt-BR", "pt"], ["en", "en"], ["es", "es"], ["x-default", "pt"]]
  .map(([hl, l]) => `    <xhtml:link rel="alternate" hreflang="${hl}" href="${SITE}${guiaPath(g, l)}"/>`).join("\n");
const alt = slug => [["pt-BR", "pt"], ["en", "en"], ["es", "es"], ["x-default", "pt"]]
  .map(([hl, l]) => `    <xhtml:link rel="alternate" hreflang="${hl}" href="${SITE}${pathFor(l, slug)}"/>`).join("\n");
fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  pages.filter(p => !hidden.includes(p.slug)).map(p => `  <url>\n    <loc>${SITE}${p.url}</loc>\n    <lastmod>${today}</lastmod>\n${alt(p.slug)}\n  </url>`).join("\n") +
  "\n" + guias.map(p => `  <url>\n    <loc>${SITE}${p.url}</loc>\n    <lastmod>${today}</lastmod>\n${altG(p.g)}\n  </url>`).join("\n") +
  `\n</urlset>\n`);
/* llms.txt (2026-11-05): resumo do site em texto simples para ChatGPT, Claude, Perplexity e Gemini citarem a Búzios Lanchas com dados certos.
   Gerado a cada publicação a partir do próprio site, então fica sempre igual ao que está no ar */
const boatUrl = (l, slug) => SITE + pathFor(l, slug);
fs.writeFileSync(path.join(ROOT, "llms.txt"), [
  "# Búzios Lanchas",
  "",
  "> Aluguel de lancha em Búzios (Armação dos Búzios, RJ, Brasil): passeios privativos de 4 horas (10h às 14h ou 14h às 18h) e de 7 horas (10h às 17h), com marinheiro, combustível, gelo, carvão, água mineral, cooler e churrasqueira inclusos. O valor é por lancha, para o grupo todo. Reserva com sinal de 50% por Pix para a Búzios Lanchas (CNPJ 32.154.099/0001-72); o restante é pago no dia. Atendimento em português, inglês e espanhol.",
  "",
  `Site: ${SITE}/ · WhatsApp: +55 21 99927-2550 · Instagram: @missbardotbuzios · English: ${SITE}/en/ · Español: ${SITE}/es/`,
  "",
  "## Lanchas",
  "",
  ...llm.boats.map(b => `- [${b.name}](${boatUrl("pt", b.slug)}): ${[b.feet ? String(b.feet).replace(".", ",") + " pés" : "", b.cap ? "até " + b.cap + " pessoas" : ""].filter(Boolean).join(", ")}.${b.tag ? " " + b.tag : ""}${b.emb.length ? " Embarque: " + b.emb.join(" ou ") + "." : ""}`),
  "",
  "## Roteiro padrão",
  "",
  llm.route.join(", ") + ". O grupo escolhe como aproveitar: dá para ficar mais tempo em uma praia.",
  "",
  "## Guias",
  "",
  `- [Passeio de lancha em Búzios: roteiro e praias](${SITE}${guiaPath("roteiro", "pt")}) · [Boat tour in Búzios](${SITE}${guiaPath("roteiro", "en")}) · [Paseo en lancha en Búzios](${SITE}${guiaPath("roteiro", "es")})`,
  `- [Lancha para grupos e aniversários](${SITE}${guiaPath("grupos", "pt")}) · [Boat party for groups](${SITE}${guiaPath("grupos", "en")}) · [Lancha para grupos y cumpleaños](${SITE}${guiaPath("grupos", "es")})`,
  `- [Quanto custa alugar uma lancha em Búzios](${SITE}${guiaPath("precos", "pt")}) · [Boat rental prices in Búzios](${SITE}${guiaPath("precos", "en")}) · [Precio del alquiler de lancha en Búzios](${SITE}${guiaPath("precos", "es")})`,
  `- [Aluguel de lancha com marinheiro em Búzios](${SITE}${guiaPath("marinheiro", "pt")}) · [Boat rental with skipper](${SITE}${guiaPath("marinheiro", "en")}) · [Alquiler con marinero](${SITE}${guiaPath("marinheiro", "es")})`,
  `- [Melhores praias de Búzios de lancha](${SITE}${guiaPath("praias", "pt")}) · [Best beaches in Búzios by boat](${SITE}${guiaPath("praias", "en")}) · [Mejores playas de Búzios](${SITE}${guiaPath("praias", "es")})`,
  "",
  "## Perguntas frequentes",
  "",
  ...llm.faq.flatMap(([q, a]) => [`### ${q}`, "", a, ""]),
  "## FAQ (English)",
  "",
  ...llm.faqEn.flatMap(([q, a]) => [`### ${q}`, "", a, ""]),
].join("\n"));

/* marca do que foi publicado: a cada 10 minutos o GitHub compara com o banco e publica de novo se mudou (scripts/db-mudou.mjs) */
const rows = await lanchasDB(DB, KEY);
const ativas = rows ? JSON.parse(rows).filter(r => r.ativa && r.dados?.capacidade).map(r => r.slug).sort().join() : null;
const ok = rows && ativas === [...dbSlugs].sort().join();
fs.writeFileSync(path.join(ROOT, "lanchas-db.json"), JSON.stringify({ h: ok ? crypto.createHash("sha256").update(rows + (await precosDB(DB, KEY)) + (await fotosDB(DB, KEY))).digest("hex") : "erro", lanchas: dbSlugs }) + "\n");
console.log(`${pages.length} páginas, sitemap.xml e llms.txt gerados; lanchas do app: ${dbSlugs.join(", ") || "nenhuma"}${ok ? "" : " (banco não conferiu: publica de novo na próxima verificação)"}`);
