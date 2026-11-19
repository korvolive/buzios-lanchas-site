// Rodar: python3 -m http.server 8765 --bind 127.0.0.1 (na raiz do repositório) e depois node scripts/testes/conversoes-navegador.js
// Teste no navegador (iPhone emulado): clique no WhatsApp, consentimento negado, falha de rede, Lead, /pagar e privacidade.
const { chromium, devices } = require("playwright");
const BASE = "http://127.0.0.1:8765";
const ok = (c, m) => { console.log((c ? "OK   " : "FALHA") + " " + m); if (!c) process.exitCode = 1; };
(async () => {
  const br = await chromium.launch();
  const nova = async (falhaRede) => {
    const ctx = await br.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
    const beacons = [];
    await ctx.route("**/*", (r) => {
      const u = r.request().url();
      if (u.includes("/functions/v1/conversoes")) { beacons.push(r.request().postData()); return falhaRede ? r.abort() : r.fulfill({ status: 200, body: "{}" }); }
      if (u.startsWith(BASE)) return r.continue();
      if (/supabase\.co\/rest|supabase\.co\/functions/.test(u)) return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return r.abort(); // GTM, fbevents, fontes etc. ficam fora do teste
    });
    return { ctx, beacons };
  };
  const clicaWa = async (page, sel) => {
    const [pop] = await Promise.all([page.context().waitForEvent("page", { timeout: 5000 }).catch(() => null), page.locator(sel).first().click()]);
    return pop;
  };
  // 1) clique normal
  {
    const { ctx, beacons } = await nova(false); const page = await ctx.newPage();
    await page.goto(BASE + "/?gclid=TESTE123&utm_source=google&nome=Joao", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { document.cookie = "_ga=GA1.1.111.222; path=/"; document.cookie = "_ga_NYEL6BGFBF=GS2.1.s1763590000$o3$g1$t1; path=/"; document.cookie = "_fbp=fb.1.1700.555; path=/"; });
    const waReq = []; ctx.on("request", (q) => { if (/wa\.me/.test(q.url())) waReq.push(q.url()); });
    const pop = await clicaWa(page, 'footer a[href*="wa.me"]');
    await page.waitForTimeout(300);
    ok(!!pop && waReq.length > 0, "WhatsApp abre na hora no celular (rodapé): " + (waReq[0] || "nada"));
    await page.waitForTimeout(500);
    const b = beacons.map((x) => JSON.parse(x)).find((x) => x.ev === "whatsapp_click");
    ok(!!b && b.posicao === "rodape", "servidor recebe whatsapp_click com posição rodape");
    ok(b && b.ga_cid === "111.222" && b.ga_sid === "1763590000" && b.fbp === "fb.1.1700.555" && b.gclid === "TESTE123", "leva client_id, session_id, _fbp e gclid reais");
    ok(b && b.pagina === "/" && !JSON.stringify(b).includes("Joao"), "endereço sem a parte do ? (sem dado pessoal)");
    const fq = await page.evaluate(() => (window.fbq && window.fbq.queue || []).map((a) => Array.from(a)));
    const ct = fq.find((a) => a[0] === "track" && a[1] === "Contact");
    ok(ct && b && ct[3] && ct[3].eventID === b.event_id, "Pixel Contact com o mesmo eventID do servidor");
    const dl = await page.evaluate(() => window.dataLayer.filter((x) => x && (x.event === "clique_whatsapp" || x.event === "whatsapp_click")).map((x) => x.event + ":" + x.posicao));
    ok(dl.includes("clique_whatsapp:rodape") && dl.includes("whatsapp_click:rodape"), "Google: clique_whatsapp (GA4) + whatsapp_click no dataLayer, com posição");
    // Lead: só depois de o banco aceitar (simulado chamando rastreioLead como o site faz no .then da consulta salva)
    await page.evaluate(() => { rastreioLead("consulta", "11111111-1111-4111-8111-111111111111", { value: 2500, lancha: "Midas" }); rastreioLead("consulta", "11111111-1111-4111-8111-111111111111", { value: 2500 }); });
    await page.waitForTimeout(300);
    const leads = beacons.map((x) => JSON.parse(x)).filter((x) => x.ev === "lead");
    ok(leads.length === 1 && leads[0].event_id === "lead-c-11111111-1111-4111-8111-111111111111", "Lead uma vez só por consulta, com event_id fixo");
    const fl = await page.evaluate(() => window.fbq.queue.map((a) => Array.from(a)).filter((a) => a[1] === "Lead"));
    ok(fl.length === 1 && fl[0][3].eventID === "lead-c-11111111-1111-4111-8111-111111111111", "Pixel Lead com o mesmo eventID");
    await ctx.close();
  }
  // 2) falha de rede no servidor de rastreio
  {
    const { ctx, beacons } = await nova(true); const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1000);
    const pop = await clicaWa(page, 'footer a[href*="wa.me"]');
    ok(!!pop, "falha de rede no rastreio: WhatsApp abre mesmo assim");
    await ctx.close();
  }
  // 3) consentimento negado na privacidade
  {
    const { ctx, beacons } = await nova(false); const page = await ctx.newPage();
    await page.goto(BASE + "/privacidade/", { waitUntil: "domcontentloaded" });
    await page.locator('[data-l].on [data-rastreio="nao"]').click();
    ok(await page.evaluate(() => localStorage.getItem("rastreio-consentimento")) === "negado", "botão Não rastrear grava a escolha");
    await page.goto(BASE + "/?gclid=XYZ", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1000);
    const pop = await clicaWa(page, 'footer a[href*="wa.me"]');
    await page.waitForTimeout(500);
    ok(!!pop, "consentimento negado: WhatsApp abre normalmente");
    ok(beacons.length === 0, "consentimento negado: nada vai ao servidor");
    const st = await page.evaluate(() => ({ q: (window.fbq && window.fbq.queue || []).map((a) => Array.from(a).slice(0, 2).join(":")), dl: window.dataLayer.filter((x) => x && x[0] === "consent").map((x) => x[1] + ":" + x[2].ad_storage), orig: localStorage.getItem("rastreio-origem") }));
    ok(st.q.includes("consent:revoke") && !st.q.includes("track:Contact"), "Pixel revogado e sem Contact");
    ok(st.dl[0] === "default:denied", "Google em modo de consentimento negado antes do GTM");
    ok(st.orig === null, "clique do anúncio não é guardado");
    await ctx.close();
  }
  // 4) /pagar manda só identificadores (nunca pagamento)
  {
    const { ctx, beacons } = await nova(false); const page = await ctx.newPage();
    await ctx.addCookies([{ name: "_ga", value: "GA1.1.777.888", url: BASE }, { name: "_fbc", value: "fb.1.1700.AdX", url: BASE }]);
    await ctx.route("**/functions/v1/paypal-checkout**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: "2026-12-20", lancha: "Midas", sinal_brl: 690, moeda: "BRL", valor: 690, status: "pendente" }) }));
    await page.goto(BASE + "/pagar/?p=90&k=22222222-2222-4222-8222-222222222222", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2500);
    const v = beacons.map((x) => JSON.parse(x)).find((x) => x.ev === "visita_pagar");
    ok(!!v && v.pedido === 90 && v.ga_cid === "777.888" && v.fbc === "fb.1.1700.AdX", "/pagar avisa o servidor dos identificadores da visita");
    ok(v && !("value" in v) && !("valor" in v) && !JSON.stringify(beacons).includes("purchase"), "/pagar não declara pagamento nem valor");
    const gaBrowser = await page.evaluate(() => (window.dataLayer || []).some((x) => x && x[0] === "event" && x[1] === "purchase"));
    ok(!gaBrowser, "purchase não sai mais do navegador (origem única: servidor)");
    await ctx.close();
  }
  await br.close();
})();
