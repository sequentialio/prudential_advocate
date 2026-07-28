const { LEGACY_ARTICLES, loadTemplate, fetchPublished, renderCard, isoDay } = require("./_lib");

module.exports = async (req, res) => {
  let dynamic = [];
  try {
    dynamic = await fetchPublished("&order=published_at.desc");
  } catch (e) {
    // Degrade gracefully: show the evergreen static articles if the DB is unreachable.
    dynamic = [];
  }
  const all = [...dynamic, ...LEGACY_ARTICLES].sort((a, b) =>
    isoDay(b.published_at).localeCompare(isoDay(a.published_at))
  );
  const html = loadTemplate("resources.html").replace("{{ARTICLE_CARDS}}", all.map(renderCard).join("\n"));
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(html);
};
