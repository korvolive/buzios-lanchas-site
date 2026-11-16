// Bordazul: cadastro do dono pela página bordazul.com.br/anunciar (Rodrigo, 2026-11-16).
// Sem login do site: o dono confirma o WhatsApp com um código e recebe um "token" do cadastro (vale 30 dias),
// que a página guarda e manda em cada pedido. Os dados ficam em bz_cadastros (sem política: só esta função lê e grava).
//
// POST { acao: "termo" }                                  -> { versao, aceites, assinatura }  (texto geral; o termo preenchido vem em "abrir")
// POST { acao: "enviar", tel, para: "entrar" }            -> { ok } | { erro: "tel" | "espere" | "nao_configurado" | "envio" }
// POST { acao: "enviar", token, para: "assinar" }         -> { ok } (código para assinar, no WhatsApp do cadastro)
// POST { acao: "confirmar", tel, codigo }                 -> { token, cadastro }  (abre o rascunho mais recente desse WhatsApp ou cria um)
// POST { acao: "abrir", token }                           -> { cadastro, termo, faixa }
// POST { acao: "novo", token }                            -> { cadastro }  (mais uma lancha do mesmo dono)
// POST { acao: "salvar", token, dados }                   -> { cadastro, faixa }
// POST { acao: "upload", token, tipo, ext }               -> { path, url, token_upload }  (link assinado para subir o arquivo direto no Storage)
// POST { acao: "arquivo_ok", token, path, tipo }          -> { cadastro }   (depois que o arquivo subiu)
// POST { acao: "remover", token, path }                   -> { cadastro }
// POST { acao: "assinar", token, codigo, nome, cpf, aceites } -> { cadastro } | { erro: "faltam", faltam: [...] } | { erro: "codigo" ...}
// POST { acao: "links", token }                           -> { links: { path: url } }  (ver as fotos e documentos já enviados)
// POST { acao: "admin_links", id }  + login de administrador -> { links }
// Segredos: WA_TOKEN, WA_PHONE_ID, WA_ATIVO=1 (os mesmos da whatsapp-codigo).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { ACEITES, ASSINATURA, termo, VERSAO } from "./termo.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const TOKEN = Deno.env.get("WA_TOKEN") || "", PHONE = Deno.env.get("WA_PHONE_ID") || "", TEMPLATE = Deno.env.get("WA_TEMPLATE") || "codigo_verificacao";
const ATIVO = !!(TOKEN && PHONE && Deno.env.get("WA_ATIVO") === "1");
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "bz-cadastros";
const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const VALIDO_MIN = 30;

const CIDADES: Record<string, string> = {
  buzios: "Búzios (RJ)", arraial: "Arraial do Cabo (RJ)", "cabo-frio": "Cabo Frio (RJ)", rio: "Rio de Janeiro (RJ)", angra: "Angra dos Reis (RJ)", paraty: "Paraty (RJ)",
  ilhabela: "Ilhabela (SP)", ubatuba: "Ubatuba (SP)", guaruja: "Guarujá (SP)", floripa: "Florianópolis (SC)", bombinhas: "Bombinhas (SC)", camboriu: "Balneário Camboriú (SC)",
  salvador: "Salvador (BA)", morro: "Morro de São Paulo (BA)", "porto-seguro": "Porto Seguro (BA)", maragogi: "Maragogi (AL)", "porto-galinhas": "Porto de Galinhas (PE)",
  noronha: "Fernando de Noronha (PE)", capitolio: "Capitólio (MG)", paranoa: "Lago Paranoá, Brasília (DF)", manaus: "Rio Negro, Manaus (AM)", outra: "Outra cidade",
};
const TIPOS = ["lancha", "veleiro", "catamara", "iate", "escuna", "jetski", "outro"];
const ITENS = ["banheiro", "ar", "som", "gerador", "geladeira", "churrasqueira", "tapete", "snorkel", "stand-up", "toldo", "cozinha", "cabine"];
const CATEG = ["arrais", "mestre", "capitao", "profissional"];
const ARQ_TIPOS: Record<string, number> = { tie: 3, dpem: 3, habilitacao: 3, foto: 15 };

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function codigoDe(s: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(CHAVE), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const b = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode("bz:" + s)));
  return String((b[0] * 16777216 + b[1] * 65536 + b[2] * 256 + b[3]) % 1000000).padStart(6, "0");
}
const telOk = (t: string) => (t.startsWith("55") ? t.length >= 12 && t.length <= 13 : t.length >= 10 && t.length <= 15);
const normTel = (t: string) => { const d = dig(t); return d.length === 10 || d.length === 11 ? "55" + d : d; };
function cpfValido(c: string) {
  if (c.length === 14) return /^\d{14}$/.test(c) && !/^(\d)\1+$/.test(c); /* CNPJ: confere só o formato */
  if (!/^\d{11}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10];
}

