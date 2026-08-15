/**
 * Final pre-launch QA against live project iyspwyljihtduvnibzll.
 * Prefix: WARKA FINAL QA
 *
 * node --env-file=.env.local scripts/warka-final-qa.mjs
 * node --env-file=.env.local scripts/warka-final-qa.mjs --cleanup
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PROJECT = "iyspwyljihtduvnibzll";
const MARK = "WARKA FINAL QA";
const IND_MARK = "WARKA FINAL QA INDIVIDUAL";
const YEAR = 2099;
const CLEANUP_ONLY = process.argv.includes("--cleanup");

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

function encryptionKey() {
  const configured = process.env.ACCESS_CODE_ENCRYPTION_KEY;
  if (configured) {
    const decoded = Buffer.from(configured, configured.length === 64 ? "hex" : "base64");
    if (decoded.length === 32) return decoded;
  }
  throw new Error("ACCESS_CODE_ENCRYPTION_KEY is required for QA.");
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

function hashPickup(token) {
  return crypto.createHmac("sha256", requireEnv("BOOKING_SESSION_SECRET")).update(`pickup:${token}`).digest("hex");
}

function assert(condition, label) {
  if (!condition) throw new Error(`FAIL ${label}`);
  console.log("PASS", label);
}

async function cleanup(client) {
  const { data: namedBatches } = await client.from("batches").select("id").ilike("name", `${MARK}%`);
  const { data: indBatches } = await client.from("batches").select("id").ilike("name", `${IND_MARK}%`);
  const batchIds = [...new Set([...(namedBatches ?? []), ...(indBatches ?? [])].map((row) => row.id))];
  const { data: namedStudents } = await client.from("students").select("id").ilike("full_name", `${MARK}%`);
  const { data: indStudents } = await client.from("students").select("id").ilike("full_name", `${IND_MARK}%`);
  const studentIds = [...new Set([...(namedStudents ?? []), ...(indStudents ?? [])].map((row) => row.id))];

  const submissionFilters = [];
  if (batchIds.length) submissionFilters.push(`batch_id.in.(${batchIds.join(",")})`);
  if (studentIds.length) submissionFilters.push(`student_id.in.(${studentIds.join(",")})`);
  let submissions = [];
  if (submissionFilters.length) {
    const { data } = await client.from("submissions").select("id").or(submissionFilters.join(","));
    submissions = data ?? [];
  }
  const submissionIds = submissions.map((row) => row.id);
  if (submissionIds.length) {
    await client.from("submission_files").delete().in("submission_id", submissionIds);
    await client.from("order_status_history").delete().in("submission_id", submissionIds);
    await client.from("submissions").delete().in("id", submissionIds);
  }
  if (studentIds.length) await client.from("student_access_codes").delete().in("student_id", studentIds);
  if (studentIds.length) await client.from("students").delete().in("id", studentIds);
  if (batchIds.length) {
    await client.from("representative_batches").delete().in("batch_id", batchIds);
    await client.from("booking_forms").delete().in("batch_id", batchIds);
    await client.from("batches").delete().in("id", batchIds);
  }

  const { data: profiles } = await client.from("profiles").select("id,email,full_name").ilike("full_name", `${MARK}%`);
  for (const profile of profiles ?? []) {
    if (profile.email === "moh986295@gmail.com") continue;
    await client.from("representative_batches").delete().eq("representative_id", profile.id);
    await client.from("profiles").delete().eq("id", profile.id);
    await client.auth.admin.deleteUser(profile.id);
  }

  const leftoverBatches = await client.from("batches").select("id", { count: "exact", head: true }).ilike("name", `${MARK}%`);
  const leftoverStudents = await client.from("students").select("id", { count: "exact", head: true }).ilike("full_name", `${MARK}%`);
  const leftoverProfiles = await client.from("profiles").select("id", { count: "exact", head: true }).ilike("full_name", `${MARK}%`);
  console.log("cleanup leftovers", {
    batches: leftoverBatches.count ?? 0,
    students: leftoverStudents.count ?? 0,
    profiles: leftoverProfiles.count ?? 0
  });
}

async function seedAndVerify(client) {
  await cleanup(client);

  const { data: otherBatch } = await client
    .from("batches")
    .insert({
      name: `${MARK} OTHER BATCH`,
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
  const { data: otherStudent } = await client
    .from("students")
    .insert({ batch_id: otherBatch.id, full_name: `${MARK} Other Student`, phone: "07700000001", notes: MARK })
    .select("id")
    .single();

  const { data: batch, error: batchError } = await client
    .from("batches")
    .insert({
      name: `${MARK} Batch`,
      university: "QA University",
      college: "QA College",
      department: "QA Dept",
      stage: "Fourth",
      graduation_year: YEAR,
      description: MARK,
      status: "active"
    })
    .select("*")
    .single();
  if (batchError) throw batchError;

  const { data: form, error: formError } = await client
    .from("booking_forms")
    .insert({
      name: `${MARK} Form`,
      internal_description: MARK,
      slug: "warka-final-qa-batch",
      type: "BATCH",
      status: "published",
      batch_id: batch.id,
      definition: { id: "qa", version: 1, name: MARK, type: "BATCH", sections: [] }
    })
    .select("*")
    .single();
  if (formError) throw formError;

  const { data: student, error: studentError } = await client
    .from("students")
    .insert({ batch_id: batch.id, full_name: `${MARK} طالب`, phone: "07701112233", notes: MARK })
    .select("*")
    .single();
  if (studentError) throw studentError;

  const batchCode = String(crypto.randomInt(100000, 999999));
  const { data: batchCodeRow, error: codeError } = await client
    .from("student_access_codes")
    .insert({
      student_id: student.id,
      batch_id: batch.id,
      form_id: form.id,
      code_ciphertext: encryptAccessCode(batchCode),
      code_fingerprint: fingerprint(batchCode, batch.id),
      status: "ACTIVE"
    })
    .select("id")
    .single();
  if (codeError) throw codeError;

  const { data: individualForm } = await client.from("booking_forms").select("id").eq("slug", "individual").maybeSingle();
  assert(Boolean(individualForm?.id), "individual form exists");

  const { data: individual, error: indError } = await client
    .from("students")
    .insert({ batch_id: null, full_name: IND_MARK, phone: "07704445566", notes: MARK })
    .select("*")
    .single();
  if (indError) throw indError;

  const indCode = String(crypto.randomInt(100000, 999999));
  const { data: indCodeRow, error: indCodeError } = await client
    .from("student_access_codes")
    .insert({
      student_id: individual.id,
      batch_id: null,
      form_id: individualForm.id,
      code_ciphertext: encryptAccessCode(indCode),
      code_fingerprint: fingerprint(indCode, individualForm.id),
      status: "ACTIVE"
    })
    .select("id")
    .single();
  if (indCodeError) throw indCodeError;

  const answers = {
    student_name: `${MARK} طالب`,
    phone: "07701112233",
    address: "بغداد",
    booking_type: "full_set",
    robe_model: "gulf",
    sash_type: "printed",
    cap_type: "none",
    _order_snapshot: { formId: form.id, formName: `${MARK} Form` }
  };

  const submitted = await client.rpc("submit_booking_transaction", {
    p_form_id: form.id,
    p_batch_id: batch.id,
    p_student_id: student.id,
    p_access_code_id: batchCodeRow.id,
    p_answers: answers,
    p_files: {}
  });
  if (submitted.error) throw submitted.error;
  const order = submitted.data;
  const orderId = order.id || order.submissionId;
  const bookingNumber = order.bookingNumber || order.booking_number;
  assert(Boolean(bookingNumber), "batch booking number");
  assert((order.status || "SUBMITTED") === "SUBMITTED", "batch order submitted");

  const token = crypto.randomBytes(32).toString("base64url");
  const { error: pickupError } = await client
    .from("submissions")
    .update({ pickup_token_hash: hashPickup(token), pickup_token_ciphertext: encryptAccessCode(token) })
    .eq("id", orderId);
  if (pickupError) throw pickupError;

  const { data: pickup } = await client
    .from("submissions")
    .select("id,booking_number,status")
    .eq("pickup_token_hash", hashPickup(token))
    .maybeSingle();
  assert(pickup?.id === orderId, "pickup token resolves only this order");
  assert(!(await client.from("submissions").select("id").eq("pickup_token_hash", hashPickup("forged-token-value-32bytes______")).maybeSingle()).data, "invalid pickup token empty");

  const { data: usedCode } = await client.from("student_access_codes").select("status").eq("id", batchCodeRow.id).single();
  assert(usedCode.status === "USED", "access code marked USED");

  const indSubmit = await client.rpc("submit_booking_transaction", {
    p_form_id: individualForm.id,
    p_batch_id: null,
    p_student_id: individual.id,
    p_access_code_id: indCodeRow.id,
    p_answers: { ...answers, student_name: IND_MARK, phone: "07704445566" },
    p_files: {}
  });
  if (indSubmit.error) throw indSubmit.error;
  const indId = indSubmit.data.id || indSubmit.data.submissionId;
  const indBooking = indSubmit.data.bookingNumber || indSubmit.data.booking_number;
  assert(indBooking !== bookingNumber, "unique booking numbers");
  const { data: indRow } = await client.from("submissions").select("batch_id").eq("id", indId).single();
  assert(indRow.batch_id == null, "individual has no fake batch");

  const { data: owner } = await client.from("profiles").select("id").eq("email", "moh986295@gmail.com").maybeSingle();
  await client.from("submissions").update({ status: "DELIVERED" }).eq("id", orderId).neq("status", "DELIVERED");
  await client.from("order_status_history").insert({
    submission_id: orderId,
    old_status: "SUBMITTED",
    new_status: "DELIVERED",
    changed_by: owner?.id ?? null,
    notes: "تأكيد تسليم عبر رمز QR"
  });
  const second = await client.from("submissions").update({ status: "DELIVERED" }).eq("id", orderId).neq("status", "DELIVERED").select("id");
  assert(!(second.data ?? []).length, "no silent second delivery update");
  const { count: deliveredEvents } = await client
    .from("order_status_history")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", orderId)
    .eq("new_status", "DELIVERED");
  assert((deliveredEvents ?? 0) === 1, "delivery history once");

  const { data: nameHits } = await client.from("students").select("id").ilike("full_name", `%${MARK} طالب%`);
  assert((nameHits ?? []).some((row) => row.id === student.id), "name search");
  const { data: phoneHits } = await client.from("students").select("id").ilike("phone", "%07701112233%");
  assert((phoneHits ?? []).some((row) => row.id === student.id), "phone search");
  const { data: bookingHits } = await client.from("submissions").select("id").ilike("booking_number", `%${bookingNumber}%`);
  assert((bookingHits ?? []).some((row) => row.id === orderId), "booking-number search");
  const { data: codeHits } = await client.from("student_access_codes").select("student_id").eq("code_fingerprint", fingerprint(batchCode, batch.id));
  assert((codeHits ?? []).some((row) => row.student_id === student.id), "exact access-code fingerprint search");

  const email = `qa.final.${Date.now()}@warka.invalid`;
  const password = `QaFinal${crypto.randomInt(100000, 999999)}!`;
  const { data: created, error: userError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `${MARK} Representative` }
  });
  if (userError) throw userError;
  await client.from("profiles").insert({
    id: created.user.id,
    full_name: `${MARK} Representative`,
    role: "REPRESENTATIVE",
    email,
    disabled: false
  });
  await client.from("representative_batches").insert({ representative_id: created.user.id, batch_id: batch.id });

  const { data: assigned } = await client.from("representative_batches").select("batch_id").eq("representative_id", created.user.id);
  assert(assigned.length === 1 && assigned[0].batch_id === batch.id, "rep assigned only QA batch");
  const { data: repStudents } = await client.from("students").select("id,batch_id").in("batch_id", assigned.map((row) => row.batch_id));
  assert(repStudents.every((row) => row.batch_id === batch.id), "rep students scoped");
  assert(!repStudents.some((row) => row.id === individual.id), "rep cannot see individual via batch scope");
  assert(!repStudents.some((row) => row.id === otherStudent.id), "rep cannot see other batch student");

  const { data: afterChange } = await client.from("students").update({ full_name: `${MARK} طالب بعد التعديل` }).eq("id", student.id).select("full_name").single();
  const { data: snapshotRow } = await client.from("submissions").select("answers").eq("id", orderId).single();
  assert(snapshotRow.answers.student_name === `${MARK} طالب`, "historical order snapshot kept original name");
  assert(afterChange.full_name.includes("بعد التعديل"), "student profile can change later");

  console.log("QA_CORE_OK");
}

const client = admin();
if (CLEANUP_ONLY) await cleanup(client);
else {
  await seedAndVerify(client);
  await cleanup(client);
  const leftoverBatches = await client.from("batches").select("id", { count: "exact", head: true }).ilike("name", `${MARK}%`);
  const leftoverStudents = await client.from("students").select("id", { count: "exact", head: true }).ilike("full_name", `${MARK}%`);
  assert((leftoverBatches.count ?? 0) === 0, "QA batches cleaned");
  assert((leftoverStudents.count ?? 0) === 0, "QA students cleaned");
}
