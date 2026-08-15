import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireSupabaseSecretsForWrites } from "@/lib/env";
import { assertOwnedBookingPath, extensionForMime, sanitizeStorageSegment } from "@/lib/upload-security";
import { defaultWarkaFormDefinition } from "@/lib/form-definition";
import {
  accessCodeFingerprint,
  decryptAccessCode,
  encryptAccessCode,
  generateNumericCode,
  getAccessCodeFingerprintScope,
  signBookingSession
} from "@/lib/security";
import { normalizeAccessCodeInput } from "@/lib/access-code-scope";
import { safeSlug } from "@/lib/utils";
import { validateDynamicAnswers } from "@/lib/validation";
import { answersWithSnapshot, buildOrderSnapshot, collectReferencePaths, readOrderSnapshot } from "@/lib/order-snapshot";
import { verifyBookingReceipt } from "@/lib/booking-receipt";
import { statusLabels } from "@/lib/labels";
import { generatePickupToken, hashPickupToken, readStoredPickupToken } from "@/lib/pickup-token";
import {
  INDIVIDUAL_FORM_SLUG,
  applyUniformToDefinition,
  enforceUniformAnswers,
  type UniformSelectionMap
} from "@/lib/form-uniform";
import type {
  AccessCodeStatus,
  Batch,
  BatchStats,
  BookingFormRecord,
  FormDefinition,
  FormOption,
  FormStatus,
  FormType,
  OrderStatus,
  Role,
  StudentWithState,
  SubmissionSummary,
  VerifiedBookingSession
} from "@/lib/types";
import type {
  AuditLog,
  CreateBatchInput,
  Representative,
  StatusHistory,
  SubmissionFile,
  SubmissionRecord
} from "@/lib/store/local-db";

/**
 * Server-only Supabase repository. Mirrors the shape of `src/lib/store/local-db.ts`
 * but reads/writes real Postgres tables + Storage buckets instead of the local JSON file.
 *
 * Auth model:
 * - The admin (service-role) client bypasses RLS entirely. It is used for almost every
 *   operation here because the app already enforces authorization in this module via
 *   `sbAssertBatchAccess` / role checks, and because several privileged writes (creating
 *   auth users, signing storage URLs, writing audit logs) require the service role anyway.
 * - `createClient()` (the cookie-bound user client) is only used for the two auth
 *   operations that must run against the caller's own session (`sbLogin` / `sbLogout`).
 * - IMPORTANT: some SQL functions (e.g. `regenerate_student_access_code`) are declared
 *   `security definer` but still call `public.can_access_batch(...)`, which reads
 *   `auth.uid()`. When invoked through the service-role client there is no `auth.uid()`,
 *   so those particular RPCs would always reject. Where that applies, this module performs
 *   the equivalent writes directly against the tables (after checking access itself)
 *   instead of calling the RPC.
 */

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

const FORM_OPTIONS_BUCKET = "form-options";
const BOOKING_UPLOADS_BUCKET = "booking-uploads";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MULTI_UPLOAD_FIELD_KEYS = [
  "robe_addition_image",
  "sash_back_image",
  "year_side_image",
  "cap_side_image",
  "cap_top_image"
];

/* -------------------------------------------------------------------------------------------- */
/* Row types (hand-written to match supabase/migrations/0001-0004)                              */
/* -------------------------------------------------------------------------------------------- */

type BatchRow = {
  id: string;
  name: string;
  university: string;
  college: string;
  department: string;
  stage: string;
  graduation_year: number;
  description: string | null;
  representative_id: string | null;
  status: Batch["status"];
  created_at: string;
  updated_at: string;
  representative?: { full_name: string } | null;
};

type BookingFormRow = {
  id: string;
  name: string;
  internal_description: string | null;
  slug: string;
  type: FormType;
  status: FormStatus;
  batch_id: string | null;
  opening_date: string | null;
  closing_date: string | null;
  definition: unknown;
  created_at: string;
  updated_at: string;
};

type StudentOverviewRow = {
  id: string;
  batch_id: string | null;
  full_name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  batch_name: string | null;
  graduation_year: number | null;
  representative_id: string | null;
  code_status: AccessCodeStatus | null;
  code_ciphertext: string | null;
  booking_number: string | null;
  submission_status: "pending" | "submitted";
  order_status: OrderStatus | null;
};

type SubmissionRow = {
  id: string;
  form_id: string;
  batch_id: string | null;
  student_id: string | null;
  access_code_id: string | null;
  booking_number: string;
  status: OrderStatus;
  is_current: boolean;
  answers: Record<string, unknown> | null;
  submitted_at: string;
  reopened_from: string | null;
};

type SubmissionJoinRow = SubmissionRow & {
  student: { full_name: string } | null;
  form: { name: string } | null;
  batch: { name: string } | null;
};

type SubmissionFileRow = {
  id: string;
  submission_id: string;
  field_key: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  created_at: string;
};

type OrderStatusHistoryRow = {
  id: string;
  submission_id: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
};

type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_label: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  role: Role;
  disabled: boolean;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

/* -------------------------------------------------------------------------------------------- */
/* Small primitive helpers                                                                      */
/* -------------------------------------------------------------------------------------------- */

function extensionFromNameOrMime(_originalName: string, mimeType: string) {
  return extensionForMime(mimeType);
}

function decryptCodeSafe(ciphertext: string | null | undefined): string | undefined {
  if (!ciphertext) return undefined;
  try {
    return decryptAccessCode(ciphertext);
  } catch {
    return "••••••";
  }
}

function buildBatchDefaultDefinition(): FormDefinition {
  return {
    ...defaultWarkaFormDefinition,
    sections: defaultWarkaFormDefinition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) =>
        MULTI_UPLOAD_FIELD_KEYS.includes(field.key)
          ? { ...field, uploadMode: "multiple" as const, maxFiles: 5, maxSizeMb: 8 }
          : field
      )
    }))
  };
}

