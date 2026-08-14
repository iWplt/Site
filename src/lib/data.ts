import "server-only";

import type { AppUser } from "@/lib/auth";
import { canAccessBatch } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { defaultWarkaFormDefinition } from "@/lib/form-definition";
import {
  getBatchStats,
  readDb,
  toStudentWithState,
  type Representative,
  type SubmissionFile,
  type SubmissionRecord
} from "@/lib/store/local-db";
import type { Batch, BatchStats, BookingFormRecord, StudentWithState, SubmissionSummary } from "@/lib/types";

export type BatchWithStats = Batch & { stats: BatchStats; form?: BookingFormRecord | null };

function ensureLocal() {
  if (hasSupabaseConfig()) {
    throw new Error("Supabase mode is configured; use Supabase data adapters.");
  }
  return readDb();
}

export async function listBatches(user: AppUser): Promise<BatchWithStats[]> {
  const db = ensureLocal();
  const batches = db.batches.filter((batch) => {
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
  options?: { batchId?: string; search?: string }
): Promise<StudentWithState[]> {
  const db = ensureLocal();
  let students = db.students;

  if (options?.batchId) {
    if (!(await canAccessBatch(user, options.batchId))) return [];
    students = students.filter((student) => student.batch_id === options.batchId);
  } else if (user.role === "REPRESENTATIVE") {
    const allowed = new Set(db.profiles.find((profile) => profile.id === user.id)?.batch_ids ?? []);
    students = students.filter((student) => allowed.has(student.batch_id));
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

export async function listForms(user: AppUser): Promise<BookingFormRecord[]> {
  const db = ensureLocal();
  return db.forms
    .filter((form) => {
      if (user.role === "OWNER") return true;
      if (!form.batch_id) return form.status === "published";
      return db.profiles.find((profile) => profile.id === user.id)?.batch_ids.includes(form.batch_id);
    })
    .map((form) => ({
      ...form,
      definition: form.definition ?? defaultWarkaFormDefinition
    }));
}

export async function getPublicForm(slug: string): Promise<BookingFormRecord | null> {
  const db = ensureLocal();
  const form = db.forms.find((entry) => entry.slug === slug && entry.status === "published");
  if (!form) return null;
  return { ...form, definition: form.definition ?? defaultWarkaFormDefinition };
}

export async function listSubmissions(
  user: AppUser,
  options?: { batchId?: string }
): Promise<SubmissionSummary[]> {
  const db = ensureLocal();
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

export async function getSubmissionDetail(user: AppUser, submissionId: string) {
  const db = ensureLocal();
  const submission = db.submissions.find((entry) => entry.id === submissionId);
  if (!submission) return null;
  if (submission.batch_id && !(await canAccessBatch(user, submission.batch_id))) return null;
  const student = submission.student_id ? toStudentWithState(db, submission.student_id) : null;
  const form = db.forms.find((entry) => entry.id === submission.form_id) ?? null;
  const batch = submission.batch_id ? db.batches.find((entry) => entry.id === submission.batch_id) ?? null : null;
  const files = db.submission_files.filter((file) => file.submission_id === submission.id);
  const history = db.status_history.filter((entry) => entry.submission_id === submission.id);
  return { submission, student, form, batch, files, history };
}

export async function listRepresentatives(): Promise<Representative[]> {
  const db = ensureLocal();
  return db.profiles.filter((profile) => profile.role === "REPRESENTATIVE");
}

export async function listAuditLogs() {
  const db = ensureLocal();
  return db.audit_logs.slice(0, 100);
}

export async function getDashboardMetrics(user: AppUser) {
  const batches = await listBatches(user);
  const students = await listStudents(user);
  const submissions = await listSubmissions(user);
  return {
    activeBatches: batches.filter((batch) => batch.status === "active").length,
    totalStudents: students.length,
    submittedOrders: submissions.length,
    pendingStudents: students.filter((student) => student.submission_status !== "submitted").length,
    inProduction: submissions.filter((submission) => submission.status === "IN_PRODUCTION").length,
    ready: submissions.filter((submission) => submission.status === "READY").length
  };
}

export type { SubmissionFile, SubmissionRecord };
