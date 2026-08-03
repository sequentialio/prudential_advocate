const { fetchPublished, isoDay } = require("./_lib");

const STATIC_URLS = [
  "", "about.html", "services.html", "trust-litigation.html", "will-contest.html",
  "certificate-of-independent-review.html", "trust-administration-probate.html", "conservatorships.html",
  "estate-planning.html", "team.html", "robbie-heaven.html", "kevin-allec-arreola.html",
  "abby-taylor.html", "melissa-penaflor.html", "jackie-graciano.html", "kaitlyn-gurule.html",
  "micah-knopf.html", "tristan-posner.html", "resources.html",
  "understanding-trust-accountings.html", "will-contests-california-grounds-deadlines.html",
  "what-is-a-certificate-of-independent-review.html", "contact.html", "disclaimer.html",
  "privacy-policy.html", "accessibility.html",
];

module.exports = async (req, res) => {
  let dynamic = [];
  try {
    dynamic = await fetchPublished("&order=published_at.desc");
  } catch (e) {
    dynamic = [];
  }
  const urls = [
    ...STATIC_URLS.map((u) => "  <url><loc>https://prudentialadvocate.com/" + u + "</loc></url>"),
    ...dynamic.map(
      (a) =>
        "  <url><loc>https://prudentialadvocate.com/articles/" + a.slug + "</loc><lastmod>" +
        isoDay(a.published_at) + "</lastmod></url>"
    ),
  ];
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") +
    "\n</urlset>\n";
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600");
  res.status(200).send(xml);
};
