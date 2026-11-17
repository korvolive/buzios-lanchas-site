/* Nenhum campo de valor aceita número abaixo de zero, nunca (2026-11-17).
   Vale para todo <input type="number"> e para campos de texto marcados com data-nn (preço, %, pessoas...).
   Bloqueia o "-" (e o "+" e o "e" de expoente) ao digitar, tira o sinal ao colar e, se ainda assim
   aparecer um negativo, troca pelo número sem sinal antes de a página ler o campo.
   O banco também recusa negativo (CHECK >= 0), então isto é só para a tela nunca mostrar nem mandar. */
(function(){
  var d = document;
  function alvo(el){ return el && el.tagName === "INPUT" && (el.type === "number" || el.hasAttribute("data-nn")); }
  function limpa(s, num){ s = String(s).replace(/[-+−–—]/g, ""); return num ? s.replace(/[eE]/g, "") : s; }
  function conserta(el, fim){
    if(el.type === "number"){
      if(fim && el.validity && el.validity.badInput){ el.value = ""; return true; }   /* ex.: "270-" que o navegador não entende; só ao sair do campo */
      if(el.value !== "" && (+el.value < 0 || /[-+]/.test(el.value))){ el.value = limpa(el.value, true); return true; }
      return false;
    }
    if(/[-+−–—]/.test(el.value)){ var p = el.selectionStart, v0 = el.value.length; el.value = limpa(el.value); try{ var q = Math.max(0, (p||0) - (v0 - el.value.length)); el.setSelectionRange(q, q); }catch(e){} return true; }
    return false;
  }
  d.addEventListener("keydown", function(e){
    if(!alvo(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if(k === "-" || k === "+" || k === "−" || k === "Subtract" || (e.target.type === "number" && (k === "e" || k === "E"))) e.preventDefault();
  }, true);
  d.addEventListener("beforeinput", function(e){
    if(!alvo(e.target) || !e.data || !/[-+−–—]/.test(e.data)) return;
    if(e.inputType === "insertText" || e.inputType === "insertCompositionText"){ if(e.cancelable) e.preventDefault(); }
  }, true);
  d.addEventListener("paste", function(e){
    var el = e.target; if(!alvo(el)) return;
    var cd = e.clipboardData || window.clipboardData, s = cd ? cd.getData("text") : "";
    if(!/[-+−–—]/.test(s)) return;
    e.preventDefault();
    var limpo = limpa(s, el.type === "number").trim();
    if(el.type === "number") el.value = limpo.replace(",", ".");
    else if(typeof el.setRangeText === "function") el.setRangeText(limpo, el.selectionStart, el.selectionEnd, "end");
    else el.value = limpo;
    el.dispatchEvent(new Event("input", {bubbles:true}));
  }, true);
  /* rede de segurança: roda antes dos ouvintes da página (fase de captura) */
  ["input", "change", "blur"].forEach(function(ev){
    d.addEventListener(ev, function(e){ if(alvo(e.target)) conserta(e.target, ev !== "input"); }, true);
  });
})();