async function mandarCodigo(tel: string, contexto: string) {
  if (!ATIVO) return { erro: "nao_configurado", s: 503 };
  const { data: ok } = await db.rpc("bz_wa_reservar", { p_tel: tel });
  if (!ok) return { erro: "espere", s: 429 };
  const exp = Date.now() + VALIDO_MIN * 60000, cod = await codigoDe(`${contexto}:${tel}:${exp}`);
  const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE}/messages`, {
    method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: tel, type: "template", template: { name: TEMPLATE, language: { code: "pt_BR" },
      components: [{ type: "body", parameters: [{ type: "text", text: cod }] }, { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: cod }] }] } }),
  });
  if (!r.ok) { console.error("whatsapp", r.status, (await r.text()).slice(0, 300)); return { erro: "envio", s: 502 }; }
  await db.from("bz_wa_codigos").update({ cod_hash: await sha(`${contexto}:${tel}:${cod}`), expira_em: new Date(exp).toISOString(), tentativas: 0 }).eq("tel", tel);
  return { ok: true };
}
async function conferirCodigo(tel: string, contexto: string, codigo: string) {
  const { data } = await db.rpc("bz_wa_tentativa", { p_tel: tel });
  const w = Array.isArray(data) ? data[0] : data;
  if (!w) return "tentativas";
  if (!w.cod_hash || new Date(w.expira_em).getTime() < Date.now()) return "expirou";
  if ((await sha(`${contexto}:${tel}:${dig(codigo)}`)) !== w.cod_hash) return "codigo";
  await db.from("bz_wa_codigos").update({ cod_hash: null, tentativas: 5 }).eq("tel", tel);
  return "";
}

/* o que a página pode ver do cadastro (sem token nem hashes) */
function publico(c: any) {
  return { id: c.id, tel: c.tel, status: c.status, dados: c.dados, arquivos: c.arquivos, assinatura: c.assinatura ? { nome: c.assinatura.nome, em: c.assinatura.em, versao: c.assinatura.termo_versao, codigo: c.assinatura.doc_hash?.slice(0, 16) } : null,
    analise: c.analise ? { resultado: c.analise.resultado, itens: c.analise.itens } : null, decisao: c.decisao ? { acao: c.decisao.acao, motivo: c.decisao.motivo } : null };
}
async function faixa(d: any) {
  const pes = Number(String(d?.pes || "").replace(",", "."));
  if (!(pes > 5 && pes < 200)) return null;
  const { data } = await db.rpc("bz_faixa", { p_pes: pes });
  return data;
}
/* links temporários para ver os arquivos (a pasta é privada) */
async function links(arq: any[], seg: number) {
  const paths = arq.map(x => x.path).filter(Boolean);
  if (!paths.length) return {};
  const { data } = await db.storage.from(BUCKET).createSignedUrls(paths, seg);
  const o: Record<string, string> = {};
  for (const x of data || []) if (x.path && x.signedUrl) o[x.path] = x.signedUrl;
  return o;
}
async function porToken(token: string) {
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(token || "")) return null;
  const { data } = await db.from("bz_cadastros").select("*").eq("token_hash", await sha("tk:" + token)).maybeSingle();
  if (!data || (data.token_expira && new Date(data.token_expira).getTime() < Date.now())) return null;
  return data;
}

/* limpa o que veio da página: só campos conhecidos, textos curtos */
function limpa(d: any, antes: any) {
  const s = (x: unknown, n = 120) => String(x ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);
  const n = (x: unknown) => { const v = Math.round(Number(String(x ?? "").replace(/\./g, "").replace(",", "."))); return Number.isFinite(v) && v > 0 && v < 200000 ? v : null; };
  const o: any = { ...antes };
  const set = (k: string, v: unknown) => { if (d[k] !== undefined) o[k] = v; };
  set("nome_dono", s(d.nome_dono, 100)); set("doc_dono", dig(d.doc_dono).slice(0, 14)); set("email", s(d.email, 120).toLowerCase());
  set("nome_lancha", s(d.nome_lancha, 60)); set("tipo", TIPOS.includes(d.tipo) ? d.tipo : "lancha");
  if (d.cidade !== undefined) { o.cidade = CIDADES[d.cidade] ? d.cidade : "outra"; o.cidade_nome = o.cidade === "outra" ? s(d.cidade_outra, 60) : CIDADES[o.cidade]; o.cidade_outra = o.cidade === "outra" ? s(d.cidade_outra, 60) : ""; }
  set("embarque", s(d.embarque, 120)); set("pes", s(d.pes, 6).replace(/[^\d.,]/g, "")); set("cap", n(d.cap)); set("ano", n(d.ano)); set("modelo", s(d.modelo, 80));
  set("tie", s(d.tie, 40)); set("itens", Array.isArray(d.itens) ? d.itens.filter((x: string) => ITENS.includes(x)) : []);
  set("descricao", s(d.descricao, 1200)); set("marinheiro", s(d.marinheiro, 80)); set("categoria", CATEG.includes(d.categoria) ? d.categoria : "");
  for (const k of ["baixa", "baixa7", "alta", "alta7"]) set(k, n(d[k]));
  return o;
}
function faltando(c: any, fx: any) {
  const d = c.dados || {}, a = c.arquivos || [], f: string[] = [];
  const conta = (t: string) => a.filter((x: any) => x.tipo === t).length;
  if (!d.nome_dono || d.nome_dono.split(" ").length < 2) f.push("nome_dono");
  if (!cpfValido(d.doc_dono || "")) f.push("doc_dono");
  if (!d.nome_lancha) f.push("nome_lancha");
  if (!d.cidade || (d.cidade === "outra" && !d.cidade_outra)) f.push("cidade");
  if (!d.embarque) f.push("embarque");
  if (!fx) f.push("pes");
  if (!d.cap || d.cap < 1 || d.cap > 200) f.push("cap");
  if (!d.tie) f.push("tie");
  if (!d.marinheiro || !d.categoria) f.push("marinheiro");
  if (!conta("tie")) f.push("arq_tie");
  if (!conta("dpem")) f.push("arq_dpem");
  if (!conta("habilitacao")) f.push("arq_habilitacao");
  if (conta("foto") < 6) f.push("fotos");
  if (!d.baixa || !d.baixa7 || !d.alta || !d.alta7) f.push("precos");
  else {
    if (fx && (d.baixa < fx.min || d.baixa > fx.max)) f.push("faixa");
    if (d.alta < d.baixa || d.alta7 < d.baixa7 || d.baixa7 <= d.baixa || d.alta7 <= d.alta) f.push("ordem");
  }
  return f;
}
/* primeira análise, na hora: confere o que dá para conferir sem olhar as imagens. A leitura dos documentos e das fotos
   (robô + segunda opinião) entra por cima, gravando em analise.itens */
function analisar(c: any, fx: any) {
  const d = c.dados || {}, a = c.arquivos || [];
  const itens: { item: string; ok: boolean; obs: string }[] = [];
  itens.push({ item: "Documentos enviados (TIE, DPEM, habilitação)", ok: ["tie", "dpem", "habilitacao"].every(t => a.some((x: any) => x.tipo === t)), obs: "" });
  itens.push({ item: "Fotos (mínimo 6)", ok: a.filter((x: any) => x.tipo === "foto").length >= 6, obs: `${a.filter((x: any) => x.tipo === "foto").length} fotos` });
  itens.push({ item: "Preço dentro da faixa", ok: !!fx && d.baixa >= fx.min && d.baixa <= fx.max, obs: fx ? `neto 4h baixa R$ ${d.baixa} (faixa R$ ${fx.min} a R$ ${fx.max})` : "" });
  itens.push({ item: "CPF/CNPJ válido", ok: cpfValido(d.doc_dono || ""), obs: "" });
  itens.push({ item: "Cidade atendida", ok: d.cidade !== "outra", obs: d.cidade_nome || "" });
  const pes = Number(String(d.pes).replace(",", ".")), cap = Number(d.cap);
  itens.push({ item: "Capacidade compatível com o tamanho", ok: cap <= Math.max(6, pes * 0.75), obs: `${cap} pessoas em ${pes} pés` });
  return { resultado: itens.every(i => i.ok) ? "aguardando_leitura" : "atencao", itens, em: new Date().toISOString() };
}

// aviso no celular dos administradores (mesmo push do app)
async function avisarAdmin(c: any) {
  try {
    const { data: ad } = await db.from("admins").select("user_id");
    const users = (ad || []).map((x: any) => x.user_id);
    const { data: k } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
    if (!k || !users.length) return;
    webpush.setVapidDetails("mailto:contato@bordazul.com.br", k.publica, k.privada);
    const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth").in("user_id", users);
    const d = c.dados || {};
    const m = { title: "Bordazul: lancha nova para analisar", body: `${d.nome_lancha || "Lancha"} · ${d.pes || "?"} pés · ${d.cidade_nome || ""}`.slice(0, 180), url: "/login/?bordazul=1", tag: `bz-${c.id}` };
    await Promise.all((subs || []).map(async (s: any) => {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(m), { TTL: 86400 }); }
      catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
    }));
  } catch (e) { console.error("aviso", e); }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const acao = String(body.acao || "");

    if (acao === "termo") return json({ versao: VERSAO, aceites: ACEITES, assinatura: ASSINATURA, ativo: ATIVO });

    if (acao === "enviar" && body.para !== "assinar") {
      const tel = normTel(body.tel);
      if (!telOk(tel)) return json({ erro: "tel" }, 400);
      const r = await mandarCodigo(tel, "entrar");
      return json(r.ok ? { ok: true } : { erro: r.erro }, r.ok ? 200 : r.s);
    }

    if (acao === "confirmar") {
      const tel = normTel(body.tel);
      if (!telOk(tel)) return json({ erro: "tel" }, 400);
      const e = await conferirCodigo(tel, "entrar", body.codigo);
      if (e) return json({ erro: e }, 400);
      const tk = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const exp = new Date(Date.now() + 30 * 86400000).toISOString(), agora = new Date().toISOString();
      /* abre o cadastro mais recente desse WhatsApp (rascunho, correção ou já enviado, para ver a situação) */
      const { data: velho } = await db.from("bz_cadastros").select("id").eq("tel", tel).order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
      const { data: c, error } = velho
        ? await db.from("bz_cadastros").update({ token_hash: await sha("tk:" + tk), token_expira: exp, tel_ok_em: agora }).eq("id", velho.id).select("*").single()
        : await db.from("bz_cadastros").insert({ tel, tel_ok_em: agora, token_hash: await sha("tk:" + tk), token_expira: exp }).select("*").single();
      if (error) throw error;
      return json({ token: tk, cadastro: publico(c), faixa: await faixa(c.dados) });
    }

    /* administrador (login do app): links para abrir documentos e fotos de um cadastro */
    if (acao === "admin_links") {
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const uid = jwt && jwt !== CHAVE ? (await db.auth.getUser(jwt)).data?.user?.id : null;
      if (!uid || !(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data) return json({ erro: "admin" }, 403);
      const { data: ca } = await db.from("bz_cadastros").select("arquivos").eq("id", String(body.id || "")).maybeSingle();
      return json({ links: await links(ca?.arquivos || [], 1800) });
    }

    const c = await porToken(String(body.token || ""));
    if (!c) return json({ erro: "token" }, 401);
    const editavel = c.status === "rascunho" || c.status === "correcao";

    if (acao === "abrir") return json({ cadastro: publico(c), termo: termo(c.dados, c.tel), faixa: await faixa(c.dados), links: await links(c.arquivos || [], 3600) });
    if (acao === "links") return json({ links: await links(c.arquivos || [], 3600) });

    if (acao === "novo") {
      const { data: n, error } = await db.from("bz_cadastros").insert({ tel: c.tel, tel_ok_em: c.tel_ok_em, token_hash: c.token_hash, token_expira: c.token_expira,
        dados: { nome_dono: c.dados?.nome_dono, doc_dono: c.dados?.doc_dono, email: c.dados?.email } }).select("*").single();
      if (error) return json({ erro: "novo" }, 409); /* token_hash é único: um cadastro aberto por vez nesse aparelho */
      await db.from("bz_cadastros").update({ token_hash: null }).eq("id", c.id);
      return json({ cadastro: publico(n), faixa: null });
    }

    if (acao === "salvar") {
      if (!editavel) return json({ erro: "enviado" }, 409);
      const dados = limpa(body.dados || {}, c.dados || {});
      const { data: n, error } = await db.from("bz_cadastros").update({ dados, atualizado_em: new Date().toISOString() }).eq("id", c.id).select("*").single();
      if (error) throw error;
      return json({ cadastro: publico(n), termo: termo(n.dados, n.tel), faixa: await faixa(n.dados) });
    }

    if (acao === "upload") {
      if (!editavel) return json({ erro: "enviado" }, 409);
      const tipo = String(body.tipo || ""), ext = String(body.ext || "").toLowerCase();
      if (!(tipo in ARQ_TIPOS) || !["jpg", "jpeg", "png", "webp", "heic", "pdf"].includes(ext)) return json({ erro: "tipo" }, 400);
      if (tipo === "foto" && ext === "pdf") return json({ erro: "tipo" }, 400);
      if ((c.arquivos || []).filter((x: any) => x.tipo === tipo).length >= ARQ_TIPOS[tipo]) return json({ erro: "limite" }, 400);
      const path = `${c.id}/${tipo}-${crypto.randomUUID().slice(0, 12)}.${ext}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return json({ path, url: data.signedUrl, token_upload: data.token });
    }

    if (acao === "arquivo_ok") {
      if (!editavel) return json({ erro: "enviado" }, 409);
      const path = String(body.path || ""), tipo = String(body.tipo || "");
      if (!path.startsWith(c.id + "/") || !(tipo in ARQ_TIPOS) || !path.slice(c.id.length + 1).startsWith(tipo + "-")) return json({ erro: "path" }, 400);
      const nome = path.slice(c.id.length + 1);
      const { data: lista } = await db.storage.from(BUCKET).list(c.id, { search: nome });
      if (!lista?.some(f => f.name === nome)) return json({ erro: "nao_subiu" }, 400);
      const arquivos = (c.arquivos || []).filter((x: any) => x.path !== path).concat([{ tipo, path, em: new Date().toISOString() }]);
      if (arquivos.filter((x: any) => x.tipo === tipo).length > ARQ_TIPOS[tipo]) return json({ erro: "limite" }, 400);
      const { data: n } = await db.from("bz_cadastros").update({ arquivos, atualizado_em: new Date().toISOString() }).eq("id", c.id).select("*").single();
      return json({ cadastro: publico(n) });
    }

    if (acao === "remover") {
      if (!editavel) return json({ erro: "enviado" }, 409);
      const path = String(body.path || "");
      if (!(c.arquivos || []).some((x: any) => x.path === path)) return json({ erro: "path" }, 400);
      await db.storage.from(BUCKET).remove([path]);
      const { data: n } = await db.from("bz_cadastros").update({ arquivos: c.arquivos.filter((x: any) => x.path !== path), atualizado_em: new Date().toISOString() }).eq("id", c.id).select("*").single();
      return json({ cadastro: publico(n) });
    }

    if (acao === "enviar" && body.para === "assinar") {
      if (!editavel) return json({ erro: "enviado" }, 409);
      const f = faltando(c, await faixa(c.dados));
      if (f.length) return json({ erro: "faltam", faltam: f }, 400);
      const r = await mandarCodigo(c.tel, "assinar:" + c.id);
      return json(r.ok ? { ok: true } : { erro: r.erro }, r.ok ? 200 : r.s);
    }

    if (acao === "assinar") {
      if (!editavel) return json({ erro: "enviado" }, 409);
      const fx = await faixa(c.dados), f = faltando(c, fx);
      if (f.length) return json({ erro: "faltam", faltam: f }, 400);
      const ac = Array.isArray(body.aceites) ? body.aceites : [];
      if (ac.length !== ACEITES.length || !ac.every((x: unknown) => x === true)) return json({ erro: "aceites" }, 400);
      const nome = String(body.nome || "").trim().replace(/\s+/g, " ").slice(0, 100), cpf = dig(body.cpf);
      const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      if (nome.split(" ").length < 2 || norm(nome) !== norm(String(c.dados.nome_dono || "").trim().replace(/\s+/g, " "))) return json({ erro: "nome" }, 400);
      if (cpf !== c.dados.doc_dono) return json({ erro: "cpf" }, 400);
      const e = await conferirCodigo(c.tel, "assinar:" + c.id, body.codigo);
      if (e) return json({ erro: e }, 400);
      const texto = JSON.stringify({ versao: VERSAO, termo: termo(c.dados, c.tel), aceites: ACEITES, assinatura: ASSINATURA, dados: c.dados, arquivos: (c.arquivos || []).map((x: any) => x.path) });
      const em = new Date().toISOString();
      const assinatura = {
        nome, cpf, tel: c.tel, em, termo_versao: VERSAO, termo_hash: await sha(JSON.stringify(termo(c.dados, c.tel))), doc_hash: await sha(texto + "|" + em),
        ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64), aparelho: (req.headers.get("user-agent") || "").slice(0, 300), aceites: ACEITES,
      };
      const analise = analisar(c, fx);
      const { data: n, error } = await db.from("bz_cadastros").update({ status: "em_analise", termo_versao: VERSAO, termo_hash: assinatura.termo_hash, assinatura, analise, atualizado_em: em })
        .eq("id", c.id).in("status", ["rascunho", "correcao"]).select("*").single();
      if (error || !n) return json({ erro: "enviado" }, 409);
      await avisarAdmin(n);
      return json({ cadastro: publico(n), termo: termo(n.dados, n.tel) });
    }

    return json({ erro: "acao" }, 400);
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
