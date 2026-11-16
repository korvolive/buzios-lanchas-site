/* Marca Bordazul (2026-11-16): o mesmo site de Búzios (vitrine, conta e pagamento) aberto por bordazul.com.br/buzios
   aparece com o nome, as cores e a fonte do Bordazul, para o cliente não sentir que saiu do Bordazul.
   Fora do bordazul.com.br este arquivo não faz nada. Carregado cedo, no <head>, por index.html, login/ e pagar/. */
(function(){
  var h = location.hostname;
  if(!/(^|\.)bordazul\.com\.br$/.test(h) && !/^bordazul\.(test|localhost)$/.test(h)) return;
  window.MARCA = "bordazul";
  window.MARCA_BASE = "/buzios";
  var d = document, de = d.documentElement;
  de.setAttribute("data-marca", "bordazul");

  /* cores e fonte do Bordazul por cima das variáveis do site de Búzios */
  var f = d.createElement("link"); f.rel = "stylesheet";
  f.href = "https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&display=swap";
  d.head.appendChild(f);
  var st = d.createElement("style");
  st.textContent =
    ':root[data-marca="bordazul"]{--sea:#0a63e8;--sea-deep:#071c35;--brass:#f5b82e;--brass-ink:#2a1d00;--chip:#e6effd;--bg:#f4f7fb;--line:#dbe4f0;--ink:#0d1b2e;--muted:#56657a;--full:#071c35;' +
      '--display:"Urbanist",ui-sans-serif,system-ui,sans-serif;--body:"Urbanist",ui-sans-serif,system-ui,sans-serif}' +
    '@media (prefers-color-scheme:dark){:root[data-marca="bordazul"]:not([data-theme="light"]){--sea:#6fa8ff;--sea-deep:#06142a;--brass:#ffc94d;--chip:#14284a;--bg:#071223;--line:#1b2c47;--full:#6fa8ff}}' +
    ':root[data-marca="bordazul"][data-theme="dark"]{--sea:#6fa8ff;--sea-deep:#06142a;--brass:#ffc94d;--chip:#14284a;--bg:#071223;--line:#1b2c47;--full:#6fa8ff}' +
    /* o app da Búzios Lanchas não é oferecido no Bordazul */
    '[data-marca="bordazul"] #gapill,[data-marca="bordazul"] #gamodal,[data-marca="bordazul"] .get-app,[data-marca="bordazul"] footer div:has(> h3[data-t="footApp"]){display:none!important}' +
    '[data-marca="bordazul"] .logo .bz-logo{flex:none}';
  d.head.appendChild(st);

  /* nome: "a Búzios Lanchas" vira "o Bordazul" (Bordazul é masculino) */
  var R = [
    [/\bda Búzios Lanchas/g, "do Bordazul"], [/\bDa Búzios Lanchas/g, "Do Bordazul"],
    [/\bna Búzios Lanchas/g, "no Bordazul"], [/\bNa Búzios Lanchas/g, "No Bordazul"],
    [/\bpela Búzios Lanchas/g, "pelo Bordazul"], [/\bPela Búzios Lanchas/g, "Pelo Bordazul"],
    [/à Búzios Lanchas/g, "ao Bordazul"], [/À Búzios Lanchas/g, "Ao Bordazul"],
    [/(^|[\s(“"'>])a Búzios Lanchas/g, "$1o Bordazul"], [/(^|[\s(“"'>])A Búzios Lanchas/g, "$1O Bordazul"],
    [/BÚZIOS LANCHAS/g, "BORDAZUL"], [/Búzios Lanchas/g, "Bordazul"], [/Buzios Lanchas/g, "Bordazul"],
    [/(www\.)?lanchaembuzios\.com\.br/g, "bordazul.com.br"]
  ];
  function troca(s){
    if(!s || (s.indexOf("anchas") < 0 && s.indexOf("lanchaembuzios") < 0)) return s;
    for(var i = 0; i < R.length; i++) s = s.replace(R[i][0], R[i][1]);
    return s;
  }
  window.MARCA_TROCA = troca;
  /* mensagem pronta do WhatsApp (wa.me/...?text=) também com o nome do Bordazul */
  function zap(u){
    if(!u || !/wa\.me|whatsapp\.com/.test(u)) return u;
    return u.replace(/([?&]text=)([^&#]*)/, function(m, k, t){ try{ var x = decodeURIComponent(t.replace(/\+/g, " ")), y = troca(x); return y === x ? m : k + encodeURIComponent(y); }catch(e){ return m; } });
  }
  var abre = window.open;
  window.open = function(u){ var a = [].slice.call(arguments); if(typeof u === "string") a[0] = zap(u); return abre.apply(window, a); };
  var ATTR = ["placeholder", "title", "aria-label", "alt", "content"];
  /* endereços das páginas de Búzios ganham o /buzios na frente; /login/, /pagar/, /img/ etc. ficam iguais */
  var B = window.MARCA_BASE;
  function caminho(a){
    if(a.id === "logo" || a.hasAttribute("data-bz-home")) return;
    var v = a.getAttribute("href");
    if(v && v.charAt(0) !== "/"){ var z = zap(v); if(z !== v) a.setAttribute("href", z); return; }
    if(!v || v.charAt(0) !== "/" || v.indexOf(B + "/") === 0 || v === B) return;
    if(/^\/(#|\?|$|lancha\/|en(\/|$)|es(\/|$))/.test(v)) a.setAttribute("href", B + v);
  }
  var LOGO = '<svg class="bz-logo" width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#0a63e8"/><path d="M5 18c2.2 0 2.2-2 4.4-2s2.2 2 4.4 2 2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M8 23c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6" fill="none" stroke="#f5b82e" stroke-width="2.4" stroke-linecap="round"/></svg>';
  function no(n){
    if(n.nodeType === 3){ var t = troca(n.nodeValue); if(t !== n.nodeValue) n.nodeValue = t; return; }
    if(n.nodeType !== 1) return;
    var tag = n.tagName;
    if(tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") return;
    if(tag === "svg" && !n.classList.contains("bz-logo") && n.parentNode && n.parentNode.classList && n.parentNode.classList.contains("logo")){
      n.insertAdjacentHTML("afterend", LOGO); n.remove(); return;
    }
    for(var i = 0; i < ATTR.length; i++){ var v = n.getAttribute && n.getAttribute(ATTR[i]); if(v){ var t2 = troca(v); if(t2 !== v) n.setAttribute(ATTR[i], t2); } }
    if(tag === "A") caminho(n);
    if(tag === "IMG" && /\/(login\/icon-|apple-touch-icon)/.test(n.getAttribute("src") || "")) n.setAttribute("src", "/favicon.svg");
    if(tag === "INPUT" && (n.type === "button" || n.type === "submit") && n.value){ var t3 = troca(n.value); if(t3 !== n.value) n.value = t3; }
    for(var c = n.firstChild; c; c = c.nextSibling) no(c);
  }
  function titulo(){ var t = troca(d.title); if(t !== d.title) d.title = t; }
  var mo = new MutationObserver(function(L){
    for(var i = 0; i < L.length; i++){
      var m = L[i];
      if(m.type === "characterData") no(m.target);
      else if(m.type === "attributes") no(m.target);
      else for(var j = 0; j < m.addedNodes.length; j++) no(m.addedNodes[j]);
    }
    titulo();
  });
  mo.observe(de, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR.concat(["href", "src"])});
  /* ícone da aba e da tela inicial */
  function icone(){
    var q = d.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"],link[rel="apple-touch-icon-precomposed"]');
    for(var i = 0; i < q.length; i++) q[i].remove();
    var l = d.createElement("link"); l.rel = "icon"; l.type = "image/svg+xml"; l.href = "/favicon.svg"; d.head.appendChild(l);
    var mt = d.querySelector('meta[name="theme-color"]'); if(mt) mt.setAttribute("content", "#071c35");
  }
  if(d.readyState === "loading") d.addEventListener("DOMContentLoaded", function(){ icone(); no(d.body); titulo(); });
  else { icone(); no(d.body); titulo(); }
})();
