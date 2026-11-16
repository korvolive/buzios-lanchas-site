// Búzios Lanchas: pedido esperando aprovação avisa quem aprova na hora, com lembretes (2026-11-16).
// Caso: o Lucas lançou um pedido numa lancha sem "Reserva automática" pela VPS e ninguém foi avisado; a cliente
// ficou esperando o link. O aviso antes dependia do app chamar notificar (op_pedido); a VPS nunca chamava.
// Agora o pg_cron "aviso-aprovacao" chama esta função a cada minuto e ela olha o banco, seja qual for o caminho do lançamento:
//  - consulta lançada pela equipe (criado_por), ainda não aprovada nem recusada, passeio de hoje em diante;
//  - 1º aviso no celular dos administradores (web push e app iOS), assim que aparece (até 6 h depois de lançada);
//  - lembrete aos 5 min e depois a cada 15 min (no máximo 4), das 7h às 23h de Brasília, enquanto continuar parada.
// O toque no aviso abre o app no pedido, já na janela de aprovar (/login/?consulta=ID&aprovar=1).
// O WhatsApp para quem aprova sai da VPS (painel-worker), lendo as mesmas colunas aprov_*.
// Não é pública: só roda com a chave de resgate_config (x-chave). Sem nomes de pessoas da empresa e sem emoji nos textos.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const SLOT: Record<string, Record<string, string>> = {
  pt: { manha: "manhã", tarde: "tarde", dia: "dia inteiro", noite: "noite" },
  en: { manha: "morning", tarde: "afternoon", dia: "full day", noite: "night" },
  es: { manha: "mañana", tarde: "tarde", dia: "día completo", noite: "noche" },
};
const dataBR = (d: string) => d.split("-").reverse().join("/");
const L = (x: unknown) => ["pt", "en", "es"].includes(String(x)) ? String(x) : "pt";
const linha = (c: any, l: string) => {
  const hr = c.hora_ini && c.hora_fim ? `${String(c.hora_ini).slice(0, 5)}-${String(c.hora_fim).slice(0, 5)}` : (SLOT[l][c.horario] || c.horario);
  const pes = c.pessoas ? ` · ${c.pessoas} ${l === "en" ? "people" : l === "es" ? "personas" : "pessoas"}` : "";
  const cli = c.nome ? ` · ${String(c.nome).split(" ")[0]}` : "";
  const val = +c.valor > 0 ? ` · R$ ${Number(c.valor).toLocaleString("pt-BR")}` : "";
  return `${c.lanchaNome} · ${dataBR(c.data)} · ${hr}${pes}${cli}${val}`;
};
const TXT: Record<string, Record<string, (c: any) => { title: string; body: string }>> = {
  novo: {
    pt: c => ({ title: "Pedido esperando sua aprovação", body: `${linha(c, "pt")}. O cliente está esperando o link de pagamento. Toque para aprovar.` }),
    en: c => ({ title: "Request waiting for your approval", body: `${linha(c, "en")}. The client is waiting for the payment link. Tap to approve.` }),
    es: c => ({ title: "Pedido esperando tu aprobación", body: `${linha(c, "es")}. El cliente está esperando el link de pago. Toca para aprobar.` }),
  },
  lembrete: {
    pt: c => ({ title: `Ainda esperando aprovação (há ${c.min} min)`, body: `${linha(c, "pt")}. O cliente continua esperando o link. Toque para aprovar.` }),
    en: c => ({ title: `Still waiting for approval (${c.min} min)`, body: `${linha(c, "en")}. The client is still waiting for the link. Tap to approve.` }),
    es: c => ({ title: `Sigue esperando aprobación (hace ${c.min} min)`, body: `${linha(c, "es")}. El cliente sigue esperando el link. Toca para aprobar.` }),
  },
};

