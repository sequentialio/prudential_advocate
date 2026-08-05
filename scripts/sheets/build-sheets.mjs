/* Team info-sheet generator.
   Usage:  node scripts/sheets/build-sheets.mjs        (run from the website repo root)
   Renders assets/sheets/<slug>.pdf for every person below via headless Chrome.
   Bio paragraphs and the credentials sidebar are SCRAPED from each person's live
   page (<slug>.html) at build time, so sheets stay in sync with site copy —
   re-run this after any bio/sidebar edit. Photos come from assets/team/<slug>.avif.
   Compliance: non-attorneys are labeled "Team Profile" and never get bar/practice
   rows (their pages don't have them; the scrape drops Role/Main line as redundant). */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MAIN_LINE = "310.955.9907";

/* Custom serif ledes for attorneys; staff sheets promote their first bio
   paragraph to the lede slot. `contact` lines override the scraped default. */
const PEOPLE = [
  { slug: "robbie-heaven", doctype: "Attorney Profile",
    lede: "Robbie Heaven is the founder of Prudential Advocate and focuses on litigation, contentious trusts &amp; estates, and cross-border estate planning, advising individuals, families, and fiduciaries across California." },
  { slug: "kevin-allec-arreola", doctype: "Attorney Profile",
    lede: "Kevin Allec-Arreola is an attorney at Prudential Advocate who focuses on litigation, contentious trusts &amp; estates, and cross-border estate planning." },
  { slug: "abby-taylor", doctype: "Attorney Profile",
    lede: "Abby Taylor is an attorney at Prudential Advocate who focuses on contentious trust and estate matters, wills and estate planning, and US/UK cross-border work.",
    contact: ["ataylor@prudentialadvocate.com", MAIN_LINE, "Remote (London)"] },
  { slug: "melissa-penaflor", doctype: "Team Profile" },
  { slug: "jackie-graciano", doctype: "Team Profile" },
  { slug: "kaitlyn-gurule", doctype: "Team Profile" },
  { slug: "micah-knopf", doctype: "Team Profile" },
  { slug: "tristan-posner", doctype: "Team Profile" },
];

