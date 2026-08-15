/**
 * Temporary QA seed for production-connected local testing.
 * Marks records with "WARKA QA TEMP" so they can be deleted after.
 *
 * node --env-file=.env.local scripts/qa-temp-seed.mjs
 * node --env-file=.env.local scripts/qa-temp-seed.mjs --cleanup
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APPLY_CLEANUP = process.argv.includes("--cleanup");
const MARK = "WARKA QA TEMP";
const SLUG = "warka-qa-temp-delete";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key || !url.includes("iyspwyljihtduvnibzll")) {
    throw new Error("Refusing to run against unexpected Supabase project.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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

function fingerprint(code, formIdOrBatchId) {
  return crypto
    .createHmac("sha256", process.env.ACCESS_CODE_HMAC_SECRET || "warka-local-hmac-secret")
    .update(`${formIdOrBatchId}:${code}`)
    .digest("hex");
}

const definition = {
  id: "warka-qa-temp-form",
  version: 2,
  name: `${MARK} form`,
  type: "BATCH",
  sections: [
    {
      id: "student",
      title: "بيانات الطالب",
      fields: [
        { id: "student_name", key: "student_name", label: "اسم الطالب", type: "read_only", required: true, locked: true },
        { id: "address", key: "address", label: "العنوان", type: "short_text", required: true },
        { id: "phone", key: "phone", label: "رقم الهاتف", type: "phone", required: true }
      ]
    },
    {
      id: "booking",
      title: "نوع الحجز",
      fields: [
        {
          id: "booking_type",
          key: "booking_type",
          label: "نوع الحجز",
          type: "radio",
          required: true,
          defaultValue: "full_set",
          options: [
            { id: "full-set", label: "زي كامل", value: "full_set" },
            { id: "single-pieces", label: "قطع منفردة", value: "single_pieces" }
          ]
        }
      ]
    },
    {
      id: "robe",
      title: "الروب",
      fields: [
        {
          id: "robe_model",
          key: "robe_model",
          label: "موديل الروب",
          type: "image_choice",
          required: true,
          showOptionImages: true,
          options: [
            { id: "robe-gulf", label: "الخليجي", value: "gulf", imageUrl: "/warka/robe-gulf.webp", imagePath: "/warka/robe-gulf.webp" },
            { id: "robe-american", label: "الأمريكي", value: "american", imageUrl: "/warka/robe-american.webp", imagePath: "/warka/robe-american.webp" }
          ]
        }
      ]
    },
    {
      id: "robe_additions",
      title: "إضافات الروب",
      fields: [
        {
          id: "robe_addition",
          key: "robe_addition",
          label: "إضافات الروب",
          type: "image_choice",
          showOptionImages: true,
          defaultValue: "none",
          options: [
            { id: "none", label: "بدون إضافة", value: "none" },
            { id: "one-sleeve", label: "تطريز ردن واحدة", value: "one_sleeve" }
          ]
        }
      ]
    },
    {
      id: "sash",
      title: "الوشاح",
      fields: [
        {
          id: "sash_type",
          key: "sash_type",
          label: "نوع الوشاح",
          type: "image_choice",
          required: true,
          showOptionImages: true,
          options: [
            { id: "sash-normal", label: "وشاح عادي بدون ظهر", value: "normal_no_back", imageUrl: "/warka/sash-normal.webp", imagePath: "/warka/sash-normal.webp" },
            { id: "sash-royal-ribbed-embroidered", label: "وشاح ملكي - ظهر مع تطريز", value: "royal_ribbed_embroidered", imageUrl: "/warka/sash-royal-ribbed.webp", imagePath: "/warka/sash-royal-ribbed.webp" }
          ]
        }
      ]
    },
    {
      id: "sash_embroidery",
      title: "تطريز الوشاح",
      fields: [
        { id: "sash_back_text", key: "sash_back_text", label: "تطريز ظهر الوشاح", type: "long_text", conditional: [{ fieldKey: "sash_type", operator: "includes", value: "embroidered" }] },
        { id: "name_embroidery", key: "name_embroidery", label: "تطريز الاسم", type: "short_text", required: true },
        { id: "year_side_embroidery", key: "year_side_embroidery", label: "تطريز جهة السنة", type: "short_text" },
        { id: "sash_edge_embroidery", key: "sash_edge_embroidery", label: "تطريز حافة الوشاح", type: "boolean", defaultValue: false }
      ]
    },
    {
      id: "cap",
      title: "القبعة",
      fields: [
        {
          id: "cap_type",
          key: "cap_type",
          label: "نوع القبعة",
          type: "image_choice",
          required: true,
          showOptionImages: true,
          options: [
            { id: "cap-normal", label: "قبعة عادية", value: "normal", imageUrl: "/warka/cap-normal.webp", imagePath: "/warka/cap-normal.webp" },
            { id: "cap-royal", label: "قبعة ملكية", value: "royal", imageUrl: "/warka/cap-royal.webp", imagePath: "/warka/cap-royal.webp" }
          ]
        },
        { id: "cap_elastic", key: "cap_elastic", label: "إضافة لاستيك خلف القبعة", type: "boolean", required: true, defaultValue: false }
      ]
    },
    {
      id: "uploads",
      title: "تصاميم الطالب",
      fields: [
        { id: "robe_addition_image", key: "robe_addition_image", label: "تصميم إضافة الروب", type: "image_upload", uploadMode: "multiple", maxFiles: 5, accept: ["image/jpeg", "image/png", "image/webp"], conditional: [{ fieldKey: "robe_addition", operator: "not_equals", value: "none" }] },
        { id: "year_side_image", key: "year_side_image", label: "تصميم جهة السنة", type: "image_upload", uploadMode: "multiple", maxFiles: 5, accept: ["image/jpeg", "image/png", "image/webp"] }
      ]
    }
  ]
};

async function cleanup(admin) {
  const { data: forms } = await admin.from("booking_forms").select("id,slug,batch_id").eq("slug", SLUG);
  const { data: batches } = await admin.from("batches").select("id,name").ilike("name", `${MARK}%`);
  const batchIds = [...new Set([...(batches ?? []).map((row) => row.id), ...(forms ?? []).map((row) => row.batch_id).filter(Boolean)])];
  const formIds = (forms ?? []).map((row) => row.id);

  if (batchIds.length) {
    const { data: students } = await admin.from("students").select("id").in("batch_id", batchIds);
    const studentIds = (students ?? []).map((row) => row.id);
    const { data: submissions } = await admin.from("submissions").select("id").in("batch_id", batchIds);
    const submissionIds = (submissions ?? []).map((row) => row.id);
    if (submissionIds.length) {
      await admin.from("submission_files").delete().in("submission_id", submissionIds);
      await admin.from("order_status_history").delete().in("submission_id", submissionIds);
      await admin.from("submissions").delete().in("id", submissionIds);
    }
    if (studentIds.length) {
      await admin.from("student_access_codes").delete().in("student_id", studentIds);
      await admin.from("students").delete().in("id", studentIds);
    }
    if (formIds.length) await admin.from("booking_forms").delete().in("id", formIds);
    await admin.from("representative_batches").delete().in("batch_id", batchIds);
    await admin.from("batches").delete().in("id", batchIds);
  }

  const { data: profiles } = await admin.from("profiles").select("id,email,full_name").ilike("full_name", `${MARK}%`);
  for (const profile of profiles ?? []) {
    if (profile.email === "moh986295@gmail.com") continue;
    await admin.from("representative_batches").delete().eq("representative_id", profile.id);
    await admin.from("profiles").delete().eq("id", profile.id);
    await admin.auth.admin.deleteUser(profile.id);
  }
  console.log("QA temp records removed.");
}

async function seed(admin) {
  await cleanup(admin);

  const { data: batch, error: batchError } = await admin
    .from("batches")
    .insert({
      name: `${MARK} Batch`,
      university: "QA University",
      college: "QA College",
      department: "QA Dept",
      stage: "Fourth",
      graduation_year: 2027,
      description: MARK,
      status: "active"
    })
    .select("*")
    .single();
  if (batchError) throw batchError;

  const { data: form, error: formError } = await admin
    .from("booking_forms")
    .insert({
      name: `${MARK} Booking Form`,
      internal_description: MARK,
      slug: SLUG,
      type: "BATCH",
      status: "published",
      batch_id: batch.id,
      definition
    })
    .select("*")
    .single();
  if (formError) throw formError;

  const { data: student, error: studentError } = await admin
    .from("students")
    .insert({
      batch_id: batch.id,
      full_name: `${MARK} طالب`,
      phone: "07701112233",
      notes: MARK
    })
    .select("*")
    .single();
  if (studentError) throw studentError;

  const code = "582917";
  const { error: codeError } = await admin.from("student_access_codes").insert({
    student_id: student.id,
    batch_id: batch.id,
    form_id: form.id,
    code_ciphertext: encryptAccessCode(code),
    code_fingerprint: fingerprint(code, batch.id),
    status: "ACTIVE"
  });
  if (codeError) throw codeError;

  const password = `QaTemp${crypto.randomInt(100000, 999999)}!`;
  const email = `qa.temp.${Date.now()}@warka.invalid`;
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `${MARK} Representative` }
  });
  if (userError) throw userError;
  await admin.from("profiles").insert({
    id: created.user.id,
    full_name: `${MARK} Representative`,
    role: "REPRESENTATIVE",
    email,
    disabled: false
  });
  await admin.from("representative_batches").insert({ representative_id: created.user.id, batch_id: batch.id });

  console.log("QA_SLUG=" + SLUG);
  console.log("QA_CODE=" + code);
  console.log("QA_REP_EMAIL=" + email);
  console.log("QA_REP_PASSWORD=" + password);
  console.log("QA_BATCH_ID=" + batch.id);
}

const admin = client();
if (APPLY_CLEANUP) await cleanup(admin);
else await seed(admin);
