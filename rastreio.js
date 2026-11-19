/* Rastreio padrão do Google (2026-11-19, pedido do Rodrigo/Zaaitar): vale para a Búzios Lanchas, a Bordazul e toda cidade nova.
   - Carrega o Google Tag Manager GTM-NVP9L5DF (o mesmo do site antigo: Google Ads AW-16871561415 + Google Analytics G-NYEL6BGFBF)
     só se a página ainda não carregou. O GTM já conta como conversão do Google Ads todo clique em link wa.me.
   - Todo clique em botão ou link manda um evento para o Google Analytics, com nome próprio para os importantes:
     clique_whatsapp, clique_telefone, clique_rede (Instagram/Facebook), clique_idioma, ver_lancha, clique_botao (os outros).
   - window.rastreio(nome, dados) manda um evento de negócio (consulta, pedido, conta criada, pagamento) a partir do código da página.
   Nada de dado pessoal: só o texto curto do botão (sem números nem e-mail), a área da página e o endereço sem a parte do "?".
   Fica fora do app de iPhone (o GTM também fica fora lá). Os geradores de bordazul/, rj/ e regiao/ embutem este arquivo no <head>. */
(function(w, d){
  if(w.rastreio) return;
  var GA = "G-NYEL6BGFBF", GTM = "GTM-NVP9L5DF";
  var ios = /BuziosLanchasIOS/.test(navigator.userAgent);
  w.dataLayer = w.dataLayer || [];
  function gtag(){ w.dataLayer.push(arguments); }
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
  var limpa = function(t){ return String(t || "").replace(/\S+@\S+/g, "").replace(/[\d()+\-.\s]{6,}/g, " ").replace(/\s+/g, " ").trim().slice(0, 40); };
  var area = function(el){
    var a = el.closest("[data-area]"); if(a) return a.getAttribute("data-area");
    var s = el.closest("dialog,header,footer,nav,section[id],aside[id],main[id],[id^='pk-'],[class*='card']");
    if(!s) return "";
    return s.id || (s.tagName === "DIALOG" ? "janela" : s.tagName.toLowerCase() === "div" ? String(s.className).split(" ")[0] : s.tagName.toLowerCase());
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
        dados.destino = "whatsapp"; return w.rastreio("clique_whatsapp", dados);
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
