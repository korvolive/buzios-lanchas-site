// Búzios Lanchas: previsão do tempo do card "Clima em Búzios" do site (Rodrigo 2026-11-14).
// Público (sem login), só lê fontes públicas. Devolve os próximos 7 dias já "traduzidos" para o card:
//   { fonte, gerado, dias: [{ d: "2026-11-15", ok: true, ceu: "sol"|"parcial"|"nublado"|"chuva", t: 29, vento: false }, ...] }
// Regra do Rodrigo: tranquilizar, nunca assustar. Nada de números técnicos (nós, rajadas, ondas) sai daqui.
//  - vento moderado no horário do passeio -> vento: true (o site diz que o roteiro vai para as praias mais abrigadas);
//  - dia ruim de verdade (trovoada, muita chuva, vento forte, ou aviso oficial forte da Marinha/INMET) -> ok: false
//    e o site simplesmente não mostra o card.
// Fonte: MET Norway (api.met.no, licença CC BY 4.0, uso comercial liberado com crédito; o Windguru não tem API
// para sites). Avisos oficiais: a função clima-alertas (?ver=1, só leitura).
const LAT = -22.76, LON = -41.89; // península de Búzios
const MET = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${LAT}&lon=${LON}`;
const UA = "BuziosLanchasSite/1.0 (+https://lanchaembuzios.com.br)";
const H0 = 9, H1 = 17; // janela dos passeios de dia, hora de Brasília (UTC-3, sem horário de verão)
const VENTO = 7, VENTO_RUIM = 11; // m/s médios na janela (~25 e ~40 km/h)
const CHUVA = 1.5, CHUVA_RUIM = 8; // mm somados na janela

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" };
let cache: { t: number; body: string } | null = null;

type Hora = { ceu: string; mm: number; v?: number; temp?: number; tmax?: number };
const ceuDe = (sym = "") => {
  const s = sym.replace(/_(day|night|polartwilight)$/, "");
  if (/thunder/.test(s)) return "trovoada";
  if (/rain|sleet|snow|shower/.test(s)) return "chuva";
  if (/cloudy|fog/.test(s) && s !== "partlycloudy") return "nublado";
  if (s === "partlycloudy") return "parcial";
  return "sol"; // clearsky, fair
};
const local = (iso: string) => { const d = new Date(new Date(iso).getTime() - 3 * 3600e3); return { dia: d.toISOString().slice(0, 10), h: d.getUTCHours() }; };

async function avisosFortes(): Promise<[number, number][]> {
  try {
    const r = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/clima-alertas?ver=1", { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    return ((j.avisos || []) as { ini?: string; fim?: string }[]).map(a => {
      const ini = a.ini ? new Date(a.ini).getTime() : Date.now();
      return [ini, a.fim ? new Date(a.fim).getTime() : ini + 24 * 3600e3] as [number, number];
    });
  } catch { return []; }
}

async function montar() {
  const r = await fetch(MET, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("met " + r.status);
  const ts = (await r.json()).properties.timeseries as any[];
  // horas locais de cada dia: o trecho de hora em hora vale como está; depois, cada bloco de 6 h cobre as 6 horas seguintes
  const horas: Record<string, Record<number, Hora>> = {};
  for (const e of ts) {
    const { dia, h } = local(e.time), d = e.data, inst = d.instant?.details || {};
    const um = d.next_1_hours, seis = d.next_6_hours;
    if (um) { (horas[dia] ||= {})[h] = { ceu: ceuDe(um.summary?.symbol_code), mm: um.details?.precipitation_amount || 0, v: inst.wind_speed, temp: inst.air_temperature }; continue; }
    if (!seis) continue;
    for (let k = 0; k < 6; k++) {
      const l = local(new Date(new Date(e.time).getTime() + k * 3600e3).toISOString());
      const dd = (horas[l.dia] ||= {});
      if (dd[l.h]) continue;
      dd[l.h] = { ceu: ceuDe(seis.summary?.symbol_code), mm: (seis.details?.precipitation_amount || 0) / 6, v: k === 0 ? inst.wind_speed : undefined,
        temp: k === 0 ? inst.air_temperature : undefined, tmax: seis.details?.air_temperature_max };
    }
  }
  const avisos = await avisosFortes();
  const hoje = local(new Date().toISOString()).dia, dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.parse(hoje + "T12:00:00Z") + i * 864e5).toISOString().slice(0, 10);
    const hs = Object.entries(horas[d] || {}).filter(([h]) => +h >= H0 && +h <= H1).map(([, x]) => x);
    if (hs.length < 2) continue; // hoje depois do horário dos passeios, ou fim da previsão
    const ini = Date.parse(d + "T12:00:00Z"), fim = Date.parse(d + "T20:00:00Z"); // 9h às 17h de Brasília
    const aviso = avisos.some(([a, b]) => a < fim && b > ini);
    const mm = hs.reduce((s, x) => s + x.mm, 0);
    const vs = hs.map(x => x.v).filter((x): x is number => x != null), vmax = vs.length ? Math.max(...vs) : 0;
    const temps = hs.flatMap(x => [x.temp, x.tmax]).filter((x): x is number => x != null);
    const conta = (c: string) => hs.filter(x => x.ceu === c).length;
    if (aviso || conta("trovoada") >= 2 || mm >= CHUVA_RUIM || vmax >= VENTO_RUIM || !temps.length) { dias.push({ d, ok: false }); continue; }
    const n = hs.length;
    const ceu = mm >= CHUVA || conta("chuva") + conta("trovoada") >= 3 ? "chuva"
      : conta("sol") / n >= 0.5 ? "sol" : conta("nublado") / n >= 0.6 ? "nublado" : "parcial";
    dias.push({ d, ok: true, ceu, t: Math.round(Math.max(...temps)), vento: vmax >= VENTO });
  }
  return { fonte: "MET Norway", gerado: new Date().toISOString(), dias };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const ver = new URL(req.url).searchParams.has("ver");
  if (!ver && cache && Date.now() - cache.t < 30 * 60e3) return new Response(cache.body, { headers: CORS });
  try {
    const b = JSON.stringify(await montar());
    cache = { t: Date.now(), body: b };
    return new Response(b, { headers: CORS });
  } catch (e) {
    console.error(String(e));
    if (cache) return new Response(cache.body, { headers: CORS }); // previsão anterior é melhor que nada
    return new Response(JSON.stringify({ dias: [] }), { status: 200, headers: CORS }); // sem previsão, o card não aparece
  }
});
