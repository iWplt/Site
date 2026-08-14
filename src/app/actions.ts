"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, requireUser, type AppUser } from "@/lib/auth";
import { previewExcelNames, previewPastedNames, analyzeWorkbook } from "@/lib/imports";
import {
  assertBatchAccess,
  audit,
  createAccessCode,
  createBatchRecord,
  mutateDb,
  nextBookingNumber,
  readDb,
  toStudentWithState
} from "@/lib/store/local-db";
import { accessCodeFingerprint, signBookingSession, verifyBookingSession } from "@/lib/security";
import { accessCodeSchema, submissionSchema, validateDynamicAnswers } from "@/lib/validation";
import { defaultWarkaFormDefinition } from "@/lib/form-definition";
import type { AccessCodeStatus, BatchStatus, FormStatus, OrderStatus } from "@/lib/types";
import { safeSlug } from "@/lib/utils";

const bookingCookie = "warka_booking_session";

function revalidateAdmin(batchId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/batches");
  revalidatePath("/admin/students");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/representatives");
  revalidatePath("/admin/import");
  revalidatePath("/admin/forms");
  revalidatePath("/admin/audit");
  if (batchId) {
    revalidatePath(`/admin/batches/${batchId}`);
    revalidatePath(`/admin/batches/${batchId}/students`);
    revalidatePath(`/admin/batches/${batchId}/orders`);
  }
}

