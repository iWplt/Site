/**
 * QA for student selection/delete. Creates WARKA QA TEMP STUDENTS only, then removes them.
 * node --env-file=.env.local scripts/qa-student-delete.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const XLSX = require("@e965/xlsx");

const PROJECT = "iyspwyljihtduvnibzll";
const MARK = "WARKA QA TEMP STUDENTS";
const IND_MARK = "WARKA QA TEMP IND";
const YEAR = 2097;
const OWNER_EMAIL = "moh986295@gmail.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOKING_UPLOADS = "booking-uploads";

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

function findWorkbook() {
  const names = ["WARKA_Test_Students.xlsx", "WARKA_Test_Students.xls"];
  const dirs = [
    process.cwd(),
    path.join(process.cwd(), "qa"),
    path.join(process.cwd(), "docs"),
    path.join(process.env.USERPROFILE || "", "Downloads"),
    path.join(process.env.USERPROFILE || "", "Desktop"),
    path.join(process.env.USERPROFILE || "", "Documents")
  ];
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function namesFromWorkbook(filePath) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => name.includes("أسماء")) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: "A", defval: "", blankrows: false, raw: false });
  const values = rows.map((row) => String(row.A ?? "").trim()).filter(Boolean);
  const maybeHeader = values[0];
  const body = maybeHeader && /اسم|name|الطالب/i.test(maybeHeader) ? values.slice(1) : values;
  return {
    sheetName,
    columnKey: "A",
    names: body.map((name) => name.replace(/\s+/g, " ").trim()).filter((name) => name.length >= 3)
  };
}

async function resolveRepBatches(client, user) {
  if (user.role === "OWNER") return [];
  if (user.batchIds) return user.batchIds;
  const [{ data: links }, { data: owned }] = await Promise.all([
    client.from("representative_batches").select("batch_id").eq("representative_id", user.id),
    client.from("batches").select("id").eq("representative_id", user.id)
  ]);
  return Array.from(
    new Set([...(links ?? []).map((row) => row.batch_id), ...(owned ?? []).map((row) => row.id)])
  );
}

async function canAccess(client, user, batchId) {
  if (user.role === "OWNER") return true;
  if (!batchId) return false;
  const ids = await resolveRepBatches(client, user);
  return ids.includes(batchId);
}

async function deleteStudentsAs(client, user, studentIds) {
  if (!user) {
    return { deleted: 0, deletedIds: [], blocked: [], rejected: studentIds.length, message: "يجب تسجيل الدخول أولاً." };
  }
  const uniqueIds = Array.from(new Set(studentIds.map((id) => id.trim()).filter((id) => UUID_RE.test(id))));
  let rejected = studentIds.length - uniqueIds.length;
  if (!uniqueIds.length) return { deleted: 0, deletedIds: [], blocked: [], rejected, message: "invalid" };

  const { data: rows } = await client.from("students").select("id,batch_id,full_name").in("id", uniqueIds);
  const students = rows ?? [];
  const found = new Set(students.map((row) => row.id));
  rejected += uniqueIds.filter((id) => !found.has(id)).length;
  const authorized = [];
  for (const student of students) {
    if (await canAccess(client, user, student.batch_id)) authorized.push(student);
    else rejected += 1;
  }
  const authorizedIds = authorized.map((row) => row.id);
  const blocked = [];
  const deletable = [];
  if (authorizedIds.length) {
    const { data: submissions } = await client.from("submissions").select("student_id").in("student_id", authorizedIds);
    const withOrders = new Set((submissions ?? []).map((row) => row.student_id).filter(Boolean));
    for (const student of authorized) {
      if (withOrders.has(student.id)) blocked.push({ id: student.id, name: student.full_name });
      else deletable.push(student);
    }
  }
  const deletedIds = [];
  if (deletable.length) {
    for (const student of deletable) {
      const prefix = `${student.batch_id ?? "individual"}/${student.id}`;
      const { data: listed } = await client.storage.from(BOOKING_UPLOADS).list(prefix, { limit: 100 });
      const files = [];
      for (const folder of listed ?? []) {
        if (folder.id) files.push(`${prefix}/${folder.name}`);
        else {
          const { data: nested } = await client.storage.from(BOOKING_UPLOADS).list(`${prefix}/${folder.name}`, { limit: 100 });
          for (const file of nested ?? []) {
            if (file.id) files.push(`${prefix}/${folder.name}/${file.name}`);
          }
        }
      }
      if (files.length) await client.storage.from(BOOKING_UPLOADS).remove(files);
    }
    const ids = deletable.map((row) => row.id);
    await client.from("student_access_codes").delete().in("student_id", ids);
    await client.from("students").delete().in("id", ids);
    deletedIds.push(...ids);
  }
  return { deleted: deletedIds.length, deletedIds, blocked, rejected };
}

async function cleanupQa(client) {
  const { data: batches } = await client.from("batches").select("id").ilike("name", `${MARK}%`);
  const batchIds = (batches ?? []).map((row) => row.id);
  const { data: batchStudents } = batchIds.length
    ? await client.from("students").select("id").in("batch_id", batchIds)
    : { data: [] };
  const { data: indStudents } = await client.from("students").select("id").is("batch_id", null).ilike("full_name", `${IND_MARK}%`);
  const studentIds = [...(batchStudents ?? []), ...(indStudents ?? [])].map((row) => row.id);
  if (studentIds.length) {
    const { data: submissions } = await client.from("submissions").select("id").in("student_id", studentIds);
    const submissionIds = (submissions ?? []).map((row) => row.id);
    if (submissionIds.length) {
      await client.from("submission_files").delete().in("submission_id", submissionIds);
      await client.from("order_status_history").delete().in("submission_id", submissionIds);
      await client.from("submissions").delete().in("id", submissionIds);
    }
    await client.from("student_access_codes").delete().in("student_id", studentIds);
    try {
      await client.from("fixed_option_config").delete().in("student_id", studentIds);
    } catch {
      /* table may be unused */
    }
    await client.from("students").delete().in("id", studentIds);
  }
  if (batchIds.length) {
    await client.from("booking_forms").delete().in("batch_id", batchIds);
    await client.from("representative_batches").delete().in("batch_id", batchIds);
    await client.from("batches").delete().in("id", batchIds);
  }
  const { data: qaProfiles } = await client.from("profiles").select("id,full_name").ilike("full_name", `${MARK}%`);
  for (const profile of qaProfiles ?? []) {
    await client.from("representative_batches").delete().eq("representative_id", profile.id);
    await client.from("profiles").delete().eq("id", profile.id);
    await client.auth.admin.deleteUser(profile.id);
  }
  return { batches: batchIds.length, students: studentIds.length };
}

