import "server-only";

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { defaultWarkaFormDefinition } from "@/lib/form-definition";
import type { UniformSelectionMap } from "@/lib/form-uniform";
import { encryptAccessCode, generateNumericCode, accessCodeFingerprint } from "@/lib/security";
import { getAccessCodeFingerprintScope } from "@/lib/access-code-scope";
import type {
  AccessCodeStatus,
  Batch,
  BatchStatus,
  BookingFormRecord,
  FormStatus,
  OrderStatus,
  ProductCategory,
  CatalogProduct,
  Role,
  StudentWithState
} from "@/lib/types";
import { DEFAULT_PRODUCT_CATEGORIES } from "@/lib/product-catalog";

export type Representative = {
  id: string;
  full_name: string;
  phone?: string;
  email: string;
  role: Role;
  disabled: boolean;
  batch_ids: string[];
  password: string;
  created_at: string;
  updated_at: string;
};

export type AccessCodeRecord = {
  id: string;
  student_id: string;
  batch_id: string | null;
  form_id: string;
  code: string;
  code_ciphertext: string;
  code_fingerprint: string;
  status: AccessCodeStatus;
  created_at: string;
  updated_at: string;
};

export type SubmissionFile = {
  id: string;
  submission_id: string;
  field_key: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  preview_url?: string;
  created_at: string;
};

export type SubmissionRecord = {
  id: string;
  form_id: string;
  batch_id?: string;
  student_id?: string;
  access_code_id?: string;
  booking_number: string;
  status: OrderStatus;
  is_current: boolean;
  answers: Record<string, unknown>;
  submitted_at: string;
  reopened_from?: string;
};

export type StatusHistory = {
  id: string;
  submission_id: string;
  old_status?: OrderStatus;
  new_status: OrderStatus;
  changed_by?: string;
  changed_at: string;
  notes?: string;
};

