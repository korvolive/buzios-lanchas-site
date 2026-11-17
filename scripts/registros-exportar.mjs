// Exporta, uma vez por dia, os registros da plataforma Supabase para o cofre privado "registros-seguranca",
// guardados por 5 anos (avaliação de segurança Asaas, 16/11/2026). Cada arquivo ganha SHA-256 encadeado
// na tabela só de inclusão public.registros_exportados (cadeia = sha256(cadeia_anterior + sha256_do_arquivo)).
// Roda no GitHub (.github/workflows/registros-exportar.yml). Não imprime conteúdo dos registros.
//
// Variáveis: SUPABASE_ACCESS_TOKEN (obrigatória), PROJECT_REF, DIAS ("2026-11-16 2026-11-15"; vazio = dias que faltam, até 6 dias atrás).

import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.PROJECT_REF || "sqoperylsqcbcjpcrlnp";
const API = `https://api.supabase.com/v1/projects/${REF}`;
const BUCKET = "registros-seguranca";
const PAGINA = 1000;
const TESTE = process.env.TESTE_FETCH ? (await import(process.env.TESTE_FETCH)).default : null; // só para teste local

if (!TOKEN && !TESTE) { console.error("Falta SUPABASE_ACCESS_TOKEN"); process.exit(1); }

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const _fetch = TESTE || fetch;

async function chamar(url, opts = {}, tentativas = 5) {
  for (let i = 0; ; i++) {
    const r = await _fetch(url, opts);
    if (r.status === 429 || r.status >= 500) {
      if (i >= tentativas) throw new Error(`HTTP ${r.status} em ${url.split("?")[0]}`);
      await dormir(2000 * (i + 1));
      continue;
    }
    return r;
  }
}

