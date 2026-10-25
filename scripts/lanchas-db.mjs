/* Lanchas do banco que mudam o site: as cadastradas no app e as que o administrador ocultou.
   Usado pela publicação (prerender.mjs) e pela verificação a cada 10 minutos (db-mudou.mjs), que comparam o mesmo texto.
   Banco ainda sem a coluna "oculta": volta para a consulta antiga. Sem resposta: null. */
export async function lanchasDB(DB, KEY) {
  const get = q => fetch(DB + "/lanchas?" + q, { headers: { apikey: KEY } }).then(r => (r.ok ? r.text() : r.status === 400 ? 400 : null)).catch(() => null);
  const novo = await get("select=slug,nome,dados,ativa,oculta&or=(dados.not.is.null,oculta.is.true)&dados->>exemplo=is.null&order=slug");
  if (novo !== 400) return novo;
  const velho = await get("select=slug,nome,dados,ativa&dados=not.is.null&dados->>exemplo=is.null&order=slug");
  return velho === 400 ? null : velho;
}
