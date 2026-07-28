// Dev-only bridge: lets serve.py render the dynamic routes locally by invoking
// the same handlers Vercel runs in production. Usage:
//   node scripts/dev-render.mjs resources
//   node scripts/dev-render.mjs article <slug>
//   node scripts/dev-render.mjs sitemap
import { createRequire } from "module";
import path from "path";
import process from "process";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
process.chdir(root);

const [route, slug] = process.argv.slice(2);
const handler = require(path.join(root, "api", route === "article" ? "article.js" : route + ".js"));

const req = { query: { slug: slug || "" } };
const res = {
  _status: 200,
  setHeader() {},
  status(c) { this._status = c; return this; },
  send(body) {
    process.stdout.write("STATUS:" + this._status + "\n");
    process.stdout.write(body);
  },
};
await handler(req, res);
