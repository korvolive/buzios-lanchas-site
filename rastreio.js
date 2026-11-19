/* Rastreio padrão do Google (2026-11-19, pedido do Rodrigo/Zaaitar): vale para a Búzios Lanchas, a Bordazul e toda cidade nova.
   - Carrega o Google Tag Manager GTM-NVP9L5DF (o mesmo do site antigo: Google Ads AW-16871561415 + Google Analytics G-NYEL6BGFBF)
     só se a página ainda não carregou. O GTM já conta como conversão do Google Ads todo clique em link wa.me.
   - Todo clique em botão ou link manda um evento para o Google Analytics, com nome próprio para os importantes:
     clique_whatsapp, clique_telefone, clique_rede (Instagram/Facebook), clique_idioma, ver_lancha, clique_botao (os outros).
   - window.rastreio(nome, dados) manda um evento de negócio (consulta, pedido, conta criada, pagamento) a partir do código da página.
   Nada de dado pessoal: só o texto curto do botão (sem números nem e-mail), a área da página e o endereço sem a parte do "?".
   Fica fora do app de iPhone (o GTM também fica fora lá). Os geradores de bordazul/, rj/ e regiao/ embutem este arquivo no <head>.
   Server-side (2026-11-19, pedido do Zaaitar): clique no WhatsApp vira "Contact" na Meta pelo Pixel e pela API de Conversões
   (o mesmo eventID nos dois); consulta/pedido aceito pelo banco vira "Lead" (rastreioLead). O pagamento ("Purchase"/"purchase")
   sai só do servidor, quando o Asaas ou o PayPal confirma: o navegador nunca declara pagamento nem valor.
   Consentimento: quem tocou em "Não rastrear" na página de privacidade (ou usa o sinal GPC do navegador) não manda nada ao servidor,
   a Meta fica com o Pixel revogado e o Google em modo de consentimento negado. */