export type AuditLog = {
  id: string;
  actor_id?: string;
  actor_label?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type LocalDatabase = {
  version: number;
  profiles: Representative[];
  batches: Batch[];
  students: Array<{
    id: string;
    batch_id: string;
    full_name: string;
    phone?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
  }>;
  forms: BookingFormRecord[];
  access_codes: AccessCodeRecord[];
  submissions: SubmissionRecord[];
  submission_files: SubmissionFile[];
  status_history: StatusHistory[];
  audit_logs: AuditLog[];
  sessions: Array<{ token: string; user_id: string; expires_at: number }>;
  product_categories: ProductCategory[];
  products: CatalogProduct[];
};

const DATA_DIR = join(process.cwd(), ".data");
const DB_PATH = join(DATA_DIR, "warka-db.json");

function now() {
  return new Date().toISOString();
}

function seed(): LocalDatabase {
  const created = now();
  const ownerId = "00000000-0000-4000-8000-000000000001";
  const repAId = "00000000-0000-4000-8000-00000000000a";
  const repBId = "00000000-0000-4000-8000-00000000000b";
  const batchAId = "11111111-1111-4111-8111-111111111111";
  const batchBId = "11111111-1111-4111-8111-111111111112";
  const formAId = "22222222-2222-4222-8222-222222222222";
  const formBId = "22222222-2222-4222-8222-222222222223";

  const studentsA = [
    { id: "33333333-3333-4333-8333-333333333331", full_name: "علي المرتضى يوسف", phone: "07701234567", code: "583921" },
    { id: "33333333-3333-4333-8333-333333333332", full_name: "مصطفى سامر محمد", phone: "07807654321", code: "945270" },
    { id: "33333333-3333-4333-8333-333333333333", full_name: "حسين علي جبار", phone: "07505555555", code: "128446" }
  ];
  const studentsB = [
    { id: "33333333-3333-4333-8333-333333333341", full_name: "علي طب الأسنان", phone: "07701112223", code: "701122" },
    { id: "33333333-3333-4333-8333-333333333342", full_name: "سارة طب الأسنان", phone: "07704445556", code: "704455" },
    { id: "33333333-3333-4333-8333-333333333343", full_name: "نور طب الأسنان", phone: "07707778889", code: "707788" }
  ];

  const definition = {
    ...defaultWarkaFormDefinition,
    sections: defaultWarkaFormDefinition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        if (["robe_addition_image", "sash_back_image", "year_side_image", "cap_side_image", "cap_top_image"].includes(field.key)) {
          return {
            ...field,
            uploadMode: "multiple" as const,
            maxFiles: 5,
            maxSizeMb: 8
          };
        }
        if (field.key === "robe_model" && field.options) {
          return {
            ...field,
            options: field.options.map((option) => ({
              ...option,
              imageUrl: `/warka/robe-${option.value === "cloche" ? "cloche" : option.value === "warka" ? "warka" : option.value}.webp`
            }))
          };
        }
        if (field.key === "sash_type" && field.options) {
          return {
            ...field,
            options: field.options.map((option) => ({
              ...option,
              imageUrl:
                option.value.startsWith("royal_ribbed") || option.value === "royal_ribbed"
                  ? "/warka/sash-royal-ribbed.webp"
                  : option.value.startsWith("royal_triangle") || option.value === "royal_triangle"
                    ? "/warka/sash-royal-triangle.webp"
                    : option.value.includes("side")
                      ? "/warka/sash-side.webp"
                      : "/warka/sash-normal.webp"
            }))
          };
        }
        if (field.key === "cap_type" && field.options) {
          return {
            ...field,
            options: field.options.map((option) => ({
              ...option,
              imageUrl: `/warka/cap-${option.value === "accent" ? "accent" : option.value}.webp`
            }))
          };
        }
        return field;
      })
    }))
  };

  const db: LocalDatabase = {
    version: 3,
    profiles: [
      {
        id: ownerId,
        full_name: "مالك WARKA",
        email: "owner@warka.local",
        phone: "07000000000",
        role: "OWNER",
        disabled: false,
        batch_ids: [],
        password: "owner123",
        created_at: created,
        updated_at: created
      },
      {
        id: repAId,
        full_name: "ممثل الأمن السيبراني",
        email: "rep.cyber@warka.local",
        phone: "07710000001",
        role: "REPRESENTATIVE",
        disabled: false,
        batch_ids: [batchAId],
        password: "rep123",
        created_at: created,
        updated_at: created
      },
      {
        id: repBId,
        full_name: "ممثل طب الأسنان",
        email: "rep.dental@warka.local",
        phone: "07710000002",
        role: "REPRESENTATIVE",
        disabled: false,
        batch_ids: [batchBId],
        password: "rep123",
        created_at: created,
        updated_at: created
      }
    ],
    batches: [
      {
        id: batchAId,
        name: "Cybersecurity 2027",
        university: "جامعة العين العراقية",
        college: "كلية الهندسة التقنية",
        department: "هندسة تقنيات الأمن السيبراني",
        stage: "الرابعة",
        graduation_year: 2027,
        description: "دفعة الأمن السيبراني",
        representative_id: repAId,
        representative_name: "ممثل الأمن السيبراني",
        status: "active",
        created_at: created,
        updated_at: created
      },
      {
        id: batchBId,
        name: "Dentistry 2027",
        university: "جامعة العين العراقية",
        college: "كلية طب الأسنان",
        department: "طب الأسنان",
        stage: "الخامسة",
        graduation_year: 2027,
        description: "دفعة طب الأسنان",
        representative_id: repBId,
        representative_name: "ممثل طب الأسنان",
        status: "active",
        created_at: created,
        updated_at: created
      }
    ],
    students: [],
    forms: [
      {
        id: formAId,
        name: "بطاقة حجز الأمن السيبراني 2027",
        internal_description: "نموذج دفعة الأمن السيبراني",
        slug: "cybersecurity-2027",
        type: "BATCH",
        status: "published",
        batch_id: batchAId,
        definition
      },
      {
        id: formBId,
        name: "بطاقة حجز طب الأسنان 2027",
        internal_description: "نموذج دفعة طب الأسنان",
        slug: "dentistry-2027",
        type: "BATCH",
        status: "published",
        batch_id: batchBId,
        definition
      }
    ],
    access_codes: [],
    submissions: [],
    submission_files: [],
    status_history: [],
    audit_logs: [],
    sessions: [],
    product_categories: DEFAULT_PRODUCT_CATEGORIES.map((category) => ({
      id: `cat-${category.slug}`,
      slug: category.slug,
      name_ar: category.name_ar,
      name_en: category.name_en,
      sort_order: category.sort_order,
      created_at: created,
      updated_at: created
    })),
    products: []
  };

  for (const entry of studentsA) {
    db.students.push({
      id: entry.id,
      batch_id: batchAId,
      full_name: entry.full_name,
      phone: entry.phone,
      created_at: created,
      updated_at: created
    });
    db.access_codes.push({
      id: randomUUID(),
      student_id: entry.id,
      batch_id: batchAId,
      form_id: formAId,
      code: entry.code,
      code_ciphertext: encryptAccessCode(entry.code),
      code_fingerprint: accessCodeFingerprint(entry.code, getAccessCodeFingerprintScope({ id: formAId, batch_id: batchAId })),
      status: entry.code === "128446" ? "DISABLED" : "ACTIVE",
      created_at: created,
      updated_at: created
    });
  }

  for (const entry of studentsB) {
    db.students.push({
      id: entry.id,
      batch_id: batchBId,
      full_name: entry.full_name,
      phone: entry.phone,
      created_at: created,
      updated_at: created
    });
    db.access_codes.push({
      id: randomUUID(),
      student_id: entry.id,
      batch_id: batchBId,
      form_id: formBId,
      code: entry.code,
      code_ciphertext: encryptAccessCode(entry.code),
      code_fingerprint: accessCodeFingerprint(entry.code, getAccessCodeFingerprintScope({ id: formBId, batch_id: batchBId })),
      status: "ACTIVE",
      created_at: created,
      updated_at: created
    });
  }

  return db;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function readDb(): LocalDatabase {
  ensureDir();
  if (!existsSync(DB_PATH)) {
    const seeded = seed();
    writeDb(seeded);
    return seeded;
  }
  const parsed = JSON.parse(readFileSync(DB_PATH, "utf8")) as LocalDatabase;
  if (!parsed.version || parsed.version < 3) {
    const seeded = seed();
    writeDb(seeded);
    return seeded;
  }
  if (!parsed.product_categories?.length) {
    parsed.product_categories = DEFAULT_PRODUCT_CATEGORIES.map((category) => ({
      id: `cat-${category.slug}`,
      slug: category.slug,
      name_ar: category.name_ar,
      name_en: category.name_en,
      sort_order: category.sort_order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  }
  if (!parsed.products) parsed.products = [];
  return parsed;
}

export function writeDb(db: LocalDatabase) {
  ensureDir();
  const tmp = `${DB_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DB_PATH);
}

export function mutateDb<T>(fn: (db: LocalDatabase) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

export function getBatchStats(db: LocalDatabase, batchId: string) {
  const students = db.students.filter((student) => student.batch_id === batchId);
  const submitted = students.filter((student) =>
    db.submissions.some((submission) => submission.student_id === student.id && submission.is_current)
  ).length;
  return {
    total: students.length,
    submitted,
    pending: students.length - submitted
  };
}

export function toStudentWithState(db: LocalDatabase, studentId: string): StudentWithState | null {
  const student = db.students.find((entry) => entry.id === studentId);
  if (!student) return null;
  const batch = db.batches.find((entry) => entry.id === student.batch_id);
  const code = [...db.access_codes]
    .filter((entry) => entry.student_id === student.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const submission = db.submissions.find((entry) => entry.student_id === student.id && entry.is_current);
  const form = code ? db.forms.find((entry) => entry.id === code.form_id) : db.forms.find((entry) => entry.slug === "individual");
  return {
    ...student,
    batch: batch ? { name: batch.name, graduation_year: batch.graduation_year } : undefined,
    code: code?.code,
    code_status: code?.status,
    submission_status: submission ? "submitted" : "pending",
    order_status: submission?.status,
    booking_number: submission?.booking_number,
    form_slug: form?.status === "published" ? form.slug : null
  };
}

export function nextBookingNumber(db: LocalDatabase, batchId?: string) {
  const year = batchId
    ? db.batches.find((batch) => batch.id === batchId)?.graduation_year ?? new Date().getFullYear()
    : new Date().getFullYear();
  const count = db.submissions.filter((submission) => submission.batch_id === batchId).length + 1;
  return `WK-${year}-${String(count).padStart(5, "0")}`;
}

export function createAccessCode(
  db: LocalDatabase,
  studentId: string,
  batchId: string | null,
  formId: string,
  status: AccessCodeStatus = "ACTIVE"
) {
  const code = generateNumericCode();
  const record: AccessCodeRecord = {
    id: randomUUID(),
    student_id: studentId,
    batch_id: batchId,
    form_id: formId,
    code,
    code_ciphertext: encryptAccessCode(code),
    code_fingerprint: accessCodeFingerprint(code, getAccessCodeFingerprintScope({ id: formId, batch_id: batchId })),
    status,
    created_at: now(),
    updated_at: now()
  };
  db.access_codes.push(record);
  return record;
}

export function audit(
  db: LocalDatabase,
  action: string,
  entityType: string,
  entityId?: string,
  actor?: { id?: string; label?: string },
  metadata?: Record<string, unknown>
) {
  db.audit_logs.unshift({
    id: randomUUID(),
    actor_id: actor?.id,
    actor_label: actor?.label,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    created_at: now()
  });
}

export function deleteStudentRecords(
  db: LocalDatabase,
  user: { id: string; role: Role; fullName?: string },
  studentIds: string[]
) {
  const uniqueIds = Array.from(new Set(studentIds.map((id) => id.trim()).filter(Boolean)));
  const blocked: Array<{ id: string; name: string }> = [];
  const deletedIds: string[] = [];
  let rejected = studentIds.length - uniqueIds.length;

  for (const studentId of uniqueIds) {
    const student = db.students.find((entry) => entry.id === studentId);
    if (!student) {
      rejected += 1;
      continue;
    }
    try {
      assertBatchAccess(db, user, student.batch_id);
    } catch {
      rejected += 1;
      continue;
    }
    const hasOrder = db.submissions.some((submission) => submission.student_id === student.id);
    if (hasOrder) {
      blocked.push({ id: student.id, name: student.full_name });
      continue;
    }
    db.access_codes = db.access_codes.filter((code) => code.student_id !== student.id);
    db.students = db.students.filter((entry) => entry.id !== student.id);
    deletedIds.push(student.id);
  }

  if (deletedIds.length) {
    audit(db, "STUDENTS_DELETED", "student", deletedIds[0], { id: user.id, label: user.fullName }, {
      count: deletedIds.length,
      blocked: blocked.length,
      rejected
    });
  }

  return { deleted: deletedIds.length, deletedIds, blocked, rejected };
}

export function assertBatchAccess(db: LocalDatabase, user: { id: string; role: Role }, batchId: string | null | undefined) {
  if (user.role === "OWNER") return;
  if (!batchId) throw new Error("غير مصرح بالوصول إلى هذه الدفعة.");
  const profile = db.profiles.find((entry) => entry.id === user.id);
  if (!profile || profile.disabled || !profile.batch_ids.includes(batchId)) {
    throw new Error("غير مصرح بالوصول إلى هذه الدفعة.");
  }
}

export type CreateBatchInput = {
  name: string;
  university: string;
  college: string;
  department: string;
  stage: string;
  graduation_year: number;
  description?: string;
  representative_id?: string;
  status: BatchStatus;
  uniform?: UniformSelectionMap;
};

export function createBatchRecord(db: LocalDatabase, input: CreateBatchInput, actorId?: string) {
  const created = now();
  const representative = input.representative_id
    ? db.profiles.find((profile) => profile.id === input.representative_id)
    : undefined;
  const batch: Batch = {
    id: randomUUID(),
    name: input.name,
    university: input.university,
    college: input.college,
    department: input.department,
    stage: input.stage,
    graduation_year: input.graduation_year,
    description: input.description,
    representative_id: input.representative_id,
    representative_name: representative?.full_name,
    status: input.status,
    created_at: created,
    updated_at: created
  };
  db.batches.unshift(batch);
  if (representative && !representative.batch_ids.includes(batch.id)) {
    representative.batch_ids.push(batch.id);
    representative.updated_at = created;
  }

  // Auto-create a draft batch form so students can receive access codes after import.
  let slugBase = batch.name
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  if (!/^[a-z0-9-]/.test(slugBase)) slugBase = `batch-${batch.graduation_year}`;
  let slug = `${slugBase || "batch"}-${batch.graduation_year}`;
  let counter = 1;
  while (db.forms.some((form) => form.slug === slug)) {
    slug = `${slugBase || "batch"}-${batch.graduation_year}-${counter++}`;
  }
  db.forms.unshift({
    id: randomUUID(),
    name: `بطاقة حجز ${batch.name}`,
    internal_description: `نموذج تلقائي للدفعة ${batch.name}`,
    slug,
    type: "BATCH",
    status: "published",
    batch_id: batch.id,
    definition: {
      ...defaultWarkaFormDefinition,
      sections: defaultWarkaFormDefinition.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) => {
          if (["robe_addition_image", "sash_back_image", "year_side_image", "cap_side_image", "cap_top_image"].includes(field.key)) {
            return { ...field, uploadMode: "multiple" as const, maxFiles: 5, maxSizeMb: 8 };
          }
          return field;
        })
      }))
    }
  });

  audit(db, "BATCH_CREATED", "batch", batch.id, { id: actorId, label: "owner" }, { name: batch.name, form_slug: slug });
  return batch;
}

export function updateFormStatus(db: LocalDatabase, formId: string, status: FormStatus) {
  const form = db.forms.find((entry) => entry.id === formId);
  if (!form) throw new Error("النموذج غير موجود.");
  form.status = status;
  return form;
}
