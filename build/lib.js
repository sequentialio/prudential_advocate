/* Build-time render library for Prudential Advocate pages.
   Eval'd by generator scripts: defines globalThis.makeLib() which closes over
   the sandbox's readFile/saveFile helpers. */
globalThis.makeLib = async function () {
  const header = await readFile('build/header.html');
  const footerRaw = await readFile('build/footer.html');
  const ctaSplit = footerRaw.indexOf('<!-- ============ FOOTER');
  const ctaHtml = footerRaw.slice(0, ctaSplit);
  const footerHtml = footerRaw.slice(ctaSplit);

  const ICON = {
    arrow: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    checkCircle: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    alert: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v5M12 16.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10.3 3.8 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    info: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5M12 8v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    mail: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    pin: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.4" stroke="currentColor" stroke-width="1.8"/></svg>',
    phone: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 3h3l1.5 5-2 1.5a12 12 0 0 0 5 5l1.5-2 5 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    scale: '<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v18M7 21h10M5 7h14M5 7l-2.5 6a3 3 0 0 0 5 0L5 7Zm14 0-2.5 6a3 3 0 0 0 5 0L19 7ZM12 5l7 2M12 5 5 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  const BASE = 'https://prudentialadvocate.com/';
  const orgLD = {
    "@context":"https://schema.org","@type":"LegalService",
    "name":"Prudential Advocate, APC","url":BASE,
    "description":"California trust and estate litigation firm in Century City and Irvine.",
    "areaServed":["Los Angeles County","Orange County","California"],
    "knowsAbout":["Trust Litigation","Will Contests","Probate","Trust Administration","Estate Planning","Conservatorships","Certificate of Independent Review"],
    "address":[
      {"@type":"PostalAddress","streetAddress":"1925 Century Park East, Suite 1700","addressLocality":"Los Angeles","addressRegion":"CA","postalCode":"90067","addressCountry":"US"},
      {"@type":"PostalAddress","streetAddress":"3333 Michelson Drive, Suite 300","addressLocality":"Irvine","addressRegion":"CA","postalCode":"92612","addressCountry":"US"}
    ],
    "telephone":["+1-310-955-9907","+1-949-675-3885"]
  };
  function crumbLD(items){
    return {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":
      items.map((it,i)=>({"@type":"ListItem","position":i+1,"name":it.name,"item":BASE+(it.slug||"")}))};
  }
  function crumbs(items){
    return '<nav class="crumbs" aria-label="Breadcrumb"><ol style="display:flex;flex-wrap:wrap;gap:.4rem;align-items:center">'+
      items.map((it,i)=>{
        const sep = i>0 ? '<li class="sep" aria-hidden="true">/</li>' : '';
        const inner = it.slug!=null && i<items.length-1
          ? `<a href="${it.slug}">${it.name}</a>`
          : `<span aria-current="page">${it.name}</span>`;
        return `${sep}<li>${inner}</li>`;
      }).join('')+'</ol></nav>';
  }

  function render(o){
    const ld = [orgLD].concat(o.jsonld||[]);
    const ldTags = ld.map(x=>`<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n  ');
    const og = o.title.replace(/ \| .*/,'').replace(/ — .*/,'');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${o.title}</title>
  <meta name="description" content="${o.desc}">
  <link rel="canonical" href="${BASE}${o.slug||''}">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Prudential Advocate">
  <meta property="og:title" content="${og}">
  <meta property="og:description" content="${o.desc}">
  <meta property="og:url" content="${BASE}${o.slug||''}">
  <meta name="twitter:card" content="summary_large_image">
  <meta property="og:image" content="${BASE}assets/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:image" content="${BASE}assets/og-image.jpg">
  <meta name="twitter:title" content="${og}">
  <meta name="twitter:description" content="${o.desc}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&display=swap" rel="stylesheet">
  <link rel="icon" type="image/svg+xml" href="assets/logo.svg">
  <link rel="stylesheet" href="assets/styles.css">
  <script>document.documentElement.classList.add('js');</script>
  ${ldTags}
</head>
<body data-page="${o.dataPage||''}">
${header}
  <main id="main">
${o.main}
  </main>
${o.includeCta===false?'':ctaHtml}
${footerHtml}
  <script src="assets/site.js"></script>
</body>
</html>`;
  }

  function slot(id, ph, style, attrs){
    return `<image-slot id="${id}" placeholder="${ph}" ${attrs||''} style="${style||''}"></image-slot>`;
  }

  const SERVICES = [
    {n:'01', slug:'trust-litigation', title:'Trust Litigation', blurb:'Strategic representation in disputes over trusts, trustee conduct, and contested accountings &mdash; for beneficiaries and trustees alike.'},
    {n:'02', slug:'will-contest', title:'Will Contest', blurb:'Challenging or defending a will on grounds of capacity, undue influence, fraud, or improper execution.'},
    {n:'03', slug:'certificate-of-independent-review', title:'Certificate of Independent Review', blurb:'Guidance through California&rsquo;s COIR process to help protect estate-planning transfers from later challenge.'},
    {n:'04', slug:'trust-administration', title:'Trust Administration', blurb:'Practical, step-by-step help for trustees and beneficiaries through the administration process.'},
    {n:'05', slug:'probate', title:'Probate', blurb:'Guidance through the California probate process &mdash; from petition to final distribution.'},
    {n:'06', slug:'estate-planning', title:'Estate Planning', blurb:'Wills, living trusts, powers of attorney, and health care directives tailored to your family.'},
  ];
  function serviceCards(){
    return SERVICES.map((s,i)=>`        <article class="scard reveal" data-d="${(i%3)+1}">
          <p class="scard__num">${s.n}</p>
          <h3>${s.title}</h3>
          <p>${s.blurb}</p>
          <span class="tlink">${ICON.arrow}<span>Learn about ${s.title}</span></span>
          <a class="scard__link" href="${s.slug}.html" aria-label="Learn about ${s.title}"></a>
        </article>`).join('\n');
  }

  return { ICON, BASE, orgLD, crumbLD, crumbs, render, slot, SERVICES, serviceCards };
};
