/* Resources article → PDF generator.
   Usage:  node scripts/sheets/build-article-pdfs.mjs   (run from the website repo root)
   Renders assets/pdf/<slug>.pdf for each static Resources article by scraping the
   article page at build time (title, byline/date/read-time, full <article> body —
   including the standing "not legal advice" note). Re-run after any article edit.
   Articles may run more than one page; content flows with letter margins. */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const ARTICLES = [
  "understanding-trust-accountings",
  "what-is-a-certificate-of-independent-review",
  "will-contests-california-grounds-deadlines",
];

const MARK = '<svg viewBox="116 44 974 1226" fill="currentColor" aria-hidden="true"><path d="M 1074,450 L 971,504 L 901,1064 L 1044,1003 L 1082,951 Z"/><path d="M 646,105 L 516,181 L 433,702 L 447,723 L 602,657 L 636,605 Z"/><path d="M 1010,59 L 781,198 L 628,1263 L 862,1152 Z"/><path d="M 507,50 L 275,180 L 123,1263 L 357,1139 Z"/></svg>';

function scrape(slug) {
  const html = readFileSync(join(ROOT, slug + ".html"), "utf8");
  const title = html.match(/<h1>([\s\S]*?)<\/h1>/)[1].trim();
  const metaRaw = html.match(/class="article-meta"[^>]*>([\s\S]*?)<\/(?:p|div)>/)?.[1] ?? "";
  const metaBits = metaRaw.replace(/<span class="dot"[^>]*><\/span>/g, "·")
    .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().split("·").map(s => s.trim()).filter(Boolean).slice(0, 3);
  const body = html.match(/<article[^>]*>([\s\S]*?)<\/article>/)[1]
    .replace(/\s*class="[^"]*"/g, "").replace(/\s*style="[^"]*"/g, "");
  return { title, meta: metaBits.join(" · "), body };
}

function pageHtml(a) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet">
<style>
  @page { size: letter; margin: .75in .8in .8in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --red: #C13333; --ink: #1a1714; --ink-soft: #5d554d; --line: #e7e0d6; }
  body { font-family: "Source Sans 3", sans-serif; color: var(--ink);
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .masthead { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand svg { height: 32px; width: auto; color: var(--red); }
  .brand__name { font-size: 14.5px; letter-spacing: .26em; text-transform: uppercase; font-weight: 500; }
  .brand__sub { font-size: 8px; letter-spacing: .18em; text-transform: uppercase; color: var(--ink-soft); margin-top: 3px; }
  .doctype { font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: var(--red); font-weight: 700; }
  hr.rule { border: 0; border-top: 1px solid var(--line); margin: 15px 0 0; }
  h1 { font-family: "Source Serif 4", serif; font-size: 27px; font-weight: 700; letter-spacing: -.01em;
       margin-top: 22px; line-height: 1.2; }
  .meta { font-size: 10.5px; font-weight: 600; color: var(--ink-soft); margin: 10px 0 4px;
          letter-spacing: .04em; }
  article { margin-top: 8px; }
  article p { font-size: 12.3px; line-height: 1.58; color: #33302c; margin-top: 10px; }
  article h2 { font-family: "Source Serif 4", serif; font-size: 17px; font-weight: 700;
               margin-top: 20px; break-after: avoid; }
  article ul { margin: 8px 0 0 4px; list-style: none; }
  article li { font-size: 12.3px; line-height: 1.55; color: #33302c; padding-left: 14px;
               position: relative; margin-top: 5px; }
  article li::before { content: "\\25C6"; color: var(--red); font-size: 7px; position: absolute; left: 0; top: 5px; }
  article strong { color: var(--ink); }
  .foot { margin-top: 26px; }
  .foot hr { border: 0; border-top: 1px solid var(--line); margin-bottom: 9px; }
  .foot .row { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; }
  .foot .disc { font-size: 8.8px; color: var(--ink-soft); line-height: 1.45; margin-top: 5px; }
</style></head><body>
  <div class="masthead">
    <div class="brand">${MARK}
      <div><div class="brand__name">Prudential Advocate</div><div class="brand__sub">A Professional Corporation</div></div>
    </div>
    <div class="doctype">Resources</div>
  </div>
  <hr class="rule">
  <h1>${a.title}</h1>
  <div class="meta">${a.meta}</div>
  <article>${a.body}</article>
  <div class="foot">
    <hr>
    <div class="row">
      <div>Prudential Advocate, APC &middot; Responsible attorney: Robert W. J. Heaven, Esq.</div>
      <div>Century City 310.955.9907 &middot; Irvine 949.675.3885</div>
    </div>
    <div class="disc">Attorney Advertising. This article is general information about California law and is not legal advice. Every situation is different; for advice about your circumstances, speak with a qualified attorney. Reading this article does not create an attorney-client relationship. &middot; prudentialadvocate.com</div>
  </div>
</body></html>`;
}

mkdirSync(join(ROOT, "assets/pdf"), { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "pa-articles-"));
for (const slug of ARTICLES) {
  const htmlPath = join(tmp, slug + ".html");
  writeFileSync(htmlPath, pageHtml(scrape(slug)));
  execFileSync(CHROME, [
    "--headless", "--disable-gpu", "--no-pdf-header-footer",
    "--virtual-time-budget=10000",
    `--print-to-pdf=${ROOT}/assets/pdf/${slug}.pdf`,
    htmlPath,
  ], { stdio: "pipe" });
  console.log("built", slug + ".pdf");
}
rmSync(tmp, { recursive: true, force: true });
