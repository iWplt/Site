/**
 * Apply 0011 pickup-token columns to the live WARKA project if missing.
 * Does not print secrets. Does not reset the database.
 *
 * node --env-file=.env.local scripts/apply-0011-pickup.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PROJECT = "iyspwyljihtduvnibzll";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function admin() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (!url.includes(PROJECT)) throw new Error("Refusing unexpected Supabase project.");
  return createClient(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function tryRunSql(sql) {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const attempts = [
    { name: "pg-query", path: "/pg/query" },
    { name: "pg-meta-query", path: "/pg-meta/default/query" }
  ].map((entry) => ({
    name: entry.name,
    url: `${url}${entry.path}`,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  }));
  if (token) {
    attempts.push({
      name: "management-api",
      url: `https://api.supabase.com/v1/projects/${PROJECT}/database/query`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ query: sql })
    });
  }
  const results = [];
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        method: "POST",
        headers: attempt.headers,
        body: attempt.body,
        signal: AbortSignal.timeout(20000)
      });
      const text = await response.text();
      results.push({
        name: attempt.name,
        status: response.status,
        ok: response.ok,
        snippet: text.slice(0, 180).replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]")
      });
      if (response.ok) return { ok: true, via: attempt.name, results };
    } catch (error) {
      results.push({
        name: attempt.name,
        status: 0,
        ok: false,
        snippet: error instanceof Error ? error.message : "fetch-failed"
      });
    }
  }
  return { ok: false, via: null, results };
}

async function columnsExist(client) {
  const { error } = await client.from("submissions").select("id,pickup_token_hash,pickup_token_ciphertext").limit(1);
  if (!error) return true;
  const message = error.message || "";
  if (/pickup_token/i.test(message)) return false;
  throw new Error("Unexpected submissions probe error (details omitted).");
}

const client = admin();
const before = await columnsExist(client);
console.log("pickup_columns_before", before);
if (!before) {
  const sql = readFileSync(new URL("../supabase/migrations/0011_pickup_token.sql", import.meta.url), "utf8");
  const applied = await tryRunSql(sql);
  console.log("apply_0011", applied.ok ? `ok via ${applied.via}` : "failed");
  if (!applied.ok) {
    console.log("attempts", applied.results);
    process.exitCode = 1;
  }
  await tryRunSql("NOTIFY pgrst, 'reload schema';");
}
const after = await columnsExist(client);
console.log("pickup_columns_after", after);
if (!after) process.exitCode = 1;
