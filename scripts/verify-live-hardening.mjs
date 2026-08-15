/**
 * Live-only verification of 0008/0009/0010. Creates WARKA QA TEMP HARDEN rows, then deletes them.
 * node --env-file=.env.local scripts/verify-live-hardening.mjs
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PROJECT = "iyspwyljihtduvnibzll";
const MARKS = ["WARKA QA TEMP SECURITY", "WARKA QA TEMP HARDEN"];
const MARK = MARKS[0];
const YEAR = 2096;

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

function anon() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function trySql(sql) {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  try {
    const response = await fetch(`${url}/pg/query`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(12000)
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: error instanceof Error ? error.message : "fetch-failed" };
  }
}

async function cleanup(client) {
  const found = [];
  for (const mark of MARKS) {
    const { data } = await client.from("batches").select("id").ilike("name", `${mark}%`);
    found.push(...(data ?? []));
  }
  const batchIds = [...new Set(found.map((row) => row.id))];
  if (!batchIds.length) return { batches: 0, students: 0, submissions: 0 };
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
  await client.from("representative_batches").delete().in("batch_id", batchIds);
  await client.from("batches").delete().in("id", batchIds);
  return { batches: batchIds.length, students: studentIds.length, submissions: submissionIds.length };
}

async function seedBatch(client, label, studentCount, extraStatus = []) {
  const { data: batch, error: batchError } = await client
    .from("batches")
    .insert({
      name: `${MARK} ${label}`,
      university: "QA",
      college: "QA",
      department: "QA",
      stage: "Fourth",
      graduation_year: YEAR,
      description: MARK,
      status: "active"
    })
    .select("id")
    .single();
  if (batchError) throw batchError;

  const { data: form, error: formError } = await client
    .from("booking_forms")
    .insert({
      name: `${MARK} ${label} Form`,
      internal_description: MARK,
      slug: `warka-qa-harden-${label.toLowerCase()}-${Date.now().toString().slice(-5)}`,
      type: "BATCH",
      status: "published",
      batch_id: batch.id,
      definition: { id: "qa", version: 1, name: MARK, type: "BATCH", sections: [] }
    })
    .select("id,slug")
    .single();
  if (formError) throw formError;

  const created = [];
  for (let i = 0; i < studentCount; i += 1) {
    const { data: student, error: studentError } = await client
      .from("students")
      .insert({ batch_id: batch.id, full_name: `${MARK} ${label} ${i + 1}`, notes: MARK })
      .select("id")
      .single();
    if (studentError) throw studentError;
    const code = String(crypto.randomInt(100000, 999999));
    const status = extraStatus[i] ?? "ACTIVE";
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

function submit(client, entry) {
  return client.rpc("submit_booking_transaction", {
    p_form_id: entry.formId,
    p_batch_id: entry.batchId,
    p_student_id: entry.studentId,
    p_access_code_id: entry.accessCodeId,
    p_answers: { student_name: MARK, address: "QA", phone: "07701112233", booking_type: "full_set" },
    p_files: {}
  });
}

function errCode(error) {
  return error?.code || error?.message?.slice(0, 80) || null;
}

function receiptChecks() {
  const secret = requireEnv("BOOKING_SESSION_SECRET");
  const ttlDays = Number(process.env.RECEIPT_TTL_DAYS ?? "30");
  const ttlMs = Math.min(120, Math.max(1, Math.trunc(ttlDays))) * 24 * 60 * 60 * 1000;
  function sign(expiresAt) {
    const payload = Buffer.from(
      JSON.stringify({
        submissionId: "00000000-0000-4000-8000-000000000099",
        bookingNumber: "WK-2099-00000",
        expiresAt
      })
    ).toString("base64url");
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }
  function verify(token) {
    const [encoded, signature] = String(token).split(".");
    if (!encoded || !signature) return null;
    const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (parsed.expiresAt < Date.now()) return null;
    return parsed;
  }
  const fresh = sign(Date.now() + ttlMs);
  const parsed = verify(fresh);
  const days = parsed ? (parsed.expiresAt - Date.now()) / 86400000 : 0;
  return {
    configuredDays: Number.isFinite(ttlDays) ? ttlDays : 30,
    generatedDays: Math.round(days),
    freshOk: Boolean(parsed),
    expiredRejected: verify(sign(Date.now() - 1000)) === null,
    guessedRejected: verify("WK-2027-00001") === null && verify("WK-2095-00001") === null
  };
}

const client = admin();
const report = {};

try {
  await cleanup(client);

  const sqlDef = await trySql("select pg_get_functiondef('public.next_booking_number(uuid)'::regprocedure) as def");
  const defText = sqlDef.ok ? sqlDef.text : "";
  report.functionSqlAccess = sqlDef.ok;
  report.functionHasCountStarPlusOne = sqlDef.ok ? /count\(\*\)\s*\+\s*1/i.test(defText) : "unknown-no-sql";
  report.functionHasAdvisoryLock = sqlDef.ok ? /pg_advisory_xact_lock/.test(defText) : "unknown-no-sql";
  report.functionHasPrefixMax = sqlDef.ok ? /warka-booking-prefix/.test(defText) : "unknown-no-sql";

  const { data: sampleNumber, error: numberError } = await client.rpc("next_booking_number", {
    p_batch_id: "00000000-0000-4000-8000-000000000001"
  });
  report.nextBookingNumberCallable = !numberError;
  report.nextBookingNumberPreview = typeof sampleNumber === "string" ? sampleNumber.replace(/\d{5}$/, "xxxxx") : null;

  const rateProbe = crypto.createHash("sha256").update(`qa-rate-exists-${Date.now()}`).digest("hex");
  const { data: rateExists, error: rateExistsError } = await client.rpc("check_access_code_rate_limit", {
    p_bucket_hash: rateProbe,
    p_event: "check",
    p_max_failures: 8,
    p_window_seconds: 900,
    p_cooldown_seconds: 600
  });
  report.rateLimitRpcExists = !rateExistsError && rateExists && typeof rateExists === "object";
  report.anonRateLimitDenied = false;
  const anonClient = anon();
  const { error: anonRateError } = await anonClient.rpc("check_access_code_rate_limit", {
    p_bucket_hash: rateProbe,
    p_event: "fail",
    p_max_failures: 8,
    p_window_seconds: 900,
    p_cooldown_seconds: 600
  });
  report.anonRateLimitDenied = Boolean(anonRateError);
  const { error: anonNextError } = await anonClient.rpc("next_booking_number", {
    p_batch_id: "00000000-0000-4000-8000-000000000001"
  });
  report.anonNextBookingDenied = Boolean(anonNextError);

  const crossA = await seedBatch(client, "XA", 1);
  const crossB = await seedBatch(client, "XB", 1);
  const first = await submit(client, crossA[0]);
  const second = await submit(client, crossB[0]);
  const crossNumbers = [first.data?.bookingNumber, second.data?.bookingNumber].filter(Boolean);
  report.crossBatchNumbers = crossNumbers;
  report.crossBatchUnique = crossNumbers.length === 2 && crossNumbers[0] !== crossNumbers[1];
  report.crossBatchSameYearPrefix =
    crossNumbers.length === 2 &&
    crossNumbers.every((value) => String(value).startsWith(`WK-${YEAR}-`));
  report.crossBatchErrors = [errCode(first.error), errCode(second.error)].filter(Boolean);

  const sameBatch = await seedBatch(client, "SA", 6);
  const sameResults = await Promise.all(sameBatch.map((entry) => submit(client, entry)));
  const sameNumbers = sameResults.map((row) => row.data?.bookingNumber).filter(Boolean);
  const sameErrors = sameResults.map((row) => errCode(row.error)).filter(Boolean);
  report.sameBatchOkCount = sameNumbers.length;
  report.sameBatchUniqueCount = new Set(sameNumbers).size;
  report.sameBatchErrors = sameErrors;
  report.sameBatch23505 = sameErrors.filter((code) => String(code).includes("23505")).length;
  report.sameBatchAllUnique = sameNumbers.length === sameBatch.length && new Set(sameNumbers).size === sameBatch.length;

  const burstA = await seedBatch(client, "PA", 4);
  const burstB = await seedBatch(client, "PB", 4);
  const burst = [...burstA, ...burstB];
  const burstResults = await Promise.all(burst.map((entry) => submit(client, entry)));
  const burstNumbers = burstResults.map((row) => row.data?.bookingNumber).filter(Boolean);
  const burstErrors = burstResults.map((row) => errCode(row.error)).filter(Boolean);
  report.crossParallelOkCount = burstNumbers.length;
  report.crossParallelUniqueCount = new Set(burstNumbers).size;
  report.crossParallelErrors = burstErrors;
  report.crossParallel23505 = burstErrors.filter((code) => String(code).includes("23505")).length;
  report.crossParallelAllUnique = burstNumbers.length === burst.length && new Set(burstNumbers).size === burst.length;
  report.collisions23505 = report.sameBatch23505 + report.crossParallel23505;

  const extra = await seedBatch(client, "RL", 3, ["ACTIVE", "DISABLED", "ACTIVE"]);
  const valid = await client.rpc("verify_access_code", {
    p_slug: extra[0].slug,
    p_fingerprint: fingerprint(extra[0].code, extra[0].batchId)
  });
  const wrong = await client.rpc("verify_access_code", {
    p_slug: extra[0].slug,
    p_fingerprint: fingerprint("000000", extra[0].batchId)
  });
  const disabled = await client.rpc("verify_access_code", {
    p_slug: extra[1].slug,
    p_fingerprint: fingerprint(extra[1].code, extra[1].batchId)
  });
  const submitted = await submit(client, extra[2]);
  const used = await client.rpc("verify_access_code", {
    p_slug: extra[2].slug,
    p_fingerprint: fingerprint(extra[2].code, extra[2].batchId)
  });
  report.verifyValid = Boolean(valid.data?.ok);
  report.verifyWrong = wrong.data?.ok === false && wrong.data?.error !== "used";
  report.verifyDisabled = disabled.data?.ok === false && disabled.data?.error !== "used";
  report.verifyUsed = used.data?.error === "used" || (submitted.data && used.data?.ok === false);

  const resetBucket = crypto.createHash("sha256").update(`qa-rate-reset-${Date.now()}`).digest("hex");
  await client.rpc("check_access_code_rate_limit", {
    p_bucket_hash: resetBucket,
    p_event: "fail",
    p_max_failures: 8,
    p_window_seconds: 900,
    p_cooldown_seconds: 600
  });
  await client.rpc("check_access_code_rate_limit", {
    p_bucket_hash: resetBucket,
    p_event: "fail",
    p_max_failures: 8,
    p_window_seconds: 900,
    p_cooldown_seconds: 600
  });
  const afterFails = await client.rpc("check_access_code_rate_limit", {
    p_bucket_hash: resetBucket,
    p_event: "success",
    p_max_failures: 8,
    p_window_seconds: 900,
    p_cooldown_seconds: 600
  });
  const afterReset = await client.rpc("check_access_code_rate_limit", {
    p_bucket_hash: resetBucket,
    p_event: "check",
    p_max_failures: 8,
    p_window_seconds: 900,
    p_cooldown_seconds: 600
  });

  const limitBucket = crypto.createHash("sha256").update(`qa-rate-limit-${Date.now()}`).digest("hex");
  let limitedAt = null;
  for (let i = 1; i <= 9; i += 1) {
    const { data } = await client.rpc("check_access_code_rate_limit", {
      p_bucket_hash: limitBucket,
      p_event: "fail",
      p_max_failures: 8,
      p_window_seconds: 900,
      p_cooldown_seconds: 600
    });
    if (data?.limited) {
      limitedAt = i;
      break;
    }
  }
  const cooldownCheck = await client.rpc("check_access_code_rate_limit", {
    p_bucket_hash: limitBucket,
    p_event: "check",
    p_max_failures: 8,
    p_window_seconds: 900,
    p_cooldown_seconds: 600
  });
  const { data: guardRow } = await client
    .from("access_code_attempt_guard")
    .select("bucket_hash, failed_count, cooldown_until")
    .eq("bucket_hash", limitBucket)
    .maybeSingle();
  report.rateLimitResetClears = afterFails.data?.limited === false && afterReset.data?.limited === false;
  report.rateLimitTriggersAt = limitedAt;
  report.rateLimitCooldownHolds = cooldownCheck.data?.limited === true;
  report.rateLimitPersisted = Boolean(guardRow) && (guardRow.failed_count ?? 0) >= 8 && Boolean(guardRow.cooldown_until);
  await client.from("access_code_attempt_guard").delete().in("bucket_hash", [rateProbe, resetBucket, limitBucket]);

  const receipts = receiptChecks();
  report.receipt = receipts;

  const guessed = burstNumbers[0] || crossNumbers[0];
  if (guessed) {
    const { count } = await client
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("booking_number", guessed);
    report.guessedNumberExistsInDb = (count ?? 0) > 0;
  }
} finally {
  report.cleanup = await cleanup(client);
}

console.log(JSON.stringify(report, null, 2));
