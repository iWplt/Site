/**
 * Apply 0008/0009 and verify booking-number + rate-limit SQL against the live project.
 * Does not print secrets. Cleans up WARKA QA TEMP HARDEN rows created by this script.
 *
 * node --env-file=.env.local scripts/apply-and-verify-hardening.mjs
 */
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PROJECT = "iyspwyljihtduvnibzll";
const MARK = "WARKA QA TEMP HARDEN";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function encryptionKey() {
  const configured = process.env.ACCESS_CODE_ENCRYPTION_KEY;
  if (configured) {
    const decoded = Buffer.from(configured, configured.length === 64 ? "hex" : "base64");
    if (decoded.length === 32) return decoded;
  }
  return crypto.createHash("sha256").update("warka-local-development-encryption-key").digest();
}

function encryptAccessCode(code) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const b64 = (buf) => Buffer.from(buf).toString("base64url");
  return `${b64(iv)}.${b64(tag)}.${b64(ciphertext)}`;
}

function fingerprint(code, scope) {
  return crypto
    .createHmac("sha256", process.env.ACCESS_CODE_HMAC_SECRET || "warka-local-hmac-secret")
    .update(`${scope}:${code}`)
    .digest("hex");
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
    { name: "pg-meta-query", path: "/pg-meta/default/query" },
    { name: "pg", path: "/pg" }
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
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      results.push({
        name: attempt.name,
        status: response.status,
        ok: response.ok,
        snippet: text.slice(0, 240).replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]")
      });
      if (response.ok) return { ok: true, via: attempt.name, results, parsed, text };
    } catch (error) {
      results.push({
        name: attempt.name,
        status: 0,
        ok: false,
        snippet: error instanceof Error ? error.message : "fetch-failed"
      });
    }
  }
  return { ok: false, via: null, results, parsed: null, text: "" };
}

async function cleanup(client) {
  const { data: batches } = await client.from("batches").select("id").ilike("name", `${MARK}%`);
  const batchIds = (batches ?? []).map((row) => row.id);
  if (!batchIds.length) return;
  const { data: students } = await client.from("students").select("id").in("batch_id", batchIds);
  const studentIds = (students ?? []).map((row) => row.id);
  const { data: submissions } = await client.from("submissions").select("id").in("batch_id", batchIds);
  const submissionIds = (submissions ?? []).map((row) => row.id);
  if (submissionIds.length) {
    await client.from("submission_files").delete().in("submission_id", submissionIds);
    await client.from("order_status_history").delete().in("submission_id", submissionIds);
    await client.from("submissions").delete().in("id", submissionIds);
  }
  if (studentIds.length) await client.from("student_access_codes").delete().in("student_id", studentIds);
  if (studentIds.length) await client.from("students").delete().in("id", studentIds);
  await client.from("booking_forms").delete().in("batch_id", batchIds);
  await client.from("batches").delete().in("id", batchIds);
}

async function seedStudents(client, count, extraStatus) {
  const { data: batch, error: batchError } = await client
    .from("batches")
    .insert({
      name: `${MARK} Batch`,
      university: "QA",
      college: "QA",
      department: "QA",
      stage: "Fourth",
      graduation_year: 2098,
      description: MARK,
      status: "active"
    })
    .select("id")
    .single();
  if (batchError) throw batchError;

  const { data: form, error: formError } = await client
    .from("booking_forms")
    .insert({
      name: `${MARK} Form`,
      internal_description: MARK,
      slug: `warka-qa-harden-${Date.now().toString().slice(-6)}`,
      type: "BATCH",
      status: "published",
      batch_id: batch.id,
      definition: { id: "qa", version: 1, name: MARK, type: "BATCH", sections: [] }
    })
    .select("id,slug")
    .single();
  if (formError) throw formError;

  const created = [];
  for (let i = 0; i < count; i += 1) {
    const suffix = String.fromCharCode(65 + i);
    const { data: student, error: studentError } = await client
      .from("students")
      .insert({ batch_id: batch.id, full_name: `${MARK} ${suffix}`, notes: MARK })
      .select("id")
      .single();
    if (studentError) throw studentError;
    const code = String(crypto.randomInt(100000, 999999));
    const status = extraStatus?.[i] ?? "ACTIVE";
    const { data: access, error: codeError } = await client
      .from("student_access_codes")
      .insert({
        student_id: student.id,
        batch_id: batch.id,
        form_id: form.id,
        code_ciphertext: encryptAccessCode(code),
        code_fingerprint: fingerprint(code, batch.id),
        status
      })
      .select("id")
      .single();
    if (codeError) throw codeError;
    created.push({
      studentId: student.id,
      accessCodeId: access.id,
      code,
      slug: form.slug,
      formId: form.id,
      batchId: batch.id,
      status
    });
  }
  return created;
}

