/* Public contact-form endpoint. Stores the inquiry in Supabase (same
   anon-insert RLS path the form used before) and, when a forwarding address
   is configured in portal_settings and RESEND_API_KEY is set, emails a copy
   via Resend. Forwarding is best-effort: an email failure never blocks
   storage, and the Messages tab in /portal remains the source of truth. */
const SUPABASE_URL = process.env.SUPABASE_URL || "https://gsvdtgtkhnpqlwhbsfal.supabase.co";
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_riHDkJRmnkIZPmpT3tnKDA_WDNCBoTB";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "Prudential Advocate Website <onboarding@resend.dev>";

const LIMITS = {
  first_name: 120, last_name: 120, email: 254, phone: 60,
  office: 60, matter: 120, description: 4000, message: 8000,
};

async function forwardByEmail(row) {
  if (!SERVICE_KEY || !RESEND_KEY) return;
  const r = await fetch(
    SUPABASE_URL + "/rest/v1/portal_settings?key=eq.inquiry_forward_email&select=value",
    { headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY } }
  );
  if (!r.ok) return; // table not created yet, or transient error — skip quietly
  const rows = await r.json();
  const to = String((rows[0] || {}).value || "")
    .split(",").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 5);
  if (!to.length) return;

  const who = (row.first_name + " " + row.last_name).trim() || "(no name)";
  const text = [
    "New inquiry from the prudentialadvocate.com contact form.",
    "",
    "Name:    " + who,
    "Email:   " + (row.email || "—"),
    "Phone:   " + (row.phone || "—"),
    "Office:  " + (row.office || "—"),
    "Matter:  " + (row.matter || "—"),
    "",
    row.description ? "How can we help:\n" + row.description + "\n" : null,
    row.message ? "Message:\n" + row.message : null,
    "",
    "Reply directly to this email to respond, or manage messages in the staff portal:",
    "https://prudentialadvocate.com/portal.html",
  ].filter(function (l) { return l !== null; }).join("\n");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: to,
      reply_to: row.email || undefined,
      subject: "New website inquiry — " + who,
      text: text,
    }),
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const b = req.body || {};

  // Honeypot: bots that fill the hidden field get a fake success.
  if (String(b.company_website || "").trim() !== "") {
    res.status(200).json({ ok: true });
    return;
  }

  const row = {};
  for (const f in LIMITS) row[f] = String(b[f] == null ? "" : b[f]).trim().slice(0, LIMITS[f]);
  if (!row.email && !row.phone && !row.first_name && !row.last_name) {
    res.status(400).json({ error: "Missing contact details." });
    return;
  }

  const ins = await fetch(SUPABASE_URL + "/rest/v1/inquiries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: "Bearer " + ANON_KEY,
    },
    body: JSON.stringify(row),
  });
  if (!ins.ok) {
    res.status(502).json({ error: "Could not store your message." });
    return;
  }

  try { await forwardByEmail(row); } catch (e) { /* storage succeeded; never fail the request over email */ }
  res.status(200).json({ ok: true });
};
