/**
 * Push production secrets to the existing Worker without printing values.
 * Reads from .dev.vars / .env.local. Skips NEXTJS_ENV and local-only keys.
 *
 * Usage:
 *   node scripts/cf-put-secrets.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SECRET_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ACCESS_CODE_ENCRYPTION_KEY",
  "ACCESS_CODE_HMAC_SECRET",
  "BOOKING_SESSION_SECRET",
  "RECEIPT_TTL_DAYS",
  "ACCESS_CODE_RATE_LIMIT_MAX",
  "ACCESS_CODE_RATE_LIMIT_WINDOW_SECONDS",
  "ACCESS_CODE_RATE_LIMIT_COOLDOWN_SECONDS"
];

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
}

const env = { ...loadEnvFile(".env.local"), ...loadEnvFile(".dev.vars") };
const put = [];
const missing = [];

for (const key of SECRET_KEYS) {
  const value = env[key]?.trim();
  if (!value) {
    // optional rate-limit / receipt keys may be absent
    if (
      key.startsWith("ACCESS_CODE_RATE_LIMIT_") ||
      key === "RECEIPT_TTL_DAYS"
    ) {
      continue;
    }
    missing.push(key);
    continue;
  }
  put.push(key);
  const result = spawnSync("npx", ["wrangler", "secret", "put", key], {
    input: value,
    encoding: "utf8",
    shell: true
  });
  if (result.status !== 0) {
    console.error("FAILED", key, (result.stderr || result.stdout || "").slice(0, 400));
    process.exit(1);
  }
  console.log("PUT_OK", key);
}

if (missing.length) {
  console.error("MISSING_REQUIRED", missing.join(","));
  process.exit(1);
}
console.log("SECRETS_PUT", put.length);
