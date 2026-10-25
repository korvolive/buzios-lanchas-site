/* Verificação automática (a cada 10 minutos, pelo GitHub): as lanchas cadastradas no app mudaram desde a última publicação?
   Compara o banco com o lanchas-db.json que a última publicação deixou no site. Escreve "mudou=true" ou "mudou=false"
   em $GITHUB_OUTPUT. Sem resposta do banco, não publica (tenta de novo na próxima vez). */
import fs from "node:fs";
import crypto from "node:crypto";
import { lanchasDB } from "./lanchas-db.mjs";

const SOURCE = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const SITE = SOURCE.match(/const SITE = "([^"]+)"/)[1];
const DB = SOURCE.match(/const AGENDA_URL = "([^"]+)\/bloqueios"/)[1], KEY = SOURCE.match(/const AGENDA_KEY = "([^"]+)"/)[1];

let mudou = false;
const rows = await lanchasDB(DB, KEY);
if (rows) {
  const h = crypto.createHash("sha256").update(rows).digest("hex");
  const pub = await fetch(`${SITE}/lanchas-db.json?t=${Date.now()}`, { headers: { "cache-control": "no-cache" } })
    .then(r => (r.ok ? r.json() : null)).catch(() => null);
  /* site sem a marca: só publica se já existe alguma lancha cadastrada no app */
  mudou = pub ? pub.h !== h : JSON.parse(rows).length > 0;
  console.log(`banco ${h.slice(0, 12)} · site ${pub ? String(pub.h).slice(0, 12) : "sem marca"} → ${mudou ? "publicar" : "nada mudou"}`);
} else console.log("banco não respondeu: tenta na próxima verificação");
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `mudou=${mudou}\n`);
