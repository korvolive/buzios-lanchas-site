// Cotação do real (BRL) para o site mostrar preços na moeda do visitante estrangeiro.
// Público (sem login). Busca a cotação do dia e devolve { data, rates: { usd: 0.18, eur: ... } } (1 BRL = x moeda).
const FONTES = [
  async () => { const r = await fetch("https://open.er-api.com/v6/latest/BRL"); const j = await r.json();
    if (j.result !== "success") throw new Error("er-api"); const o: Record<string, number> = {};
    for (const [k, v] of Object.entries(j.rates)) o[k.toLowerCase()] = v as number; return { data: j.time_last_update_utc, rates: o }; },
  async () => { const r = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/brl.json"); const j = await r.json();
    return { data: j.date, rates: j.brl }; },
];
let cache: { t: number; body: string } | null = null;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Content-Type": "application/json", "Cache-Control": "public, max-age=21600" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (cache && Date.now() - cache.t < 6 * 3600e3) return new Response(cache.body, { headers: CORS });
  for (const f of FONTES) {
    try { const b = JSON.stringify(await f()); cache = { t: Date.now(), body: b }; return new Response(b, { headers: CORS }); } catch (_) { /* tenta a próxima */ }
  }
  return new Response(JSON.stringify({ erro: "sem cotação" }), { status: 502, headers: CORS });
});
