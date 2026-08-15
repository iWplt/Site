import { readFileSync, writeFileSync } from "node:fs";

function pack(name, sql) {
  const expression = `(async () => {
  const parsed = JSON.parse(localStorage.getItem("supabase.dashboard.auth.token"));
  const access = parsed.access_token;
  const sql = ${JSON.stringify(sql)};
  const res = await fetch("https://api.supabase.com/v1/projects/iyspwyljihtduvnibzll/database/query", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + access,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  return JSON.stringify({ status: res.status, body: text.slice(0, 1200) });
})()`;
  writeFileSync(`tmp-run-${name}.json`, JSON.stringify({ expression }));
  console.log(name, expression.length);
}

pack("0008", readFileSync("supabase/migrations/0008_booking_number_lock_and_submit_hardening.sql", "utf8"));
pack("0009", readFileSync("supabase/migrations/0009_access_code_rate_limit.sql", "utf8"));
pack("0010", readFileSync("supabase/migrations/0010_booking_number_global_prefix.sql", "utf8"));
pack("notify", "NOTIFY pgrst, 'reload schema';");
pack(
  "verify",
  `select
    (select proname from pg_proc where proname = 'check_access_code_rate_limit' limit 1) as rate_fn,
    (pg_get_functiondef('public.next_booking_number(uuid)'::regprocedure) like '%pg_advisory_xact_lock%') as has_lock,
    (pg_get_functiondef('public.next_booking_number(uuid)'::regprocedure) like '%warka-booking-prefix%') as has_prefix,
    (pg_get_functiondef('public.next_booking_number(uuid)'::regprocedure) like '%count(*)%') as has_count_star;`
);
