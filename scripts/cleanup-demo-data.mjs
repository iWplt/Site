/**
 * One-shot production cleanup: remove E2E/demo records from the real Supabase project.
 * Does NOT touch Owner profiles, schema, buckets, or RLS.
 *
 * Usage: node --env-file=.env.local scripts/cleanup-demo-data.mjs [--apply]
 */
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const OWNER_EMAIL = "moh986295@gmail.com";

const KNOWN_BATCH_IDS = [
  "42949bfc-d77f-478e-aab5-3f247a636702",
  "a0671c2e-63bf-4b05-b1cf-575bf513b760"
];
const KNOWN_SUBMISSION_IDS = ["7de7c53a-9be3-4471-bb98-124fc1267057"];
const KNOWN_BOOKING_NUMBERS = ["WK-2027-00001"];
const KNOWN_SLUGS = ["warka-e2e-test-2027-2027"];

function looksLikeTestText(value) {
  const text = String(value ?? "").toLowerCase();
  return (
    text.includes("e2e") ||
    text.includes("decoy") ||
    text.includes("warka e2e") ||
    text.includes("طالب اختبار") ||
    text.includes("اختبار وركة") ||
    /decoy-\d+/.test(text) ||
    text.includes("warka qa temp") ||
    text.includes("qa temp")
  );
}

function loadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!url.includes("iyspwyljihtduvnibzll")) {
    throw new Error("Refusing to run: Supabase URL does not match the expected production project.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function listAll(admin, table, columns = "*") {
  const { data, error } = await admin.from(table).select(columns);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

async function listBucketPaths(admin, bucket) {
  const paths = [];
  async function walk(prefix = "") {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw new Error(`${bucket} list ${prefix}: ${error.message}`);
    for (const item of data ?? []) {
      const next = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || item.metadata == null) {
        await walk(next);
      } else {
        paths.push(next);
      }
    }
  }
  await walk("");
  return paths;
}

function collectIds(rows, key = "id") {
  return new Set(rows.map((row) => row[key]).filter(Boolean));
}

async function main() {
  const admin = loadClient();

  const { data: ownerUsers, error: ownerError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (ownerError) throw ownerError;
  const owner = (ownerUsers?.users ?? []).find((user) => user.email === OWNER_EMAIL);
  console.log(`Owner account present: ${Boolean(owner)}`);
  if (owner) console.log(`Owner id kept: ${owner.id}`);

  const [batches, forms, students, submissions, codes, files, history, audits, profiles, reps] = await Promise.all([
    listAll(admin, "batches"),
    listAll(admin, "booking_forms"),
    listAll(admin, "students"),
    listAll(admin, "submissions"),
    listAll(admin, "student_access_codes", "id, student_id, batch_id, form_id, status"),
    listAll(admin, "submission_files", "id, submission_id, storage_path, field_key"),
    listAll(admin, "order_status_history", "id, submission_id"),
    listAll(admin, "audit_logs", "id, action, entity_type, entity_id, actor_label, metadata, created_at"),
    listAll(admin, "profiles", "id, full_name, email, role"),
    listAll(admin, "representative_batches")
  ]);

  const testBatches = batches.filter(
    (row) =>
      KNOWN_BATCH_IDS.includes(row.id) ||
      looksLikeTestText(row.name) ||
      looksLikeTestText(row.description)
  );
  const testForms = forms.filter(
    (row) =>
      KNOWN_SLUGS.includes(row.slug) ||
      looksLikeTestText(row.slug) ||
      looksLikeTestText(row.name) ||
      looksLikeTestText(row.internal_description) ||
      testBatches.some((batch) => batch.id === row.batch_id)
  );
  const testStudents = students.filter(
    (row) =>
      looksLikeTestText(row.full_name) ||
      looksLikeTestText(row.notes) ||
      testBatches.some((batch) => batch.id === row.batch_id)
  );
  const testSubmissions = submissions.filter(
    (row) =>
      KNOWN_SUBMISSION_IDS.includes(row.id) ||
      KNOWN_BOOKING_NUMBERS.includes(row.booking_number) ||
      looksLikeTestText(row.booking_number) ||
      testBatches.some((batch) => batch.id === row.batch_id) ||
      testForms.some((form) => form.id === row.form_id) ||
      testStudents.some((student) => student.id === row.student_id)
  );

  const testBatchIds = collectIds(testBatches);
  const testFormIds = collectIds(testForms);
  const testStudentIds = collectIds(testStudents);
  const testSubmissionIds = collectIds(testSubmissions);

  const testCodes = codes.filter(
    (row) => testStudentIds.has(row.student_id) || testBatchIds.has(row.batch_id) || testFormIds.has(row.form_id)
  );
  const testFiles = files.filter((row) => testSubmissionIds.has(row.submission_id));
  const testHistory = history.filter((row) => testSubmissionIds.has(row.submission_id));
  const testAudits = audits.filter((row) => {
    const meta = JSON.stringify(row.metadata ?? {});
    return (
      testSubmissionIds.has(row.entity_id) ||
      testBatchIds.has(row.entity_id) ||
      testFormIds.has(row.entity_id) ||
      testStudentIds.has(row.entity_id) ||
      looksLikeTestText(row.actor_label) ||
      looksLikeTestText(meta) ||
      KNOWN_BOOKING_NUMBERS.some((number) => meta.includes(number))
    );
  });
  const testRepLinks = reps.filter((row) => testBatchIds.has(row.batch_id));
  const testReps = profiles.filter(
    (row) => row.role === "REPRESENTATIVE" && looksLikeTestText(row.full_name)
  );

  console.log("Inventory:");
  console.log(`  batches=${batches.length} test=${testBatches.length}`);
  console.log(`  forms=${forms.length} test=${testForms.length}`);
  console.log(`  students=${students.length} test=${testStudents.length}`);
  console.log(`  submissions=${submissions.length} test=${testSubmissions.length}`);
  console.log(`  codes=${codes.length} test=${testCodes.length}`);
  console.log(`  files=${files.length} test=${testFiles.length}`);
  console.log(`  history=${history.length} test=${testHistory.length}`);
  console.log(`  audits=${audits.length} test=${testAudits.length}`);
  console.log(`  test representative profiles=${testReps.length}`);
  if (testBatches.length) console.log("  test batches:", testBatches.map((row) => `${row.id} ${row.name}`).join(" | "));
  if (testForms.length) console.log("  test forms:", testForms.map((row) => `${row.slug}`).join(" | "));
  if (testStudents.length) console.log("  test students:", testStudents.map((row) => row.full_name).join(" | "));
  if (testSubmissions.length) console.log("  test bookings:", testSubmissions.map((row) => row.booking_number).join(" | "));

  const [uploadPaths, optionPaths] = await Promise.all([
    listBucketPaths(admin, "booking-uploads"),
    listBucketPaths(admin, "form-options")
  ]);

  const testUploadPaths = uploadPaths.filter((path) => {
    return (
      testFiles.some((file) => file.storage_path === path) ||
      [...testSubmissionIds, ...testBatchIds, ...testFormIds, ...testStudentIds].some((id) => path.includes(id)) ||
      looksLikeTestText(path) ||
      path.includes("e2e") ||
      path.includes("decoy")
    );
  });
  const testOptionPaths = optionPaths.filter((path) => {
    return (
      [...testFormIds, ...testBatchIds].some((id) => path.includes(id)) ||
      looksLikeTestText(path) ||
      path.includes("e2e") ||
      path.includes("decoy")
    );
  });

  console.log(`Storage booking-uploads: ${uploadPaths.length} objects, test=${testUploadPaths.length}`);
  console.log(`Storage form-options: ${optionPaths.length} objects, test=${testOptionPaths.length}`);

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to delete the identified test records.");
    return;
  }

  async function remove(table, ids) {
    if (!ids.length) return;
    const { error } = await admin.from(table).delete().in("id", ids);
    if (error) throw new Error(`delete ${table}: ${error.message}`);
    console.log(`Deleted ${ids.length} from ${table}`);
  }

  if (testUploadPaths.length) {
    const { error } = await admin.storage.from("booking-uploads").remove(testUploadPaths);
    if (error) throw new Error(`storage booking-uploads: ${error.message}`);
    console.log(`Removed ${testUploadPaths.length} booking-uploads objects`);
  }
  if (testOptionPaths.length) {
    const { error } = await admin.storage.from("form-options").remove(testOptionPaths);
    if (error) throw new Error(`storage form-options: ${error.message}`);
    console.log(`Removed ${testOptionPaths.length} form-options objects`);
  }

  await remove("audit_logs", testAudits.map((row) => row.id));
  await remove("order_status_history", testHistory.map((row) => row.id));
  await remove("submission_files", testFiles.map((row) => row.id));
  await remove("submissions", testSubmissions.map((row) => row.id));
  await remove("student_access_codes", testCodes.map((row) => row.id));
  await remove("students", testStudents.map((row) => row.id));

  if (testFormIds.size) {
    const formIds = [...testFormIds];
    for (const table of ["form_rules", "form_sections", "batch_form_overrides"]) {
      const { error } = await admin.from(table).delete().in("form_id", formIds);
      if (error && !/does not exist|schema cache/i.test(error.message)) {
        throw new Error(`delete ${table}: ${error.message}`);
      }
    }
  }
  await remove("booking_forms", testForms.map((row) => row.id));

  if (testBatchIds.size) {
    const { error } = await admin.from("representative_batches").delete().in("batch_id", [...testBatchIds]);
    if (error) throw new Error(`delete representative_batches: ${error.message}`);
    console.log(`Deleted ${testRepLinks.length} representative_batches links`);
  }
  await remove("batches", testBatches.map((row) => row.id));

  for (const rep of testReps) {
    if (rep.email === OWNER_EMAIL) continue;
    await admin.from("representative_batches").delete().eq("representative_id", rep.id);
    await admin.from("profiles").delete().eq("id", rep.id);
    await admin.auth.admin.deleteUser(rep.id);
    console.log(`Deleted test representative ${rep.full_name}`);
  }

  console.log("Cleanup applied.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
