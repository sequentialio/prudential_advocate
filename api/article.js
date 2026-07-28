const { loadTemplate, fetchPublished, esc, jsonEsc, humanDate, isoDay } = require("./_lib");

module.exports = async (req, res) => {
  const slug = String(req.query.slug || "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    res.status(404).send("Not found");
    return;
  }
  let rows = [];
  try {
    rows = await fetchPublished("&slug=eq." + encodeURIComponent(slug) + "&limit=1");
  } catch (e) {
    res.status(503).send("Temporarily unavailable");
    return;
  }
  if (!rows.length) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(404).send(
      '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Article not found | Prudential Advocate</title>' +
        '<meta name="robots" content="noindex"></head><body style="font-family:sans-serif;padding:3rem">' +
        '<h1>Article not found</h1><p>This article may have been unpublished. <a href="/resources">Back to Resources</a></p></body></html>'
    );
    return;
  }
  const a = rows[0];
  const html = loadTemplate("article.html")
    .replaceAll("{{TITLE_JSON}}", jsonEsc(a.title))
    .replaceAll("{{META_DESC_JSON}}", jsonEsc(a.meta_description))
    .replaceAll("{{TITLE}}", esc(a.title))
    .replaceAll("{{META_DESC}}", esc(a.meta_description))
    .replaceAll("{{SLUG}}", esc(a.slug))
    .replaceAll("{{CATEGORY}}", esc(a.category))
    .replaceAll("{{DATE_ISO}}", esc(isoDay(a.published_at)))
    .replaceAll("{{DATE_HUMAN}}", esc(humanDate(isoDay(a.published_at))))
    .replaceAll("{{READ_MIN}}", esc(a.read_minutes))
    .replace("{{BODY_HTML}}", a.body_html || "");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(html);
};