const strip = (h) => h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function scrape(slug) {
  const html = readFileSync(join(ROOT, slug + ".html"), "utf8");
  const eyebrow = strip(html.match(/<p class="titlechip"[^>]*>([\s\S]*?)<\/p>/)[1]);
  const name = strip(html.match(/<h1>([\s\S]*?)<\/h1>/)[1]);
  const email = html.match(/mailto:([^"]+)/)[1];
  const paragraphs = [...html.match(/<div class="prose reveal">([\s\S]*?)<\/div>/)[1]
    .matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => strip(m[1]));
  const sidebar = [];
  const dl = html.match(/<dl>([\s\S]*?)<\/dl>/);
  if (dl) {
    for (const row of dl[1].matchAll(/<div><dt>([\s\S]*?)<\/dt><dd[^>]*>([\s\S]*?)<\/dd><\/div>/g)) {
      const label = strip(row[1]);
      if (label === "Role" || label === "Main line") continue; // eyebrow + contact cover these
      const lis = [...row[2].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => strip(m[1]));
      sidebar.push([label, lis.length ? lis : strip(row[2])]);
    }
  }
  return { eyebrow, name, email, paragraphs, sidebar };
}

const MARK = '<svg viewBox="116 44 974 1226" fill="currentColor" aria-hidden="true"><path d="M 1074,450 L 971,504 L 901,1064 L 1044,1003 L 1082,951 Z"/><path d="M 646,105 L 516,181 L 433,702 L 447,723 L 602,657 L 636,605 Z"/><path d="M 1010,59 L 781,198 L 628,1263 L 862,1152 Z"/><path d="M 507,50 L 275,180 L 123,1263 L 357,1139 Z"/></svg>';

function sidebarHtml(rows) {
  return rows.map(([label, val]) => {
    const body = Array.isArray(val)
      ? `<ul>${val.map(v => `<li>${v}</li>`).join("")}</ul>`
      : `<p>${val}</p>`;
    return `<div class="cred"><h3>${label}</h3>${body}</div>`;
  }).join("");
}

function pageHtml(a) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet">
<style>
  @page { size: letter; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --red: #C13333; --ink: #1a1714; --ink-soft: #5d554d; --line: #e7e0d6; --ivory: #FBF9F4; }
  html, body { width: 8.5in; height: 11in; }
  body { font-family: "Source Sans 3", sans-serif; color: var(--ink); background: #fff;
         padding: .55in .62in .5in; display: flex; flex-direction: column;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .masthead { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand svg { height: 34px; width: auto; color: var(--red); }
  .brand__name { font-size: 15.5px; letter-spacing: .26em; text-transform: uppercase; font-weight: 500; }
  .brand__sub { font-size: 8.5px; letter-spacing: .18em; text-transform: uppercase; color: var(--ink-soft); margin-top: 3px; }
  .doctype { font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: var(--red); font-weight: 700; }
  hr.rule { border: 0; border-top: 1px solid var(--line); margin: 16px 0 0; }
  .titleblock { margin-top: 20px; }
  .eyebrow { font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: var(--red); font-weight: 700; }
  h1 { font-family: "Source Serif 4", serif; font-size: 34px; font-weight: 700; letter-spacing: -.01em; margin-top: 6px; }
  .cols { display: flex; gap: 26px; margin-top: 15px; flex: 1; min-height: 0; }
  .aside { width: 194px; flex: none; }
  .contact { margin-top: 9px; font-size: 11.5px; font-weight: 600; line-height: 1.6; }
  .card { margin-top: 11px; background: var(--ivory); border: 1px solid var(--line); border-radius: 10px; padding: 13px 14px; }
  .card h2 { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700;
             border-bottom: 1px solid var(--line); padding-bottom: 8px; }
  .cred { margin-top: 9px; }
  .cred h3 { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--red); font-weight: 700; margin-bottom: 4px; }
  .cred p, .cred li { font-size: 11px; line-height: 1.4; color: var(--ink); }
  .cred ul { list-style: none; }
  .cred li { padding-left: 12px; position: relative; margin-top: 3px; }
  .cred li::before { content: "\\25C6"; color: var(--red); font-size: 6.5px; position: absolute; left: 0; top: 4px; }
  .main { flex: 1; min-width: 0; }
  .photo { width: 194px; height: 148px; border-radius: 10px; overflow: hidden; }
  .photo img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; display: block; }
  .lede { font-family: "Source Serif 4", serif; font-size: 15.5px; line-height: 1.5; }
  .main p.body { font-size: 12.3px; line-height: 1.5; color: #33302c; margin-top: 9px; }
  .foot { margin-top: auto; padding-top: 12px; }
  .foot hr { border: 0; border-top: 1px solid var(--line); margin-bottom: 9px; }
  .foot .row { display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 700; }
  .foot .disc { font-size: 9px; color: var(--ink-soft); line-height: 1.45; margin-top: 5px; }
</style></head><body>
  <div class="masthead">
    <div class="brand">${MARK}
      <div><div class="brand__name">Prudential Advocate</div><div class="brand__sub">A Professional Corporation</div></div>
    </div>
    <div class="doctype">${a.doctype}</div>
  </div>
  <hr class="rule">
  <div class="titleblock">
    <div class="eyebrow">${a.eyebrow}</div>
    <h1>${a.name}</h1>
  </div>
  <div class="cols">
    <div class="aside">
      <div class="photo"><img src="${a.photoPath}" alt=""></div>
      <div class="contact">${a.contact.map(c => `<div>${c}</div>`).join("")}</div>
      ${a.sidebar.length ? `<div class="card"><h2>Credentials</h2>${sidebarHtml(a.sidebar)}</div>` : ""}
    </div>
    <div class="main">
      <p class="lede">${a.lede}</p>
      ${a.paragraphs.map(p => `<p class="body">${p}</p>`).join("")}
    </div>
  </div>
  <div class="foot">
    <hr>
    <div class="row">
      <div>Prudential Advocate, APC &middot; Responsible attorney: Robert W. J. Heaven, Esq.</div>
      <div>Century City 310.955.9907 &middot; Irvine 949.675.3885</div>
    </div>
    <div class="disc">Attorney Advertising. This information sheet is provided for general informational purposes only and does not constitute legal advice or a solicitation for professional employment. Prior results do not guarantee a similar outcome. &middot; prudentialadvocate.com</div>
  </div>
</body></html>`;
}

const tmp = mkdtempSync(join(tmpdir(), "pa-sheets-"));
for (const person of PEOPLE) {
  const s = scrape(person.slug);
  const a = {
    doctype: person.doctype,
    eyebrow: s.eyebrow,
    name: s.name,
    contact: person.contact || [s.email, MAIN_LINE],
    sidebar: s.sidebar,
    lede: person.lede || s.paragraphs[0],
    paragraphs: person.lede ? s.paragraphs : s.paragraphs.slice(1),
  };
  // AVIF embeds losslessly (~700KB/PDF); a 560px JPEG keeps the PDF ~250KB
  const jpg = join(tmp, person.slug + ".jpg");
  execFileSync("sips", ["-Z", "560", "-s", "format", "jpeg", "-s", "formatOptions", "80", join(ROOT, "assets/team", person.slug + ".avif"), "--out", jpg], { stdio: "pipe" });
  a.photoPath = jpg;
  const htmlPath = join(tmp, person.slug + ".html");
  writeFileSync(htmlPath, pageHtml(a));
  execFileSync(CHROME, [
    "--headless", "--disable-gpu", "--no-pdf-header-footer",
    "--virtual-time-budget=10000",
    `--print-to-pdf=${ROOT}/assets/sheets/${person.slug}.pdf`,
    htmlPath,
  ], { stdio: "pipe" });
  console.log("built", person.slug + ".pdf");
}
rmSync(tmp, { recursive: true, force: true });
