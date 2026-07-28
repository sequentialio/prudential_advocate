/* Prudential Advocate — article portal.
   Auth + data via Supabase (RLS enforces: anon sees published only,
   signed-in firm users manage everything). Markdown is rendered to HTML
   client-side (marked + DOMPurify) and stored alongside the source so the
   public pages never need a markdown library. */
(function () {
  "use strict";
  var SUPABASE_URL = "https://gsvdtgtkhnpqlwhbsfal.supabase.co";
  var SUPABASE_KEY = "sb_publishable_riHDkJRmnkIZPmpT3tnKDA_WDNCBoTB"; // publishable — safe in client code
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  var doc = document;
  var views = { login: q('[data-view="login"]'), list: q('[data-view="list"]'), editor: q('[data-view="editor"]') };
  var current = null; // article being edited (null = new)

  function q(sel) { return doc.querySelector(sel); }
  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    q("[data-signout]").hidden = name === "login";
    window.scrollTo(0, 0);
  }
  function msg(el, kind, text) {
    el.setAttribute("data-kind", kind);
    el.textContent = text;
    if (kind === "ok") setTimeout(function () { el.removeAttribute("data-kind"); }, 4000);
  }
  function renderMd(md) {
    return DOMPurify.sanitize(marked.parse(md || "", { breaks: false }), {
      ALLOWED_TAGS: ["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "a", "blockquote", "br", "hr"],
      ALLOWED_ATTR: ["href"],
    });
  }
  function slugify(s) {
    return String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }

  /* ---------------- auth ---------------- */
  var loginForm = q("[data-login-form]");
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = new FormData(loginForm);
    sb.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") }).then(function (r) {
      if (r.error) { msg(q("[data-login-msg]"), "err", "Sign-in failed: " + r.error.message); return; }
      loadList();
    });
  });
  q("[data-signout]").addEventListener("click", function () {
    sb.auth.signOut().then(function () { show("login"); });
  });

  /* ---------------- list ---------------- */
  function loadList() {
    sb.from("articles").select("*").order("updated_at", { ascending: false }).then(function (r) {
      if (r.error) { msg(q("[data-list-msg]"), "err", r.error.message); return; }
      var wrap = q("[data-article-list]");
      wrap.innerHTML = "";
      if (!r.data.length) {
        wrap.innerHTML = '<p class="muted">No articles yet — click &ldquo;New article&rdquo; to write your first one.</p>';
      }
      r.data.forEach(function (a) {
        var row = doc.createElement("div");
        row.className = "portal-row";
        var badge = a.published
          ? '<span class="badge badge--live">Live</span>'
          : '<span class="badge badge--draft">Draft</span>';
        row.innerHTML =
          '<div class="grow"><strong></strong><br><span class="hint-sm">/articles/' + a.slug + " &middot; " + a.category + "</span></div>" +
          badge +
          '<button class="btn btn--outline btn--sm" type="button">Edit</button>' +
          (a.published ? '<a class="btn btn--outline btn--sm" target="_blank" rel="noopener" href="/articles/' + a.slug + '">View</a>' : "");
        row.querySelector("strong").textContent = a.title;
        row.querySelector("button").addEventListener("click", function () { openEditor(a); });
        wrap.appendChild(row);
      });
      show("list");
    });
  }

  /* ---------------- editor ---------------- */
  var form = q("[data-editor-form]");
  var slugTouched = false;

  q("[data-new-article]").addEventListener("click", function () { openEditor(null); });
  q("[data-back]").addEventListener("click", function () { loadList(); });

  form.title.addEventListener("input", function () {
    if (!slugTouched && !current) form.slug.value = slugify(form.title.value);
  });
  form.slug.addEventListener("input", function () { slugTouched = true; });

  function openEditor(article) {
    current = article;
    slugTouched = !!article;
    q("[data-editor-title]").textContent = article ? "Edit article" : "New article";
    form.reset();
    q("[data-preview]").hidden = true;
    if (article) {
      form.title.value = article.title;
      form.slug.value = article.slug;
      form.category.value = article.category;
      form.meta_description.value = article.meta_description;
      form.read_minutes.value = article.read_minutes;
      form.body_md.value = article.body_md;
    }
    q("[data-publish]").hidden = !(article && !article.published);
    q("[data-unpublish]").hidden = !(article && article.published);
    q("[data-delete]").hidden = !article;
    q("[data-save]").textContent = article && article.published ? "Save changes" : "Save draft";
    show("editor");
  }

  function collect() {
    return {
      title: form.title.value.trim(),
      slug: slugify(form.slug.value),
      category: form.category.value,
      meta_description: form.meta_description.value.trim(),
      read_minutes: Math.max(1, Math.min(60, parseInt(form.read_minutes.value, 10) || 4)),
      body_md: form.body_md.value,
      body_html: renderMd(form.body_md.value),
    };
  }

  function save(extra, okText) {
    if (!form.reportValidity()) return;
    var data = Object.assign(collect(), extra || {});
    var op = current
      ? sb.from("articles").update(data).eq("id", current.id).select().single()
      : sb.from("articles").insert(data).select().single();
    op.then(function (r) {
      if (r.error) {
        var m = r.error.message.indexOf("duplicate key") !== -1
          ? "That web address (slug) is already used by another article — pick a different one."
          : r.error.message;
        msg(q("[data-editor-msg]"), "err", m);
        return;
      }
      current = r.data;
      openEditor(r.data);
      msg(q("[data-editor-msg]"), "ok", okText || "Saved.");
    });
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); save(); });
  q("[data-publish]").addEventListener("click", function () {
    save({ published: true, published_at: new Date().toISOString() }, "Published — it's live on the Resources page.");
  });
  q("[data-unpublish]").addEventListener("click", function () {
    save({ published: false }, "Unpublished — removed from the Resources page.");
  });
  q("[data-delete]").addEventListener("click", function () {
    if (!current) return;
    if (!window.confirm('Delete "' + current.title + '" permanently? This cannot be undone.')) return;
    sb.from("articles").delete().eq("id", current.id).then(function (r) {
      if (r.error) { msg(q("[data-editor-msg]"), "err", r.error.message); return; }
      loadList();
    });
  });

  q("[data-preview-toggle]").addEventListener("click", function () {
    var pane = q("[data-preview]");
    pane.hidden = !pane.hidden;
    if (!pane.hidden) q("[data-preview-body]").innerHTML = renderMd(form.body_md.value);
  });

  /* ---------------- boot ---------------- */
  sb.auth.getSession().then(function (r) {
    if (r.data.session) loadList();
    else show("login");
  });
})();
