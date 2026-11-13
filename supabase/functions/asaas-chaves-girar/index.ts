// Búzios Lanchas: troca anual do segredo que cifra as chaves das subcontas do Asaas (compromisso 4.1.4 com o Asaas, 2026-11-13).
// Só o robô (chave interna do resgate_config, mandada pelo próprio banco com net.http_post) ou a chave de serviço.
// POST { acao: "conferir" }  conta quantas chaves abrem com o segredo atual (ASAAS_CHAVES_SEGREDO). Não muda nada.
// POST { acao: "girar" }     recifra com ASAAS_CHAVES_SEGREDO_NOVO todas as chaves que abrem com o atual.
// Passo a passo anual (também no SEGURANCA.md):
//   1. gravar um segredo novo (48+ caracteres aleatórios) em ASAAS_CHAVES_SEGREDO_NOVO;
//   2. chamar { acao: "girar" };
//   3. gravar o mesmo valor em ASAAS_CHAVES_SEGREDO (a função asaas passa a usar o novo);
//   4. chamar { acao: "conferir" } e ver falhas = 0. Entre os passos 2 e 3 (segundos) um saque pode falhar e é só repetir.
// Nunca devolve nem registra chave nenhuma: só contagens.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const de64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function chave(nome: string) {
  const s = Deno.env.get(nome) || "";
  if (s.length < 32) return null;
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function abrir(txt: string, k: CryptoKey | null) {
  const [v, iv, ct] = String(txt || "").split(":");
  if (!k || v !== "v1" || !iv || !ct) return null;
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: de64(iv) }, k, de64(ct))); } catch (_) { return null; }
}
async function fechar(txt: string, k: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return `v1:${b64(iv)}:${b64(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(txt))))}`;
}

Deno.serve(async req => {
  if (req.method !== "POST") return json({ erro: "método" }, 405);
  try {
    const ch = req.headers.get("x-chave") || "", tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const cfg = ch ? (await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle()).data : null;
    if (!((cfg?.chave && ch === cfg.chave) || (srk && tok === srk))) return json({ erro: "chave" }, 403);
    const b = await req.json().catch(() => ({}));
    const atual = await chave("ASAAS_CHAVES_SEGREDO"), novo = await chave("ASAAS_CHAVES_SEGREDO_NOVO");
    if (!atual) return json({ erro: "sem_segredo" }, 500);
    const { data: rows, error } = await db.from("asaas_chaves").select("user_id, api_key");
    if (error) return json({ erro: "leitura" }, 500);
    let ok = 0, novas = 0, recifradas = 0, falhas = 0;
    for (const r of rows || []) {
      const t = await abrir(r.api_key, atual);
      if (b.acao === "girar") {
        if (!novo) return json({ erro: "sem_segredo_novo" }, 400);
        if (t === null) { if (await abrir(r.api_key, novo) !== null) novas++; else falhas++; continue; }
        const { error: e } = await db.from("asaas_chaves").update({ api_key: await fechar(t, novo) }).eq("user_id", r.user_id);
        if (e) { console.error("girar", r.user_id, e.message); falhas++; } else recifradas++;
      } else {
        if (t !== null) ok++; else if (novo && await abrir(r.api_key, novo) !== null) novas++; else falhas++;
      }
    }
    await db.from("auditoria").insert({ tabela: "asaas_chaves", operacao: b.acao === "girar" ? "GIRAR_SEGREDO" : "CONFERIR_SEGREDO", depois: { total: (rows || []).length, ok, novas, recifradas, falhas } }).then(() => {}, () => {});
    return json({ total: (rows || []).length, abrem_com_atual: ok, ja_no_novo: novas, recifradas, falhas });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