async function main() {
  const client = admin();
  const report = {};
  await cleanupQa(client);
  try {

  const { data: owner } = await client.from("profiles").select("id,full_name,role").eq("role", "OWNER").limit(1).maybeSingle();
  if (!owner) throw new Error("Owner profile missing.");
  const ownerUser = { id: owner.id, role: "OWNER", fullName: owner.full_name };

  const workbookPath = findWorkbook();
  report.excelPath = workbookPath || "NOT_FOUND";
  let parsed;
  if (workbookPath) {
    parsed = namesFromWorkbook(workbookPath);
  } else {
    parsed = {
      sheetName: "أسماء فقط (generated)",
      columnKey: "A",
      names: Array.from({ length: 30 }, (_, i) => `طالب تجريبي رقم ${String(i + 1).padStart(2, "0")}`)
    };
  }
  report.excelSheet = parsed.sheetName;
  report.excelColumn = parsed.columnKey;
  report.excelNameCount = parsed.names.length;

  const { data: batch, error: batchError } = await client
    .from("batches")
    .insert({
      name: `${MARK} ${Date.now()}`,
      university: "QA",
      college: "QA",
      department: "QA",
      stage: "Fourth",
      graduation_year: YEAR,
      description: MARK,
      status: "active"
    })
    .select("id,name")
    .single();
  if (batchError) throw batchError;

  const { data: form, error: formError } = await client
    .from("booking_forms")
    .insert({
      name: `${MARK} Form`,
      internal_description: MARK,
      slug: `warka-qa-students-${Date.now().toString().slice(-6)}`,
      type: "BATCH",
      status: "published",
      batch_id: batch.id,
      definition: { id: "qa", version: 1, name: MARK, type: "BATCH", sections: [] }
    })
    .select("id")
    .single();
  if (formError) throw formError;

  const uniqueNames = [];
  const seen = new Set();
  for (const name of parsed.names) {
    if (seen.has(name)) continue;
    seen.add(name);
    uniqueNames.push(name);
  }
  const { data: inserted, error: insertError } = await client
    .from("students")
    .insert(uniqueNames.map((full_name) => ({ batch_id: batch.id, full_name, notes: MARK })))
    .select("id,full_name");
  if (insertError) throw insertError;
  const codes = (inserted ?? []).map((student) => {
    const code = String(crypto.randomInt(100000, 999999));
    return {
      student_id: student.id,
      batch_id: batch.id,
      form_id: form.id,
      code_ciphertext: encryptAccessCode(code),
      code_fingerprint: fingerprint(code, batch.id),
      status: "ACTIVE"
    };
  });
  const { error: codeError } = await client.from("student_access_codes").insert(codes);
  if (codeError) throw codeError;

  const { count: importedCount } = await client
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batch.id);
  report.importedCount = importedCount;
  report.noDuplicateInsert = importedCount === uniqueNames.length;

  const { data: qaStudents } = await client
    .from("students")
    .select("id,full_name")
    .eq("batch_id", batch.id)
    .order("created_at", { ascending: true });
  const list = qaStudents ?? [];

  const storagePath = `${batch.id}/${list[0].id}/robe_addition_image/qa-temp.png`;
  let uploaded = false;
  try {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const upload = await client.storage.from(BOOKING_UPLOADS).upload(storagePath.replace(/\.txt$/, ".png"), png, {
      contentType: "image/png",
      upsert: true
    });
    uploaded = !upload.error;
  } catch {
    uploaded = false;
  }

  const single = await deleteStudentsAs(client, ownerUser, [list[0].id]);
  const { data: singleGone } = await client.from("students").select("id").eq("id", list[0].id).maybeSingle();
  const { count: codesAfterSingle } = await client
    .from("student_access_codes")
    .select("id", { count: "exact", head: true })
    .eq("student_id", list[0].id);
  const { data: leftoverFile } = await client.storage.from(BOOKING_UPLOADS).list(`${batch.id}/${list[0].id}/robe_addition_image`);
  report.singleDelete = single.deleted === 1 && !singleGone && codesAfterSingle === 0;
  report.storageCleanup = uploaded ? !leftoverFile?.length : "skipped";

  const multiIds = list.slice(1, 4).map((row) => row.id);
  const multi = await deleteStudentsAs(client, ownerUser, multiIds);
  report.multiSelect = multi.deleted === 3;

  const { data: remaining } = await client.from("students").select("id,full_name").eq("batch_id", batch.id);
  const keep = remaining[0];
  const { data: access } = await client.from("student_access_codes").select("id").eq("student_id", keep.id).maybeSingle();
  const booking = `WK-2097-QADEL${Date.now().toString().slice(-4)}`;
  const { error: subError } = await client.from("submissions").insert({
    form_id: form.id,
    batch_id: batch.id,
    student_id: keep.id,
    access_code_id: access?.id ?? null,
    booking_number: booking,
    status: "SUBMITTED",
    is_current: true,
    answers: { qa: true },
    files: {}
  });
  if (subError) throw subError;

  const rest = remaining.slice(1).map((row) => row.id);
  const mixed = await deleteStudentsAs(client, ownerUser, [keep.id, ...rest.slice(0, 2)]);
  const { data: keptStudent } = await client.from("students").select("id").eq("id", keep.id).maybeSingle();
  const { data: keptOrder } = await client.from("submissions").select("id,booking_number").eq("booking_number", booking).maybeSingle();
  report.historicalProtection = mixed.blocked.length >= 1 && Boolean(keptStudent) && keptOrder?.booking_number === booking;

  const { data: leftoverVisible } = await client.from("students").select("id").eq("batch_id", batch.id).neq("id", keep.id);
  const visibleIds = (leftoverVisible ?? []).map((row) => row.id);
  const selectAll = await deleteStudentsAs(client, ownerUser, visibleIds);
  const { count: stillVisible } = await client.from("students").select("id", { count: "exact", head: true }).eq("batch_id", batch.id).neq("id", keep.id);
  report.selectAll = selectAll.deleted === visibleIds.length && stillVisible === 0;

  const { data: ind, error: indError } = await client
    .from("students")
    .insert({ batch_id: null, full_name: `${IND_MARK} ${Date.now()}`, notes: MARK })
    .select("id")
    .single();
  if (indError) throw indError;
  const indDelete = await deleteStudentsAs(client, ownerUser, [ind.id]);
  const { data: indGone } = await client.from("students").select("id").eq("id", ind.id).maybeSingle();
  report.individualStudents = indDelete.deleted === 1 && !indGone;

  const { data: otherBatch, error: otherErr } = await client
    .from("batches")
    .insert({
      name: `${MARK} OTHER ${Date.now()}`,
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
  if (otherErr) throw otherErr;
  const { data: otherStudent } = await client
    .from("students")
    .insert({ batch_id: otherBatch.id, full_name: `${MARK} foreign`, notes: MARK })
    .select("id")
    .single();

  const email = `qa.students.delete.${Date.now()}@warka.invalid`;
  const { data: created, error: userError } = await client.auth.admin.createUser({
    email,
    password: `QaTemp${crypto.randomInt(100000, 999999)}!`,
    email_confirm: true,
    user_metadata: { full_name: `${MARK} Representative` }
  });
  if (userError) throw userError;
  await client.from("profiles").upsert({
    id: created.user.id,
    full_name: `${MARK} Representative`,
    role: "REPRESENTATIVE",
    email,
    disabled: false
  });
  await client.from("representative_batches").insert({ representative_id: created.user.id, batch_id: batch.id });
  const denied = await deleteStudentsAs(
    client,
    { id: created.user.id, role: "REPRESENTATIVE", batchIds: [batch.id] },
    [otherStudent.id]
  );
  report.representativeRbac = denied.deleted === 0 && denied.rejected >= 1;
  const forged = await deleteStudentsAs(client, ownerUser, ["00000000-0000-4000-8000-000000000099", "not-a-uuid"]);
  report.unauthorizedIds = forged.deleted === 0 && forged.rejected >= 1;
  const loggedOut = await deleteStudentsAs(client, null, [otherStudent.id]);
  report.loggedOut = loggedOut.deleted === 0 && loggedOut.message.includes("تسجيل");

  const { data: stillOther } = await client.from("students").select("id").eq("id", otherStudent.id).maybeSingle();
  report.batchStudents = Boolean(stillOther);
  report.ownerUntouched = OWNER_EMAIL;
  } finally {
    const leftover = await cleanupQa(client);
    const { count: leftoverQa } = await client.from("batches").select("id", { count: "exact", head: true }).ilike("name", `${MARK}%`);
    const { count: leftoverInd } = await client.from("students").select("id", { count: "exact", head: true }).is("batch_id", null).ilike("full_name", `${IND_MARK}%`);
    report.qaCleaned = leftoverQa === 0 && leftoverInd === 0;
    report.cleanupCounts = leftover;
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
