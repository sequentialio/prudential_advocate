/* Extract unique visible text strings from all top-level *.html pages.
   Output: /tmp/i18n_strings.json  (array of normalized strings)
   These become the EN keys for the Spanish translation dictionary, matched
   at text-node granularity (same as the runtime i18n engine). */
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..');
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));

const ENT = { '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&apos;':"'",
  '&mdash;':'—','&ndash;':'–','&rsquo;':'’','&lsquo;':'‘','&ldquo;':'“','&rdquo;':'”',
  '&middot;':'·','&rarr;':'→','&larr;':'←','&hellip;':'…','&copy;':'©','&nbsp;':' ','&times;':'×' };
function decode(s){ return s.replace(/&[a-zA-Z#0-9]+;/g, m => ENT[m] != null ? ENT[m] : m); }
function norm(s){ return decode(s).replace(/\s+/g,' ').trim(); }

const set = new Set();
const attrSet = new Set();

for (const f of files) {
  let html = fs.readFileSync(path.join(DIR, f), 'utf8');
  // drop script/style blocks entirely
  html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  // collect a few translatable attributes before stripping tags
  const attrRe = /\b(placeholder|aria-label|alt|content)\s*=\s*"([^"]*)"/gi;
  let am;
  while ((am = attrRe.exec(html))) {
    const v = norm(am[2]);
    if (v && /[a-zA-Z]/.test(v) && v.length > 1) attrSet.add(v);
  }
  // page <title>
  const tm = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (tm) { const v = norm(tm[1]); if (v) attrSet.add(v); }
  // text nodes = stuff between tags
  const parts = html.split(/<[^>]+>/);
  for (const p of parts) {
    const v = norm(p);
    if (!v) continue;
    if (v.length < 2) continue;
    if (!/[a-zA-Z]/.test(v)) continue;            // skip pure numbers/punctuation
    if (/^[0-9.\-—·/|()$%]+$/.test(v)) continue;
    set.add(v);
  }
}

const text = Array.from(set).sort((a,b)=>a.localeCompare(b));
const attrs = Array.from(attrSet).sort((a,b)=>a.localeCompare(b));
fs.writeFileSync('/tmp/i18n_strings.json', JSON.stringify({ text, attrs }, null, 2));
console.log('files:', files.length);
console.log('unique text strings:', text.length);
console.log('unique attr/meta strings:', attrs.length);
console.log('--- sample text (first 25) ---');
console.log(text.slice(0, 25).join('\n'));