(function(w, d){
  if(w.rastreio) return;
  var GA = "G-NYEL6BGFBF", GTM = "GTM-NVP9L5DF", FN = "https://sqoperylsqcbcjpcrlnp.supabase.co/functions/v1/conversoes";
  var ios = /BuziosLanchasIOS/.test(navigator.userAgent);
  w.dataLayer = w.dataLayer || [];
  function gtag(){ w.dataLayer.push(arguments); }
  var ls = function(k, v){ try{ if(v === undefined) return localStorage.getItem(k); if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){ return null; } };
  /* consentimento: "negado" guardado neste aparelho ou o sinal Global Privacy Control do navegador */
  var negado = w.rastreioNegado = function(){ return ls("rastreio-consentimento") === "negado" || navigator.globalPrivacyControl === true; };
  w.rastreioConsentimento = function(sim){
    ls("rastreio-consentimento", sim ? null : "negado"); if(!sim) ls("rastreio-origem", null);
    var c = sim ? "granted" : "denied"; gtag("consent", "update", {ad_storage: c, analytics_storage: c, ad_user_data: c, ad_personalization: c});
    try{ if(w.fbq) w.fbq("consent", sim ? "grant" : "revoke"); }catch(e){}
  };
  if(negado()) gtag("consent", "default", {ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"});
  if(!ios && !w.google_tag_manager && !d.querySelector('script[src*="googletagmanager.com/gtm.js"]')){
    w.dataLayer.push({"gtm.start": new Date().getTime(), event: "gtm.js"});
    var s = d.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtm.js?id=" + GTM;
    (d.head || d.documentElement).appendChild(s);
  }
  var base = function(){ return {pagina: location.pathname, site: location.hostname.replace(/^www\./, ""), idioma: (d.documentElement.lang || "").slice(0, 2)}; };
  /* evento para o Google Analytics (pelo Google tag do GTM) e o mesmo evento no dataLayer, para virar gatilho no GTM se precisar */
  w.rastreio = function(nome, dados){
    if(ios) return;
    try{
      var p = base(), k; dados = dados || {};
      for(k in dados) if(dados[k] != null && dados[k] !== "") p[k] = dados[k];
      var o = {event: nome}; for(k in p) o[k] = p[k]; w.dataLayer.push(o);
      p.send_to = GA; gtag("event", nome, p);
    }catch(e){}
  };
  /* de onde a pessoa veio (clique do anúncio): guardado 90 dias neste aparelho, só os identificadores, para ligar a reserva paga ao anúncio */
  try{
    if(!negado()){
      var q = new URLSearchParams(location.search), o = {}, tem = false;
      ["gclid", "gbraid", "wbraid", "fbclid", "utm_source", "utm_medium", "utm_campaign"].forEach(function(k){
        var v = q.get(k); if(v && /^[\w.~%\-]{1,250}$/.test(v)){ o[k] = v; tem = true; } });
      if(tem){ o.em = Date.now(); ls("rastreio-origem", JSON.stringify(o)); }
    }
  }catch(e){}
  var cookie = function(n){ var m = d.cookie.match(new RegExp("(?:^|; )" + n.replace(/\W/g, "\\$&") + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : ""; };
  /* identificadores reais da visita: client_id e session_id do Google Analytics, _fbp/_fbc da Meta e o clique do anúncio */
  w.rastreioIds = function(){
    var r = {}, o = null;
    var ga = cookie("_ga").split("."); if(ga.length >= 4) r.ga_cid = ga.slice(-2).join(".");
    var gs = cookie("_ga_" + GA.slice(2)), m = gs.match(/^GS1\.\d\.(\d+)\./) || gs.match(/^GS2\.\d\.s(\d+)/); if(m) r.ga_sid = m[1];
    r.fbp = cookie("_fbp"); r.fbc = cookie("_fbc");
    try{ o = JSON.parse(ls("rastreio-origem") || "null"); }catch(e){}
    if(o && Date.now() - o.em < 90 * 864e5){
      ["gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign"].forEach(function(k){ if(o[k]) r[k] = o[k]; });
      if(!r.fbc && o.fbclid) r.fbc = "fb.1." + o.em + "." + o.fbclid;
    }
    for(var k in r) if(!r[k]) delete r[k];
    return r;
  };
  var novoId = w.rastreioNovoId = function(p){ return p + "-" + (w.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12)); };
  /* manda ao servidor (função conversoes) sem esperar e sem atrapalhar a abertura do WhatsApp: sendBeacon, ou fetch keepalive */
  w.rastreioServidor = function(ev, extra){
    if(ios || negado()) return;
    try{
      var b = w.rastreioIds(), k; b.ev = ev; b.consent = "ok"; b.pagina = location.pathname.slice(0, 150); b.site = location.hostname.replace(/^www\./, "");
      for(k in extra || {}) if(extra[k] != null && extra[k] !== "") b[k] = extra[k];
      try{ var se = JSON.parse(ls("dono-ses") || "null"); if(se && se.access_token && se.expires_at * 1000 > Date.now() + 5000) b.tok = se.access_token; }catch(e){}
      var body = JSON.stringify(b);
      if(navigator.sendBeacon && navigator.sendBeacon(FN, new Blob([body], {type: "text/plain"}))) return;
      fetch(FN, {method: "POST", body: body, keepalive: true, headers: {"content-type": "text/plain"}}).catch(function(){});
    }catch(e){}
  };
  /* Lead: só depois que o banco aceitou a consulta (tipo "consulta", id = chave) ou o pedido (tipo "pedido", id = número).
     generate_lead no Google Analytics (pelo navegador, origem única), Lead no Pixel e na API de Conversões com o mesmo eventID;
     o servidor confere no banco que a consulta/o pedido existe antes de mandar à Meta. */
  var leads = {};
  w.rastreioLead = function(tipo, id, dados){
    if(ios || !id) return;
    var eid = "lead-" + (tipo === "pedido" ? "p-" : "c-") + id;
    if(leads[eid] || ls("rl-" + eid)) return; leads[eid] = 1; ls("rl-" + eid, "1");
    dados = dados || {}; var g = {tipo_lead: tipo}, k; for(k in dados) g[k] = dados[k];
    w.rastreio("generate_lead", g);
    if(negado()) return;
    try{ if(w.fbq) w.fbq("track", "Lead", {value: +dados.value || 0, currency: "BRL", content_name: dados.lancha || "", content_category: tipo}, {eventID: eid}); }catch(e){}
    w.rastreioServidor("lead", tipo === "pedido" ? {tipo: tipo, pedido: +id, event_id: eid} : {tipo: tipo, consulta: String(id), event_id: eid});
  };
  var limpa = function(t){ return String(t || "").replace(/\S+@\S+/g, "").replace(/[\d()+\-.\s]{6,}/g, " ").replace(/\s+/g, " ").trim().slice(0, 40); };
  var area = function(el){
    var a = el.closest("[data-area]"); if(a) return a.getAttribute("data-area");
    var s = el.closest("dialog,header,footer,nav,section[id],aside[id],main[id],[id^='pk-'],[class*='card']");
    if(!s) return "";
    return s.id || (s.tagName === "DIALOG" ? "janela" : s.tagName.toLowerCase() === "div" ? String(s.className).split(" ")[0] : s.tagName.toLowerCase());
  };
  /* posição do botão do WhatsApp: topo, flutuante, rodapé, janela, reserva (página da lancha) ou a área da página */
  var posicao = function(el, ar){
    var p = el.closest("[data-posicao]"); if(p) return p.getAttribute("data-posicao");
    if(el.closest(".bwa,.wa-float,[class*='flutu'],[class*='float']")) return "flutuante";
    if(el.closest("header,nav,.topbar,#topo")) return "topo";
    if(el.closest("footer")) return "rodape";
    if(el.closest("dialog")) return "janela";
    if(el.closest("[id^='pk-'],.pk-res,.picker,.wa-cta")) return "reserva";
    return String(ar || "meio").slice(0, 30);
  };
  d.addEventListener("click", function(e){
    try{
      var el = e.target && e.target.closest && e.target.closest("a[href],button,[role=button],input[type=submit],input[type=button]");
      if(!el || el.closest("[data-sem-rastreio]")) return;
      if(el.closest("[class*='cal'] button,[id*='cal'] button")) return; /* dia do calendário: a data escolhida vai no evento escolher_data */
      var href = el.getAttribute("href") || "", txt = limpa(el.getAttribute("aria-label") || el.textContent || el.value), ar = area(el);
      var u = null; try{ if(href && href.charAt(0) !== "#") u = new URL(href, location.href); }catch(x){}
      var dest = u ? (u.protocol === "tel:" ? "tel" : u.host + u.pathname) : href.slice(0, 40);
      var dados = {botao: txt, area: ar, destino: dest};
      if(u && /(^|\.)wa\.me$|api\.whatsapp\.com$|web\.whatsapp\.com$/.test(u.host)){
        if(u.host === "wa.me" && u.pathname === "/" || /\/send\/?$/.test(u.pathname) && !u.searchParams.get("phone")) return w.rastreio("compartilhar_whatsapp", {botao: txt, area: ar});
        /* nada aqui impede o link: o WhatsApp abre na hora, mesmo se o rastreio falhar (sem preventDefault, envios em segundo plano) */
        var pos = posicao(el, ar), eid = novoId("wa");
        dados.destino = "whatsapp"; dados.posicao = pos;
        w.rastreio("clique_whatsapp", dados);
        try{ w.dataLayer.push({event: "whatsapp_click", posicao: pos, pagina: location.pathname, event_id: eid}); }catch(x){}
        if(!negado()){
          try{ if(w.fbq) w.fbq("track", "Contact", {content_category: "whatsapp", posicao: pos}, {eventID: eid}); }catch(x){}
          w.rastreioServidor("whatsapp_click", {event_id: eid, posicao: pos});
        }
        return;
      }
      if(u && u.protocol === "tel:"){ dados.destino = "tel"; return w.rastreio("clique_telefone", dados); }
      if(u && /instagram\.com|facebook\.com|tiktok\.com|youtube\.com/.test(u.host)){ dados.rede = u.host.replace(/^www\./, "").split(".")[0]; return w.rastreio("clique_rede", dados); }
      var lg = el.getAttribute("data-lg") || (u && u.host === location.host && (u.pathname.match(/^\/(?:buzios\/)?(en|es)\/$/) || [])[1]);
      if(lg) return w.rastreio("clique_idioma", {idioma_novo: lg, area: ar});
      var m = u && u.host === location.host && u.pathname.match(/\/(?:lancha|escuna|jetski)\/([^\/]+)\/?$/);
      if(m) return w.rastreio("ver_lancha", {lancha: m[1], area: ar, botao: txt});
      w.rastreio("clique_botao", dados);
    }catch(x){}
  }, true);
  /* idioma pelo seletor (select) do topo */
  d.addEventListener("change", function(e){ var t = e.target; if(t && t.id === "lang") w.rastreio("clique_idioma", {idioma_novo: t.value, area: "topo"}); }, true);
})(window, document);
