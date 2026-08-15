/**
 * Live individual access-code checks. Never prints codes or secrets.
 * node --env-file=.env.local scripts/live-verify-individual-access-codes.mjs
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PROJECT = "iyspwyljihtduvnibzll";
const MARK = "WARKA QA TEMP ACCESSCODE";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getAccessCodeFingerprintScope(form) {
  const batchId = typeof form.batch_id === "string" ? form.batch_id.trim() : "";
  return batchId || form.id;
}

function normalizeAccessCodeInput(raw) {
  return raw
    .trim()
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[^\d]/g, "");
}

function encryptionKey() {
  const configured = requireEnv("ACCESS_CODE_ENCRYPTION_KEY");
  const decoded = Buffer.from(configured, configured.length === 64 ? "hex" : "base64");
  if (decoded.length !== 32) throw new Error("Invalid ACCESS_CODE_ENCRYPTION_KEY");
  return decoded;
}

function decryptAccessCode(encrypted) {
  const [ivRaw, tagRaw, ciphertextRaw] = encrypted.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final()
  ]).toString("utf8");
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
  return crypto.createHmac("sha256", requireEnv("ACCESS_CODE_HMAC_SECRET")).update(`${scope}:${code}`).digest("hex");
}

function generateNumericCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
if (!url.includes(PROJECT)) throw new Error("Refusing unexpected Supabase project.");
const client = createClient(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function verify(slug, code) {
  const { data: form, error: formError } = await client
    .from("booking_forms")
    .select("id,batch_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (formError || !form) return { ok: false, error: "invalid-form" };
  const { data, error } = await client.rpc("verify_access_code", {
    p_slug: slug,
    p_fingerprint: fingerprint(normalizeAccessCodeInput(code), getAccessCodeFingerprintScope(form))
  });
  if (error) return { ok: false, error: error.code ?? "rpc" };
  return { ok: Boolean(data?.ok), error: data?.error ?? null };
}

async function cleanupQa() {
  const { data: students } = await client.from("students").select("id").ilike("full_name", `${MARK}%`);
  const ids = (students ?? []).map((row) => row.id);
  if (!ids.length) return 0;
  await client.from("student_access_codes").delete().in("student_id", ids);
  await client.from("students").delete().in("id", ids);
  return ids.length;
}

const report = {};
try {
  const { data: form } = await client
    .from("booking_forms")
    .select("id,slug,batch_id,status")
    .eq("slug", "individual")
    .maybeSingle();
  if (!form) throw new Error("individual form missing");

  const { data: existing } = await client
    .from("student_access_codes")
    .select("id,student_id,code_ciphertext,code_fingerprint,status")
    .eq("form_id", form.id)
    .eq("status", "ACTIVE")
    .not("student_id", "is", null);

  const existingOk = [];
  for (const row of existing ?? []) {
    const { data: student } = await client.from("students").select("full_name,batch_id").eq("id", row.student_id).maybeSingle();
    if (student?.full_name?.startsWith(MARK)) continue;
    const code = decryptAccessCode(row.code_ciphertext);
    const padded = ` ${code} `;
    const arabic = [...code].map((d) => String.fromCharCode(0x0660 + Number(d))).join("");
    const result = await verify("individual", code);
    const paddedResult = await verify("individual", padded);
    const arabicResult = await verify("individual", arabic);
    existingOk.push({
      ok: result.ok === true,
      paddedOk: paddedResult.ok === true,
      arabicOk: arabicResult.ok === true,
      studentBatchNull: student?.batch_id == null
    });
  }
  report.existingActive = existingOk;
  report.liveExistingCodeVerification = existingOk.length > 0 && existingOk.every((row) => row.ok && row.paddedOk && row.arabicOk);

  await cleanupQa();
  const { data: qaStudent, error: studentError } = await client
    .from("students")
    .insert({ batch_id: null, full_name: `${MARK} 1`, notes: MARK })
    .select("id")
    .single();
  if (studentError) throw studentError;
  const qaCode = generateNumericCode();
  const { error: qaCodeError } = await client.from("student_access_codes").insert({
    student_id: qaStudent.id,
    batch_id: null,
    form_id: form.id,
    code_ciphertext: encryptAccessCode(qaCode),
    code_fingerprint: fingerprint(qaCode, getAccessCodeFingerprintScope(form)),
    status: "ACTIVE"
  });
  if (qaCodeError) throw qaCodeError;

  report.wrongCode = (await verify("individual", "000000")).ok === false;
  const disabledCode = generateNumericCode();
  await client
    .from("student_access_codes")
    .insert({
      student_id: qaStudent.id,
      batch_id: null,
      form_id: form.id,
      code_ciphertext: encryptAccessCode(disabledCode),
      code_fingerprint: fingerprint(disabledCode, getAccessCodeFingerprintScope(form)),
      status: "DISABLED"
    });
  report.disabledCode = (await verify("individual", disabledCode)).error === "invalid" || (await verify("individual", disabledCode)).ok === false;

  const usedStudent = await client
    .from("students")
    .insert({ batch_id: null, full_name: `${MARK} used`, notes: MARK })
    .select("id")
    .single();
  const usedCode = generateNumericCode();
  const { data: usedAccess } = await client
    .from("student_access_codes")
    .insert({
      student_id: usedStudent.data.id,
      batch_id: null,
      form_id: form.id,
      code_ciphertext: encryptAccessCode(usedCode),
      code_fingerprint: fingerprint(usedCode, getAccessCodeFingerprintScope(form)),
      status: "ACTIVE"
    })
    .select("id")
    .single();
  await client.from("student_access_codes").update({ status: "USED" }).eq("id", usedAccess.id);
  report.usedCode = (await verify("individual", usedCode)).error === "used";

  const oldCode = qaCode;
  const newCode = generateNumericCode();
  await client
    .from("student_access_codes")
    .update({ status: "DISABLED", updated_at: new Date().toISOString() })
    .eq("student_id", qaStudent.id)
    .eq("status", "ACTIVE");
  await client.from("student_access_codes").insert({
    student_id: qaStudent.id,
    batch_id: null,
    form_id: form.id,
    code_ciphertext: encryptAccessCode(newCode),
    code_fingerprint: fingerprint(newCode, getAccessCodeFingerprintScope(form)),
    status: "ACTIVE"
  });
  report.regeneratedNewWorks = (await verify("individual", newCode)).ok === true;
  report.regeneratedOldFails = (await verify("individual", oldCode)).ok === false;

  const { data: rate } = await client.rpc("check_access_code_rate_limit", {
    p_bucket_hash: crypto.createHash("sha256").update(`qa-accesscode-${Date.now()}`).digest("hex"),
    p_event: "check",
    p_max_failures: 8,
    p_window_seconds: 900,
    p_cooldown_seconds: 600
  });
  report.rateLimitPreserved = rate && rate.ok === true && rate.limited === false;
} finally {
  report.qaCleaned = await cleanupQa();
}

console.log(JSON.stringify(report, null, 2));
