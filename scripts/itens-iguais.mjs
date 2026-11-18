// Confere que os nomes curtos (ITEM_SHORT) e os itens dourados são os mesmos no site e no app
// (Rodrigo 2026-11-18: mudou em um, tem que mudar no outro).
import fs from "node:fs";
const pega = (arq, nome) => { const m = fs.readFileSync(arq, "utf8").match(new RegExp(`const ${nome} = (.*?);(?:\\s*/\\*|\\n)`)); if(!m) throw new Error(`${nome} não achado em ${arq}`); return JSON.stringify(JSON.parse(m[1])); };
const erros = [];
if (pega("index.html","ITEM_SHORT") !== pega("login/index.html","ITEM_SHORT")) erros.push("ITEM_SHORT diferente entre index.html e login/index.html");
if (pega("index.html","STACK_GOLD") !== pega("login/index.html","GOLD_ITEMS")) erros.push("STACK_GOLD (site) diferente de GOLD_ITEMS (app)");
if (erros.length) { console.error(erros.join("\n")); process.exit(1); }
console.log("Nomes e dourados dos itens iguais no site e no app.");
