/* Shared helpers for the dynamic Resources pages.
   Zero-dependency: articles are fetched from Supabase over REST (RLS allows
   anonymous reads of published rows only), and HTML comes pre-rendered from
   the portal, so no markdown library is needed at request time. */
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://gsvdtgtkhnpqlwhbsfal.supabase.co";
// Publishable key — safe to expose by design; RLS is the security boundary.
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_riHDkJRmnkIZPmpT3tnKDA_WDNCBoTB";

// The three original hand-built articles remain static files at the site root.
const LEGACY_ARTICLES = [
  {
    slug: "understanding-trust-accountings.html",
    external: true,
    title: "Understanding Trust Accountings: A California Beneficiary's Guide",
    category: "Trust Administration",
    meta_description:
      "What a trust accounting must include under California law, when you’re entitled to one as a beneficiary, and how to read it with confidence — plus the questions worth asking when the numbers don’t seem to add up.",
    published_at: "2026-06-24",
    read_minutes: 6,
  },
  {
    slug: "will-contests-california-grounds-deadlines.html",
    external: true,
    title: "Will Contests in California: Common Grounds and Key Deadlines",
    category: "Will Contest",
    meta_description:
      "The grounds for challenging a will in California — lack of capacity, undue influence, fraud, and improper execution — who has standing to bring a contest, and why the deadlines make timing so important.",
    published_at: "2026-06-10",
    read_minutes: 5,
  },
  {
    slug: "what-is-a-certificate-of-independent-review.html",
    external: true,
    title: "What Is a Certificate of Independent Review?",
    category: "Certificate of Independent Review",
    meta_description:
      "How an independent attorney’s review can protect a gift to a caregiver or fiduciary from California’s presumption of undue influence — what the certificate is, when it’s needed, and what the review involves.",
    published_at: "2026-05-28",
    read_minutes: 4,
  },
];

function loadTemplate(name) {
  return fs.readFileSync(path.join(process.cwd(), "templates", name), "utf8");
}

async function fetchPublished(extraQuery) {
  const url =
    SUPABASE_URL +
    "/rest/v1/articles?select=slug,title,category,meta_description,body_html,read_minutes,published_at" +
    "&published=eq.true" +
    (extraQuery || "");
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
  });
  if (!res.ok) throw new Error("Supabase " + res.status);
  return res.json();
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonEsc(s) {
  return JSON.stringify(String(s == null ? "" : s)).slice(1, -1);
}

function humanDate(iso) {
  const d = new Date(iso + (String(iso).length === 10 ? "T12:00:00Z" : ""));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function isoDay(v) {
  return String(v || "").slice(0, 10);
}

function articleUrl(a) {
  return a.external ? "/" + a.slug : "/articles/" + a.slug;
}

function renderCard(a) {
  return [
    '          <a class="res-card reveal" href="' + esc(articleUrl(a)) + '">',
    '            <span class="res-tag">' + esc(a.category) + "</span>",
    '            <h2 class="res-card__title">' + esc(a.title) + "</h2>",
    '            <p class="res-card__excerpt">' + esc(a.meta_description) + "</p>",
    '            <p class="res-card__meta"><time datetime="' + esc(isoDay(a.published_at)) + '">' +
      esc(humanDate(isoDay(a.published_at))) +
      '</time> <span class="dot" aria-hidden="true"></span> ' + esc(a.read_minutes) + " min read</p>",
    '            <span class="res-card__more">Read article</span>',
    "          </a>",
  ].join("\n");
}

module.exports = { LEGACY_ARTICLES, loadTemplate, fetchPublished, esc, jsonEsc, humanDate, isoDay, renderCard };