let keys: { publica: string; privada: string } | null = null;
let apnsJwt: { t: string; em: number } | null = null;
async function apnsToken() {
  if (apnsJwt && Date.now() - apnsJwt.em < 50 * 60e3) return apnsJwt.t;
  const kid = Deno.env.get("APNS_KEY_ID")!, team = Deno.env.get("APNS_TEAM_ID")!;
  const pem = Deno.env.get("APNS_KEY_P8")!.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const enc = (o: unknown) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const head = `${enc({ alg: "ES256", kid })}.${enc({ iss: team, iat: Math.floor(Date.now() / 1000) })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(head)));
  apnsJwt = { t: `${head}.${b64u(sig)}`, em: Date.now() };
  return apnsJwt.t;
}

async function push(tipo: "novo" | "lembrete", c: any) {
  if (!keys) { const { data } = await db.from("push_config").select("publica, privada").eq("id", 1).maybeSingle(); if (!data) return 0; keys = data; }
  webpush.setVapidDetails("https://www.lanchaembuzios.com.br", keys.publica, keys.privada);
  const { data: ads } = await db.from("admins").select("user_id");
  const ids = (ads || []).map(a => a.user_id);
  if (!ids.length) return 0;
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth, lang").in("user_id", ids);
  const url = `/login/?consulta=${c.id}&aprovar=1`, tag = `op_pedido-${c.id}`; // mesma etiqueta do aviso do app: substitui, não duplica
  let n = 0;
  await Promise.all((subs || []).map(async s => {
    const m = TXT[tipo][L(s.lang)](c);
    try {
      if (s.endpoint.startsWith("apns:")) {
        const r = await fetch(`https://api.push.apple.com/3/device/${s.endpoint.slice(5)}`, {
          method: "POST",
          headers: { authorization: `bearer ${await apnsToken()}`, "apns-topic": "br.com.lanchaembuzios.app", "apns-push-type": "alert", "apns-priority": "10", "apns-collapse-id": tag.slice(0, 64) },
          body: JSON.stringify({ aps: { alert: { title: m.title, body: m.body }, sound: "default" }, url }),
        });
        if (!r.ok) throw Object.assign(new Error(await r.text()), { statusCode: r.status });
      } else {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url, tag }), { TTL: 3600, urgency: "high" });
      }
      n++;
    } catch (e: any) {
      const apns = s.endpoint.startsWith("apns:");
      console.error("push falhou", tipo, e?.statusCode, apns ? "apns" : new URL(s.endpoint).host);
      if (e?.statusCode === 404 || e?.statusCode === 410 || (apns && /BadDeviceToken|Unregistered/.test(String(e?.message)))) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }));
  return n;
}

Deno.serve(async req => {
  try {
    const { data: cfg } = await db.from("resgate_config").select("chave").eq("id", 1).maybeSingle();
    if (!cfg?.chave || req.headers.get("x-chave") !== cfg.chave) return json({ erro: "nao" }, 401);
    const corpo = await req.json().catch(() => ({}));
    if (corpo?.teste === true) // teste: um aviso só, com dados fictícios, para conferir que chega no celular
      return json({ teste: true, enviados: await push("novo", { id: 0, lanchaNome: "Teste do aviso", data: "2026-12-01", horario: "tarde", pessoas: 2, nome: "Teste", valor: 0 }) });
    const agora = Date.now(), hBR = new Date(agora - 3 * 3600e3).getUTCHours();
    const hoje = new Date(agora - 3 * 3600e3).toISOString().slice(0, 10);
    const { data: cs, error } = await db.from("consultas")
      .select("id, lancha, data, horario, hora_ini, hora_fim, pessoas, nome, valor, grupo, criado_em, aprov_aviso_em, aprov_lembrete_em, aprov_lembretes")
      .not("criado_por", "is", null).is("recusada_em", null).is("virou_pedido_em", null)
      .gte("data", hoje).gte("criado_em", new Date(agora - 3 * 864e5).toISOString())
      .order("id").limit(50);
    if (error) throw error;
    const nomes = new Map(((await db.from("lanchas").select("slug, nome")).data || []).map(x => [x.slug, x.nome]));
    const vistos = new Set<string>();
    let novos = 0, lembretes = 0;
    for (const c of cs || []) {
      if (c.grupo) { if (vistos.has(c.grupo)) continue; vistos.add(c.grupo); } // grupo: um aviso pelo grupo todo
      c.lanchaNome = nomes.get(c.lancha) || c.lancha;
      const grupoIds = c.grupo ? (cs || []).filter(x => x.grupo === c.grupo).map(x => x.id) : [c.id];
      if (!c.aprov_aviso_em) {
        const marca = new Date().toISOString();
        const { data: ok } = await db.from("consultas").update({ aprov_aviso_em: marca }).in("id", grupoIds).is("aprov_aviso_em", null).select("id");
        if (!ok?.length) continue;
        if (agora - Date.parse(c.criado_em) > 6 * 3600e3) continue; // antigo (antes desta função): só marca, não avisa
        await push("novo", c); novos++;
        continue;
      }
      if (hBR < 7 || hBR >= 23 || (c.aprov_lembretes || 0) >= 4 || agora - Date.parse(c.criado_em) > 6 * 3600e3) continue;
      const desde = Date.parse(c.aprov_lembrete_em || c.aprov_aviso_em), espera = c.aprov_lembrete_em ? 15 * 60e3 : 5 * 60e3;
      if (agora - desde < espera - 20e3) continue;
      const { data: ok } = await db.from("consultas").update({ aprov_lembrete_em: new Date().toISOString(), aprov_lembretes: (c.aprov_lembretes || 0) + 1 })
        .in("id", grupoIds).eq("aprov_lembretes", c.aprov_lembretes || 0).select("id");
      if (!ok?.length) continue;
      c.min = Math.max(1, Math.round((agora - Date.parse(c.criado_em)) / 60e3));
      await push("lembrete", c); lembretes++;
    }
    return json({ ok: true, pendentes: (cs || []).length, novos, lembretes });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
