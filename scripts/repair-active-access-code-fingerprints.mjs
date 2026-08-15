/**
 * One-time repair: recompute ACTIVE access-code fingerprints from decrypted codes.
 * Does not change plaintext, student, status, or form association.
 * Never prints codes or secrets.
 *
 * node --env-file=.env.local scripts/repair-active-access-code-fingerprints.mjs
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PROJECT = "iyspwyljihtduvnibzll";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getAccessCodeFingerprintScope(form) {
  const batchId = typeof form.batch_id === "string" ? form.batch_id.trim() : "";
  return batchId || form.id;
}

function encryptionKey() {
  const configured = process.env.ACCESS_CODE_ENCRYPTION_KEY;
  if (!configured) throw new Error("Missing ACCESS_CODE_ENCRYPTION_KEY");
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

function fingerprint(code, scope, secret) {
  return crypto.createHmac("sha256", secret).update(`${scope}:${code}`).digest("hex");
}

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
if (!url.includes(PROJECT)) throw new Error("Refusing unexpected Supabase project.");
const hmac = requireEnv("ACCESS_CODE_HMAC_SECRET");
const client = createClient(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data: forms, error: formError } = await client.from("booking_forms").select("id,batch_id");
if (formError) throw formError;
const formsById = new Map((forms ?? []).map((row) => [row.id, row]));

const { data: codes, error: codesError } = await client
  .from("student_access_codes")
  .select("id,form_id,status,code_ciphertext,code_fingerprint")
  .eq("status", "ACTIVE");
if (codesError) throw codesError;

let decryptFail = 0;
let alreadyMatched = 0;
let repaired = 0;
let skippedNoForm = 0;

for (const row of codes ?? []) {
  const form = formsById.get(row.form_id);
  if (!form) {
    skippedNoForm += 1;
    continue;
  }
  let plaintext;
  try {
    plaintext = decryptAccessCode(row.code_ciphertext);
  } catch {
    decryptFail += 1;
    continue;
  }
  const next = fingerprint(plaintext, getAccessCodeFingerprintScope(form), hmac);
  if (next === row.code_fingerprint) {
    alreadyMatched += 1;
    continue;
  }
  const { error } = await client
    .from("student_access_codes")
    .update({ code_fingerprint: next, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "ACTIVE")
    .eq("code_fingerprint", row.code_fingerprint);
  if (error) throw error;
  repaired += 1;
}

console.log(
  JSON.stringify({
    activeScanned: (codes ?? []).length,
    alreadyMatched,
    repaired,
    decryptFail,
    skippedNoForm
  })
);
