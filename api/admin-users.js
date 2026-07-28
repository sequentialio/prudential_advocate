/* Staff-portal user management. Runs with the service key (env var only —
   never shipped to the browser). Any signed-in firm user may list, add, or
   remove portal users; the last remaining user can never be removed. */
const SUPABASE_URL = process.env.SUPABASE_URL || "https://gsvdtgtkhnpqlwhbsfal.supabase.co";
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_riHDkJRmnkIZPmpT3tnKDA_WDNCBoTB";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function callerIsValidUser(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return false;
  const res = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: ANON_KEY, Authorization: auth },
  });
  return res.ok;
}

function admin(path, opts) {
  return fetch(SUPABASE_URL + "/auth/v1/admin" + path, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      ...(opts && opts.headers),
    },
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!SERVICE_KEY) {
    res.status(501).json({ error: "User management is not configured (missing SUPABASE_SERVICE_ROLE_KEY)." });
    return;
  }
  if (!(await callerIsValidUser(req))) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  const { action, email, password, user_id } = req.body || {};

  if (action === "list") {
    const r = await admin("/users?per_page=100");
    const data = await r.json();
    const users = (data.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));
    res.status(200).json({ users });
    return;
  }

  if (action === "create") {
    if (!email || !password || String(password).length < 10) {
      res.status(400).json({ error: "Email and a password of at least 10 characters are required." });
      return;
    }
    const r = await admin("/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(400).json({ error: data.msg || data.message || "Could not create user." });
      return;
    }
    res.status(200).json({ ok: true, id: data.id, email: data.email });
    return;
  }

  if (action === "delete") {
    if (!user_id) {
      res.status(400).json({ error: "Missing user_id." });
      return;
    }
    const listRes = await admin("/users?per_page=100");
    const listData = await listRes.json();
    if ((listData.users || []).length <= 1) {
      res.status(400).json({ error: "You can't remove the last remaining user — add another user first." });
      return;
    }
    const r = await admin("/users/" + encodeURIComponent(user_id), { method: "DELETE" });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      res.status(400).json({ error: data.msg || "Could not remove user." });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(400).json({ error: "Unknown action." });
};
