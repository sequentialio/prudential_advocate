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
  var views = {
    login: q('[data-view="login"]'),
    list: q('[data-view="list"]'),
    editor: q('[data-view="editor"]'),
    inquiries: q('[data-view="inquiries"]'),
    users: q('[data-view="users"]'),
    account: q('[data-view="account"]'),
  };
  var current = null; // article being edited (null = new)

  function q(sel) { return doc.querySelector(sel); }
  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    q("[data-signout]").hidden = name === "login";
    q("[data-tabs]").hidden = name === "login";
    var tabFor = { list: "articles", editor: "articles", inquiries: "inquiries", users: "users", account: "account" };
    Array.prototype.forEach.call(doc.querySelectorAll("[data-tab]"), function (b) {
      if (b.getAttribute("data-tab") === tabFor[name]) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
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
      refreshUnread();
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

  /* ---------------- tabs ---------------- */
  Array.prototype.forEach.call(doc.querySelectorAll("[data-tab]"), function (b) {
    b.addEventListener("click", function () {
      var t = b.getAttribute("data-tab");
      if (t === "articles") loadList();
      else if (t === "inquiries") loadInquiries();
      else if (t === "users") loadUsers();
      else if (t === "account") showAccount();
    });
  });

  /* ---------------- messages (inquiries) ---------------- */
  function fmtWhen(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  function refreshUnread() {
    sb.from("inquiries").select("id", { count: "exact", head: true }).eq("is_read", false).then(function (r) {
      var badge = q("[data-unread-badge]");
      if (r.count > 0) { badge.hidden = false; badge.textContent = r.count + " new"; }
      else badge.hidden = true;
    });
  }
  function loadInquiries() {
    sb.from("inquiries").select("*").order("created_at", { ascending: false }).limit(200).then(function (r) {
      if (r.error) { msg(q("[data-inquiries-msg]"), "err", r.error.message); return; }
      var wrap = q("[data-inquiry-list]");
      wrap.innerHTML = "";
      if (!r.data.length) wrap.innerHTML = '<p class="muted">No messages yet. Contact-form submissions will appear here.</p>';
      r.data.forEach(function (m) {
        var row = doc.createElement("div");
        row.className = "portal-row";
        row.style.alignItems = "flex-start";
        var who = (m.first_name + " " + m.last_name).trim() || "(no name)";
        row.innerHTML =
          '<div class="grow"><strong></strong> ' + (m.is_read ? "" : '<span class="badge badge--live">New</span>') +
          '<br><span class="hint-sm"></span>' +
          '<p class="inq-body" style="margin-top:.5rem;white-space:pre-wrap;display:none"></p></div>' +
          '<button class="btn btn--outline btn--sm" type="button" data-open>Read</button>' +
          (m.email ? '<a class="btn btn--outline btn--sm" data-mail>Email</a>' : "") +
          '<button class="btn btn--outline btn--sm" type="button" data-del style="color:#A31212;border-color:#A31212">Delete</button>';
        row.querySelector("strong").textContent = who + (m.matter ? " — " + m.matter : "");
        row.querySelector(".hint-sm").textContent =
          fmtWhen(m.created_at) + " · " + m.email + (m.phone ? " · " + m.phone : "") + (m.office ? " · " + m.office : "");
        row.querySelector(".inq-body").textContent = (m.description ? m.description + "\n\n" : "") + m.message;
        var mail = row.querySelector("[data-mail]");
        if (mail) {
          mail.href = "mailto:" + encodeURIComponent(m.email).replace(/%40/g, "@") +
            "?subject=" + encodeURIComponent("Re: your inquiry to Prudential Advocate");
        }
        row.querySelector("[data-open]").addEventListener("click", function () {
          var body = row.querySelector(".inq-body");
          body.style.display = body.style.display === "none" ? "block" : "none";
          if (!m.is_read) {
            sb.from("inquiries").update({ is_read: true }).eq("id", m.id).then(function () {
              m.is_read = true;
              var b = row.querySelector(".badge"); if (b) b.remove();
              refreshUnread();
            });
          }
        });
        row.querySelector("[data-del]").addEventListener("click", function () {
          if (!window.confirm("Delete this message permanently?")) return;
          sb.from("inquiries").delete().eq("id", m.id).then(function (dr) {
            if (dr.error) { msg(q("[data-inquiries-msg]"), "err", dr.error.message); return; }
            row.remove();
            refreshUnread();
          });
        });
        wrap.appendChild(row);
      });
      show("inquiries");
    });
  }

  /* ---------------- users ---------------- */
  function adminUsers(payload) {
    return sb.auth.getSession().then(function (r) {
      return fetch("/api/admin-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (r.data.session ? r.data.session.access_token : ""),
        },
        body: JSON.stringify(payload),
      }).then(function (res) { return res.json().then(function (j) { return { ok: res.ok, data: j }; }); });
    });
  }
  function loadUsers() {
    adminUsers({ action: "list" }).then(function (r) {
      if (!r.ok) { msg(q("[data-users-msg]"), "err", r.data.error || "Could not load users."); show("users"); return; }
      var wrap = q("[data-user-list]");
      wrap.innerHTML = "";
      r.data.users.forEach(function (u) {
        var row = doc.createElement("div");
        row.className = "portal-row";
        row.innerHTML =
          '<div class="grow"><strong></strong><br><span class="hint-sm"></span></div>' +
          '<button class="btn btn--outline btn--sm" type="button" style="color:#A31212;border-color:#A31212">Remove</button>';
        row.querySelector("strong").textContent = u.email;
        row.querySelector(".hint-sm").textContent = u.last_sign_in_at
          ? "Last sign-in " + fmtWhen(u.last_sign_in_at)
          : "Has never signed in";
        row.querySelector("button").addEventListener("click", function () {
          if (!window.confirm("Remove " + u.email + "? They will no longer be able to sign in.")) return;
          adminUsers({ action: "delete", user_id: u.id }).then(function (dr) {
            if (!dr.ok) { msg(q("[data-users-msg]"), "err", dr.data.error); return; }
            loadUsers();
          });
        });
        wrap.appendChild(row);
      });
      show("users");
    });
  }
  var addForm = q("[data-adduser-form]");
  addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    adminUsers({ action: "create", email: addForm.email.value.trim(), password: addForm.password.value }).then(function (r) {
      if (!r.ok) { msg(q("[data-adduser-msg]"), "err", r.data.error); return; }
      addForm.reset();
      msg(q("[data-adduser-msg]"), "ok", "User added — share the temporary password with them securely.");
      loadUsers();
    });
  });

  /* ---------------- my account ---------------- */
  function showAccount() {
    sb.auth.getUser().then(function (r) {
      q("[data-account-email]").textContent = r.data.user ? "Signed in as " + r.data.user.email : "";
      show("account");
    });
  }
  var pwForm = q("[data-password-form]");
  pwForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (pwForm.password.value !== pwForm.password2.value) {
      msg(q("[data-password-msg]"), "err", "The two passwords don't match.");
      return;
    }
    sb.auth.updateUser({ password: pwForm.password.value }).then(function (r) {
      if (r.error) { msg(q("[data-password-msg]"), "err", r.error.message); return; }
      pwForm.reset();
      msg(q("[data-password-msg]"), "ok", "Password changed.");
    });
  });

  /* ---------------- boot ---------------- */
  sb.auth.getSession().then(function (r) {
    if (r.data.session) { loadList(); refreshUnread(); }
    else show("login");
  });
})();