async function api(caminho, opts = {}) {
  const r = await chamar(API + caminho, { ...opts, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${caminho.split("?")[0]}: ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}

const sql = (query) => api("/database/query", { method: "POST", body: JSON.stringify({ query }) });
const lit = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);

async function logs(consulta, ini, fim) {
  const q = new URLSearchParams({ sql: consulta, iso_timestamp_start: ini, iso_timestamp_end: fim });
  const j = await api(`/analytics/endpoints/logs?${q}`);
  if (j && j.error) throw new Error(`consulta de registros falhou: ${JSON.stringify(j.error).slice(0, 300)}`);
  await dormir(400);
  return (j && (j.result || j.data)) || [];
}

const A = (k) => `log_attributes['${k}']`;

// Cada fonte: filtro, colunas e ordem (a ordem inclui todas as chaves, para a paginação não pular nem repetir linhas).
const FONTES = {
  // acessos às APIs do site, painel e app, agrupados por hora, caminho, IP e usuário
  "api-acessos": {
    agrupado: true,
    corpo: `select toStartOfHour(timestamp) hora, ${A("request.method")} metodo, ${A("response.status_code")} status,
      ${A("request.path")} caminho, ${A("request.headers.cf_connecting_ip")} ip,
      ${A("request.sb.jwt.authorization.payload.subject")} usuario, ${A("request.sb.jwt.authorization.payload.role")} papel,
      ${A("request.cf.country")} pais, any(${A("request.headers.user_agent")}) aparelho, count() vezes
      from logs where source = 'edge_logs'
      group by hora, metodo, status, caminho, ip, usuario, papel, pais`,
    ordem: "hora, caminho, ip, usuario, metodo, status, papel, pais",
  },
  // login e sessões (servidor de autenticação), um por linha
  login: {
    corpo: `select timestamp, id, ${A("level")} nivel, ${A("msg")} msg, ${A("method")} metodo, ${A("path")} caminho,
      ${A("status")} status, ${A("remote_addr")} ip, ${A("referer")} origem
      from logs where source = 'auth_logs'`,
    ordem: "timestamp, id",
  },
  // trilha de auditoria do login (entrou, saiu, trocou senha, convite...)
  "login-auditoria": {
    corpo: `select timestamp, id, ${A("auth_audit_event.action")} acao, ${A("auth_audit_event.actor_id")} usuario,
      ${A("auth_audit_event.actor_username")} login, ${A("auth_audit_event.log_type")} tipo
      from logs where source = 'auth_audit_logs'`,
    ordem: "timestamp, id",
  },
  // chamadas às funções do servidor (Asaas, PayPal, WhatsApp...), um por linha
  funcoes: {
    corpo: `select timestamp, id, ${A("request.method")} metodo, ${A("response.status_code")} status, ${A("request.pathname")} caminho,
      ${A("request.headers.cf_connecting_ip")} ip, ${A("request.headers.user_agent")} aparelho, ${A("request.cf.country")} pais,
      ${A("execution_time_ms")} ms
      from logs where source = 'function_edge_logs'`,
    ordem: "timestamp, id",
  },
  // erros graves do banco (falha de autenticação, permissão negada). Sem textos de rotinas, que podem ter chaves.
  "banco-erros": {
    corpo: `select timestamp, id, ${A("parsed.error_severity")} gravidade, substring(event_message, 1, 300) msg
      from logs where source = 'postgres_logs'
        and (${A("parsed.error_severity")} in ('FATAL', 'PANIC')
             or (${A("parsed.error_severity")} = 'ERROR' and event_message ilike '%permission denied%'))
        and event_message not ilike '%http_post%' and event_message not ilike '%x-chave%'`,
    ordem: "timestamp, id",
  },
};

async function exportarFonte(nome, f, ini, fim) {
  const tot = await logs(`select count() c from (${f.corpo})`, ini, fim);
  const total = Number(tot[0]?.c ?? tot[0]?.["count()"] ?? 0);
  const linhas = [];
  while (linhas.length < total) {
    const pag = await logs(`${f.corpo} order by ${f.ordem} limit ${PAGINA} offset ${linhas.length}`, ini, fim);
    if (!pag.length) break;
    for (const l of pag) linhas.push(JSON.stringify(l));
  }
  if (linhas.length !== total) throw new Error(`${nome}: esperava ${total} linhas e veio ${linhas.length}`);
  return linhas;
}

let CHAVE = null;
async function chaveServidor() {
  if (CHAVE) return CHAVE;
  const ks = await api("/api-keys?reveal=true");
  const k = ks.find((x) => x.name === "service_role" && x.api_key) || ks.find((x) => x.type === "secret" && x.api_key);
  if (!k) throw new Error("não achei chave de servidor");
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${k.api_key}`);
  CHAVE = k.api_key;
  return CHAVE;
}

async function storage(metodo, caminho, corpo) {
  const k = await chaveServidor();
  const h = { apikey: k };
  if (!k.startsWith("sb_")) h.Authorization = `Bearer ${k}`;
  if (corpo) { h["Content-Type"] = "application/gzip"; h["x-upsert"] = "false"; }
  return chamar(`https://${REF}.supabase.co/storage/v1/object/${BUCKET}/${caminho}`, { method: metodo, headers: h, body: corpo });
}

async function gravar(dia, nome, linhas) {
  const arquivo = `${dia.slice(0, 4)}/${dia.slice(5, 7)}/${dia}_${nome}.jsonl.gz`;
  let dados = gzipSync(Buffer.from(linhas.join("\n") + (linhas.length ? "\n" : "")), { level: 9 });
  const r = await storage("POST", arquivo, dados);
  if (!r.ok) {
    const t = await r.text();
    // já gravado numa rodada anterior que caiu antes de registrar: usa o arquivo que está no cofre
    if (r.status === 409 || /already exists|Duplicate/i.test(t)) {
      const b = await storage("GET", arquivo);
      if (!b.ok) throw new Error(`${arquivo}: existe mas não consegui ler (HTTP ${b.status})`);
      dados = Buffer.from(await b.arrayBuffer());
    } else throw new Error(`${arquivo}: envio falhou (HTTP ${r.status}) ${t.slice(0, 200)}`);
  }
  const sha = createHash("sha256").update(dados).digest("hex");
  const ult = await sql("select cadeia from public.registros_exportados order by id desc limit 1");
  const anterior = ult?.[0]?.cadeia || null;
  const cadeia = createHash("sha256").update((anterior || "") + sha).digest("hex");
  await sql(`insert into public.registros_exportados (dia, fonte, arquivo, linhas, bytes, sha256, cadeia_anterior, cadeia)
    values (${lit(dia)}, ${lit(nome)}, ${lit(arquivo)}, ${linhas.length}, ${dados.length}, ${lit(sha)}, ${lit(anterior)}, ${lit(cadeia)})
    on conflict (dia, fonte) do nothing`);
  console.log(`OK ${dia} ${nome}: ${linhas.length} linhas, ${dados.length} bytes`);
}

function diasPendentes(feitos) {
  const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
  const out = [];
  for (let i = 6; i >= 1; i--) {
    const d = new Date(hoje.getTime() - i * 86400000).toISOString().slice(0, 10);
    out.push(d);
  }
  return out.filter((d) => Object.keys(FONTES).some((f) => !feitos.has(`${d}|${f}`)));
}

const feitosRows = await sql("select dia::text dia, fonte from public.registros_exportados where dia >= current_date - 7");
const feitos = new Set((feitosRows || []).map((r) => `${r.dia}|${r.fonte}`));
const dias = (process.env.DIAS || "").trim() ? process.env.DIAS.trim().split(/\s+/) : diasPendentes(feitos);
let falhas = 0;
for (const dia of dias) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error(`dia inválido: ${dia}`);
  const ini = `${dia}T00:00:00.000Z`;
  const fim = new Date(Date.parse(ini) + 86400000).toISOString();
  for (const [nome, f] of Object.entries(FONTES)) {
    if (feitos.has(`${dia}|${nome}`)) continue;
    try {
      await gravar(dia, nome, await exportarFonte(nome, f, ini, fim));
    } catch (e) {
      falhas++;
      console.log(`::error::${dia} ${nome}: ${e.message}`);
    }
  }
}
console.log(dias.length ? `Dias: ${dias.join(", ")}. Falhas: ${falhas}.` : "Nada pendente.");
if (falhas) process.exit(1);
