/* =========================================================================
   Prudential Advocate — audit enhancements
   1) Accessibility view modes (high contrast, larger text, underline links,
      reduce motion) — persisted, applied site-wide.
   2) Full English↔Spanish translation engine (text nodes + attributes +
      <title>/meta), persisted, with a MutationObserver for dynamic content.
   3) Injects the "Demo" nav link, a language switch, and a floating
      accessibility button + panel on every page.
   Loaded by site.js so it applies to all pages with no per-page edits.
   ========================================================================= */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var PREFS_KEY = "pa_prefs", LANG_KEY = "pa_lang";

  /* ---------------- preferences storage ---------------- */
  function read(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var prefs = read(PREFS_KEY, {});
  var lang = (localStorage.getItem(LANG_KEY) === "es") ? "es" : "en";

  /* ---------------- accessibility view modes ---------------- */
  var MODES = [
    { key: "contrast", cls: "pa-contrast",      label: "High contrast", desc: "Maximum contrast between text and background" },
    { key: "textlarge", cls: "pa-textlarge",    label: "Larger text",   desc: "Increase the text size" },
    { key: "underline", cls: "pa-underline",    label: "Underline links", desc: "Underline every link" },
    { key: "reduce",   cls: "pa-reduce-motion", label: "Reduce motion", desc: "Turn off animations" }
  ];
  function applyModes() { MODES.forEach(function (m) { root.classList.toggle(m.cls, !!prefs[m.key]); }); }
  function setMode(key, on) { prefs[key] = !!on; write(PREFS_KEY, prefs); applyModes(); syncControls(); }
  function resetAll() {
    prefs = {}; write(PREFS_KEY, prefs); applyModes();
    setLang("en"); syncControls();
  }
  applyModes();

  /* ---------------- translation engine ---------------- */
  /* UI strings for injected controls + demo toolbar (merged over the page dict) */
  var EXTRA_ES = {
    "Demo": "Demo",
    "Team": "Equipo",
    "Accessibility & language": "Accesibilidad e idioma",
    "Accessibility and language options": "Opciones de accesibilidad e idioma",
    "Language": "Idioma",
    "English": "Inglés",
    "Español": "Español",
    "High contrast": "Alto contraste",
    "Larger text": "Texto más grande",
    "Underline links": "Subrayar enlaces",
    "Reduce motion": "Reducir movimiento",
    "Maximum contrast between text and background": "Máximo contraste entre texto y fondo",
    "Increase the text size": "Aumentar el tamaño del texto",
    "Underline every link": "Subrayar todos los enlaces",
    "Turn off animations": "Desactivar las animaciones",
    "Reset all": "Restablecer todo",
    "Close": "Cerrar",
    "View this site in Spanish": "Ver este sitio en español",
    "View this site in English": "Ver este sitio en inglés"
  };
  var dict = null, dictLoading = false;
  var touchedText = [];   // {node, en}
  var touchedAttr = [];   // {el, attr, en}
  var applying = false;   // guards MutationObserver against our own writes
  var observer = null;

  function norm(s) { return s.replace(/\s+/g, " ").trim(); }

  function loadDict(cb) {
    if (dict) { cb && cb(); return; }
    if (window.PA_I18N_ES) { dict = Object.assign({}, EXTRA_ES, window.PA_I18N_ES); cb && cb(); return; }
    if (dictLoading) { var t = setInterval(function () { if (window.PA_I18N_ES) { clearInterval(t); dict = Object.assign({}, EXTRA_ES, window.PA_I18N_ES); cb && cb(); } }, 40); return; }
    dictLoading = true;
    var s = doc.createElement("script");
    s.src = "assets/i18n-es.js";
    s.onload = function () { dict = Object.assign({}, EXTRA_ES, window.PA_I18N_ES || {}); cb && cb(); };
    s.onerror = function () { dict = Object.assign({}, EXTRA_ES); cb && cb(); };
    doc.head.appendChild(s);
  }

  function translateEl(el) {
    if (!dict) return;
    // text nodes
    var walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !/\S/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest("[data-no-i18n]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      if (node.__paES) return;
      var raw = node.nodeValue, key = norm(raw);
      // a parent element's data-es overrides the shared dictionary (e.g. gendered role labels)
      var pe = node.parentElement;
      var ov = pe && pe.getAttribute ? pe.getAttribute("data-es") : null;
      var es = (ov != null && ov !== "") ? ov : dict[key];
      if (es == null || es === key) return;
      var lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
      touchedText.push({ node: node, en: raw });
      node.__paES = true;
      node.nodeValue = lead + es + trail;
    });
    // attributes
    ["placeholder", "aria-label", "alt", "title"].forEach(function (attr) {
      var els = el.querySelectorAll ? el.querySelectorAll("[" + attr + "]") : [];
      Array.prototype.forEach.call(els, function (e2) {
        if (e2.closest && e2.closest("[data-no-i18n]")) return;
        var v = e2.getAttribute(attr); if (!v) return;
        var es = dict[norm(v)];
        if (es == null || es === norm(v)) return;
        if (e2.__paAttr && e2.__paAttr[attr]) return;
        e2.__paAttr = e2.__paAttr || {};
        e2.__paAttr[attr] = true;
        touchedAttr.push({ el: e2, attr: attr, en: v });
        e2.setAttribute(attr, es);
      });
    });
  }

  function translateHead() {
    if (!dict) return;
    // <title>
    var t = norm(doc.title); if (dict[t] && dict[t] !== t) { touchedAttr.push({ el: doc, attr: "__title", en: doc.title }); doc.title = dict[t]; }
    // meta
    ["description"].forEach(function (nm) {
      var m = doc.querySelector('meta[name="' + nm + '"]'); if (!m) return;
      var v = m.getAttribute("content"), es = v && dict[norm(v)];
      if (es && es !== norm(v)) { touchedAttr.push({ el: m, attr: "content", en: v }); m.setAttribute("content", es); }
    });
  }

  function toES() {
    applying = true;
    translateEl(doc.body);
    translateHead();
    root.setAttribute("lang", "es");
    applying = false;
  }
  function toEN() {
    applying = true;
    touchedText.forEach(function (r) { try { r.node.nodeValue = r.en; r.node.__paES = false; } catch (e) {} });
    touchedAttr.forEach(function (r) {
      try {
        if (r.attr === "__title") doc.title = r.en;
        else r.el.setAttribute(r.attr, r.en);
        if (r.el.__paAttr) r.el.__paAttr[r.attr] = false;
      } catch (e) {}
    });
    touchedText = []; touchedAttr = [];
    root.setAttribute("lang", "en");
    applying = false;
  }

  function setLang(next) {
    next = (next === "es") ? "es" : "en";
    if (next === lang && (next === "en" || dict)) { syncControls(); return; }
    lang = next;
    localStorage.setItem(LANG_KEY, lang);
    if (lang === "es") { loadDict(function () { toES(); startObserver(); }); }
    else { toEN(); }
    syncControls();
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function (muts) {
      if (applying || lang !== "es" || !dict) return;
      applying = true;
      muts.forEach(function (m) {
        if (m.type === "childList") {
          Array.prototype.forEach.call(m.addedNodes, function (node) {
            if (node.nodeType === 1) translateEl(node);
            else if (node.nodeType === 3) {
              var raw = node.nodeValue, es = dict[norm(raw || "")];
              if (es && !node.__paES) { touchedText.push({ node: node, en: raw }); node.__paES = true; node.nodeValue = es; }
            }
          });
        } else if (m.type === "characterData" && m.target && !m.target.__paES) {
          var raw2 = m.target.nodeValue, es2 = dict[norm(raw2 || "")];
          if (es2 && es2 !== norm(raw2)) { touchedText.push({ node: m.target, en: raw2 }); m.target.__paES = true; m.target.nodeValue = es2; }
        }
      });
      applying = false;
    });
    observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
  }

  /* ---------------- control wiring / sync ---------------- */
  function syncControls() {
    // language buttons
    Array.prototype.forEach.call(doc.querySelectorAll(".pa-lang button[data-lang]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang));
    });
    // mode switches
    Array.prototype.forEach.call(doc.querySelectorAll("[data-pa-mode]"), function (input) {
      input.checked = !!prefs[input.getAttribute("data-pa-mode")];
    });
  }

  function makeLangControl() {
    var w = doc.createElement("div");
    w.className = "pa-lang"; w.setAttribute("role", "group"); w.setAttribute("aria-label", "Language");
    w.setAttribute("data-no-i18n", "");
    w.innerHTML =
      '<button type="button" data-lang="en" aria-pressed="' + (lang === "en") + '" title="View this site in English">EN</button>' +
      '<button type="button" data-lang="es" lang="es" aria-pressed="' + (lang === "es") + '" title="Ver este sitio en español">ES</button>';
    w.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-lang]"); if (!b) return;
      setLang(b.getAttribute("data-lang"));
    });
    return w;
  }

  /* ---------------- DOM injection ---------------- */
  function injectNav() {
    // Desktop "Demo" link (before Contact)
    var primary = doc.querySelector(".nav__primary");
    if (primary && !primary.querySelector('[data-nav="demo"]')) {
      var li = doc.createElement("li");
      li.innerHTML = '<a class="nav__link" href="demo.html" data-nav="demo">Demo</a>';
      var contact = primary.querySelector('a[data-nav="contact"]');
      if (contact) primary.insertBefore(li, contact.parentNode); else primary.appendChild(li);
    }
    // current-page marker for Demo
    if (doc.body.getAttribute("data-page") === "demo") {
      var d = doc.querySelector('[data-nav="demo"]'); if (d) d.setAttribute("aria-current", "page");
    }
    // Mobile nav: Demo link (language switch intentionally NOT in nav —
    // language is geo-detected automatically; the demo page exposes a manual toggle)
    var mContact = doc.querySelector('.mnav .mnav__list a[href="contact.html"]');
    if (mContact && !doc.querySelector('.mnav .mnav__list a[href="demo.html"]')) {
      var ma = doc.createElement("a"); ma.href = "demo.html"; ma.textContent = "Demo";
      mContact.parentNode.insertBefore(ma, mContact.nextSibling);
    }
  }

  function injectA11y() {
    if (doc.querySelector(".pa-fab")) return;
    var fab = doc.createElement("button");
    fab.className = "pa-fab"; fab.type = "button"; fab.setAttribute("aria-haspopup", "dialog");
    fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-controls", "pa-a11y-panel");
    fab.setAttribute("aria-label", "Accessibility and language options"); fab.setAttribute("data-no-i18n", "");
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="6.9" r="1.4" fill="currentColor"/><path d="M5.5 9.3c2 .8 4.2 1.2 6.5 1.2s4.5-.4 6.5-1.2M12 10.6V15m0 0-2.3 4M12 15l2.3 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var panel = doc.createElement("div");
    panel.className = "pa-panel"; panel.id = "pa-a11y-panel"; panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Accessibility and language");
    var rows = MODES.map(function (m) {
      return '<div class="pa-row"><span class="pa-row__label">' + m.label + '<small>' + m.desc + '</small></span>' +
        '<label class="pa-switch"><input type="checkbox" data-pa-mode="' + m.key + '" aria-label="' + m.label + '"><span class="track"></span><span class="thumb"></span></label></div>';
    }).join("");
    panel.innerHTML =
      '<div class="pa-panel__head"><h2>Accessibility</h2>' +
      '<button class="pa-panel__close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>' +
      rows +
      '<button class="pa-panel__reset" type="button">Reset all</button>';

    doc.body.appendChild(fab);
    doc.body.appendChild(panel);

    function open() {
      panel.setAttribute("data-open", "true"); fab.setAttribute("aria-expanded", "true");
      var first = panel.querySelector("button, input"); if (first) first.focus();
      doc.addEventListener("click", outside, true); doc.addEventListener("keydown", onKey, true);
    }
    function close(returnFocus) {
      panel.removeAttribute("data-open"); fab.setAttribute("aria-expanded", "false");
      doc.removeEventListener("click", outside, true); doc.removeEventListener("keydown", onKey, true);
      if (returnFocus) fab.focus();
    }
    function outside(e) { if (!panel.contains(e.target) && e.target !== fab && !fab.contains(e.target)) close(false); }
    function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(true); } }

    fab.addEventListener("click", function () {
      (panel.getAttribute("data-open") === "true") ? close(false) : open();
    });
    panel.querySelector(".pa-panel__close").addEventListener("click", function () { close(true); });
    panel.querySelector(".pa-panel__reset").addEventListener("click", function () { resetAll(); });
    panel.addEventListener("change", function (e) {
      var input = e.target.closest("[data-pa-mode]"); if (!input) return;
      setMode(input.getAttribute("data-pa-mode"), input.checked);
    });
  }

  /* expose a tiny API for the demo page's inline controls */
  window.PA = {
    setLang: setLang, getLang: function () { return lang; },
    setMode: setMode, getMode: function (k) { return !!prefs[k]; },
    resetAll: resetAll, MODES: MODES
  };

  /* ---------------- init ---------------- */
  function init() {
    injectNav();
    injectA11y();
    syncControls();
    if (lang === "es") { loadDict(function () { toES(); startObserver(); syncControls(); }); }
  }
  if (doc.readyState !== "loading") init();
  else doc.addEventListener("DOMContentLoaded", init);
})();
