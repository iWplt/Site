import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

const formId = "form-individual-id";
assert.equal(getAccessCodeFingerprintScope({ id: formId, batch_id: null }), formId);
assert.equal(getAccessCodeFingerprintScope({ id: formId, batch_id: undefined }), formId);
assert.equal(getAccessCodeFingerprintScope({ id: formId, batch_id: "" }), formId);
assert.equal(getAccessCodeFingerprintScope({ id: formId, batch_id: "batch-9" }), "batch-9");
assert.notEqual(getAccessCodeFingerprintScope({ id: formId, batch_id: null }), "individual");
assert.notEqual(getAccessCodeFingerprintScope({ id: formId, batch_id: null }), "null");
assert.equal(normalizeAccessCodeInput("  123456  "), "123456");
assert.equal(normalizeAccessCodeInput("١٢٣٤٥٦"), "123456");

const scopeSource = readFileSync("src/lib/access-code-scope.ts", "utf8");
assert.match(scopeSource, /batch_id/);
assert.match(scopeSource, /return batchId \|\| form\.id/);

const callers = [
  "src/lib/store/supabase-db.ts",
  "src/app/actions.ts",
  "src/lib/store/local-db.ts"
];
for (const file of callers) {
  const source = readFileSync(file, "utf8");
  const matches = [...source.matchAll(/accessCodeFingerprint\(([^)]*)\)/g)].map((row) => row[1]);
  for (const args of matches) {
    assert.equal(
      args.includes("student.batch_id") && !args.includes("getAccessCodeFingerprintScope"),
      false,
      `${file} fingerprints with student.batch_id`
    );
    assert.equal(args.includes('"individual"'), false, `${file} fingerprints with literal individual`);
  }
}

const supabaseDb = readFileSync("src/lib/store/supabase-db.ts", "utf8");
assert.match(supabaseDb, /getAccessCodeFingerprintScope\(form\)/);
assert.doesNotMatch(supabaseDb, /accessCodeFingerprint\(code, student\.batch_id\)/);

console.log("access-code fingerprint regression: ok");