export async function loginAction(_state: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const db = readDb();
  const profile = db.profiles.find((entry) => entry.email.toLowerCase() === email && !entry.disabled);
  if (!profile || profile.password !== password) {
    return { error: "بيانات الدخول غير صحيحة." };
  }

  const token = randomUUID();
  mutateDb((store) => {
    store.sessions = store.sessions.filter((session) => session.expires_at > Date.now());
    store.sessions.push({ token, user_id: profile.id, expires_at: Date.now() + 1000 * 60 * 60 * 12 });
    audit(store, "LOGIN", "profile", profile.id, { id: profile.id, label: profile.full_name });
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  redirect("/admin");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (token) {
    mutateDb((db) => {
      db.sessions = db.sessions.filter((session) => session.token !== token);
    });
  }
  cookieStore.delete(AUTH_COOKIE);
  redirect("/login");
}

export async function verifyAccessCodeAction(_state: { error?: string } | undefined, formData: FormData) {
  const parsed = accessCodeSchema.safeParse({
    slug: formData.get("slug"),
    code: formData.get("code")
  });
  if (!parsed.success) return { error: "رمز الحجز غير صحيح أو غير متاح." };

  const { slug, code } = parsed.data;
  const db = readDb();
  const form = db.forms.find((entry) => entry.slug === slug && entry.status === "published");
  if (!form) return { error: "رمز الحجز غير صحيح أو غير متاح." };

  const fingerprint = accessCodeFingerprint(code, form.batch_id ?? form.id);
  const accessCode = db.access_codes.find(
    (entry) => entry.form_id === form.id && entry.code_fingerprint === fingerprint
  );
  if (!accessCode) return { error: "رمز الحجز غير صحيح أو غير متاح." };
  if (accessCode.status === "USED") {
    return { error: "تم استخدام رمز الحجز مسبقاً وإرسال الطلب بنجاح." };
  }
  if (accessCode.status !== "ACTIVE") return { error: "رمز الحجز غير صحيح أو غير متاح." };

  const student = db.students.find((entry) => entry.id === accessCode.student_id);
  if (!student || student.batch_id !== accessCode.batch_id) {
    return { error: "رمز الحجز غير صحيح أو غير متاح." };
  }

  const existing = db.submissions.find(
    (entry) => entry.student_id === student.id && entry.form_id === form.id && entry.is_current
  );
  if (existing) return { error: "تم استخدام رمز الحجز مسبقاً وإرسال الطلب بنجاح." };

  const cookieStore = await cookies();
  cookieStore.set(
    bookingCookie,
    signBookingSession({
      formId: form.id,
      slug,
      formType: form.type,
      batchId: form.batch_id,
      accessCodeId: accessCode.id,
      studentId: student.id,
      studentName: student.full_name,
      expiresAt: Date.now() + 1000 * 60 * 45
    }),
    { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" }
  );
  redirect(`/f/${slug}/book`);
}

export async function submitBookingAction(input: unknown) {
  const cookieStore = await cookies();
  const session = verifyBookingSession(cookieStore.get(bookingCookie)?.value);
  if (!session) return { ok: false as const, error: "انتهت جلسة الحجز، يرجى إدخال الرمز مرة أخرى." };

  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success || parsed.data.slug !== session.slug) {
    return { ok: false as const, error: "بيانات الطلب غير صحيحة." };
  }

  try {
    const result = mutateDb((db) => {
      const form = db.forms.find((entry) => entry.id === session.formId && entry.slug === session.slug && entry.status === "published");
      if (!form) throw new Error("النموذج غير متاح حالياً.");

      const accessCode = db.access_codes.find((entry) => entry.id === session.accessCodeId);
      if (!accessCode || accessCode.status !== "ACTIVE" || accessCode.student_id !== session.studentId) {
        throw new Error("رمز الحجز غير صحيح أو غير متاح.");
      }

      const student = db.students.find((entry) => entry.id === session.studentId);
      if (!student) throw new Error("تعذر حفظ الحجز، يرجى المحاولة مرة أخرى.");

      const existing = db.submissions.find(
        (entry) => entry.student_id === student.id && entry.form_id === form.id && entry.is_current
      );
      if (existing) throw new Error("تم استخدام رمز الحجز مسبقاً وإرسال الطلب بنجاح.");

      const answers = { ...parsed.data.answers, student_name: student.full_name };
      const validation = validateDynamicAnswers(form.definition ?? defaultWarkaFormDefinition, answers);
      if (!validation.valid) {
        throw new Error("يرجى مراجعة الحقول المطلوبة.");
      }

      const bookingNumber = nextBookingNumber(db, session.batchId);
      const submissionId = randomUUID();
      const submittedAt = new Date().toISOString();

      db.submissions.unshift({
        id: submissionId,
        form_id: form.id,
        batch_id: session.batchId,
        student_id: student.id,
        access_code_id: accessCode.id,
        booking_number: bookingNumber,
        status: "SUBMITTED",
        is_current: true,
        answers,
        submitted_at: submittedAt
      });

      let sort = 0;
      for (const [fieldKey, files] of Object.entries(parsed.data.files ?? {})) {
        for (const file of files) {
          db.submission_files.push({
            id: randomUUID(),
            submission_id: submissionId,
            field_key: fieldKey,
            storage_path: file.path,
            original_filename: file.originalName,
            mime_type: file.mimeType,
            file_size: file.size,
            sort_order: sort++,
            preview_url: (file as { previewUrl?: string }).previewUrl,
            created_at: submittedAt
          });
        }
      }

      db.status_history.push({
        id: randomUUID(),
        submission_id: submissionId,
        old_status: undefined,
        new_status: "SUBMITTED",
        changed_at: submittedAt,
        notes: "تم استلام الحجز من النموذج العام"
      });

      accessCode.status = "USED";
      accessCode.updated_at = submittedAt;

      audit(db, "BOOKING_SUBMITTED", "submission", submissionId, { label: "public_student_access_code" }, {
        booking_number: bookingNumber,
        student_id: student.id,
        batch_id: session.batchId
      });

      return {
        bookingNumber,
        studentName: student.full_name,
        status: "SUBMITTED" as const,
        submittedAt,
        submissionId
      };
    });

    cookieStore.delete(bookingCookie);
    revalidateAdmin(session.batchId);
    return { ok: true as const, ...result };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "تعذر حفظ الحجز، يرجى المحاولة مرة أخرى."
    };
  }
}

export async function createBatchAction(_state: { error?: string; success?: boolean; batchId?: string } | undefined, formData: FormData) {
  const user = await requireUser(["OWNER"]);
  const name = String(formData.get("name") ?? "").trim();
  const university = String(formData.get("university") ?? "").trim();
  const college = String(formData.get("college") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const stage = String(formData.get("stage") ?? "").trim();
  const graduationYear = Number(formData.get("graduation_year"));
  const description = String(formData.get("description") ?? "").trim();
  const representativeId = String(formData.get("representative_id") ?? "").trim() || undefined;
  const status = (String(formData.get("status") ?? "active") as BatchStatus) || "active";

  if (!name || !university || !college || !department || !stage || !graduationYear) {
    return { error: "يرجى تعبئة جميع الحقول المطلوبة." };
  }

  try {
    const batch = mutateDb((db) =>
      createBatchRecord(
        db,
        {
          name,
          university,
          college,
          department,
          stage,
          graduation_year: graduationYear,
          description: description || undefined,
          representative_id: representativeId,
          status
        },
        user.id
      )
    );
    revalidateAdmin(batch.id);
    redirect(`/admin/batches/${batch.id}?created=1`);
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { error: error instanceof Error ? error.message : "تعذر إنشاء الدفعة." };
  }
}

export async function createRepresentativeAction(_state: { error?: string } | undefined, formData: FormData) {
  await requireUser(["OWNER"]);
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim() || "rep123";
  const batchIds = formData.getAll("batch_ids").map(String);

  if (!fullName || !email) return { error: "الاسم والبريد مطلوبان." };

  try {
    mutateDb((db) => {
      if (db.profiles.some((profile) => profile.email.toLowerCase() === email)) {
        throw new Error("البريد مستخدم مسبقاً.");
      }
      const id = randomUUID();
      const created = new Date().toISOString();
      db.profiles.push({
        id,
        full_name: fullName,
        phone,
        email,
        password,
        role: "REPRESENTATIVE",
        disabled: false,
        batch_ids: batchIds,
        created_at: created,
        updated_at: created
      });
      for (const batchId of batchIds) {
        const batch = db.batches.find((entry) => entry.id === batchId);
        if (batch) {
          batch.representative_id = id;
          batch.representative_name = fullName;
          batch.updated_at = created;
        }
      }
      audit(db, "REPRESENTATIVE_CREATED", "profile", id, { label: "owner" }, { email, batchIds });
    });
    revalidateAdmin();
    redirect("/admin/representatives");
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { error: error instanceof Error ? error.message : "تعذر إنشاء الممثل." };
  }
}

export async function toggleRepresentativeAction(representativeId: string, disabled: boolean) {
  await requireUser(["OWNER"]);
  mutateDb((db) => {
    const profile = db.profiles.find((entry) => entry.id === representativeId && entry.role === "REPRESENTATIVE");
    if (!profile) throw new Error("الممثل غير موجود.");
    profile.disabled = disabled;
    profile.updated_at = new Date().toISOString();
    audit(db, disabled ? "REPRESENTATIVE_DISABLED" : "REPRESENTATIVE_ENABLED", "profile", representativeId, { label: "owner" });
  });
  revalidateAdmin();
}

export async function assignRepresentativeBatchesAction(representativeId: string, batchIds: string[]) {
  await requireUser(["OWNER"]);
  mutateDb((db) => {
    const profile = db.profiles.find((entry) => entry.id === representativeId && entry.role === "REPRESENTATIVE");
    if (!profile) throw new Error("الممثل غير موجود.");
    profile.batch_ids = batchIds;
    profile.updated_at = new Date().toISOString();
    for (const batch of db.batches) {
      if (batch.representative_id === representativeId && !batchIds.includes(batch.id)) {
        batch.representative_id = undefined;
        batch.representative_name = undefined;
      }
    }
    for (const batchId of batchIds) {
      const batch = db.batches.find((entry) => entry.id === batchId);
      if (batch) {
        batch.representative_id = representativeId;
        batch.representative_name = profile.full_name;
      }
    }
    audit(db, "REPRESENTATIVE_BATCHES_UPDATED", "profile", representativeId, { label: "owner" }, { batchIds });
  });
  revalidateAdmin();
}

export async function importStudentsAction(batchId: string, names: string[]) {
  const user = await requireUser();
  const cleaned = names.map((name) => name.replace(/\s+/g, " ").trim()).filter((name) => name.length >= 3);
  if (!cleaned.length) return { error: "لا توجد أسماء صالحة للاستيراد." };

  try {
    mutateDb((db) => {
      assertBatchAccess(db, user, batchId);
      const form = db.forms.find((entry) => entry.batch_id === batchId);
      const existing = new Set(
        db.students.filter((student) => student.batch_id === batchId).map((student) => student.full_name)
      );
      for (const fullName of cleaned) {
        if (existing.has(fullName)) continue;
        const studentId = randomUUID();
        const created = new Date().toISOString();
        db.students.push({
          id: studentId,
          batch_id: batchId,
          full_name: fullName,
          created_at: created,
          updated_at: created
        });
        if (form) createAccessCode(db, studentId, batchId, form.id);
        existing.add(fullName);
      }
      audit(db, "STUDENTS_IMPORTED", "batch", batchId, { id: user.id, label: user.fullName }, { count: cleaned.length });
    });
    revalidateAdmin(batchId);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر استيراد الطلاب." };
  }
}

export async function previewPasteAction(text: string, batchId: string) {
  const user = await requireUser();
  const db = readDb();
  assertBatchAccess(db, user, batchId);
  const existing = db.students.filter((student) => student.batch_id === batchId).map((student) => student.full_name);
  return previewPastedNames(text, existing);
}

export async function analyzeExcelAction(formData: FormData) {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "يرجى اختيار ملف Excel." };
  return analyzeWorkbook(file);
}

export async function importExcelColumnAction(batchId: string, rows: Record<string, unknown>[], columnKey: string) {
  const preview = previewExcelNames(rows, columnKey);
  const names = preview.filter((row) => row.valid).map((row) => row.normalizedName);
  return importStudentsAction(batchId, names);
}

export async function regenerateStudentCodeAction(studentId: string) {
  const user = await requireUser();
  const code = mutateDb((db) => {
    const student = db.students.find((entry) => entry.id === studentId);
    if (!student) throw new Error("الطالب غير موجود.");
    assertBatchAccess(db, user, student.batch_id);
    const form = db.forms.find((entry) => entry.batch_id === student.batch_id);
    if (!form) throw new Error("لا يوجد نموذج مرتبط بهذه الدفعة.");
    for (const accessCode of db.access_codes) {
      if (accessCode.student_id === studentId && accessCode.status === "ACTIVE") {
        accessCode.status = "DISABLED";
        accessCode.updated_at = new Date().toISOString();
      }
    }
    const created = createAccessCode(db, studentId, student.batch_id, form.id, "ACTIVE");
    audit(db, "ACCESS_CODE_REGENERATED", "student_access_code", created.id, { id: user.id, label: user.fullName }, {
      student_id: studentId
    });
    return created.code;
  });
  revalidateAdmin();
  return { code };
}

export async function setAccessCodeStatusAction(studentId: string, status: AccessCodeStatus) {
  const user = await requireUser();
  mutateDb((db) => {
    const student = db.students.find((entry) => entry.id === studentId);
    if (!student) throw new Error("الطالب غير موجود.");
    assertBatchAccess(db, user, student.batch_id);
    const code = [...db.access_codes]
      .filter((entry) => entry.student_id === studentId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!code) throw new Error("لا يوجد رمز لهذا الطالب.");
    if (status === "ACTIVE" && code.status === "USED") {
      throw new Error("لا يمكن إعادة تفعيل رمز مستخدم إلا عبر إعادة فتح الطلب.");
    }
    code.status = status;
    code.updated_at = new Date().toISOString();
    audit(db, "ACCESS_CODE_STATUS_CHANGED", "student_access_code", code.id, { id: user.id, label: user.fullName }, { status });
  });
  revalidateAdmin();
}

export async function reopenSubmissionAction(submissionId: string) {
  const user = await requireUser(["OWNER"]);
  mutateDb((db) => {
    const submission = db.submissions.find((entry) => entry.id === submissionId);
    if (!submission) throw new Error("الطلب غير موجود.");
    submission.is_current = false;
    const student = db.students.find((entry) => entry.id === submission.student_id);
    if (!student) throw new Error("الطالب غير موجود.");
    const form = db.forms.find((entry) => entry.id === submission.form_id);
    if (!form) throw new Error("النموذج غير موجود.");
    for (const code of db.access_codes) {
      if (code.student_id === student.id && code.status === "ACTIVE") code.status = "DISABLED";
    }
    const created = createAccessCode(db, student.id, student.batch_id, form.id, "ACTIVE");
    db.status_history.push({
      id: randomUUID(),
      submission_id: submission.id,
      old_status: submission.status,
      new_status: "CANCELLED",
      changed_by: user.id,
      changed_at: new Date().toISOString(),
      notes: "تمت إعادة فتح الطلب من المالك"
    });
    audit(db, "SUBMISSION_REOPENED", "submission", submission.id, { id: user.id, label: user.fullName }, {
      new_code_id: created.id
    });
  });
  revalidateAdmin();
}

export async function updateOrderStatusAction(submissionId: string, status: OrderStatus, notes?: string) {
  const user = await requireUser();
  mutateDb((db) => {
    const submission = db.submissions.find((entry) => entry.id === submissionId);
    if (!submission) throw new Error("الطلب غير موجود.");
    if (submission.batch_id) assertBatchAccess(db, user, submission.batch_id);
    if (user.role === "REPRESENTATIVE" && !["REVIEWED", "CONFIRMED"].includes(status)) {
      throw new Error("غير مصرح بتغيير الحالة إلى هذه القيمة.");
    }
    const old = submission.status;
    submission.status = status;
    db.status_history.push({
      id: randomUUID(),
      submission_id: submissionId,
      old_status: old,
      new_status: status,
      changed_by: user.id,
      changed_at: new Date().toISOString(),
      notes
    });
    audit(db, "ORDER_STATUS_CHANGED", "submission", submissionId, { id: user.id, label: user.fullName }, { status });
  });
  revalidateAdmin();
}

export async function createFormAction(_state: { error?: string } | undefined, formData: FormData) {
  const user = await requireUser(["OWNER"]);
  const name = String(formData.get("name") ?? "").trim();
  const slug = safeSlug(String(formData.get("slug") ?? name));
  const type = String(formData.get("type") ?? "BATCH") as "BATCH" | "INDIVIDUAL";
  const batchId = String(formData.get("batch_id") ?? "").trim() || undefined;
  const description = String(formData.get("internal_description") ?? "").trim();
  if (!name || !slug) return { error: "اسم النموذج والرابط مطلوبان." };

  try {
    mutateDb((db) => {
      if (db.forms.some((form) => form.slug === slug)) throw new Error("الرابط مستخدم مسبقاً.");
      db.forms.unshift({
        id: randomUUID(),
        name,
        slug,
        type,
        batch_id: batchId,
        internal_description: description,
        status: "draft",
        definition: defaultWarkaFormDefinition
      });
      audit(db, "FORM_CREATED", "booking_form", undefined, { id: user.id, label: user.fullName }, { slug });
    });
    revalidateAdmin(batchId);
    redirect("/admin/forms");
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { error: error instanceof Error ? error.message : "تعذر إنشاء النموذج." };
  }
}

export async function setFormStatusAction(formId: string, status: FormStatus) {
  await requireUser(["OWNER"]);
  mutateDb((db) => {
    const form = db.forms.find((entry) => entry.id === formId);
    if (!form) throw new Error("النموذج غير موجود.");
    form.status = status;
    audit(db, "FORM_STATUS_CHANGED", "booking_form", formId, { label: "owner" }, { status });
  });
  revalidateAdmin();
}

export async function duplicateFormAction(formId: string) {
  await requireUser(["OWNER"]);
  mutateDb((db) => {
    const form = db.forms.find((entry) => entry.id === formId);
    if (!form) throw new Error("النموذج غير موجود.");
    db.forms.unshift({
      ...form,
      id: randomUUID(),
      name: `${form.name} (نسخة)`,
      slug: `${form.slug}-copy-${Date.now().toString().slice(-4)}`,
      status: "draft"
    });
  });
  revalidateAdmin();
}

export async function getStudentCardAction(studentId: string) {
  const user = await requireUser();
  const db = readDb();
  const student = db.students.find((entry) => entry.id === studentId);
  if (!student) throw new Error("الطالب غير موجود.");
  assertBatchAccess(db, user, student.batch_id);
  return toStudentWithState(db, studentId);
}

export async function ensureDevOwnerSession() {
  // Used by login page helper buttons in local mode.
  return {
    owner: { email: "owner@warka.local", password: "owner123" },
    repA: { email: "rep.cyber@warka.local", password: "rep123" },
    repB: { email: "rep.dental@warka.local", password: "rep123" }
  };
}

export type { AppUser };
