import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const cfgPath = join(homedir(), "AppData/Roaming/xdg.config/.wrangler/config/default.toml");
const toml = readFileSync(cfgPath, "utf8");
const match = toml.match(/oauth_token\s*=\s*"([^"]+)"/);
const oauth = match?.[1];
const accountId = "fe65e39cb90dec468e001a9e5c48bbbe";
if (!oauth) {
  console.log("NO_OAUTH");
  process.exit(1);
}

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
  headers: { Authorization: `Bearer ${oauth}` }
});
const json = await res.json();
console.log("API_OK", res.status, "SUCCESS", json.success);
console.log("SUBDOMAIN", json.result?.subdomain || json.errors?.[0]?.message || "NONE");
