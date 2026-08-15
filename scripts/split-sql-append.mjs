import { readFileSync, writeFileSync } from "node:fs";

function splitSql(sql, size = 600) {
  const chunks = [];
  for (let i = 0; i < sql.length; i += size) chunks.push(sql.slice(i, i + size));
  return chunks;
}

function writeAppends(label, sql) {
  const chunks = splitSql(sql);
  chunks.forEach((chunk, index) => {
    const expression =
      index === 0
        ? `(() => { window.__sql = ${JSON.stringify(chunk)}; return window.__sql.length; })()`
        : `(() => { window.__sql += ${JSON.stringify(chunk)}; return window.__sql.length; })()`;
    writeFileSync(`tmp-append-${label}-${String(index).padStart(2, "0")}.json`, JSON.stringify({ expression }));
  });
  console.log(label, "chunks", chunks.length, "chars", sql.length);
}

writeAppends("0008", readFileSync("supabase/migrations/0008_booking_number_lock_and_submit_hardening.sql", "utf8"));
writeAppends("0009", readFileSync("supabase/migrations/0009_access_code_rate_limit.sql", "utf8"));
writeAppends("0010", readFileSync("supabase/migrations/0010_booking_number_global_prefix.sql", "utf8"));
