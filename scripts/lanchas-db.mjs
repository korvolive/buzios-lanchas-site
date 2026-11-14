/* Lanchas do banco que mudam o site: as cadastradas no app e as que o administrador ocultou.
   Usado pela publicação (prerender.mjs) e pela verificação a cada 10 minutos (db-mudou.mjs), que comparam o mesmo texto.
   Banco ainda sem a coluna "oculta": volta para a consulta antiga. Sem resposta: null. */
export async function lanchasDB(DB, KEY) {
  const get = q => fetch(DB + "/lanchas?" + q, { headers: { apikey: KEY } }).then(r => (r.ok ? r.text() : r.status === 400 ? 400 : null)).catch(() => null);
  /* posicao (ordem na vitrine, 2026-11-14): mudar a ordem no app também republica */
  const comPos = await get("select=slug,nome,dados,ativa,oculta,posicao&or=(dados.not.is.null,oculta.is.true)&dados->>exemplo=is.null&order=slug");
  if (comPos !== 400) return comPos;
  const novo = await get("select=slug,nome,dados,ativa,oculta&or=(dados.not.is.null,oculta.is.true)&dados->>exemplo=is.null&order=slug");
  if (novo !== 400) return novo;
  const velho = await get("select=slug,nome,dados,ativa&dados=not.is.null&dados->>exemplo=is.null&order=slug");
  return velho === 400 ? null : velho;
}
/* Menor preço da baixa temporada de cada lancha: muda o "a partir de" do FAQ (2026-11-05), então também republica o site */
export async function precosDB(DB, KEY) {
  return fetch(DB + "/precos?select=lancha,baixa,baixa7&order=lancha", { headers: { apikey: KEY } }).then(r => (r.ok ? r.text() : "")).catch(() => "");
}
/* Fotos e ordem editadas no app (tabela fotos): foto nova também republica, para o enquadramento automático da galeria (2026-11-13) */
export async function fotosDB(DB, KEY) {
  return fetch(DB + "/fotos?select=lancha,lista&order=lancha", { headers: { apikey: KEY } }).then(r => (r.ok ? r.text() : "")).catch(() => "");
}
