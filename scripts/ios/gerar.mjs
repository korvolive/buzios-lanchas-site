// Prepara o projeto iOS (Capacitor) do app Búzios Lanchas, que abre www.lanchaembuzios.com.br.
// Uso: node scripts/ios/gerar.mjs <pasta-de-saída>
// Depois o workflow ios.yml roda "npm install" e "npx cap add ios" dentro da pasta (precisa de Mac).
import fs from "node:fs";

const HOST = "www.lanchaembuzios.com.br";
const out = process.argv[2] || "build-ios";
const web = JSON.parse(fs.readFileSync(new URL("../../manifest.webmanifest", import.meta.url), "utf8"));
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(`${out}/www`, { recursive: true });
fs.writeFileSync(`${out}/package.json`, JSON.stringify({
  name: "buzios-lanchas-ios", private: true,
  dependencies: { "@capacitor/cli": "^7.4.0", "@capacitor/core": "^7.4.0", "@capacitor/ios": "^7.4.0" },
}, null, 2));
fs.writeFileSync(`${out}/capacitor.config.json`, JSON.stringify({
  appId: "br.com.lanchaembuzios.app",
  appName: "Buzios Lanchas", // nome na tela do iPhone sem acento (regra do Rodrigo)
  webDir: "www",
  appendUserAgent: "BuziosLanchasIOS",
  backgroundColor: web.background_color,
  server: { url: `https://${HOST}${web.start_url}`, allowNavigation: ["lanchaembuzios.com.br", "*.lanchaembuzios.com.br"] },
  ios: { contentInset: "never", backgroundColor: web.background_color },
}, null, 2));
// Só aparece se o site não abrir (sem internet).
fs.writeFileSync(`${out}/www/index.html`, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:${web.background_color};color:#fff;font:17px -apple-system,sans-serif;text-align:center;padding:24px;box-sizing:border-box">
<div><p>Sem conexão com a internet.<br>No internet connection.<br>Sin conexión a internet.</p>
<p><a href="https://${HOST}${web.start_url}" style="color:#7fd3e8">Tentar de novo · Try again · Reintentar</a></p></div>`);
console.log("projeto iOS preparado em", out);
