/* Gera, antes de cada envio para a HostGator, uma página HTML pronta para cada
   endereço do site (início e cada lancha, em pt, en e es) e o sitemap.xml.
   Assim o Google e as prévias de link do WhatsApp leem o conteúdo e as
   etiquetas certas de cada página sem depender do JavaScript.
   Uso: node scripts/prerender.mjs  (precisa do pacote playwright) */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SOURCE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const SITE = SOURCE.match(/const SITE = "([^"]+)"/)[1];
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
/* fontes e outros endereços externos não são necessários para gerar o HTML */
await page.route("**/*", r => (r.request().url().startsWith(base) ? r.continue() : r.abort()));

const pages = [];
async function snap(l, slug) {
  const url = pathFor(l, slug);
  await page.goto(base + url, { waitUntil: "domcontentloaded" });
  const final = new URL(page.url()).pathname;
  if (final !== url) throw new Error(`${url} foi redirecionado para ${final}`);
  /* tira os scripts que o Google Tag Manager e o Meta Pixel acrescentam; eles são carregados de novo na visita */
  const html = "<!doctype html>\n" + (await page.evaluate(() => {
    document.querySelectorAll('script[src*="googletagmanager.com"],script[src*="connect.facebook.net"]').forEach(s => s.remove());
    return document.documentElement.outerHTML;
  }));
  if (!html.includes(`rel="canonical" href="${SITE}${url}"`)) throw new Error(`${url} sem canonical`);
  pages.push({ url, slug, html });
}
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
const slugs = await page.evaluate(() => BOATS.map(b => b.slug));
for (const slug of [null, ...slugs]) for (const l of LANGS) await snap(l, slug);
await browser.close();
server.close();

for (const p of pages) {
  const out = path.join(ROOT, p.url, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, p.html);
}

const today = new Date().toISOString().slice(0, 10);
const alt = slug => [["pt-BR", "pt"], ["en", "en"], ["es", "es"], ["x-default", "pt"]]
  .map(([hl, l]) => `    <xhtml:link rel="alternate" hreflang="${hl}" href="${SITE}${pathFor(l, slug)}"/>`).join("\n");
fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  pages.map(p => `  <url>\n    <loc>${SITE}${p.url}</loc>\n    <lastmod>${today}</lastmod>\n${alt(p.slug)}\n  </url>`).join("\n") +
  `\n</urlset>\n`);
console.log(`${pages.length} páginas e sitemap.xml gerados`);
