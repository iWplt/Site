import "server-only";

import type { AppUser } from "@/lib/auth";
import { canAccessBatch } from "@/lib/auth";
import { defaultWarkaFormDefinition } from "@/lib/form-definition";
import { normalizeLiveFormDefinition } from "@/lib/form-live";
import { assertPersistenceAllowed, getPersistenceMode } from "@/lib/persistence";
import {
  getBatchStats,
  readDb,
  toStudentWithState,
  type Representative,
  type SubmissionFile,
  type SubmissionRecord
} from "@/lib/store/local-db";
import {
  sbGetAdminForm,
  sbGetBatch,
  sbGetDashboardMetrics,
  sbGetEffectivePublicForm,
  sbGetFixedOptions,
  sbGetPublicForm,
  sbGetPublicSubmissionByReceipt,
  sbGetStudentCard,
  sbGetStudentPrefill,
  sbGetSubmissionDetail,
  sbGetUniformTemplateDefinition,
  sbListAuditLogs,
  sbListBatches,
  sbListFormSummaries,
  sbListForms,
  sbListRepresentatives,
  sbListStudents,
  sbListSubmissions,
  type SubmissionDetail
} from "@/lib/store/supabase-db";
import { withCatalogDefinition } from "@/lib/store/catalog-store";
import type { Batch, BatchStats, BookingFormRecord, FormSummary, StudentWithState, SubmissionSummary } from "@/lib/types";
import { toFormSummary } from "@/lib/form-summary";

export type BatchWithStats = Batch & { stats: BatchStats; form?: BookingFormRecord | null };

function ensureLocal() {
  const mode = assertPersistenceAllowed();
  if (mode === "supabase") {
    throw new Error("Internal error: local DB accessed while Supabase mode is active.");
  }
  return readDb();
}

export function getActivePersistenceMode() {
  return assertPersistenceAllowed();
}

export async function listBatches(user: AppUser, options?: { archived?: boolean }): Promise<BatchWithStats[]> {
  if (assertPersistenceAllowed() === "supabase") return sbListBatches(user, options);

  const db = ensureLocal();
  const batches = db.batches.filter((batch) => {
    if (Boolean(options?.archived) !== (batch.status === "archived")) return false;
    if (user.role === "OWNER") return true;
    return db.profiles.find((profile) => profile.id === user.id)?.batch_ids.includes(batch.id);
  });
  return batches.map((batch) => ({
    ...batch,
    stats: getBatchStats(db, batch.id),
    form: db.forms.find((form) => form.batch_id === batch.id) ?? null
  }));
}

export async function getBatch(user: AppUser, batchId: string): Promise<BatchWithStats | null> {
  if (assertPersistenceAllowed() === "supabase") return sbGetBatch(user, batchId);

  const db = ensureLocal();
  if (!(await canAccessBatch(user, batchId))) return null;
  const batch = db.batches.find((entry) => entry.id === batchId);
  if (!batch) return null;
  return {
    ...batch,
    stats: getBatchStats(db, batch.id),
    form: db.forms.find((form) => form.batch_id === batch.id) ?? null
  };
}

export async function listStudents(
  user: AppUser,
  options?: { batchId?: string; search?: string; unbatchedOnly?: boolean; limit?: number }
): Promise<StudentWithState[]> {
  if (assertPersistenceAllowed() === "supabase") return sbListStudents(user, options);

  const db = ensureLocal();
  let students = db.students;

  if (options?.batchId) {
    if (!(await canAccessBatch(user, options.batchId))) return [];
    students = students.filter((student) => student.batch_id === options.batchId);
  } else if (user.role === "REPRESENTATIVE") {
    const allowed = new Set(db.profiles.find((profile) => profile.id === user.id)?.batch_ids ?? []);
    students = students.filter((student) => student.batch_id && allowed.has(student.batch_id));
  }

  const mapped = students
    .map((student) => toStudentWithState(db, student.id))
    .filter((student): student is StudentWithState => Boolean(student));

  const needle = options?.search?.trim();
  if (!needle) return mapped;

  return mapped.filter((student) =>
    [student.full_name, student.phone, student.code, student.booking_number, student.batch?.name]
      .filter(Boolean)
      .some((value) => String(value).includes(needle))
  );
}

