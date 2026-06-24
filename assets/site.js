/* =========================================================================
   Prudential Advocate — site behavior
   Accessible disclosure menu, focus-trapped mobile nav, reveal-on-scroll,
   and the contact form (client-side validation + error summary + success).
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- Services disclosure menu (keyboard operable, NOT hover-only) ---------- */
  function initDisclosure() {
    var wrap = document.querySelector('[data-disclosure]');
    if (!wrap) return;
    var btn = wrap.querySelector('[data-disc-btn]');
    var menu = wrap.querySelector('[data-disc-menu]');
    if (!btn || !menu) return;
    var items = Array.prototype.slice.call(menu.querySelectorAll('a'));

    function open(focusFirst) {
      btn.setAttribute('aria-expanded', 'true');
      menu.setAttribute('data-open', 'true');
      // defer so the click/tap that opened the menu can't immediately close it
      setTimeout(function () { if (isOpen()) document.addEventListener('click', onDocClick, true); }, 0);
      if (focusFirst && items[0]) items[0].focus();
    }
    function close(returnFocus) {
      btn.setAttribute('aria-expanded', 'false');
      menu.removeAttribute('data-open');
      document.removeEventListener('click', onDocClick, true);
      if (returnFocus) btn.focus();
    }
    function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }
    function onDocClick(e) { if (!wrap.contains(e.target)) close(false); }

    btn.addEventListener('click', function (e) { e.preventDefault(); isOpen() ? close(false) : open(false); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); open(false); if (items.length) items[items.length - 1].focus(); }
      else if (e.key === 'Escape') { if (isOpen()) close(true); }
    });
    menu.addEventListener('keydown', function (e) {
      var idx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (items[idx + 1] || items[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (items[idx - 1] || items[items.length - 1]).focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') { close(false); }
    });

    // Desktop convenience: open on hover too (click + keyboard still work — not hover-only).
    // Listeners on the whole wrapper, so moving between the button and the menu doesn't close it.
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var hoverTimer;
      wrap.addEventListener('mouseenter', function () { clearTimeout(hoverTimer); if (!isOpen()) open(false); });
      wrap.addEventListener('mouseleave', function () { hoverTimer = setTimeout(function () { if (isOpen()) close(false); }, 160); });
    }
  }

  /* ---------- Mobile navigation (focus trap + Esc + body lock) ---------- */
  function initMobileNav() {
    var toggle = document.querySelector('[data-mnav-toggle]');
    var panel = document.querySelector('[data-mnav-panel]');
    var closeBtn = document.querySelector('[data-mnav-close]');
    if (!toggle || !panel) return;
    var lastFocused = null;

    function focusables() {
      return Array.prototype.slice.call(
        panel.querySelectorAll('a[href], button:not([disabled])')
      ).filter(function (el) { return el.offsetParent !== null; });
    }
    function open() {
      lastFocused = document.activeElement;
      panel.setAttribute('data-open', 'true');
      panel.removeAttribute('aria-hidden');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('scroll-lock');
      var f = focusables();
      if (f[0]) f[0].focus();
      document.addEventListener('keydown', onKey, true);
    }
    function close() {
      panel.removeAttribute('data-open');
      panel.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('scroll-lock');
      document.removeEventListener('keydown', onKey, true);
      if (lastFocused) lastFocused.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    toggle.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    // close when a destination link is chosen
    panel.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (a) close();
    });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Contact form ---------- */
  function initForm() {
    var form = document.querySelector('[data-inquiry-form]');
    if (!form) return;
    var summary = form.querySelector('[data-error-summary]');
    var summaryList = summary ? summary.querySelector('ul') : null;
    var success = document.querySelector('[data-form-success]');
    var honeypot = form.querySelector('[name="company_website"]');

    function fieldEl(input) {
      if (input && input._fs) return input._fs;
      if (!input || !input.closest) return null;
      return input.closest('.field') || input.closest('fieldset') || input.closest('.consent');
    }

    function validateInput(input) {
      var f = fieldEl(input);
      var valid = true, msg = '';
      var val = (input.value || '').trim();
      if (input.type === 'checkbox') {
        valid = input.checked;
        msg = 'You must acknowledge this before submitting.';
      } else if (input.tagName === 'FIELDSET' || input.dataset.group) {
        // radio group required
        var checked = form.querySelector('input[name="' + input.dataset.group + '"]:checked');
        valid = !!checked; msg = 'Please choose an option.';
      } else if (input.required) {
        if (!val) { valid = false; msg = 'This field is required.'; }
        else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { valid = false; msg = 'Enter a valid email address.'; }
        else if (input.type === 'tel' && val.replace(/[^0-9]/g, '').length < 7) { valid = false; msg = 'Enter a valid phone number.'; }
      }
      if (f) {
        f.classList.toggle('has-error', !valid);
        if (input.setAttribute) input.setAttribute('aria-invalid', valid ? 'false' : 'true');
        var em = f.querySelector('.err-msg');
        if (em && msg && !valid) { var t = em.querySelector('.err-txt'); if (t) t.textContent = msg; }
      }
      return valid;
    }

    // collect controls to validate
    function getControls() {
      var list = [];
      Array.prototype.forEach.call(form.querySelectorAll('input, select, textarea'), function (el) {
        if (el === honeypot) return;
        if (el.type === 'radio') return; // handled via group token below
        if (el.required || el.type === 'checkbox') list.push(el);
      });
      // required radio group(s)
      Array.prototype.forEach.call(form.querySelectorAll('fieldset[data-required-group]'), function (fs) {
        list.push({ tagName: 'FIELDSET', dataset: { group: fs.dataset.requiredGroup }, _fs: fs,
                    setAttribute: function () {}, required: true });
      });
      return list;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // honeypot — silently "succeed" for bots
      if (honeypot && honeypot.value) { return; }

      var controls = getControls();
      var invalid = [];
      controls.forEach(function (c) {
        var ok = validateInput(c);
        if (!ok) {
          var target = c._fs || c;
          var id, label;
          if (c.tagName === 'FIELDSET') {
            var lg = c._fs.querySelector('legend');
            label = lg ? lg.textContent.replace('(required)', '').trim() : 'Matter type';
            var firstRadio = c._fs.querySelector('input');
            id = firstRadio ? firstRadio.id : null;
          } else {
            var lab = form.querySelector('label[for="' + c.id + '"]');
            label = lab ? lab.textContent.replace('(required)', '').replace('*', '').trim() : (c.name || 'Field');
            id = c.id;
          }
          invalid.push({ id: id, label: label });
        }
      });

      if (invalid.length) {
        if (summaryList) {
          summaryList.innerHTML = '';
          invalid.forEach(function (it) {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = '#' + (it.id || '');
            a.textContent = it.label;
            a.addEventListener('click', function (ev) {
              ev.preventDefault();
              var el = document.getElementById(it.id);
              if (el) el.focus();
            });
            li.appendChild(a);
            summaryList.appendChild(li);
          });
        }
        if (summary) {
          summary.setAttribute('data-show', 'true');
          summary.setAttribute('tabindex', '-1');
          summary.focus();
        }
        return;
      }

      // success
      if (summary) summary.removeAttribute('data-show');
      form.querySelector('[data-form-fields]')?.setAttribute('hidden', '');
      if (success) {
        success.setAttribute('data-show', 'true');
        success.setAttribute('tabindex', '-1');
        success.focus();
      }
    });

    // live-clear errors once a field becomes valid
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t === honeypot) return;
      var f = fieldEl(t);
      if (f && f.classList.contains('has-error')) validateInput(t);
    });
    form.addEventListener('change', function (e) {
      if (e.target.type === 'radio') {
        var fs = e.target.closest('fieldset');
        if (fs && fs.classList.contains('has-error')) fs.classList.remove('has-error');
      }
    });
  }

  /* ---------- Hero carousel (crossfade, auto-advance, accessible) ---------- */
  function initHero() {
    var hero = document.querySelector('[data-hero]');
    if (!hero) return;
    var slides = Array.prototype.slice.call(hero.querySelectorAll('.hero__slide'));
    var dots = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-dot]'));
    if (slides.length < 2) return;

    var i = 0, timer = null;
    var INTERVAL = 6000;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    function motionOff() {
      return reduce.matches || document.documentElement.classList.contains('pa-reduce-motion');
    }
    function show(n) {
      n = (n + slides.length) % slides.length;
      if (n === i) return;
      slides[i].classList.remove('is-active');
      if (dots[i]) dots[i].setAttribute('aria-current', 'false');
      i = n;
      slides[i].classList.add('is-active');
      if (dots[i]) dots[i].setAttribute('aria-current', 'true');
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      stop();
      if (motionOff()) return;
      timer = setInterval(function () { show(i + 1); }, INTERVAL);
    }

    dots.forEach(function (d, n) {
      d.addEventListener('click', function () { show(n); start(); });
    });
    // pause while the user hovers, focuses inside, or the tab is hidden
    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', start);
    hero.addEventListener('focusin', stop);
    hero.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    if (reduce.addEventListener) reduce.addEventListener('change', function () { motionOff() ? stop() : start(); });

    start();
  }

  /* ---------- init ---------- */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  /* ---------- Sticky header scroll state (robust to any scroll container) ---------- */
  function initHeaderScroll() {
    var h = document.querySelector('.site-header');
    if (!h) return;
    if ('IntersectionObserver' in window) {
      var sentinel = document.createElement('div');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none';
      document.body.prepend(sentinel);
      new IntersectionObserver(function (entries) {
        h.classList.toggle('is-scrolled', !entries[0].isIntersecting);
      }, { threshold: 0 }).observe(sentinel);
    }
    // fallback for window-scrolling contexts
    var on = false;
    function upd() {
      var s = (window.scrollY || document.documentElement.scrollTop || 0) > 8;
      if (s !== on) { on = s; h.classList.toggle('is-scrolled', s); }
    }
    window.addEventListener('scroll', upd, { passive: true });
  }

  /* ---------- Active nav marker ---------- */
  function initActiveNav() {
    var page = document.body.getAttribute('data-page');
    if (!page) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (el) {
      if (el.getAttribute('data-nav') === page) {
        el.setAttribute('aria-current', 'page');
      }
    });
  }

  ready(function () {
    initDisclosure();
    initMobileNav();
    initHero();
    initReveal();
    initForm();
    initActiveNav();
    initHeaderScroll();
    // current year
    var y = document.querySelector('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
    // load audit enhancements (accessibility view modes + EN/ES language + demo nav)
    if (!document.querySelector('script[data-pa-enhance]')) {
      var ph = document.createElement('script');
      ph.src = 'assets/enhance.js';
      ph.setAttribute('data-pa-enhance', '');
      document.body.appendChild(ph);
    }
  });
})();
