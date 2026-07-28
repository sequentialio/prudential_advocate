// Dev-only bridge for POST API routes: reads the JSON body from stdin and the
// Authorization header from argv, then invokes the same handler Vercel runs.
//   node scripts/dev-api.mjs admin-users "Bearer <jwt>" < body.json
import { createRequire } from "module";
import path from "path";
import process from "process";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
process.chdir(root);

const [route, authHeader] = process.argv.slice(2);
const handler = require(path.join(root, "api", route + ".js"));

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
let body = {};
try { body = JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch (e) {}

const req = { method: "POST", headers: { authorization: authHeader || "" }, body, query: {} };
const res = {
  _status: 200,
  setHeader() {},
  status(c) { this._status = c; return this; },
  json(obj) { process.stdout.write("STATUS:" + this._status + "\n" + JSON.stringify(obj)); },
  send(b) { process.stdout.write("STATUS:" + this._status + "\n" + b); },
};
await handler(req, res);