export async function listFormSummaries(user: AppUser, options?: { archived?: boolean }): Promise<FormSummary[]> {
  if (assertPersistenceAllowed() === "supabase") return sbListFormSummaries(user, options);

  const db = ensureLocal();
  return db.forms
    .filter((form) => {
      if (Boolean(options?.archived) !== (form.status === "archived")) return false;
      if (user.role === "OWNER") return true;
      if (!form.batch_id) return false;
      return db.profiles.find((profile) => profile.id === user.id)?.batch_ids.includes(form.batch_id);
    })
    .map((form) =>
      toFormSummary(form, form.batch_id ? db.batches.find((batch) => batch.id === form.batch_id)?.name : undefined)
    );
}

export async function getAdminForm(
  user: AppUser,
  formId: string,
  options?: { resolveImages?: boolean }
): Promise<BookingFormRecord | null> {
  if (assertPersistenceAllowed() === "supabase") return sbGetAdminForm(user, formId, options);

  const db = ensureLocal();
  const form = db.forms.find((entry) => entry.id === formId);
  if (!form) return null;
  if (user.role !== "OWNER") {
    if (!form.batch_id) return null;
    if (!(await canAccessBatch(user, form.batch_id))) return null;
  }
  return {
    ...form,
    definition: normalizeLiveFormDefinition(form.definition ?? defaultWarkaFormDefinition)
  };
}

export async function listForms(user: AppUser): Promise<BookingFormRecord[]> {
  if (assertPersistenceAllowed() === "supabase") return sbListForms(user);

  const db = ensureLocal();
  return db.forms
    .filter((form) => {
      if (user.role === "OWNER") return true;
      if (!form.batch_id) return form.status === "published";
      return db.profiles.find((profile) => profile.id === user.id)?.batch_ids.includes(form.batch_id);
    })
    .map((form) => ({
      ...form,
      definition: normalizeLiveFormDefinition(form.definition ?? defaultWarkaFormDefinition)
    }));
}

export async function getPublicForm(slug: string, options?: { resolveImages?: boolean }): Promise<BookingFormRecord | null> {
  if (assertPersistenceAllowed() === "supabase") return sbGetPublicForm(slug, options);

  const db = ensureLocal();
  const form = db.forms.find((entry) => entry.slug === slug && entry.status === "published");
  if (!form) return null;
  return {
    ...form,
    definition: normalizeLiveFormDefinition(form.definition ?? defaultWarkaFormDefinition)
  };
}

export async function getEffectivePublicForm(slug: string, studentId?: string | null): Promise<BookingFormRecord | null> {
  if (assertPersistenceAllowed() === "supabase") return sbGetEffectivePublicForm(slug, studentId);
  const form = await getPublicForm(slug);
  if (!form) return null;
  return withCatalogDefinition(form);
}

export async function getUniformTemplateDefinition() {
  if (assertPersistenceAllowed() === "supabase") return sbGetUniformTemplateDefinition();
  return defaultWarkaFormDefinition;
}

export async function getFixedOptions(user: AppUser, formId: string, studentId?: string | null) {
  if (assertPersistenceAllowed() === "supabase") return sbGetFixedOptions(user, formId, studentId);
  return {};
}

export async function getBookingStudentPrefill(studentId: string) {
  if (assertPersistenceAllowed() === "supabase") return sbGetStudentPrefill(studentId);
  const db = ensureLocal();
  const student = db.students.find((entry) => entry.id === studentId);
  return student ? { full_name: student.full_name, phone: student.phone ?? null, address: null } : null;
}

export async function getStudentCard(user: AppUser, studentId: string) {
  if (assertPersistenceAllowed() === "supabase") return sbGetStudentCard(user, studentId);
  const db = ensureLocal();
  return toStudentWithState(db, studentId);
}