async function generateUniqueFormSlug(admin: SupabaseAdminClient, name: string, year: number) {
  const base = safeSlug(name) || `batch-${year}`;
  let slug = `${base}-${year}`;
  let counter = 1;
  for (;;) {
    const { data } = await admin.from("booking_forms").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${year}-${counter++}`;
  }
}

function pgErrorMessage(error: { message: string } | null, fallback: string) {
  const message = error?.message?.trim();
  if (!message) return fallback;
  if (/[\u0600-\u06FF]/.test(message) && !/(relation|column|permission denied|violates|PGRST|postgres)/i.test(message)) {
    return message;
  }
  return fallback;
}

/* -------------------------------------------------------------------------------------------- */
/* Row -> app type mapping                                                                      */
/* -------------------------------------------------------------------------------------------- */

function mapBatchRow(row: BatchRow): Batch {
  return {
    id: row.id,
    name: row.name,
    university: row.university,
    college: row.college,
    department: row.department,
    stage: row.stage,
    graduation_year: row.graduation_year,
    status: row.status,
    description: row.description ?? undefined,
    representative_id: row.representative_id ?? undefined,
    representative_name: row.representative?.full_name ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapFormRow(row: BookingFormRow): BookingFormRecord {
  return {
    id: row.id,
    name: row.name,
    internal_description: row.internal_description ?? undefined,
    slug: row.slug,
    type: row.type,
    status: row.status,
    batch_id: row.batch_id ?? undefined,
    opening_date: row.opening_date ?? undefined,
    closing_date: row.closing_date ?? undefined,
    definition: (row.definition as FormDefinition | null) ?? defaultWarkaFormDefinition
  };
}

function mapStudentOverviewRow(row: StudentOverviewRow): StudentWithState {
  return {
    id: row.id,
    batch_id: row.batch_id,
    full_name: row.full_name,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    notes: row.notes ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    batch: row.batch_name ? { name: row.batch_name, graduation_year: row.graduation_year ?? 0 } : undefined,
    code: decryptCodeSafe(row.code_ciphertext),
    code_status: row.code_status ?? undefined,
    submission_status: row.submission_status,
    order_status: row.order_status ?? undefined,
    booking_number: row.booking_number ?? undefined
  };
}

async function attachStudentFormSlugs(
  admin: SupabaseAdminClient,
  students: StudentWithState[]
): Promise<StudentWithState[]> {
  if (!students.length) return students;
  const ids = students.map((student) => student.id);
  const { data: codes, error } = await admin
    .from("student_access_codes")
    .select("student_id, form_id, created_at")
    .in("student_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل نموذج الحجز المرتبط بالطالب."));

  const latestFormByStudent = new Map<string, string>();
  for (const row of codes ?? []) {
    if (!latestFormByStudent.has(row.student_id)) latestFormByStudent.set(row.student_id, row.form_id);
  }
  const formIds = [...new Set(latestFormByStudent.values())];
  const { data: forms, error: formError } = formIds.length
    ? await admin.from("booking_forms").select("id,slug,status").in("id", formIds)
    : { data: [] as Array<{ id: string; slug: string; status: string }>, error: null };
  if (formError) throw new Error(pgErrorMessage(formError, "تعذر تحميل نموذج الحجز المرتبط بالطالب."));
  const formsById = new Map((forms ?? []).map((form) => [form.id, form]));

  return students.map((student) => {
    const formId = latestFormByStudent.get(student.id);
    const form = formId ? formsById.get(formId) : undefined;
    return {
      ...student,
      form_slug: form?.status === "published" ? form.slug : null
    };
  });
}

function mapSubmissionRow(row: SubmissionRow): SubmissionRecord {
  return {
    id: row.id,
    form_id: row.form_id,
    batch_id: row.batch_id ?? undefined,
    student_id: row.student_id ?? undefined,
    access_code_id: row.access_code_id ?? undefined,
    booking_number: row.booking_number,
    status: row.status,
    is_current: row.is_current,
    answers: row.answers ?? {},
    submitted_at: row.submitted_at,
    reopened_from: row.reopened_from ?? undefined
  };
}

function mapSubmissionJoinRow(row: SubmissionJoinRow): SubmissionSummary {
  return {
    id: row.id,
    booking_number: row.booking_number,
    student_name: row.student?.full_name ?? "عميل",
    form_name: row.form?.name ?? "نموذج",
    batch_name: row.batch?.name ?? undefined,
    status: row.status,
    submitted_at: row.submitted_at
  };
}

function mapStatusHistoryRow(row: OrderStatusHistoryRow): StatusHistory {
  return {
    id: row.id,
    submission_id: row.submission_id,
    old_status: row.old_status ?? undefined,
    new_status: row.new_status,
    changed_by: row.changed_by ?? undefined,
    changed_at: row.changed_at,
    notes: row.notes ?? undefined
  };
}

function mapAuditLogRow(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    actor_id: row.actor_id ?? undefined,
    actor_label: row.actor_label ?? undefined,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id ?? undefined,
    metadata: row.metadata ?? undefined,
    created_at: row.created_at
  };
}

/* -------------------------------------------------------------------------------------------- */
/* Access control helpers                                                                       */
/* -------------------------------------------------------------------------------------------- */

async function resolveRepresentativeBatchIds(admin: SupabaseAdminClient, user: AppUser): Promise<string[]> {
  if (user.batchIds) return user.batchIds;
  const [{ data: links }, { data: owned }] = await Promise.all([
    admin.from("representative_batches").select("batch_id").eq("representative_id", user.id),
    admin.from("batches").select("id").eq("representative_id", user.id)
  ]);
  const linked = (links ?? []).map((row: { batch_id: string }) => row.batch_id);
  const ownedIds = (owned ?? []).map((row: { id: string }) => row.id);
  return Array.from(new Set([...linked, ...ownedIds]));
}

async function sbCanAccessBatchInternal(admin: SupabaseAdminClient, user: AppUser, batchId: string | null | undefined): Promise<boolean> {
  if (user.role === "OWNER") return true;
  if (!batchId) return false;
  if (user.batchIds?.includes(batchId)) return true;
  const ids = await resolveRepresentativeBatchIds(admin, user);
  return ids.includes(batchId);
}

/** Throws an Arabic error if `user` cannot manage/view `batchId`. */
export async function sbAssertBatchAccess(user: AppUser, batchId: string | null | undefined) {
  const admin = createAdminClient();
  const ok = await sbCanAccessBatchInternal(admin, user, batchId);
  if (!ok) throw new Error(batchId ? "غير مصرح بالوصول إلى هذه الدفعة." : "غير مصرح بإدارة الطلاب الفرديين.");
}

/* -------------------------------------------------------------------------------------------- */
/* Audit log writer                                                                              */
/* -------------------------------------------------------------------------------------------- */

async function sbAudit(
  admin: SupabaseAdminClient,
  action: string,
  entityType: string,
  entityId?: string,
  actor?: { id?: string; label?: string },
  metadata?: Record<string, unknown>
) {
  await admin.from("audit_logs").insert({
    actor_id: actor?.id ?? null,
    actor_label: actor?.label ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata: metadata ?? {}
  });
}

/* -------------------------------------------------------------------------------------------- */
/* Batch stats / form-per-batch helpers                                                         */
/* -------------------------------------------------------------------------------------------- */

async function fetchBatchStatsMap(admin: SupabaseAdminClient, batchIds: string[]): Promise<Map<string, BatchStats>> {
  const map = new Map<string, BatchStats>();
  for (const id of batchIds) map.set(id, { total: 0, submitted: 0, pending: 0 });
  if (!batchIds.length) return map;

  const [{ data: students }, { data: submissions }] = await Promise.all([
    admin.from("students").select("id,batch_id").in("batch_id", batchIds),
    admin.from("submissions").select("student_id,batch_id").in("batch_id", batchIds).eq("is_current", true)
  ]);

  const submittedStudentIds = new Set((submissions ?? []).map((row: { student_id: string | null }) => row.student_id));
  for (const student of (students ?? []) as Array<{ id: string; batch_id: string }>) {
    const stat = map.get(student.batch_id);
    if (!stat) continue;
    stat.total += 1;
    if (submittedStudentIds.has(student.id)) stat.submitted += 1;
    else stat.pending += 1;
  }
  return map;
}

async function fetchFormsByBatchIds(
  admin: SupabaseAdminClient,
  batchIds: string[]
): Promise<Map<string, BookingFormRecord>> {
  const map = new Map<string, BookingFormRecord>();
  if (!batchIds.length) return map;
  const { data: forms } = await admin
    .from("booking_forms")
    .select("id,name,slug,type,status,batch_id,internal_description,opening_date,closing_date")
    .in("batch_id", batchIds)
    .order("created_at", { ascending: true });
  for (const row of (forms ?? []) as BookingFormRow[]) {
    if (row.batch_id && !map.has(row.batch_id)) {
      map.set(row.batch_id, {
        ...mapFormRow({ ...row, definition: defaultWarkaFormDefinition }),
        definition: defaultWarkaFormDefinition
      });
    }
  }
  return map;
}

export type BatchWithStats = Batch & { stats: BatchStats; form?: BookingFormRecord | null };

/* -------------------------------------------------------------------------------------------- */
/* READS                                                                                         */
/* -------------------------------------------------------------------------------------------- */

export async function sbListBatches(user: AppUser): Promise<BatchWithStats[]> {
  const admin = createAdminClient();
  const builder = admin.from("batches").select("*, representative:profiles!representative_id(full_name)").order("created_at", {
    ascending: false
  });

  const scoped =
    user.role === "OWNER" ? builder : builder.in("id", await resolveRepresentativeBatchIds(admin, user));

  const { data, error } = await scoped;
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل الدفعات."));
  const rows = (data ?? []) as BatchRow[];
  if (!rows.length) return [];

  const batchIds = rows.map((row) => row.id);
  const [statsMap, formsMap] = await Promise.all([
    fetchBatchStatsMap(admin, batchIds),
    fetchFormsByBatchIds(admin, batchIds)
  ]);

  return rows.map((row) => ({
    ...mapBatchRow(row),
    stats: statsMap.get(row.id) ?? { total: 0, submitted: 0, pending: 0 },
    form: formsMap.get(row.id) ?? null
  }));
}

export async function sbGetBatch(user: AppUser, batchId: string): Promise<BatchWithStats | null> {
  const admin = createAdminClient();
  if (!(await sbCanAccessBatchInternal(admin, user, batchId))) return null;

  const { data, error } = await admin
    .from("batches")
    .select("*, representative:profiles!representative_id(full_name)")
    .eq("id", batchId)
    .maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل الدفعة."));
  if (!data) return null;

  const [statsMap, formsMap] = await Promise.all([
    fetchBatchStatsMap(admin, [batchId]),
    fetchFormsByBatchIds(admin, [batchId])
  ]);

  return {
    ...mapBatchRow(data as BatchRow),
    stats: statsMap.get(batchId) ?? { total: 0, submitted: 0, pending: 0 },
    form: formsMap.get(batchId) ?? null
  };
}

export async function sbListStudents(
  user: AppUser,
  options?: { batchId?: string; search?: string }
): Promise<StudentWithState[]> {
  const admin = createAdminClient();
  let query = admin.from("student_overview").select("*").order("created_at", { ascending: false }).limit(250);

  if (options?.batchId) {
    if (!(await sbCanAccessBatchInternal(admin, user, options.batchId))) return [];
    query = query.eq("batch_id", options.batchId);
  } else if (user.role === "REPRESENTATIVE") {
    const ids = await resolveRepresentativeBatchIds(admin, user);
    if (!ids.length) return [];
    query = query.in("batch_id", ids);
  }

  const { data, error } = await query;
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل الطلاب."));
  const mapped = await attachStudentFormSlugs(
    admin,
    ((data ?? []) as StudentOverviewRow[]).map(mapStudentOverviewRow)
  );

  const needle = options?.search?.trim();
  if (!needle) return mapped;
  return mapped.filter((student) =>
    [student.full_name, student.phone, student.code, student.booking_number, student.batch?.name]
      .filter(Boolean)
      .some((value) => String(value).includes(needle))
  );
}

export async function sbGetStudentCard(user: AppUser, studentId: string): Promise<StudentWithState | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("student_overview").select("*").eq("id", studentId).maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل بيانات الطالب."));
  if (!data) throw new Error("الطالب غير موجود.");
  const row = data as StudentOverviewRow;
  await sbAssertBatchAccess(user, row.batch_id);
  const [student] = await attachStudentFormSlugs(admin, [mapStudentOverviewRow(row)]);
  return student;
}

export async function sbListForms(user: AppUser): Promise<BookingFormRecord[]> {
  const admin = createAdminClient();

  if (user.role === "OWNER") {
    const { data, error } = await admin.from("booking_forms").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل النماذج."));
    const forms = await Promise.all(((data ?? []) as BookingFormRow[]).map((row) => resolveFormRowImages(row)));
    return forms;
  }

  const batchIds = await resolveRepresentativeBatchIds(admin, user);
  const batchFormsResult = batchIds.length
    ? await admin.from("booking_forms").select("*").in("batch_id", batchIds)
    : { data: [] as BookingFormRow[], error: null };
  if (batchFormsResult.error) throw new Error(pgErrorMessage(batchFormsResult.error, "تعذر تحميل النماذج."));

  const merged = ((batchFormsResult.data ?? []) as BookingFormRow[]).filter((row) => row.batch_id);
  merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return Promise.all(merged.map((row) => resolveFormRowImages(row)));
}

async function resolveFormRowImages(row: BookingFormRow): Promise<BookingFormRecord> {
  const form = mapFormRow(row);
  form.definition = await sbResolveDefinitionImages(form.definition);
  return form;
}

export async function sbGetPublicForm(slug: string, options?: { resolveImages?: boolean }): Promise<BookingFormRecord | null> {
  const admin = createAdminClient();
  if (options?.resolveImages === false) {
    const { data, error } = await admin
      .from("booking_forms")
      .select("id,name,slug,type,status,batch_id,internal_description")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل النموذج."));
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      type: data.type,
      status: data.status,
      batch_id: data.batch_id ?? undefined,
      internal_description: data.internal_description ?? undefined,
      definition: defaultWarkaFormDefinition
    };
  }

  const { data, error } = await admin
    .from("booking_forms")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل النموذج."));
  if (!data) return null;
  return resolveFormRowImages(data as BookingFormRow);
}

export async function sbPublicFormAvailability(slug: string): Promise<"published" | "unpublished" | "missing"> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("booking_forms").select("status").eq("slug", slug).maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل النموذج."));
  if (!data) return "missing";
  return data.status === "published" ? "published" : "unpublished";
}

export async function sbListSubmissions(
  user: AppUser,
  options?: { batchId?: string; individualOnly?: boolean; limit?: number }
): Promise<SubmissionSummary[]> {
  const admin = createAdminClient();
  let query = admin
    .from("submissions")
    .select(
      "id, form_id, batch_id, student_id, booking_number, status, submitted_at, student:students(full_name), form:booking_forms(name), batch:batches(name)"
    )
    .eq("is_current", true)
    .order("submitted_at", { ascending: false })
    .limit(options?.limit ?? 150);

  if (options?.individualOnly) {
    if (user.role !== "OWNER") return [];
    query = query.is("batch_id", null);
  } else if (options?.batchId) {
    if (!(await sbCanAccessBatchInternal(admin, user, options.batchId))) return [];
    query = query.eq("batch_id", options.batchId);
  } else if (user.role !== "OWNER") {
    const ids = await resolveRepresentativeBatchIds(admin, user);
    if (!ids.length) return [];
    query = query.in("batch_id", ids);
  }

  const { data, error } = await query;
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل الطلبات."));
  return ((data ?? []) as unknown as SubmissionJoinRow[]).map(mapSubmissionJoinRow);
}

export type SubmissionDetail = {
  submission: SubmissionRecord;
  student: StudentWithState | null;
  form: BookingFormRecord | null;
  batch: Batch | null;
  files: SubmissionFile[];
  history: StatusHistory[];
  referenceImageUrls: Record<string, string>;
};

async function sbCreateBookingUploadSignedUrl(admin: SupabaseAdminClient, path: string): Promise<string | undefined> {
  const { data, error } = await admin.storage.from(BOOKING_UPLOADS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return undefined;
  return data.signedUrl;
}

async function mapSubmissionFileRow(admin: SupabaseAdminClient, row: SubmissionFileRow): Promise<SubmissionFile> {
  return {
    id: row.id,
    submission_id: row.submission_id,
    field_key: row.field_key,
    storage_path: row.storage_path,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    file_size: row.file_size,
    sort_order: row.sort_order,
    preview_url: await sbCreateBookingUploadSignedUrl(admin, row.storage_path),
    created_at: row.created_at
  };
}

export async function sbGetSubmissionDetail(user: AppUser, submissionId: string): Promise<SubmissionDetail | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("submissions")
    .select("*, form:booking_forms(*), batch:batches(*, representative:profiles!representative_id(full_name))")
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل الطلب."));
  if (!data) return null;

  const row = data as SubmissionRow & { form: BookingFormRow | null; batch: BatchRow | null };
  if (!row.batch_id && user.role !== "OWNER") return null;
  if (row.batch_id && !(await sbCanAccessBatchInternal(admin, user, row.batch_id))) return null;

  const submission = mapSubmissionRow(row);
  const snapshot = readOrderSnapshot(submission.answers);
  const [student, form, filesResult, historyResult, referenceImageUrls] = await Promise.all([
    row.student_id
      ? admin
          .from("student_overview")
          .select("*")
          .eq("id", row.student_id)
          .maybeSingle()
          .then(({ data: studentRow }) => (studentRow ? mapStudentOverviewRow(studentRow as StudentOverviewRow) : null))
      : Promise.resolve(null),
    row.form ? resolveFormRowImages(row.form) : Promise.resolve(null),
    admin.from("submission_files").select("*").eq("submission_id", submissionId).order("sort_order", { ascending: true }),
    admin.from("order_status_history").select("*").eq("submission_id", submissionId).order("changed_at", { ascending: true }),
    resolveReferencePathMap(admin, collectReferencePaths(snapshot))
  ]);
  if (filesResult.error) throw new Error(pgErrorMessage(filesResult.error, "تعذر تحميل مرفقات الطلب."));
  if (historyResult.error) throw new Error(pgErrorMessage(historyResult.error, "تعذر تحميل سجل حالة الطلب."));
  const files = await Promise.all(((filesResult.data ?? []) as SubmissionFileRow[]).map((file) => mapSubmissionFileRow(admin, file)));
  const history = ((historyResult.data ?? []) as OrderStatusHistoryRow[]).map(mapStatusHistoryRow);
  const batch = row.batch ? mapBatchRow(row.batch) : null;

  return { submission, student, form, batch, files, history, referenceImageUrls };
}

export async function sbListRepresentatives(): Promise<Representative[]> {
  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("*")
    .eq("role", "REPRESENTATIVE")
    .order("created_at", { ascending: false });
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل الممثلين."));
  const rows = (profiles ?? []) as ProfileRow[];
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);
  const [{ data: links }, { data: owned }] = await Promise.all([
    admin.from("representative_batches").select("representative_id,batch_id").in("representative_id", ids),
    admin.from("batches").select("id,representative_id").in("representative_id", ids)
  ]);

  const batchMap = new Map<string, Set<string>>();
  for (const id of ids) batchMap.set(id, new Set());
  for (const link of (links ?? []) as Array<{ representative_id: string; batch_id: string }>) {
    batchMap.get(link.representative_id)?.add(link.batch_id);
  }
  for (const batch of (owned ?? []) as Array<{ id: string; representative_id: string | null }>) {
    if (batch.representative_id) batchMap.get(batch.representative_id)?.add(batch.id);
  }

  return rows.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    phone: row.phone ?? undefined,
    email: row.email ?? "",
    role: row.role,
    disabled: row.disabled,
    batch_ids: Array.from(batchMap.get(row.id) ?? []),
    // Supabase Auth owns credentials; there is no plaintext password to surface here.
    password: "",
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

export async function sbListAuditLogs(): Promise<AuditLog[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل سجل الأنشطة."));
  return ((data ?? []) as AuditLogRow[]).map(mapAuditLogRow);
}

export async function sbGetDashboardMetrics(user: AppUser) {
  const admin = createAdminClient();
  const batchFilter = user.role === "REPRESENTATIVE" ? await resolveRepresentativeBatchIds(admin, user) : null;
  if (batchFilter && !batchFilter.length) {
    return {
      activeBatches: 0,
      totalStudents: 0,
      submittedOrders: 0,
      pendingStudents: 0,
      todayOrders: 0,
      reviewed: 0,
      confirmed: 0,
      inProduction: 0,
      ready: 0,
      delivered: 0
    };
  }

  const startOfDay = new Date();
  startOfDay.setHours(startOfDay.getHours() + 3);
  startOfDay.setHours(0, 0, 0, 0);
  const iraqStart = new Date(startOfDay.getTime() - 3 * 60 * 60 * 1000).toISOString();

  let batchQuery = admin.from("batches").select("id", { count: "exact", head: true }).eq("status", "active");
  let studentQuery = admin.from("students").select("id", { count: "exact", head: true });
  let submittedQuery = admin.from("submissions").select("id", { count: "exact", head: true }).eq("is_current", true);
  let todayQuery = admin.from("submissions").select("id", { count: "exact", head: true }).eq("is_current", true).gte("submitted_at", iraqStart);
  let reviewedQuery = admin.from("submissions").select("id", { count: "exact", head: true }).eq("is_current", true).eq("status", "REVIEWED");
  let confirmedQuery = admin.from("submissions").select("id", { count: "exact", head: true }).eq("is_current", true).eq("status", "CONFIRMED");
  let productionQuery = admin.from("submissions").select("id", { count: "exact", head: true }).eq("is_current", true).eq("status", "IN_PRODUCTION");
  let readyQuery = admin.from("submissions").select("id", { count: "exact", head: true }).eq("is_current", true).eq("status", "READY");
  let deliveredQuery = admin.from("submissions").select("id", { count: "exact", head: true }).eq("is_current", true).eq("status", "DELIVERED");

  if (batchFilter) {
    batchQuery = batchQuery.in("id", batchFilter);
    studentQuery = studentQuery.in("batch_id", batchFilter);
    submittedQuery = submittedQuery.in("batch_id", batchFilter);
    todayQuery = todayQuery.in("batch_id", batchFilter);
    reviewedQuery = reviewedQuery.in("batch_id", batchFilter);
    confirmedQuery = confirmedQuery.in("batch_id", batchFilter);
    productionQuery = productionQuery.in("batch_id", batchFilter);
    readyQuery = readyQuery.in("batch_id", batchFilter);
    deliveredQuery = deliveredQuery.in("batch_id", batchFilter);
  }

  const [activeBatches, totalStudents, submittedOrders, todayOrders, reviewed, confirmed, inProduction, ready, delivered] =
    await Promise.all([
      batchQuery,
      studentQuery,
      submittedQuery,
      todayQuery,
      reviewedQuery,
      confirmedQuery,
      productionQuery,
      readyQuery,
      deliveredQuery
    ]);

  const students = totalStudents.count ?? 0;
  const submitted = submittedOrders.count ?? 0;
  return {
    activeBatches: activeBatches.count ?? 0,
    totalStudents: students,
    submittedOrders: submitted,
    pendingStudents: Math.max(0, students - submitted),
    todayOrders: todayOrders.count ?? 0,
    reviewed: reviewed.count ?? 0,
    confirmed: confirmed.count ?? 0,
    inProduction: inProduction.count ?? 0,
    ready: ready.count ?? 0,
    delivered: delivered.count ?? 0
  };
}

export async function sbExportBatchStudentsCsv(user: AppUser, batchId: string) {
  await sbAssertBatchAccess(user, batchId);
  const students = await sbListStudents(user, { batchId });
  const rows = students.map((state) =>
    [state.full_name, state.phone ?? "", state.code ?? "", state.code_status ?? "", state.submission_status ?? "", state.booking_number ?? ""]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",")
  );
  return {
    filename: `students-${batchId}.csv`,
    csv: ["الاسم,الهاتف,الرمز,حالة الرمز,الحجز,رقم الحجز", ...rows].join("\n")
  };
}

/* -------------------------------------------------------------------------------------------- */
/* AUTH WRITES                                                                                   */
/* -------------------------------------------------------------------------------------------- */

export async function sbLogin(email: string, password: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "لم يتم تهيئة Supabase." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "بيانات الدخول غير صحيحة." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "بيانات الدخول غير صحيحة." };
  const { data: profile } = await supabase.from("profiles").select("disabled").eq("id", auth.user.id).maybeSingle();
  if (!profile || profile.disabled) {
    await supabase.auth.signOut();
    return { error: "بيانات الدخول غير صحيحة." };
  }
  return {};
}

export async function sbLogout(): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

/* -------------------------------------------------------------------------------------------- */
/* PUBLIC BOOKING FLOW (access code verification + submission)                                  */
/* -------------------------------------------------------------------------------------------- */

export type UploadedFile = {
  path: string;
  originalName: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
};

export type AccessCodeVerificationResult =
  | { ok: true; session: VerifiedBookingSession; token: string }
  | { ok: false; error: string };

export async function sbVerifyAccessCode(slug: string, code: string): Promise<AccessCodeVerificationResult> {
  const admin = createAdminClient();

  const { data: form } = await admin
    .from("booking_forms")
    .select("id,batch_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!form) return { ok: false, error: "رمز الحجز غير صحيح أو غير متاح." };

  const fingerprint = accessCodeFingerprint(normalizeAccessCodeInput(code), getAccessCodeFingerprintScope(form));

  const { data, error } = await admin.rpc("verify_access_code", {
    p_slug: slug,
    p_fingerprint: fingerprint
  });
  if (error) return { ok: false, error: "رمز الحجز غير صحيح أو غير متاح." };

  const result = data as {
    ok: boolean;
    error?: string;
    formId?: string;
    slug?: string;
    formType?: VerifiedBookingSession["formType"];
    batchId?: string | null;
    accessCodeId?: string;
    studentId?: string;
    studentName?: string;
  };

  if (!result?.ok) {
    if (result?.error === "used") return { ok: false, error: "تم استخدام رمز الحجز مسبقاً وإرسال الطلب بنجاح." };
    return { ok: false, error: "رمز الحجز غير صحيح أو غير متاح." };
  }

  const session: VerifiedBookingSession = {
    formId: result.formId!,
    slug: result.slug!,
    formType: result.formType!,
    studentId: result.studentId,
    batchId: result.batchId ?? undefined,
    accessCodeId: result.accessCodeId,
    studentName: result.studentName,
    expiresAt: Date.now() + 1000 * 60 * 45
  };

  return { ok: true, session, token: signBookingSession(session) };
}

export type SubmitBookingResult =
  | { ok: true; bookingNumber: string; studentName: string; status: OrderStatus; submittedAt: string; submissionId: string; batchName?: string }
  | { ok: false; error: string };

export async function sbSubmitBooking(
  session: VerifiedBookingSession,
  answers: Record<string, unknown>,
  files: Record<string, UploadedFile[]>
): Promise<SubmitBookingResult> {
  if (!session.studentId || !session.accessCodeId) {
    return { ok: false, error: "انتهت جلسة الحجز، يرجى إدخال الرمز مرة أخرى." };
  }
  try {
    for (const entries of Object.values(files)) {
      for (const file of entries) {
        assertOwnedBookingPath(session, file.path);
        sanitizeStorageSegment(file.path.split("/")[2] ?? "");
      }
    }
  } catch {
    return { ok: false, error: "ملف غير صالح." };
  }

  const admin = createAdminClient();

  const { data: formRow, error: formError } = await admin
    .from("booking_forms")
    .select("*")
    .eq("id", session.formId)
    .eq("slug", session.slug)
    .eq("status", "published")
    .maybeSingle();
  if (formError) return { ok: false, error: pgErrorMessage(formError, "النموذج غير متاح حالياً.") };
  if (!formRow) return { ok: false, error: "النموذج غير متاح حالياً." };

  const fixed = await sbLoadFixedOptions(admin, formRow.id, session.studentId);
  for (const [key, value] of Object.entries(fixed)) {
    if (value && answers[key] != null && String(answers[key]) !== value) {
      return { ok: false, error: "الخيار المحدد غير متاح." };
    }
  }
  const definition = applyUniformToDefinition(
    (formRow.definition as FormDefinition | null) ?? defaultWarkaFormDefinition,
    fixed
  );
  const finalAnswers = enforceUniformAnswers({ ...answers, student_name: session.studentName }, fixed);
  const validation = validateDynamicAnswers(definition, finalAnswers);
  if (!validation.valid) return { ok: false, error: "يرجى مراجعة الحقول المطلوبة." };

  const snapshot = buildOrderSnapshot({
    formId: formRow.id,
    formName: formRow.name,
    definition,
    answers: finalAnswers
  });
  const persistedAnswers = answersWithSnapshot(finalAnswers, snapshot);

  const { data, error } = await admin.rpc("submit_booking_transaction", {
    p_form_id: session.formId,
    p_batch_id: session.batchId ?? null,
    p_student_id: session.studentId ?? null,
    p_access_code_id: session.accessCodeId ?? null,
    p_answers: persistedAnswers,
    p_files: files
  });
  if (error) {
    return { ok: false, error: pgErrorMessage(error, "تعذر حفظ الحجز، يرجى المحاولة مرة أخرى.") };
  }

  const result = data as { id: string; bookingNumber: string; studentName: string; status: OrderStatus; submittedAt: string };
  let batchName: string | undefined;
  if (session.batchId) {
    const { data: batchRow } = await admin.from("batches").select("name").eq("id", session.batchId).maybeSingle();
    batchName = batchRow?.name;
  }
  await persistPickupToken(admin, result.id);
  return {
    ok: true,
    bookingNumber: result.bookingNumber,
    studentName: result.studentName,
    status: result.status,
    submittedAt: result.submittedAt,
    submissionId: result.id,
    batchName
  };
}

async function persistPickupToken(admin: SupabaseAdminClient, submissionId: string) {
  const issued = generatePickupToken();
  const { error } = await admin
    .from("submissions")
    .update({ pickup_token_hash: issued.hash, pickup_token_ciphertext: issued.ciphertext })
    .eq("id", submissionId)
    .is("pickup_token_hash", null);
  if (error) throw new Error(pgErrorMessage(error, "تعذر إنشاء رمز الاستلام."));
}

export async function sbEnsurePickupToken(submissionId: string): Promise<string> {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("submissions")
    .select("id,pickup_token_hash,pickup_token_ciphertext")
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل الطلب."));
  if (!data) throw new Error("الطلب غير موجود.");

  if (data.pickup_token_hash && data.pickup_token_ciphertext) {
    return readStoredPickupToken(data.pickup_token_ciphertext);
  }
  const issued = generatePickupToken();
  const { error: updateError } = await admin
    .from("submissions")
    .update({ pickup_token_hash: issued.hash, pickup_token_ciphertext: issued.ciphertext })
    .eq("id", submissionId);
  if (updateError) throw new Error(pgErrorMessage(updateError, "تعذر إنشاء رمز الاستلام."));
  return issued.token;
}

export type PickupView = {
  submissionId: string;
  bookingNumber: string;
  status: OrderStatus;
  studentName: string;
  phone?: string;
  batchName?: string;
  individual: boolean;
  summary: string;
  ready: boolean;
  deliveredAt?: string;
  alreadyDelivered: boolean;
};

function orderSummaryFromAnswers(answers: Record<string, unknown>) {
  const keys = ["robe_model", "robe", "sash_type", "sash", "cap_type", "cap", "booking_type"];
  const parts = keys
    .map((key) => answers[key])
    .filter((value) => value != null && String(value).trim())
    .map((value) => String(value));
  return parts.slice(0, 4).join(" · ") || "تفاصيل الطلب في صفحة الحجز";
}

export async function sbGetPickupByToken(user: AppUser, rawToken: string): Promise<PickupView | { error: string }> {
  requireSupabaseSecretsForWrites();
  const token = rawToken.trim();
  if (!token || token.length < 16) return { error: "رمز الاستلام غير صالح." };
  const admin = createAdminClient();
  const hash = hashPickupToken(token);
  const { data, error } = await admin
    .from("submissions")
    .select("id,booking_number,status,batch_id,student_id,answers,submitted_at,student:students(full_name,phone),batch:batches(name)")
    .eq("pickup_token_hash", hash)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر التحقق من رمز الاستلام."));
  if (!data) return { error: "رمز الاستلام غير صالح." };

  const batchId = data.batch_id as string | null;
  if (!(await sbCanAccessBatchInternal(admin, user, batchId))) {
    return { error: "غير مصرح بالوصول إلى هذا الطلب." };
  }

  const { data: delivered } = data.status === "DELIVERED"
    ? await admin
        .from("order_status_history")
        .select("changed_at")
        .eq("submission_id", data.id)
        .eq("new_status", "DELIVERED")
        .order("changed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const student = Array.isArray(data.student) ? data.student[0] : data.student;
  const batch = Array.isArray(data.batch) ? data.batch[0] : data.batch;
  return {
    submissionId: data.id,
    bookingNumber: data.booking_number,
    status: data.status as OrderStatus,
    studentName: student?.full_name ?? "طالب",
    phone: student?.phone ?? undefined,
    batchName: batch?.name ?? undefined,
    individual: !batchId,
    summary: orderSummaryFromAnswers((data.answers as Record<string, unknown>) ?? {}),
    ready: data.status === "READY" || data.status === "DELIVERED" || data.status === "CONFIRMED" || data.status === "IN_PRODUCTION" || data.status === "SUBMITTED" || data.status === "REVIEWED",
    deliveredAt: delivered?.changed_at,
    alreadyDelivered: data.status === "DELIVERED"
  };
}

export async function sbConfirmPickupDelivery(user: AppUser, rawToken: string) {
  const view = await sbGetPickupByToken(user, rawToken);
  if ("error" in view) return view;
  if (view.alreadyDelivered) {
    return { ...view, message: "تم تسليم هذا الطلب مسبقاً" };
  }

  const admin = createAdminClient();
  const { data: current } = await admin.from("submissions").select("id,status").eq("id", view.submissionId).maybeSingle();
  if (!current) return { error: "الطلب غير موجود." };
  if (current.status === "DELIVERED") {
    return { ...view, alreadyDelivered: true, message: "تم تسليم هذا الطلب مسبقاً" };
  }

  const { data: updated, error: updateError } = await admin
    .from("submissions")
    .update({ status: "DELIVERED" })
    .eq("id", view.submissionId)
    .neq("status", "DELIVERED")
    .select("id")
    .maybeSingle();
  if (updateError) throw new Error(pgErrorMessage(updateError, "تعذر تأكيد التسليم."));
  if (!updated) {
    return { ...view, alreadyDelivered: true, message: "تم تسليم هذا الطلب مسبقاً" };
  }

  await admin.from("order_status_history").insert({
    submission_id: view.submissionId,
    old_status: current.status,
    new_status: "DELIVERED",
    changed_by: user.id,
    notes: "تأكيد تسليم عبر رمز QR"
  });
  await sbAudit(admin, "ORDER_DELIVERED", "submission", view.submissionId, { id: user.id, label: user.fullName }, {
    booking_number: view.bookingNumber
  });

  return {
    ...view,
    status: "DELIVERED" as OrderStatus,
    alreadyDelivered: true,
    deliveredAt: new Date().toISOString(),
    message: "تم تأكيد التسليم"
  };
}

export type AdminSearchHit = {
  type: "طالب" | "طلب" | "دفعة";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function sbAdminSearch(user: AppUser, rawQuery: string): Promise<AdminSearchHit[]> {
  const needle = rawQuery.trim().replace(/[%_,()]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  if (needle.length < 2) return [];
  const admin = createAdminClient();
  const hits: AdminSearchHit[] = [];
  const batchIds = user.role === "REPRESENTATIVE" ? await resolveRepresentativeBatchIds(admin, user) : null;
  if (batchIds && !batchIds.length) return [];

  const studentsQuery = admin
    .from("students")
    .select("id,full_name,phone,batch_id,batch:batches(name)")
    .or(`full_name.ilike.%${needle}%,phone.ilike.%${needle}%`)
    .limit(8);
  const scopedStudents = batchIds ? studentsQuery.in("batch_id", batchIds) : studentsQuery;

  let ordersQuery = admin
    .from("submissions")
    .select("id,booking_number,status,batch_id,student:students(full_name)")
    .eq("is_current", true)
    .ilike("booking_number", `%${needle}%`)
    .limit(8);
  if (batchIds) ordersQuery = ordersQuery.in("batch_id", batchIds);
  else if (user.role !== "OWNER") ordersQuery = ordersQuery.in("batch_id", []);

  const statusEntries = Object.entries(statusLabels).filter(([key]) =>
    ["SUBMITTED", "REVIEWED", "CONFIRMED", "IN_PRODUCTION", "READY", "DELIVERED", "CANCELLED"].includes(key)
  );
  const upperNeedle = needle.toUpperCase();
  const statusKey =
    statusEntries.find(([key]) => key === upperNeedle)?.[0] ??
    statusEntries.find(([, label]) => label.includes(needle) || needle.includes(label))?.[0];

  let statusQuery = statusKey
    ? admin
        .from("submissions")
        .select("id,booking_number,status,batch_id,student:students(full_name)")
        .eq("is_current", true)
        .eq("status", statusKey)
        .limit(8)
    : null;
  if (statusQuery && batchIds) statusQuery = statusQuery.in("batch_id", batchIds);

  const batchesQuery = admin.from("batches").select("id,name,university,status").ilike("name", `%${needle}%`).limit(6);
  const scopedBatches = batchIds ? batchesQuery.in("id", batchIds) : batchesQuery;

  const [students, orders, statusOrders, batches] = await Promise.all([
    scopedStudents,
    ordersQuery,
    statusQuery ?? Promise.resolve({ data: [] as never[] }),
    scopedBatches
  ]);

  for (const row of students.data ?? []) {
    const batch = Array.isArray(row.batch) ? row.batch[0] : row.batch;
    hits.push({
      type: "طالب",
      id: row.id,
      title: row.full_name,
      subtitle: `${row.phone || "بدون هاتف"} · ${batch?.name ?? "طالب فردي"}`,
      href: `/admin/students/${row.id}`
    });
  }
  const orderRows = [...(orders.data ?? []), ...((statusOrders as { data?: typeof orders.data }).data ?? [])];
  const seenOrders = new Set<string>();
  for (const row of orderRows) {
    if (seenOrders.has(row.id)) continue;
    seenOrders.add(row.id);
    const student = Array.isArray(row.student) ? row.student[0] : row.student;
    hits.push({
      type: "طلب",
      id: row.id,
      title: row.booking_number,
      subtitle: `${student?.full_name ?? "طالب"} · ${row.status}`,
      href: `/admin/orders/${row.id}`
    });
  }
  for (const row of batches.data ?? []) {
    hits.push({
      type: "دفعة",
      id: row.id,
      title: row.name,
      subtitle: row.university,
      href: `/admin/batches/${row.id}`
    });
  }

  const digits = needle.replace(/[^\d\u0660-\u0669\u06f0-\u06f9]/g, "");
  const normalized = digits
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  if (normalized.length === 6) {
    const { data: forms } = await admin.from("booking_forms").select("id,batch_id");
    const scopes = Array.from(
      new Set((forms ?? []).map((form) => form.batch_id || form.id).filter(Boolean))
    ) as string[];
    const fingerprints = scopes.map((scope) => accessCodeFingerprint(normalized, scope));
    if (fingerprints.length) {
      let codeQuery = admin
        .from("student_access_codes")
        .select("student_id,batch_id,students(full_name,phone,batch_id)")
        .in("code_fingerprint", fingerprints)
        .limit(5);
      if (batchIds) codeQuery = codeQuery.in("batch_id", batchIds);
      const { data: codes } = await codeQuery;
      for (const row of codes ?? []) {
        const student = Array.isArray(row.students) ? row.students[0] : row.students;
        if (!student) continue;
        hits.unshift({
          type: "طالب",
          id: row.student_id,
          title: student.full_name,
          subtitle: "نتيجة رمز حجز مطابق",
          href: `/admin/students/${row.student_id}`
        });
      }
    }
  }

  return hits.slice(0, 20);
}

export async function sbExportOrders(
  user: AppUser,
  filters: { batchId?: string; individualOnly?: boolean; status?: OrderStatus; from?: string; to?: string }
) {
  if (user.role !== "OWNER") throw new Error("التصدير متاح للمالك فقط.");
  const admin = createAdminClient();
  let query = admin
    .from("submissions")
    .select(
      "id,booking_number,status,submitted_at,batch_id,answers,student:students(full_name,phone,address),batch:batches(name)"
    )
    .eq("is_current", true)
    .order("submitted_at", { ascending: false })
    .limit(2000);

  if (filters.individualOnly) query = query.is("batch_id", null);
  else if (filters.batchId) query = query.eq("batch_id", filters.batchId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("submitted_at", filters.from);
  if (filters.to) query = query.lte("submitted_at", filters.to);

  const { data, error } = await query;
  if (error) throw new Error(pgErrorMessage(error, "تعذر تصدير الطلبات."));

  return (data ?? []).map((row) => {
    const student = Array.isArray(row.student) ? row.student[0] : row.student;
    const batch = Array.isArray(row.batch) ? row.batch[0] : row.batch;
    const answers = (row.answers as Record<string, unknown>) ?? {};
    return {
      booking_number: row.booking_number,
      student_name: student?.full_name ?? "",
      phone: student?.phone ?? String(answers.phone ?? ""),
      address: student?.address ?? String(answers.address ?? ""),
      batch: batch?.name ?? "حجز فردي",
      booking_type: String(answers.booking_type ?? ""),
      robe: String(answers.robe_model ?? answers.robe ?? ""),
      robe_additions: String(answers.robe_addition ?? answers.robe_additions ?? ""),
      sash: String(answers.sash_type ?? answers.sash ?? ""),
      embroidery: String(answers.sash_name_embroidery ?? answers.embroidery ?? ""),
      cap: String(answers.cap_type ?? answers.cap ?? ""),
      status: statusLabels[row.status] ?? row.status,
      created_at: row.submitted_at,
      updated_at: row.submitted_at
    };
  });
}

/* -------------------------------------------------------------------------------------------- */
/* BATCH / STUDENT / REPRESENTATIVE WRITES                                                      */
/* -------------------------------------------------------------------------------------------- */

export async function sbCreateBatch(user: AppUser, input: CreateBatchInput): Promise<Batch> {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();

  const { data: batchRow, error } = await admin
    .from("batches")
    .insert({
      name: input.name,
      university: input.university,
      college: input.college,
      department: input.department,
      stage: input.stage,
      graduation_year: input.graduation_year,
      description: input.description ?? null,
      representative_id: input.representative_id ?? null,
      status: input.status
    })
    .select("*, representative:profiles!representative_id(full_name)")
    .single();
  if (error || !batchRow) throw new Error(pgErrorMessage(error, "تعذر إنشاء الدفعة."));

  const row = batchRow as BatchRow;
  const slug = await generateUniqueFormSlug(admin, row.name, row.graduation_year);
  const definition = buildBatchDefaultDefinition();

  const { data: formRow, error: formError } = await admin
    .from("booking_forms")
    .insert({
      name: `بطاقة حجز ${row.name}`,
      internal_description: `نموذج تلقائي للدفعة ${row.name}`,
      slug,
      type: "BATCH",
      status: "published",
      batch_id: row.id,
      definition,
      created_by: user.id
    })
    .select("id")
    .single();
  if (formError || !formRow) throw new Error(pgErrorMessage(formError, "تعذر إنشاء نموذج الدفعة."));

  if (input.uniform) {
    await sbReplaceFixedOptions(admin, formRow.id, null, input.uniform);
  }

  if (input.representative_id) {
    const { error: linkError } = await admin
      .from("representative_batches")
      .upsert(
        { representative_id: input.representative_id, batch_id: row.id },
        { onConflict: "representative_id,batch_id" }
      );
    if (linkError) throw new Error(pgErrorMessage(linkError, "تعذر ربط الممثل بالدفعة."));
  }

  await sbAudit(admin, "BATCH_CREATED", "batch", row.id, { id: user.id, label: user.fullName }, {
    name: row.name,
    form_slug: slug
  });

  return mapBatchRow(row);
}

export type CreateRepresentativeInput = {
  fullName: string;
  phone?: string;
  email: string;
  password: string;
  batchIds: string[];
};

export async function sbCreateRepresentative(input: CreateRepresentativeInput) {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName }
  });
  if (error || !created?.user) {
    const message = error?.message ?? "";
    if (/already.*registered|duplicate/i.test(message)) throw new Error("البريد مستخدم مسبقاً.");
    throw new Error(message || "تعذر إنشاء الممثل.");
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    full_name: input.fullName,
    role: "REPRESENTATIVE",
    disabled: false,
    phone: input.phone ?? null,
    email: input.email
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(pgErrorMessage(profileError, "تعذر إنشاء الممثل."));
  }

  if (input.batchIds.length) {
    const { error: linkError } = await admin
      .from("representative_batches")
      .insert(input.batchIds.map((batchId) => ({ representative_id: userId, batch_id: batchId })));
    if (linkError) throw new Error(pgErrorMessage(linkError, "تعذر ربط الدفعات بالممثل."));

    const { error: assignError } = await admin
      .from("batches")
      .update({ representative_id: userId })
      .in("id", input.batchIds);
    if (assignError) throw new Error(pgErrorMessage(assignError, "تعذر تحديث الدفعات."));
  }

  await sbAudit(admin, "REPRESENTATIVE_CREATED", "profile", userId, undefined, {
    email: input.email,
    batchIds: input.batchIds
  });

  return {
    id: userId,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    batchIds: input.batchIds
  };
}

export async function sbToggleRepresentative(id: string, disabled: boolean) {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({ disabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("role", "REPRESENTATIVE")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحديث حالة الممثل."));
  if (!data) throw new Error("الممثل غير موجود.");
  await sbAudit(admin, disabled ? "REPRESENTATIVE_DISABLED" : "REPRESENTATIVE_ENABLED", "profile", id);
}

export async function sbAssignRepresentativeBatches(id: string, batchIds: string[]) {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("role", "REPRESENTATIVE")
    .maybeSingle();
  if (profileError) throw new Error(pgErrorMessage(profileError, "تعذر تحديث الممثل."));
  if (!profile) throw new Error("الممثل غير موجود.");

  const { error: deleteError } = await admin.from("representative_batches").delete().eq("representative_id", id);
  if (deleteError) throw new Error(pgErrorMessage(deleteError, "تعذر تحديث الدفعات."));

  if (batchIds.length) {
    const { error: insertError } = await admin
      .from("representative_batches")
      .insert(batchIds.map((batchId) => ({ representative_id: id, batch_id: batchId })));
    if (insertError) throw new Error(pgErrorMessage(insertError, "تعذر تحديث الدفعات."));
  }

  const { error: clearError } = await admin
    .from("batches")
    .update({ representative_id: null, updated_at: new Date().toISOString() })
    .eq("representative_id", id);
  if (clearError) throw new Error(pgErrorMessage(clearError, "تعذر تحديث الدفعات."));

  if (batchIds.length) {
    const { error: assignError } = await admin
      .from("batches")
      .update({ representative_id: id, updated_at: new Date().toISOString() })
      .in("id", batchIds);
    if (assignError) throw new Error(pgErrorMessage(assignError, "تعذر تحديث الدفعات."));
  }

  await sbAudit(admin, "REPRESENTATIVE_BATCHES_UPDATED", "profile", id, undefined, { batchIds });
}

export async function sbImportStudents(user: AppUser, batchId: string, names: string[]) {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  if (!(await sbCanAccessBatchInternal(admin, user, batchId))) {
    return { error: "غير مصرح بالوصول إلى هذه الدفعة." };
  }

  const cleaned = names.map((name) => name.replace(/\s+/g, " ").trim()).filter((name) => name.length >= 3);
  if (!cleaned.length) return { error: "لا توجد أسماء صالحة للاستيراد." };

  const { data: form } = await admin.from("booking_forms").select("id").eq("batch_id", batchId).maybeSingle();

  const { data: existingStudents, error: existingError } = await admin
    .from("students")
    .select("full_name")
    .eq("batch_id", batchId);
  if (existingError) return { error: pgErrorMessage(existingError, "تعذر استيراد الطلاب.") };

  const existing = new Set((existingStudents ?? []).map((row: { full_name: string }) => row.full_name));
  const toInsert = cleaned.filter((name) => !existing.has(name));
  if (!toInsert.length) return { success: true as const, imported: 0 };

  const { data: inserted, error } = await admin
    .from("students")
    .insert(toInsert.map((full_name) => ({ batch_id: batchId, full_name })))
    .select("id");
  if (error) return { error: pgErrorMessage(error, "تعذر استيراد الطلاب.") };

  if (form && inserted?.length) {
    const codesPayload = (inserted as Array<{ id: string }>).map((student) => {
      const code = generateNumericCode();
      return {
        student_id: student.id,
        batch_id: batchId,
        form_id: form.id,
        code_ciphertext: encryptAccessCode(code),
        code_fingerprint: accessCodeFingerprint(code, getAccessCodeFingerprintScope({ id: form.id, batch_id: batchId })),
        status: "ACTIVE" as const
      };
    });
    const { error: codeError } = await admin.from("student_access_codes").insert(codesPayload);
    if (codeError) return { error: pgErrorMessage(codeError, "تعذر إنشاء رموز الحجز.") };
  }

  await sbAudit(admin, "STUDENTS_IMPORTED", "batch", batchId, { id: user.id, label: user.fullName }, {
    count: toInsert.length
  });
  return { success: true as const, imported: toInsert.length };
}

export async function sbRegenerateStudentCode(user: AppUser, studentId: string): Promise<{ code: string }> {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();

  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id,batch_id")
    .eq("id", studentId)
    .maybeSingle();
  if (studentError) throw new Error(pgErrorMessage(studentError, "تعذر تحميل بيانات الطالب."));
  if (!student) throw new Error("الطالب غير موجود.");
  await sbAssertBatchAccess(user, student.batch_id);

  const form = student.batch_id
    ? (await admin.from("booking_forms").select("id,batch_id").eq("batch_id", student.batch_id).maybeSingle()).data
    : await ensureIndividualForm(admin);
  if (!form) throw new Error(student.batch_id ? "لا يوجد نموذج مرتبط بهذه الدفعة." : "تعذر تجهيز نموذج الحجز الفردي.");

  const code = generateNumericCode();
  const ciphertext = encryptAccessCode(code);
  const fingerprint = accessCodeFingerprint(code, getAccessCodeFingerprintScope(form));

  // Written manually (disable + insert) instead of the `regenerate_student_access_code`
  // RPC: that function checks `public.can_access_batch`, which relies on `auth.uid()`
  // and is always null under the service-role client. Access was already verified above.
  const { error: disableError } = await admin
    .from("student_access_codes")
    .update({ status: "DISABLED", updated_at: new Date().toISOString() })
    .eq("student_id", studentId)
    .eq("status", "ACTIVE");
  if (disableError) throw new Error(pgErrorMessage(disableError, "تعذر إلغاء الرمز السابق."));

  const { data: inserted, error: insertError } = await admin
    .from("student_access_codes")
    .insert({
      student_id: studentId,
      batch_id: student.batch_id,
      form_id: form.id,
      code_ciphertext: ciphertext,
      code_fingerprint: fingerprint,
      status: "ACTIVE"
    })
    .select("id")
    .single();
  if (insertError || !inserted) throw new Error(pgErrorMessage(insertError, "تعذر إنشاء رمز جديد."));

  await sbAudit(admin, "ACCESS_CODE_REGENERATED", "student_access_code", inserted.id, {
    id: user.id,
    label: user.fullName
  }, { student_id: studentId });

  return { code };
}

export async function sbSetAccessCodeStatus(user: AppUser, studentId: string, status: AccessCodeStatus) {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();

  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id,batch_id")
    .eq("id", studentId)
    .maybeSingle();
  if (studentError) throw new Error(pgErrorMessage(studentError, "تعذر تحميل بيانات الطالب."));
  if (!student) throw new Error("الطالب غير موجود.");
  await sbAssertBatchAccess(user, student.batch_id);

  const { data: latest, error: latestError } = await admin
    .from("student_access_codes")
    .select("id,status")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(pgErrorMessage(latestError, "تعذر تحميل رمز الحجز."));
  if (!latest) throw new Error("لا يوجد رمز لهذا الطالب.");
  if (status === "ACTIVE" && latest.status === "USED") {
    throw new Error("لا يمكن إعادة تفعيل رمز مستخدم إلا عبر إعادة فتح الطلب.");
  }

  const { error } = await admin
    .from("student_access_codes")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", latest.id);
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحديث حالة الرمز."));

  await sbAudit(admin, "ACCESS_CODE_STATUS_CHANGED", "student_access_code", latest.id, {
    id: user.id,
    label: user.fullName
  }, { status });
}

export async function sbReopenSubmission(user: AppUser, submissionId: string): Promise<{ code: string }> {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();

  const { data: submission, error: submissionError } = await admin
    .from("submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  if (submissionError) throw new Error(pgErrorMessage(submissionError, "تعذر تحميل الطلب."));
  if (!submission) throw new Error("الطلب غير موجود.");
  const oldStatus = submission.status as OrderStatus;

  const { error: updateSubmissionError } = await admin
    .from("submissions")
    .update({ is_current: false, status: "CANCELLED" })
    .eq("id", submissionId);
  if (updateSubmissionError) throw new Error(pgErrorMessage(updateSubmissionError, "تعذر إعادة فتح الطلب."));

  if (!submission.student_id) throw new Error("الطالب غير موجود.");
  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id,batch_id")
    .eq("id", submission.student_id)
    .maybeSingle();
  if (studentError) throw new Error(pgErrorMessage(studentError, "تعذر تحميل بيانات الطالب."));
  if (!student) throw new Error("الطالب غير موجود.");

  const { data: form, error: formError } = await admin
    .from("booking_forms")
    .select("id,batch_id")
    .eq("id", submission.form_id)
    .maybeSingle();
  if (formError) throw new Error(pgErrorMessage(formError, "تعذر تحميل النموذج."));
  if (!form) throw new Error("النموذج غير موجود.");

  const { error: disableError } = await admin
    .from("student_access_codes")
    .update({ status: "DISABLED", updated_at: new Date().toISOString() })
    .eq("student_id", student.id)
    .eq("status", "ACTIVE");
  if (disableError) throw new Error(pgErrorMessage(disableError, "تعذر إلغاء الرمز السابق."));

  const code = generateNumericCode();
  const ciphertext = encryptAccessCode(code);
  const fingerprint = accessCodeFingerprint(code, getAccessCodeFingerprintScope(form));
  const { data: newCode, error: insertError } = await admin
    .from("student_access_codes")
    .insert({
      student_id: student.id,
      batch_id: student.batch_id,
      form_id: form.id,
      code_ciphertext: ciphertext,
      code_fingerprint: fingerprint,
      status: "ACTIVE"
    })
    .select("id")
    .single();
  if (insertError || !newCode) throw new Error(pgErrorMessage(insertError, "تعذر إنشاء رمز جديد."));

  const { error: historyError } = await admin.from("order_status_history").insert({
    submission_id: submissionId,
    old_status: oldStatus,
    new_status: "CANCELLED",
    changed_by: user.id,
    notes: "تمت إعادة فتح الطلب من المالك"
  });
  if (historyError) throw new Error(pgErrorMessage(historyError, "تعذر تحديث سجل الحالة."));

  await sbAudit(admin, "SUBMISSION_REOPENED", "submission", submissionId, { id: user.id, label: user.fullName }, {
    new_code_id: newCode.id,
    new_code: code,
    reopened_from: submissionId
  });

  return { code };
}

export async function sbUpdateOrderStatus(user: AppUser, submissionId: string, status: OrderStatus, notes?: string) {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();

  const { data: submission, error: submissionError } = await admin
    .from("submissions")
    .select("id,status,batch_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (submissionError) throw new Error(pgErrorMessage(submissionError, "تعذر تحميل الطلب."));
  if (!submission) throw new Error("الطلب غير موجود.");
  if (submission.batch_id) await sbAssertBatchAccess(user, submission.batch_id);
  if (user.role === "REPRESENTATIVE" && !["REVIEWED", "CONFIRMED"].includes(status)) {
    throw new Error("غير مصرح بتغيير الحالة إلى هذه القيمة.");
  }

  const oldStatus = submission.status as OrderStatus;
  const { error: updateError } = await admin.from("submissions").update({ status }).eq("id", submissionId);
  if (updateError) throw new Error(pgErrorMessage(updateError, "تعذر تحديث حالة الطلب."));

  const { error: historyError } = await admin.from("order_status_history").insert({
    submission_id: submissionId,
    old_status: oldStatus,
    new_status: status,
    changed_by: user.id,
    notes: notes ?? null
  });
  if (historyError) throw new Error(pgErrorMessage(historyError, "تعذر تحديث سجل الحالة."));

  await sbAudit(admin, "ORDER_STATUS_CHANGED", "submission", submissionId, { id: user.id, label: user.fullName }, {
    status
  });
}

/* -------------------------------------------------------------------------------------------- */
/* FORM BUILDER WRITES                                                                           */
/* -------------------------------------------------------------------------------------------- */

async function fetchFormDefinitionOrThrow(admin: SupabaseAdminClient, formId: string): Promise<FormDefinition> {
  const { data, error } = await admin.from("booking_forms").select("definition").eq("id", formId).maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل النموذج."));
  if (!data) throw new Error("النموذج غير موجود.");
  return (data.definition as FormDefinition | null) ?? defaultWarkaFormDefinition;
}

function updateOptionsList(
  options: FormOption[],
  optionId: string,
  updater: (option: FormOption) => FormOption
): FormOption[] {
  return options.map((option) => {
    if (option.id === optionId) return updater(option);
    if (option.children?.length) return { ...option, children: updateOptionsList(option.children, optionId, updater) };
    return option;
  });
}

function updateOptionInDefinition(
  definition: FormDefinition,
  fieldKey: string,
  optionId: string,
  updater: (option: FormOption) => FormOption
): FormDefinition {
  return {
    ...definition,
    sections: definition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        if (field.key !== fieldKey || !field.options) return field;
        return { ...field, options: updateOptionsList(field.options, optionId, updater) };
      })
    }))
  };
}

export type CreateFormInput = {
  name: string;
  slug: string;
  type: FormType;
  batchId?: string;
  internalDescription?: string;
};

export async function sbCreateForm(user: AppUser, input: CreateFormInput): Promise<BookingFormRecord> {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();

  const { data: existing } = await admin.from("booking_forms").select("id").eq("slug", input.slug).maybeSingle();
  if (existing) throw new Error("الرابط مستخدم مسبقاً.");

  const { data: form, error } = await admin
    .from("booking_forms")
    .insert({
      name: input.name,
      slug: input.slug,
      type: input.type,
      batch_id: input.batchId ?? null,
      internal_description: input.internalDescription ?? null,
      status: "draft",
      definition: defaultWarkaFormDefinition,
      created_by: user.id
    })
    .select("*")
    .single();
  if (error || !form) throw new Error(pgErrorMessage(error, "تعذر إنشاء النموذج."));

  await sbAudit(admin, "FORM_CREATED", "booking_form", form.id, { id: user.id, label: user.fullName }, {
    slug: input.slug
  });

  return mapFormRow(form as BookingFormRow);
}

export async function sbSetFormStatus(formId: string, status: FormStatus) {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const { data, error } = await admin.from("booking_forms").update({ status }).eq("id", formId).select("id").maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحديث حالة النموذج."));
  if (!data) throw new Error("النموذج غير موجود.");
  await sbAudit(admin, "FORM_STATUS_CHANGED", "booking_form", formId, undefined, { status });
}

export type FormUploadSettingUpdate = {
  key: string;
  uploadMode?: "single" | "multiple";
  maxFiles?: number;
  required?: boolean;
};

export async function sbUpdateFormUploadSettings(formId: string, updates: FormUploadSettingUpdate[]) {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const definition = await fetchFormDefinitionOrThrow(admin, formId);

  const nextDefinition: FormDefinition = {
    ...definition,
    sections: definition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        const update = updates.find((entry) => entry.key === field.key);
        if (!update) return field;
        return { ...field, uploadMode: update.uploadMode, maxFiles: update.maxFiles, required: update.required };
      })
    }))
  };

  const { error } = await admin.from("booking_forms").update({ definition: nextDefinition }).eq("id", formId);
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحديث إعدادات الرفع."));
  await sbAudit(admin, "FORM_UPLOAD_SETTINGS_UPDATED", "booking_form", formId);
}

export type FormOptionPatch = Partial<{
  label: string;
  description: string;
  enabled: boolean;
  imagePath: string | undefined;
  imageUrl: string | undefined;
  imageAlt: string;
}>;

export async function sbUpdateFormOption(
  formId: string,
  fieldKey: string,
  optionId: string,
  patch: FormOptionPatch
): Promise<FormOption> {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const definition = await fetchFormDefinitionOrThrow(admin, formId);

  let updatedOption: FormOption | undefined;
  const nextDefinition = updateOptionInDefinition(definition, fieldKey, optionId, (option) => {
    updatedOption = { ...option, ...patch };
    return updatedOption;
  });
  if (!updatedOption) throw new Error("الخيار غير موجود.");

  const { error } = await admin.from("booking_forms").update({ definition: nextDefinition }).eq("id", formId);
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحديث الخيار."));

  await sbAudit(admin, "FORM_OPTION_UPDATED", "booking_form", formId, undefined, { fieldKey, optionId, patch });
  return updatedOption;
}

export type FormFieldMetaPatch = Partial<{
  showOptionImages: boolean;
  uploadMode: "single" | "multiple";
  maxFiles: number;
  required: boolean;
}>;

export async function sbUpdateFormFieldMeta(formId: string, fieldKey: string, patch: FormFieldMetaPatch) {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const definition = await fetchFormDefinitionOrThrow(admin, formId);

  let found = false;
  const nextDefinition: FormDefinition = {
    ...definition,
    sections: definition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        if (field.key !== fieldKey) return field;
        found = true;
        return { ...field, ...patch };
      })
    }))
  };
  if (!found) throw new Error("الحقل غير موجود.");

  const { error } = await admin.from("booking_forms").update({ definition: nextDefinition }).eq("id", formId);
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحديث إعدادات الحقل."));
  await sbAudit(admin, "FORM_FIELD_META_UPDATED", "booking_form", formId, undefined, { fieldKey, patch });
}

export async function sbDuplicateForm(formId: string): Promise<BookingFormRecord> {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const { data: form, error } = await admin.from("booking_forms").select("*").eq("id", formId).maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل النموذج."));
  if (!form) throw new Error("النموذج غير موجود.");

  const { data: created, error: insertError } = await admin
    .from("booking_forms")
    .insert({
      name: `${form.name} (نسخة)`,
      internal_description: form.internal_description,
      slug: `${form.slug}-copy-${Date.now().toString().slice(-4)}`,
      type: form.type,
      status: "draft",
      batch_id: form.batch_id,
      opening_date: form.opening_date,
      closing_date: form.closing_date,
      definition: form.definition
    })
    .select("*")
    .single();
  if (insertError || !created) throw new Error(pgErrorMessage(insertError, "تعذر تكرار النموذج."));

  return mapFormRow(created as BookingFormRow);
}

/* -------------------------------------------------------------------------------------------- */
/* IMAGE / DEFINITION RESOLUTION                                                                */
/* -------------------------------------------------------------------------------------------- */

export async function sbResolveOptionImageUrl(imagePath: string | undefined | null): Promise<string | undefined> {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("/") || /^https?:\/\//.test(imagePath)) return imagePath;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(FORM_OPTIONS_BUCKET)
    .createSignedUrl(imagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return undefined;
  return data.signedUrl;
}

async function resolveReferencePathMap(admin: SupabaseAdminClient, paths: string[]) {
  const unique = [...new Set(paths)];
  const entries = await Promise.all(
    unique.map(async (path) => {
      if (path.startsWith("/") || /^https?:\/\//.test(path)) return [path, path] as const;
      const { data } = await admin.storage.from(FORM_OPTIONS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      return [path, data?.signedUrl ?? ""] as const;
    })
  );
  return Object.fromEntries(entries.filter(([, url]) => url));
}

export async function sbGetPublicSubmissionByReceipt(token: string): Promise<SubmissionDetail | null> {
  const receipt = verifyBookingReceipt(token);
  if (!receipt) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("submissions")
    .select("*, form:booking_forms(*), batch:batches(*, representative:profiles!representative_id(full_name))")
    .eq("id", receipt.submissionId)
    .eq("booking_number", receipt.bookingNumber)
    .maybeSingle();
  if (error || !data) return null;
  return sbGetSubmissionDetail({ id: "public-receipt", role: "OWNER", fullName: "receipt" }, receipt.submissionId);
}

async function resolveOptionImages(option: FormOption): Promise<FormOption> {
  const [imageUrl, children] = await Promise.all([
    option.imagePath ? sbResolveOptionImageUrl(option.imagePath) : Promise.resolve(option.imageUrl),
    option.children?.length ? Promise.all(option.children.map(resolveOptionImages)) : Promise.resolve(option.children)
  ]);
  return { ...option, imageUrl, children };
}

export async function sbResolveDefinitionImages(definition: FormDefinition): Promise<FormDefinition> {
  const sections = await Promise.all(
    definition.sections.map(async (section) => ({
      ...section,
      fields: await Promise.all(
        section.fields.map(async (field) => {
          if (!field.options?.length) return field;
          const options = await Promise.all(field.options.map((option) => resolveOptionImages(option)));
          return { ...field, options };
        })
      )
    }))
  );
  return { ...definition, sections };
}

/* -------------------------------------------------------------------------------------------- */
/* STORAGE WRITES                                                                                */
/* -------------------------------------------------------------------------------------------- */

export type UploadFileInput = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

export async function sbUploadOptionImage(
  formId: string,
  fieldKey: string,
  optionId: string,
  file: UploadFileInput
): Promise<FormOption> {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const definition = await fetchFormDefinitionOrThrow(admin, formId);

  const extension = extensionFromNameOrMime(file.originalName, file.mimeType);
  const path = `${sanitizeStorageSegment(formId)}/${sanitizeStorageSegment(fieldKey)}/${sanitizeStorageSegment(optionId)}/reference.${extension}`;

  const { error: uploadError } = await admin.storage
    .from(FORM_OPTIONS_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimeType, upsert: true });
  if (uploadError) throw new Error(pgErrorMessage(uploadError, "تعذر رفع الصورة."));

  const imageUrl = await sbResolveOptionImageUrl(path);

  let updatedOption: FormOption | undefined;
  const nextDefinition = updateOptionInDefinition(definition, fieldKey, optionId, (option) => {
    updatedOption = { ...option, imagePath: path, imageUrl };
    return updatedOption;
  });
  if (!updatedOption) throw new Error("الخيار غير موجود.");

  const { error } = await admin.from("booking_forms").update({ definition: nextDefinition }).eq("id", formId);
  if (error) throw new Error(pgErrorMessage(error, "تعذر حفظ الصورة."));

  return updatedOption;
}

export async function sbDeleteOptionImage(formId: string, fieldKey: string, optionId: string): Promise<FormOption> {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const definition = await fetchFormDefinitionOrThrow(admin, formId);

  let previousPath: string | undefined;
  let updatedOption: FormOption | undefined;
  const nextDefinition = updateOptionInDefinition(definition, fieldKey, optionId, (option) => {
    previousPath = option.imagePath;
    updatedOption = { ...option, imagePath: undefined, imageUrl: undefined };
    return updatedOption;
  });
  if (!updatedOption) throw new Error("الخيار غير موجود.");

  if (previousPath) {
    await admin.storage.from(FORM_OPTIONS_BUCKET).remove([previousPath]).catch(() => undefined);
  }

  const { error } = await admin.from("booking_forms").update({ definition: nextDefinition }).eq("id", formId);
  if (error) throw new Error(pgErrorMessage(error, "تعذر حذف الصورة."));

  return updatedOption;
}

export async function sbUploadStudentDesign(
  session: VerifiedBookingSession,
  fieldKey: string,
  file: UploadFileInput
): Promise<UploadedFile> {
  if (!session.studentId) throw new Error("جلسة الحجز غير مكتملة.");
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();

  const extension = extensionFromNameOrMime(file.originalName, file.mimeType);
  const path = `${session.batchId ?? "individual"}/${session.studentId}/${sanitizeStorageSegment(fieldKey)}/${randomUUID()}.${extension}`;

  const { error } = await admin.storage
    .from(BOOKING_UPLOADS_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimeType, upsert: false });
  if (error) throw new Error(pgErrorMessage(error, "تعذر رفع الملف."));

  const previewUrl = await sbCreateBookingUploadSignedUrl(admin, path);

  return {
    path,
    previewUrl,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.buffer.byteLength
  };
}

async function definitionLooksEmpty(definition: unknown) {
  if (!definition || typeof definition !== "object") return true;
  const sections = (definition as FormDefinition).sections;
  return !Array.isArray(sections) || sections.length === 0;
}

async function ensureIndividualForm(admin: SupabaseAdminClient): Promise<{ id: string; slug: string; batch_id: string | null }> {
  const { data, error } = await admin
    .from("booking_forms")
    .select("id,slug,batch_id,definition")
    .eq("slug", INDIVIDUAL_FORM_SLUG)
    .maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل نموذج الحجز الفردي."));

  if (data) {
    if (await definitionLooksEmpty(data.definition)) {
      const { error: updateError } = await admin
        .from("booking_forms")
        .update({ definition: buildBatchDefaultDefinition(), type: "INDIVIDUAL", status: "published", updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (updateError) throw new Error(pgErrorMessage(updateError, "تعذر تجهيز نموذج الحجز الفردي."));
    }
    return { id: data.id, slug: data.slug, batch_id: data.batch_id ?? null };
  }

  const { data: inserted, error: insertError } = await admin
    .from("booking_forms")
    .insert({
      name: "حجز فردي WARKA",
      internal_description: "نموذج الحجوزات الفردية بدون دفعة.",
      slug: INDIVIDUAL_FORM_SLUG,
      type: "INDIVIDUAL",
      status: "published",
      batch_id: null,
      definition: buildBatchDefaultDefinition()
    })
    .select("id,slug,batch_id")
    .single();
  if (insertError || !inserted) throw new Error(pgErrorMessage(insertError, "تعذر إنشاء نموذج الحجز الفردي."));
  return { id: inserted.id, slug: inserted.slug, batch_id: inserted.batch_id ?? null };
}

async function sbLoadFixedOptions(
  admin: SupabaseAdminClient,
  formId: string,
  studentId?: string | null
): Promise<UniformSelectionMap> {
  const { data: formRows, error: formError } = await admin
    .from("fixed_option_config")
    .select("field_key,option_value")
    .eq("form_id", formId)
    .is("student_id", null);
  if (formError) throw new Error(pgErrorMessage(formError, "تعذر تحميل إعدادات الزي الموحد."));

  const map: UniformSelectionMap = {};
  for (const row of formRows ?? []) {
    map[row.field_key as keyof UniformSelectionMap] = row.option_value;
  }

  if (studentId) {
    const { data: studentRows, error: studentError } = await admin
      .from("fixed_option_config")
      .select("field_key,option_value")
      .eq("form_id", formId)
      .eq("student_id", studentId);
    if (studentError) throw new Error(pgErrorMessage(studentError, "تعذر تحميل إعدادات زي الطالب."));
    for (const row of studentRows ?? []) {
      map[row.field_key as keyof UniformSelectionMap] = row.option_value;
    }
  }
  return map;
}

async function sbReplaceFixedOptions(
  admin: SupabaseAdminClient,
  formId: string,
  studentId: string | null,
  map: UniformSelectionMap
) {
  let query = admin.from("fixed_option_config").delete().eq("form_id", formId);
  query = studentId ? query.eq("student_id", studentId) : query.is("student_id", null);
  const { error: deleteError } = await query;
  if (deleteError) throw new Error(pgErrorMessage(deleteError, "تعذر تحديث إعدادات الزي الموحد."));

  const rows = Object.entries(map)
    .filter(([, value]) => value)
    .map(([field_key, option_value]) => ({
      form_id: formId,
      student_id: studentId,
      field_key,
      option_value
    }));
  if (!rows.length) return;
  const { error: insertError } = await admin.from("fixed_option_config").insert(rows);
  if (insertError) throw new Error(pgErrorMessage(insertError, "تعذر حفظ إعدادات الزي الموحد."));
}

export async function sbGetFixedOptions(user: AppUser, formId: string, studentId?: string | null) {
  const admin = createAdminClient();
  const { data: form, error } = await admin.from("booking_forms").select("id,batch_id").eq("id", formId).maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل النموذج."));
  if (!form) throw new Error("النموذج غير موجود.");
  if (!form.batch_id && user.role !== "OWNER") throw new Error("غير مصرح.");
  await sbAssertBatchAccess(user, form.batch_id);
  return sbLoadFixedOptions(admin, formId, studentId);
}

export async function sbSaveFixedOptions(
  user: AppUser,
  input: { formId: string; studentId?: string | null; map: UniformSelectionMap }
) {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const { data: form, error } = await admin.from("booking_forms").select("id,batch_id").eq("id", input.formId).maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل النموذج."));
  if (!form) throw new Error("النموذج غير موجود.");

  if (input.studentId) {
    if (user.role !== "OWNER") throw new Error("غير مصرح بتعديل إعدادات الطلاب الفرديين.");
    const { data: student } = await admin.from("students").select("id,batch_id").eq("id", input.studentId).maybeSingle();
    if (!student) throw new Error("الطالب غير موجود.");
    if (student.batch_id && student.batch_id !== form.batch_id) throw new Error("الطالب لا ينتمي إلى هذا النموذج.");
  } else {
    if (!form.batch_id && user.role !== "OWNER") throw new Error("غير مصرح.");
    await sbAssertBatchAccess(user, form.batch_id);
  }

  await sbReplaceFixedOptions(admin, form.id, input.studentId ?? null, input.map);
  await sbAudit(admin, "UNIFORM_UPDATED", "booking_form", form.id, { id: user.id, label: user.fullName }, {
    student_id: input.studentId ?? null,
    keys: Object.keys(input.map)
  });
}

export async function sbGetStudentPrefill(studentId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("students").select("full_name,phone,address").eq("id", studentId).maybeSingle();
  return data as { full_name: string; phone: string | null; address: string | null } | null;
}

export async function sbGetEffectivePublicForm(slug: string, studentId?: string | null): Promise<BookingFormRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("booking_forms")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل النموذج."));
  if (!data) return null;
  const form = await resolveFormRowImages(data as BookingFormRow);
  const fixed = await sbLoadFixedOptions(admin, form.id, studentId);
  return { ...form, definition: applyUniformToDefinition(form.definition, fixed) };
}

export async function sbGetUniformTemplateDefinition(): Promise<FormDefinition> {
  const admin = createAdminClient();
  const form = await ensureIndividualForm(admin);
  const { data } = await admin.from("booking_forms").select("*").eq("id", form.id).maybeSingle();
  if (!data) return buildBatchDefaultDefinition();
  const resolved = await resolveFormRowImages(data as BookingFormRow);
  return resolved.definition;
}

export async function sbCreateIndividualStudent(
  user: AppUser,
  input: {
    full_name: string;
    phone?: string;
    address?: string;
    notes?: string;
    uniform?: UniformSelectionMap;
  }
): Promise<{ studentId: string; code: string; slug: string }> {
  if (user.role !== "OWNER") throw new Error("غير مصرح بإدارة الطلاب الفرديين.");
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const form = await ensureIndividualForm(admin);

  const { data: student, error } = await admin
    .from("students")
    .insert({
      batch_id: null,
      full_name: input.full_name,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null
    })
    .select("id")
    .single();
  if (error || !student) throw new Error(pgErrorMessage(error, "تعذر إنشاء الطالب الفردي."));

  const code = generateNumericCode();
  const { error: codeError } = await admin.from("student_access_codes").insert({
    student_id: student.id,
    batch_id: null,
    form_id: form.id,
    code_ciphertext: encryptAccessCode(code),
    code_fingerprint: accessCodeFingerprint(code, getAccessCodeFingerprintScope(form)),
    status: "ACTIVE"
  });
  if (codeError) throw new Error(pgErrorMessage(codeError, "تعذر إنشاء رمز الحجز."));

  if (input.uniform && Object.keys(input.uniform).length) {
    await sbReplaceFixedOptions(admin, form.id, student.id, input.uniform);
  }

  await sbAudit(admin, "INDIVIDUAL_STUDENT_CREATED", "student", student.id, { id: user.id, label: user.fullName }, {
    full_name: input.full_name
  });
  return { studentId: student.id, code, slug: form.slug };
}

export async function sbUpdateStudent(
  user: AppUser,
  studentId: string,
  input: { full_name: string; phone?: string; address?: string; notes?: string; uniform?: UniformSelectionMap }
) {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();
  const { data: student, error } = await admin
    .from("students")
    .select("id,batch_id")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل الطالب."));
  if (!student) throw new Error("الطالب غير موجود.");
  if (!student.batch_id && user.role !== "OWNER") throw new Error("غير مصرح بإدارة الطلاب الفرديين.");
  await sbAssertBatchAccess(user, student.batch_id);

  const { error: updateError } = await admin
    .from("students")
    .update({
      full_name: input.full_name,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("id", studentId);
  if (updateError) throw new Error(pgErrorMessage(updateError, "تعذر تحديث الطالب."));

  if (input.uniform && user.role === "OWNER" && !student.batch_id) {
    const form = await ensureIndividualForm(admin);
    await sbReplaceFixedOptions(admin, form.id, studentId, input.uniform);
  }
}

const STUDENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STUDENT_DELETE_IDS = 250;

export type DeleteStudentsResult = {
  deleted: number;
  deletedIds: string[];
  blocked: Array<{ id: string; name: string }>;
  rejected: number;
  message: string;
};

function formatDeleteStudentsMessage(result: Pick<DeleteStudentsResult, "deleted" | "blocked" | "rejected">): string {
  const parts: string[] = [];
  if (result.deleted) {
    parts.push(result.deleted === 1 ? "تم حذف طالب واحد." : `تم حذف ${result.deleted} طلاب.`);
  }
  if (result.blocked.length) {
    parts.push(
      result.blocked.length === 1
        ? "لا يمكن حذف هذا الطالب لوجود طلب مسجل. يمكن أرشفته بدلاً من ذلك."
        : `لم يُحذف ${result.blocked.length} طلاب لوجود طلب مسجل.`
    );
  }
  if (result.rejected) {
    parts.push("رُفضت بعض المعرّفات لأنها غير صالحة أو غير مصرح بها.");
  }
  if (!parts.length) return "لم يتم حذف أي طالب.";
  return parts.join(" ");
}

async function listStudentUploadPaths(
  admin: SupabaseAdminClient,
  batchId: string | null,
  studentId: string
): Promise<string[]> {
  const root = `${batchId ?? "individual"}/${studentId}`;
  const collected: string[] = [];

  async function walk(prefix: string) {
    const { data, error } = await admin.storage.from(BOOKING_UPLOADS_BUCKET).list(prefix, { limit: 1000 });
    if (error || !data?.length) return;
    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      if (item.id) collected.push(path);
      else await walk(path);
    }
  }

  await walk(root);
  return collected;
}

async function removeUnusedStudentUploads(
  admin: SupabaseAdminClient,
  batchId: string | null,
  studentId: string
) {
  const paths = await listStudentUploadPaths(admin, batchId, studentId);
  if (!paths.length) return;
  const chunks: string[][] = [];
  for (let i = 0; i < paths.length; i += 100) chunks.push(paths.slice(i, i + 100));
  for (const chunk of chunks) {
    await admin.storage.from(BOOKING_UPLOADS_BUCKET).remove(chunk).catch(() => undefined);
  }
}

export async function sbDeleteStudents(user: AppUser, studentIds: string[]): Promise<DeleteStudentsResult> {
  requireSupabaseSecretsForWrites();
  const admin = createAdminClient();

  const uniqueIds = Array.from(
    new Set(studentIds.map((id) => id.trim()).filter((id) => STUDENT_ID_RE.test(id)))
  ).slice(0, MAX_STUDENT_DELETE_IDS);
  const rejectedInvalid = studentIds.length - uniqueIds.length;

  if (!uniqueIds.length) {
    return {
      deleted: 0,
      deletedIds: [],
      blocked: [],
      rejected: Math.max(rejectedInvalid, studentIds.length),
      message: "لم يتم تحديد طلاب صالحين للحذف."
    };
  }

  const { data: rows, error } = await admin.from("students").select("id,batch_id,full_name").in("id", uniqueIds);
  if (error) throw new Error(pgErrorMessage(error, "تعذر تحميل الطلاب المحددين."));
  const students = (rows ?? []) as Array<{ id: string; batch_id: string | null; full_name: string }>;
  const foundIds = new Set(students.map((row) => row.id));
  let rejected = rejectedInvalid + uniqueIds.filter((id) => !foundIds.has(id)).length;

  const authorized: typeof students = [];
  for (const student of students) {
    if (await sbCanAccessBatchInternal(admin, user, student.batch_id)) {
      authorized.push(student);
    } else {
      rejected += 1;
    }
  }

  const authorizedIds = authorized.map((row) => row.id);
  const blocked: Array<{ id: string; name: string }> = [];
  const deletable: typeof authorized = [];

  if (authorizedIds.length) {
    const { data: submissions, error: submissionError } = await admin
      .from("submissions")
      .select("student_id")
      .in("student_id", authorizedIds);
    if (submissionError) throw new Error(pgErrorMessage(submissionError, "تعذر التحقق من طلبات الطلاب."));
    const withOrders = new Set(
      (submissions ?? [])
        .map((row: { student_id: string | null }) => row.student_id)
        .filter((id): id is string => Boolean(id))
    );
    for (const student of authorized) {
      if (withOrders.has(student.id)) blocked.push({ id: student.id, name: student.full_name });
      else deletable.push(student);
    }
  }

  const deletedIds: string[] = [];
  if (deletable.length) {
    for (const student of deletable) {
      await removeUnusedStudentUploads(admin, student.batch_id, student.id);
    }

    const deletableIds = deletable.map((row) => row.id);
    const { error: codesError } = await admin.from("student_access_codes").delete().in("student_id", deletableIds);
    if (codesError) throw new Error(pgErrorMessage(codesError, "تعذر حذف رموز الحجز غير المستخدمة."));

    const { error: deleteError } = await admin.from("students").delete().in("id", deletableIds);
    if (deleteError) throw new Error(pgErrorMessage(deleteError, "تعذر حذف الطلاب."));
    deletedIds.push(...deletableIds);

    await sbAudit(admin, "STUDENTS_DELETED", "student", deletedIds[0], { id: user.id, label: user.fullName }, {
      count: deletedIds.length,
      blocked: blocked.length,
      rejected,
      ids: deletedIds
    });
  }

  const result = {
    deleted: deletedIds.length,
    deletedIds,
    blocked,
    rejected,
    message: ""
  };
  result.message = formatDeleteStudentsMessage(result);
  return result;
}

/* -------------------------------------------------------------------------------------------- */
/* Re-exports for convenience                                                                    */
/* -------------------------------------------------------------------------------------------- */

export type { AuditLog, Representative, StatusHistory, SubmissionFile, SubmissionRecord };
export type { SupabaseClient };