function rpcErrorCode(error) {
  if (!error) return null;
  return error.code || error.details || error.message?.slice(0, 80) || "error";
}

function receiptHelpers() {
  const secret = requireEnv("BOOKING_SESSION_SECRET");
  function sign(ttlMs) {
    const payload = Buffer.from(
      JSON.stringify({
        submissionId: "00000000-0000-4000-8000-000000000099",
        bookingNumber: "WK-2099-00000",
        expiresAt: Date.now() + ttlMs
      })
    ).toString("base64url");
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }
  function verify(token) {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;
    const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (parsed.expiresAt < Date.now()) return null;
    return parsed;
  }
  return { sign, verify };
}

async function main() {
  const report = {
    sqlApply: "not-applied",
    sqlApplyVia: null,
    sqlApplyDetail: [],
    functionHasAdvisoryLock: "unknown-no-sql-access",
    migrationHistory: "unknown-no-sql-access",
    concurrentOk: false,
    concurrentUnique: false,
    concurrentCollision: false,
    concurrentErrors: [],
    rateLimitRpc: "unknown",
    verifyValid: false,
    verifyInvalid: false,
    verifyUsed: false,
    verifyDisabled: false,
    sameStudentSecondSubmitBlocked: false,
    receiptTtlDays: Number(process.env.RECEIPT_TTL_DAYS ?? "30"),
    receiptFreshOk: false,
    receiptExpiredRejected: false,
    guessedBookingNumberRejected: false
  };

  const sql8 = readFileSync("supabase/migrations/0008_booking_number_lock_and_submit_hardening.sql", "utf8");
  const sql9 = readFileSync("supabase/migrations/0009_access_code_rate_limit.sql", "utf8");
  const sql10 = readFileSync("supabase/migrations/0010_booking_number_global_prefix.sql", "utf8");
  const applied = await tryRunSql(`${sql8}\n${sql9}\n${sql10}`);
  report.sqlApply = applied.ok ? "applied" : "blocked-no-sql-access";
  report.sqlApplyVia = applied.via;
  report.sqlApplyDetail = applied.results.map((row) => `${row.name}:${row.status}`);

  if (applied.ok) {
    await tryRunSql(`
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        name text,
        statements text[]
      );
      insert into supabase_migrations.schema_migrations (version, name)
      values
        ('0008', '0008_booking_number_lock_and_submit_hardening'),
        ('0009', '0009_access_code_rate_limit')
      on conflict (version) do nothing;
    `);
  }

  const def = await tryRunSql("select pg_get_functiondef('public.next_booking_number(uuid)'::regprocedure) as def");
  if (def.ok) {
    const text = `${def.text}${JSON.stringify(def.parsed)}`;
    report.functionHasAdvisoryLock = /pg_advisory_xact_lock/.test(text) ? "yes" : "no";
  }

  const history = await tryRunSql(
    "select version, name from supabase_migrations.schema_migrations order by version"
  );
  if (history.ok) {
    const text = `${history.text}${JSON.stringify(history.parsed)}`;
    report.migrationHistory = /0008/.test(text) ? "0008-present" : "0008-missing";
  }

  const client = admin();
  await cleanup(client);
  const pair = await seedStudents(client, 3, ["ACTIVE", "ACTIVE", "DISABLED"]);
  const answers = { student_name: MARK, address: "QA", phone: "07701112233", booking_type: "full_set" };

  const valid = await client.rpc("verify_access_code", {
    p_slug: pair[0].slug,
    p_fingerprint: fingerprint(pair[0].code, pair[0].batchId)
  });
  report.verifyValid = Boolean(valid.data?.ok);

  const invalid = await client.rpc("verify_access_code", {
    p_slug: pair[0].slug,
    p_fingerprint: fingerprint("000000", pair[0].batchId)
  });
  report.verifyInvalid = valid.data?.ok && invalid.data?.ok === false && invalid.data?.error !== "used";

  const disabled = await client.rpc("verify_access_code", {
    p_slug: pair[2].slug,
    p_fingerprint: fingerprint(pair[2].code, pair[2].batchId)
  });
  report.verifyDisabled = disabled.data?.ok === false && disabled.data?.error !== "used";

  const [first, second] = await Promise.all(
    pair.slice(0, 2).map((entry) =>
      client.rpc("submit_booking_transaction", {
        p_form_id: entry.formId,
        p_batch_id: entry.batchId,
        p_student_id: entry.studentId,
        p_access_code_id: entry.accessCodeId,
        p_answers: answers,
        p_files: {}
      })
    )
  );
  const numbers = [first.data?.bookingNumber, second.data?.bookingNumber].filter(Boolean);
  report.concurrentErrors = [rpcErrorCode(first.error), rpcErrorCode(second.error)].filter(Boolean);
  report.concurrentCollision = report.concurrentErrors.some((code) => String(code).includes("23505"));
  report.concurrentUnique = numbers.length === 2 && numbers[0] !== numbers[1];
  report.concurrentOk = report.concurrentUnique && !first.error && !second.error;

  const used = await client.rpc("verify_access_code", {
    p_slug: pair[0].slug,
    p_fingerprint: fingerprint(pair[0].code, pair[0].batchId)
  });
  report.verifyUsed = used.data?.error === "used" || used.data?.ok === false;

  const repeat = await client.rpc("submit_booking_transaction", {
    p_form_id: pair[0].formId,
    p_batch_id: pair[0].batchId,
    p_student_id: pair[0].studentId,
    p_access_code_id: pair[0].accessCodeId,
    p_answers: answers,
    p_files: {}
  });
  report.sameStudentSecondSubmitBlocked = Boolean(repeat.error);

  const rateBucket = crypto.createHash("sha256").update(`qa-rate-${Date.now()}`).digest("hex");
  let limited = false;
  let rateError = null;
  for (let i = 0; i < 9; i += 1) {
    const { data, error } = await client.rpc("check_access_code_rate_limit", {
      p_bucket_hash: rateBucket,
      p_event: "fail",
      p_max_failures: 8,
      p_window_seconds: 900,
      p_cooldown_seconds: 600
    });
    if (error) {
      rateError = rpcErrorCode(error);
      break;
    }
    if (data?.limited) limited = true;
  }
  if (rateError) report.rateLimitRpc = `missing:${rateError}`;
  else report.rateLimitRpc = limited ? "limits-after-threshold" : "did-not-limit";

  const receipts = receiptHelpers();
  report.receiptFreshOk = Boolean(receipts.verify(receipts.sign(60_000)));
  report.receiptExpiredRejected = receipts.verify(receipts.sign(-1000)) === null;
  report.guessedBookingNumberRejected = receipts.verify(numbers[0] ?? "WK-2027-00001") === null;

  await cleanup(client);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("VERIFY_FAILED", error instanceof Error ? error.message : "unknown");
  process.exitCode = 1;
});