export async function listSubmissions(
  user: AppUser,
  options?: { batchId?: string; individualOnly?: boolean; limit?: number }
): Promise<SubmissionSummary[]> {
  if (assertPersistenceAllowed() === "supabase") return sbListSubmissions(user, options);

  const db = ensureLocal();
      if (options?.individualOnly) {
        if (user.role !== "OWNER") return [];
        return db.submissions
          .filter((submission) => !submission.batch_id)
          .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
          .map((submission) => {
            const student = db.students.find((entry) => entry.id === submission.student_id);
            const form = db.forms.find((entry) => entry.id === submission.form_id);
            return {
              id: submission.id,
              booking_number: submission.booking_number,
              student_name: student?.full_name ?? String(submission.answers.student_name ?? "عميل"),
              form_name: form?.name ?? "نموذج",
              batch_name: undefined,
              status: submission.status,
              submitted_at: submission.submitted_at
            };
          });
      }
      return db.submissions
    .filter((submission) => {
      if (options?.batchId && submission.batch_id !== options.batchId) return false;
      if (user.role === "OWNER") return true;
      if (!submission.batch_id) return false;
      return db.profiles.find((profile) => profile.id === user.id)?.batch_ids.includes(submission.batch_id);
    })
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
    .map((submission) => {
      const student = db.students.find((entry) => entry.id === submission.student_id);
      const form = db.forms.find((entry) => entry.id === submission.form_id);
      const batch = db.batches.find((entry) => entry.id === submission.batch_id);
      return {
        id: submission.id,
        booking_number: submission.booking_number,
        student_name: student?.full_name ?? String(submission.answers.student_name ?? "عميل"),
        form_name: form?.name ?? "نموذج",
        batch_name: batch?.name,
        status: submission.status,
        submitted_at: submission.submitted_at
      };
    });
}

export async function getSubmissionDetail(user: AppUser, submissionId: string): Promise<SubmissionDetail | null> {
  if (assertPersistenceAllowed() === "supabase") return sbGetSubmissionDetail(user, submissionId);

  const db = ensureLocal();
  const submission = db.submissions.find((entry) => entry.id === submissionId);
  if (!submission) return null;
  if (submission.batch_id && !(await canAccessBatch(user, submission.batch_id))) return null;
  const student = submission.student_id ? toStudentWithState(db, submission.student_id) : null;
  const form = db.forms.find((entry) => entry.id === submission.form_id) ?? null;
  const batch = submission.batch_id ? db.batches.find((entry) => entry.id === submission.batch_id) ?? null : null;
  const files = db.submission_files.filter((file) => file.submission_id === submission.id);
  const history = db.status_history.filter((entry) => entry.submission_id === submission.id);
  return { submission, student, form, batch, files, history, referenceImageUrls: {} };
}

export async function getPublicSubmissionByReceipt(token: string): Promise<SubmissionDetail | null> {
  if (assertPersistenceAllowed() === "supabase") return sbGetPublicSubmissionByReceipt(token);

  const receipt = (await import("@/lib/booking-receipt")).verifyBookingReceipt(token);
  if (!receipt) return null;
  const db = ensureLocal();
  const submission = db.submissions.find(
    (entry) => entry.id === receipt.submissionId && entry.booking_number === receipt.bookingNumber
  );
  if (!submission) return null;
  const student = submission.student_id ? toStudentWithState(db, submission.student_id) : null;
  const form = db.forms.find((entry) => entry.id === submission.form_id) ?? null;
  const batch = submission.batch_id ? db.batches.find((entry) => entry.id === submission.batch_id) ?? null : null;
  const files = db.submission_files.filter((file) => file.submission_id === submission.id);
  const history = db.status_history.filter((entry) => entry.submission_id === submission.id);
  return { submission, student, form, batch, files, history, referenceImageUrls: {} };
}

export async function listRepresentatives(): Promise<Representative[]> {
  if (assertPersistenceAllowed() === "supabase") return sbListRepresentatives();
  const db = ensureLocal();
  return db.profiles.filter((profile) => profile.role === "REPRESENTATIVE");
}

export async function listAuditLogs() {
  if (assertPersistenceAllowed() === "supabase") return sbListAuditLogs();
  const db = ensureLocal();
  return db.audit_logs.slice(0, 100);
}

export async function getDashboardMetrics(user: AppUser) {
  if (assertPersistenceAllowed() === "supabase") return sbGetDashboardMetrics(user);
  const batches = await listBatches(user);
  const students = await listStudents(user);
  const submissions = await listSubmissions(user);
  return {
    activeBatches: batches.filter((batch) => batch.status === "active").length,
    totalStudents: students.length,
    submittedOrders: submissions.length,
    pendingStudents: students.filter((student) => student.submission_status !== "submitted").length,
    todayOrders: 0,
    reviewed: submissions.filter((submission) => submission.status === "REVIEWED").length,
    confirmed: submissions.filter((submission) => submission.status === "CONFIRMED").length,
    inProduction: submissions.filter((submission) => submission.status === "IN_PRODUCTION").length,
    ready: submissions.filter((submission) => submission.status === "READY").length,
    delivered: submissions.filter((submission) => submission.status === "DELIVERED").length
  };
}

export type { SubmissionFile, SubmissionRecord, SubmissionDetail };
export { getPersistenceMode };
