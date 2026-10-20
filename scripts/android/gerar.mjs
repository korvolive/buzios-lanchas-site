// Gera o projeto Android (TWA) do app Búzios Lanchas a partir do manifest do site.
// Uso: node scripts/android/gerar.mjs <pasta-de-saída> <versionCode>
// O ícone é baixado do site no ar (ICON_BASE muda isso para testar localmente).
import fs from "node:fs";
import { TwaManifest, TwaGenerator, ConsoleLog } from "@bubblewrap/core";

const HOST = "www.lanchaembuzios.com.br";
const out = process.argv[2] || "build-android", code = +(process.argv[3] || 1);
const web = JSON.parse(fs.readFileSync(new URL("../../manifest.webmanifest", import.meta.url), "utf8"));
const m = TwaManifest.fromWebManifestJson(new URL(`https://${HOST}/manifest.webmanifest`), web);
const base = process.env.ICON_BASE;
if (base) { for (const k of ["iconUrl", "maskableIconUrl", "monochromeIconUrl"]) if (m[k]) m[k] = m[k].replace(`https://${HOST}`, base); }
Object.assign(m, {
  packageId: "br.com.lanchaembuzios.app",
  name: "Búzios Lanchas",
  launcherName: "Búzios Lanchas",
  enableNotifications: true,
  appVersionCode: code,
  appVersionName: `1.0.${code}`,
  signingKey: { path: "upload.jks", alias: "upload" },
  navigationColor: m.themeColor,
  navigationColorDark: m.themeColor,
  fallbackType: "customtabs",
});
fs.rmSync(out, { recursive: true, force: true });
await new TwaGenerator().createTwaProject(out, m, new ConsoleLog("gerar"));
fs.writeFileSync(`${out}/twa-manifest.json`, JSON.stringify(m.toJson(), null, 2));
console.log("projeto Android gerado em", out, "versão", m.appVersionName);
