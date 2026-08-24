"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, getCurrentUser, requireUser, type AppUser } from "@/lib/auth";
import { previewPastedNames, analyzeWorkbook } from "@/lib/imports";
import {
  assertBatchAccess,
  audit,
  createAccessCode,
  createBatchRecord,
  deleteStudentRecords,
  mutateDb,
  nextBookingNumber,
  readDb,
  toStudentWithState,
  type CreateBatchInput,
  type LocalDatabase
} from "@/lib/store/local-db";
import { accessCodeFingerprint, signBookingSession, verifyBookingSession } from "@/lib/security";
import { getAccessCodeFingerprintScope } from "@/lib/access-code-scope";
import { signBookingReceipt } from "@/lib/booking-receipt";
import { answersWithSnapshot, buildOrderSnapshot } from "@/lib/order-snapshot";
import { accessCodeSchema, submissionSchema, validateDynamicAnswers } from "@/lib/validation";
import { defaultWarkaFormDefinition } from "@/lib/form-definition";
import { mergeCatalogIntoDefinition, filterAvailableProducts } from "@/lib/product-catalog";
import { applyOutfitArchitecture, CORE_PRODUCT_IDS, normalizeCatalogAssignment, resolveOutfitAnswers, sanitizeOutfitConfig } from "@/lib/outfit-architecture";
import { applyCopiedFormConfig, catalogProductIdsFromDefinition, type CopyFormSlices } from "@/lib/form-config";
import { getAdminForm } from "@/lib/data";
import { normalizeFormCustomizationGrouping } from "@/lib/form-customization";
import { assertPersistenceAllowed, type PersistenceMode } from "@/lib/persistence";
import { deleteOptionImage, deleteOutfitAssetFile, storeOptionImage, storeOutfitAsset } from "@/lib/storage/uploads";
import {
  sbAssertBatchAccess,
  sbAssignRepresentativeBatches,
  sbCreateBatch,
  sbCreateForm,
  sbCreateIndividualStudent,
  sbCreateOwner,
  sbCreateRepresentative,
  sbDeleteStudents,
  sbDuplicateForm,
  sbExportBatchStudentsCsv,
  sbGetStudentCard,
  sbImportStudents,
  sbListStudents,
  sbLogin,
  sbLogout,
  sbRegenerateStudentCode,
  sbReopenSubmission,
  sbSaveFixedOptions,
  sbSetAccessCodeStatus,
  sbSetFormStatus,
  sbSetBatchStatus,
  sbSubmitBooking,
  sbToggleRepresentative,
  sbUpdateFormFieldMeta,
  sbUpdateFormGeneral,
  sbUpdateFormOption,
  sbUpdateFormOutfitConfig,
  sbPatchOutfitImage,
  sbPatchFormCatalogAssignment,
  sbAddFormOption,
  sbReplaceFormDefinition,
  sbGetFormDefinition,
  sbReorderFormOptions,
  sbUpdateFormUploadSettings,
  sbUpdateOrderStatus,
  sbUpdateStudent,
  sbVerifyAccessCode,
  sbConfirmPickupDelivery
} from "@/lib/store/supabase-db";
import { parseUniformFormData } from "@/lib/form-uniform";
import { OPTION_IMAGE_MIMES, sniffAllowedMime } from "@/lib/upload-security";
import {
  ACCESS_CODE_RATE_LIMIT_MESSAGE,
  clientRateBucket,
  guardAccessCodeAttempt
} from "@/lib/access-code-rate-limit";
import type { AccessCodeStatus, Batch, BatchStatus, CatalogFormAssignment, CoreProductId, FormDefinition, FormOption, FormStatus, OrderStatus, OutfitConfig } from "@/lib/types";
import { safeSlug } from "@/lib/utils";

const bookingCookie = "warka_booking_session";

const MAX_OPTION_IMAGE_BYTES = 5 * 1024 * 1024;

function revalidateAdmin(batchId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/batches");
  revalidatePath("/admin/students");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/representatives");
  revalidatePath("/admin/import");
  revalidatePath("/admin/forms");
  revalidatePath("/admin/forms", "layout");
  revalidatePath("/admin/products");
  revalidatePath("/admin/audit");
  if (batchId) {
    revalidatePath(`/admin/batches/${batchId}`);
    revalidatePath(`/admin/batches/${batchId}/students`);
    revalidatePath(`/admin/batches/${batchId}/orders`);
  }
}

function isNextRedirectError(error: unknown): error is { digest: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

/** Finds `optionId` anywhere in an option tree (including nested children) and replaces it via `fn`. */
function mapOptionTree(options: FormOption[], optionId: string, fn: (option: FormOption) => FormOption): FormOption[] {
  return options.map((option) => {
    if (option.id === optionId) return fn(option);
    if (option.children?.length) return { ...option, children: mapOptionTree(option.children, optionId, fn) };
    return option;
  });
}

/** Local-db equivalent of the Supabase `updateOptionInDefinition` helper: mutates a form's option tree in place. */
function updateLocalFormOption(
  db: LocalDatabase,
  formId: string,
  fieldKey: string,
  optionId: string,
  updater: (option: FormOption) => FormOption
): FormOption {
  const form = db.forms.find((entry) => entry.id === formId);
  if (!form) throw new Error("النموذج غير موجود.");

  let updated: FormOption | undefined;
  form.definition = {
    ...form.definition,
    sections: form.definition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        if (field.key !== fieldKey || !field.options) return field;
        return {
          ...field,
          options: mapOptionTree(field.options, optionId, (option) => {
            updated = updater(option);
            return updated;
          })
        };
      })
    }))
  };
  if (!updated) throw new Error("الخيار غير موجود.");
  return updated;
}

export async function loginAction(_state: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  let mode: PersistenceMode;
  try {
    mode = assertPersistenceAllowed();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "بيانات الدخول غير صحيحة." };
  }

  if (mode === "supabase") {
    const result = await sbLogin(email, password);
    if (result.error) return { error: result.error };
    redirect("/admin");
  }

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

  let mode: PersistenceMode = "local-demo";
  try {
    mode = assertPersistenceAllowed();
  } catch {
    // Ignore config errors during logout; still clear any local session cookie below.
  }

  if (mode === "supabase") {
    await sbLogout();
  } else {
    const token = cookieStore.get(AUTH_COOKIE)?.value;
    if (token) {
      mutateDb((db) => {
        db.sessions = db.sessions.filter((session) => session.token !== token);
      });
    }
  }

  if (cookieStore.get(AUTH_COOKIE)) {
    cookieStore.delete(AUTH_COOKIE);
  }
  redirect("/login");
}

export async function verifyAccessCodeAction(_state: { error?: string } | undefined, formData: FormData) {
  const parsed = accessCodeSchema.safeParse({
    slug: formData.get("slug"),
    code: formData.get("code")
  });
  if (!parsed.success) return { error: "رمز الحجز غير صحيح أو غير متاح." };
  const { slug, code } = parsed.data;
  const bucket = await clientRateBucket(slug);
  const precheck = await guardAccessCodeAttempt(bucket, "check");
  if (precheck.limited) return { error: ACCESS_CODE_RATE_LIMIT_MESSAGE };

  let mode: PersistenceMode;
  try {
    mode = assertPersistenceAllowed();
  } catch {
    return { error: "رمز الحجز غير صحيح أو غير متاح." };
  }

  async function reject(error: string, kind: "invalid" | "used") {
    const fail = await guardAccessCodeAttempt(bucket, "fail");
    if (fail.limited) return { error: ACCESS_CODE_RATE_LIMIT_MESSAGE };
    return { error: kind === "used" ? "تم استخدام رمز الحجز مسبقاً وإرسال الطلب بنجاح." : error };
  }

  if (mode === "supabase") {
    const result = await sbVerifyAccessCode(slug, code);
    if (!result.ok) {
      return reject("رمز الحجز غير صحيح أو غير متاح.", result.error.includes("استخدام") ? "used" : "invalid");
    }
    await guardAccessCodeAttempt(bucket, "success");

    const cookieStore = await cookies();
    cookieStore.set(bookingCookie, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
    redirect(`/f/${slug}/book`);
  }

  const db = readDb();
  const form = db.forms.find((entry) => entry.slug === slug && entry.status === "published");
  if (!form) return reject("رمز الحجز غير صحيح أو غير متاح.", "invalid");

  const fingerprint = accessCodeFingerprint(code, getAccessCodeFingerprintScope(form));
  const accessCode = db.access_codes.find(
    (entry) => entry.form_id === form.id && entry.code_fingerprint === fingerprint
  );
  if (!accessCode) return reject("رمز الحجز غير صحيح أو غير متاح.", "invalid");
  if (accessCode.status === "USED") {
    return reject("تم استخدام رمز الحجز مسبقاً وإرسال الطلب بنجاح.", "used");
  }
  if (accessCode.status !== "ACTIVE") return reject("رمز الحجز غير صحيح أو غير متاح.", "invalid");

  const student = db.students.find((entry) => entry.id === accessCode.student_id);
  if (!student || student.batch_id !== accessCode.batch_id) {
    return reject("رمز الحجز غير صحيح أو غير متاح.", "invalid");
  }

  const existing = db.submissions.find(
    (entry) => entry.student_id === student.id && entry.form_id === form.id && entry.is_current
  );
  if (existing) return reject("تم استخدام رمز الحجز مسبقاً وإرسال الطلب بنجاح.", "used");

  await guardAccessCodeAttempt(bucket, "success");

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
    if (assertPersistenceAllowed() === "supabase") {
      const result = await sbSubmitBooking(session, parsed.data.answers, parsed.data.files);
      if (!result.ok) return result;
      cookieStore.delete(bookingCookie);
      revalidateAdmin(session.batchId);
      return { ...result, receiptToken: signBookingReceipt({ submissionId: result.submissionId, bookingNumber: result.bookingNumber }) };
    }

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

      const definition = applyOutfitArchitecture(
        mergeCatalogIntoDefinition(
          normalizeFormCustomizationGrouping(form.definition ?? defaultWarkaFormDefinition),
          filterAvailableProducts(db.products ?? [], {
            formId: form.id,
            formType: form.type,
            batchId: form.batch_id ?? session.batchId ?? null
          }),
          db.product_categories ?? []
        )
      );
      const answers = resolveOutfitAnswers(definition, { ...parsed.data.answers, student_name: student.full_name });
      const validation = validateDynamicAnswers(definition, answers, parsed.data.files);
      if (!validation.valid) {
        throw new Error("يرجى مراجعة الحقول المطلوبة.");
      }

      const snapshot = buildOrderSnapshot({
        formId: form.id,
        formName: form.name,
        definition,
        answers
      });
      const persistedAnswers = answersWithSnapshot(answers, snapshot);

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
        answers: persistedAnswers,
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
    return {
      ok: true as const,
      ...result,
      receiptToken: signBookingReceipt({ submissionId: result.submissionId, bookingNumber: result.bookingNumber })
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "تعذر حفظ الحجز، يرجى المحاولة مرة أخرى."
    };
  }
}

export async function createIndividualStudentAction(
  _state: { error?: string; code?: string } | undefined,
  formData: FormData
) {
  const user = await requireUser(["OWNER"]);
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "اسم الطالب مطلوب." };
  const phone = String(formData.get("phone") ?? "").trim() || undefined;
  const address = String(formData.get("address") ?? "").trim() || undefined;
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const uniform = parseUniformFormData(formData);

  try {
    if (assertPersistenceAllowed() !== "supabase") {
      return { error: "إنشاء الطلاب الفرديين متاح في وضع Supabase فقط." };
    }
    const created = await sbCreateIndividualStudent(user, { full_name: fullName, phone, address, notes, uniform });
    revalidateAdmin();
    return { code: created.code };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر إنشاء الطالب الفردي." };
  }
}

export async function updateStudentAction(_state: { error?: string; success?: boolean } | undefined, formData: FormData) {
  const user = await requireUser();
  const studentId = String(formData.get("student_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!studentId || !fullName) return { error: "بيانات الطالب غير مكتملة." };
  try {
    if (assertPersistenceAllowed() !== "supabase") return { error: "التعديل متاح في وضع Supabase فقط." };
    await sbUpdateStudent(user, studentId, {
      full_name: fullName,
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      address: String(formData.get("address") ?? "").trim() || undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
      uniform: parseUniformFormData(formData)
    });
    revalidateAdmin();
    revalidatePath(`/admin/students/${studentId}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر تحديث الطالب." };
  }
}

export async function saveBatchUniformAction(_state: { error?: string; success?: boolean } | undefined, formData: FormData) {
  const user = await requireUser();
  const formId = String(formData.get("form_id") ?? "").trim();
  if (!formId) return { error: "النموذج غير موجود." };
  try {
    if (assertPersistenceAllowed() !== "supabase") return { error: "حفظ الزي الموحد متاح في وضع Supabase فقط." };
    await sbSaveFixedOptions(user, { formId, studentId: null, map: parseUniformFormData(formData) });
    revalidateAdmin();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر حفظ الزي الموحد." };
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

  const input: CreateBatchInput = {
    name,
    university,
    college,
    department,
    stage,
    graduation_year: graduationYear,
    description: description || undefined,
    representative_id: representativeId,
    status,
    uniform: parseUniformFormData(formData)
  };

  try {
    let batch: Batch;
    if (assertPersistenceAllowed() === "supabase") {
      batch = await sbCreateBatch(user, input);
    } else {
      batch = mutateDb((db) => createBatchRecord(db, input, user.id));
    }
    revalidateAdmin(batch.id);
    redirect(`/admin/batches/${batch.id}?created=1`);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "تعذر إنشاء الدفعة." };
  }
}

export async function createRepresentativeAction(_state: { error?: string } | undefined, formData: FormData) {
  await requireUser(["OWNER"]);
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const batchIds = formData.getAll("batch_ids").map(String);

  if (!fullName || !email) return { error: "الاسم والبريد مطلوبان." };
  if (password.length < 8) return { error: "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل." };

  try {
    if (assertPersistenceAllowed() === "supabase") {
      await sbCreateRepresentative({ fullName, phone: phone || undefined, email, password, batchIds });
    } else {
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
    }
    revalidateAdmin();
    redirect("/admin/representatives");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "تعذر إنشاء الممثل." };
  }
}

export async function createOwnerAction(_state: { error?: string } | undefined, formData: FormData) {
  await requireUser(["OWNER"]);
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();

  if (!fullName || !email) return { error: "الاسم والبريد مطلوبان." };
  if (password.length < 8) return { error: "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل." };

  try {
    if (assertPersistenceAllowed() !== "supabase") {
      return { error: "إنشاء مالك إضافي متاح في وضع Supabase فقط." };
    }
    await sbCreateOwner({ fullName, phone: phone || undefined, email, password });
    revalidateAdmin();
    redirect("/admin/settings");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "تعذر إنشاء المالك." };
  }
}

export async function toggleRepresentativeAction(representativeId: string, disabled: boolean) {
  await requireUser(["OWNER"]);
  if (assertPersistenceAllowed() === "supabase") {
    await sbToggleRepresentative(representativeId, disabled);
  } else {
    mutateDb((db) => {
      const profile = db.profiles.find((entry) => entry.id === representativeId && entry.role === "REPRESENTATIVE");
      if (!profile) throw new Error("الممثل غير موجود.");
      profile.disabled = disabled;
      profile.updated_at = new Date().toISOString();
      audit(db, disabled ? "REPRESENTATIVE_DISABLED" : "REPRESENTATIVE_ENABLED", "profile", representativeId, { label: "owner" });
    });
  }
  revalidateAdmin();
}

export async function assignRepresentativeBatchesAction(representativeId: string, batchIds: string[]) {
  await requireUser(["OWNER"]);
  if (assertPersistenceAllowed() === "supabase") {
    await sbAssignRepresentativeBatches(representativeId, batchIds);
  } else {
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
  }
  revalidateAdmin();
}

export async function importStudentsAction(batchId: string, names: string[]) {
  const user = await requireUser();
  const cleaned = names.map((name) => name.replace(/\s+/g, " ").trim()).filter((name) => name.length >= 3);
  if (!cleaned.length) return { error: "لا توجد أسماء صالحة للاستيراد." };

  try {
    if (assertPersistenceAllowed() === "supabase") {
      const result = await sbImportStudents(user, batchId, cleaned);
      if ("error" in result && result.error) return { error: result.error };
      revalidateAdmin(batchId);
      return { success: true as const, imported: "imported" in result ? result.imported : cleaned.length };
    } else {
      let imported = 0;
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
          imported += 1;
        }
        audit(db, "STUDENTS_IMPORTED", "batch", batchId, { id: user.id, label: user.fullName }, { count: imported });
      });
      revalidateAdmin(batchId);
      return { success: true as const, imported };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر استيراد الطلاب." };
  }
}

export async function deleteStudentsAction(studentIds: string[]) {
  const user = await getCurrentUser();
  if (!user) return { error: "يجب تسجيل الدخول أولاً.", deleted: 0, deletedIds: [] as string[], blocked: [] as Array<{ id: string; name: string }>, rejected: studentIds.length, message: "يجب تسجيل الدخول أولاً." };

  try {
    if (assertPersistenceAllowed() === "supabase") {
      const result = await sbDeleteStudents(user, studentIds);
      revalidateAdmin();
      return result;
    }

    const result = mutateDb((db) => deleteStudentRecords(db, user, studentIds));
    revalidateAdmin();
    const parts: string[] = [];
    if (result.deleted) parts.push(result.deleted === 1 ? "تم حذف طالب واحد." : `تم حذف ${result.deleted} طلاب.`);
    if (result.blocked.length) {
      parts.push(
        result.blocked.length === 1
          ? "لا يمكن حذف هذا الطالب لوجود طلب مسجل. يمكن أرشفته بدلاً من ذلك."
          : `لم يُحذف ${result.blocked.length} طلاب لوجود طلب مسجل.`
      );
    }
    if (result.rejected) parts.push("رُفضت بعض المعرّفات لأنها غير صالحة أو غير مصرح بها.");
    return { ...result, message: parts.join(" ") || "لم يتم حذف أي طالب." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذر حذف الطلاب.",
      deleted: 0,
      deletedIds: [] as string[],
      blocked: [] as Array<{ id: string; name: string }>,
      rejected: studentIds.length,
      message: error instanceof Error ? error.message : "تعذر حذف الطلاب."
    };
  }
}

export async function previewPasteAction(text: string, batchId: string) {
  const user = await requireUser();
  if (assertPersistenceAllowed() === "supabase") {
    await sbAssertBatchAccess(user, batchId);
    const existing = (await sbListStudents(user, { batchId })).map((s) => s.full_name);
    return previewPastedNames(text, existing);
  }
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
  const user = await requireUser();

  let existing: string[];
  if (assertPersistenceAllowed() === "supabase") {
    await sbAssertBatchAccess(user, batchId);
    existing = (await sbListStudents(user, { batchId })).map((s) => s.full_name);
  } else {
    const db = readDb();
    assertBatchAccess(db, user, batchId);
    existing = db.students.filter((student) => student.batch_id === batchId).map((student) => student.full_name);
  }

  const values = rows.map((row) => (row[columnKey] == null ? "" : String(row[columnKey])));
  const maybeHeader = values[0]?.trim();
  const body = maybeHeader && /اسم|name|الطالب/i.test(maybeHeader) ? values.slice(1) : values;
  const preview = previewPastedNames(body.join("\n"), existing);
  const names = preview.filter((row) => row.valid).map((row) => row.normalizedName);
  return importStudentsAction(batchId, names);
}

export async function regenerateStudentCodeAction(studentId: string) {
  const user = await requireUser();

  let code: string;
  if (assertPersistenceAllowed() === "supabase") {
    ({ code } = await sbRegenerateStudentCode(user, studentId));
  } else {
    code = mutateDb((db) => {
      const student = db.students.find((entry) => entry.id === studentId);
      if (!student) throw new Error("الطالب غير موجود.");
      assertBatchAccess(db, user, student.batch_id);
      const form = student.batch_id
        ? db.forms.find((entry) => entry.batch_id === student.batch_id)
        : db.forms.find((entry) => entry.slug === "individual");
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
  }
  revalidateAdmin();
  return { code };
}

export async function setAccessCodeStatusAction(studentId: string, status: AccessCodeStatus) {
  const user = await requireUser();
  if (assertPersistenceAllowed() === "supabase") {
    await sbSetAccessCodeStatus(user, studentId, status);
  } else {
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
  }
  revalidateAdmin();
}

export async function reopenSubmissionAction(submissionId: string) {
  const user = await requireUser(["OWNER"]);

  let newCode: string;
  if (assertPersistenceAllowed() === "supabase") {
    ({ code: newCode } = await sbReopenSubmission(user, submissionId));
  } else {
    newCode = mutateDb((db) => {
      const submission = db.submissions.find((entry) => entry.id === submissionId);
      if (!submission) throw new Error("الطلب غير موجود.");
      const oldStatus = submission.status;
      submission.is_current = false;
      submission.status = "CANCELLED";
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
        old_status: oldStatus,
        new_status: "CANCELLED",
        changed_by: user.id,
        changed_at: new Date().toISOString(),
        notes: "تمت إعادة فتح الطلب من المالك"
      });
      audit(db, "SUBMISSION_REOPENED", "submission", submission.id, { id: user.id, label: user.fullName }, {
        new_code_id: created.id,
        new_code: created.code,
        reopened_from: submission.id
      });
      return created.code;
    });
  }
  revalidateAdmin();
  return { code: newCode };
}

export async function updateOrderStatusAction(submissionId: string, status: OrderStatus, notes?: string) {
  const user = await requireUser();
  if (assertPersistenceAllowed() === "supabase") {
    await sbUpdateOrderStatus(user, submissionId, status, notes);
  } else {
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
  }
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
    if (assertPersistenceAllowed() === "supabase") {
      const created = await sbCreateForm(user, { name, slug, type, batchId, internalDescription: description || undefined });
      revalidateAdmin(batchId);
      redirect(`/admin/forms/${created.id}`);
    } else {
      let createdId = "";
      mutateDb((db) => {
        if (db.forms.some((form) => form.slug === slug)) throw new Error("الرابط مستخدم مسبقاً.");
        createdId = randomUUID();
        db.forms.unshift({
          id: createdId,
          name,
          slug,
          type,
          batch_id: batchId,
          internal_description: description,
          status: "draft",
          definition: defaultWarkaFormDefinition
        });
        audit(db, "FORM_CREATED", "booking_form", createdId, { id: user.id, label: user.fullName }, { slug });
      });
      revalidateAdmin(batchId);
      redirect(`/admin/forms/${createdId}`);
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "تعذر إنشاء النموذج." };
  }
}

export async function setFormStatusAction(formId: string, status: FormStatus) {
  await requireUser(["OWNER"]);
  if (assertPersistenceAllowed() === "supabase") {
    await sbSetFormStatus(formId, status);
  } else {
    mutateDb((db) => {
      const form = db.forms.find((entry) => entry.id === formId);
      if (!form) throw new Error("النموذج غير موجود.");
      form.status = status;
      audit(db, "FORM_STATUS_CHANGED", "booking_form", formId, { label: "owner" }, { status });
    });
  }
  revalidateAdmin();
}

export async function archiveFormAction(formData: FormData) {
  const formId = String(formData.get("formId") ?? "").trim();
  if (!formId) throw new Error("النموذج غير موجود.");
  await setFormStatusAction(formId, "archived");
  redirect("/admin/forms");
}

export async function archiveBatchAction(formData: FormData) {
  await requireUser(["OWNER"]);
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) throw new Error("الدفعة غير موجودة.");
  if (assertPersistenceAllowed() === "supabase") {
    await sbSetBatchStatus(batchId, "archived");
  } else {
    mutateDb((db) => {
      const batch = db.batches.find((entry) => entry.id === batchId);
      if (!batch) throw new Error("الدفعة غير موجودة.");
      batch.status = "archived";
      batch.updated_at = new Date().toISOString();
      for (const form of db.forms) {
        if (form.batch_id === batchId && form.status === "published") form.status = "closed";
      }
      audit(db, "BATCH_STATUS_CHANGED", "batch", batchId, { label: "owner" }, { status: "archived" });
    });
  }
  revalidateAdmin(batchId);
  redirect("/admin/batches");
}

export async function updateFormUploadSettingsAction(
  formId: string,
  updates: Array<{ key: string; uploadMode?: "single" | "multiple"; maxFiles?: number; required?: boolean }>
) {
  await requireUser(["OWNER"]);
  if (assertPersistenceAllowed() === "supabase") {
    await sbUpdateFormUploadSettings(formId, updates);
  } else {
    mutateDb((db) => {
      const form = db.forms.find((entry) => entry.id === formId);
      if (!form) throw new Error("النموذج غير موجود.");
      form.definition = {
        ...form.definition,
        sections: form.definition.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => {
            const update = updates.find((entry) => entry.key === field.key);
            if (!update) return field;
            return {
              ...field,
              uploadMode: update.uploadMode,
              maxFiles: update.maxFiles,
              required: update.required
            };
          })
        }))
      };
      audit(db, "FORM_UPLOAD_SETTINGS_UPDATED", "booking_form", formId, { label: "owner" });
    });
  }
  revalidateAdmin();
}

export async function updateFormOptionAction(
  formId: string,
  fieldKey: string,
  optionId: string,
  patch: { label?: string; description?: string; enabled?: boolean; imageAlt?: string; showOptionImages?: never }
) {
  await requireUser(["OWNER"]);
  // `showOptionImages` belongs to the field, not the option — never forwarded to the option patch.
  const { showOptionImages, ...optionPatch } = patch;
  void showOptionImages;

  let option: FormOption;
  if (assertPersistenceAllowed() === "supabase") {
    option = await sbUpdateFormOption(formId, fieldKey, optionId, optionPatch);
  } else {
    option = mutateDb((db) => {
      const updated = updateLocalFormOption(db, formId, fieldKey, optionId, (current) => ({ ...current, ...optionPatch }));
      audit(db, "FORM_OPTION_UPDATED", "booking_form", formId, { label: "owner" }, { fieldKey, optionId, patch: optionPatch });
      return updated;
    });
  }
  revalidateAdmin();
  return option;
}

export async function updateFormFieldMetaAction(
  formId: string,
  fieldKey: string,
  patch: { showOptionImages?: boolean; uploadMode?: "single" | "multiple"; maxFiles?: number; required?: boolean }
) {
  await requireUser(["OWNER"]);
  if (assertPersistenceAllowed() === "supabase") {
    await sbUpdateFormFieldMeta(formId, fieldKey, patch);
  } else {
    mutateDb((db) => {
      const form = db.forms.find((entry) => entry.id === formId);
      if (!form) throw new Error("النموذج غير موجود.");
      form.definition = patchLocalFieldMeta(form.definition, fieldKey, patch);
      audit(db, "FORM_FIELD_META_UPDATED", "booking_form", formId, { label: "owner" }, { fieldKey, patch });
    });
  }
  revalidateAdmin();
}

export async function updateFormOutfitConfigAction(formId: string, raw: OutfitConfig) {
  await requireUser(["OWNER"]);
  const config = sanitizeOutfitConfig(raw);
  if (assertPersistenceAllowed() === "supabase") {
    await sbUpdateFormOutfitConfig(formId, config);
  } else {
    mutateDb((db) => {
      const form = db.forms.find((entry) => entry.id === formId);
      if (!form) throw new Error("النموذج غير موجود.");
      form.definition = { ...form.definition, outfitConfig: config };
      audit(db, "FORM_OUTFIT_CONFIG_UPDATED", "booking_form", formId, { label: "owner" }, { config });
    });
  }
  revalidateAdmin();
}

export async function saveFormCatalogProductAction(input: {
  formId: string;
  productId?: string;
  create?: {
    category_id: string;
    name_ar: string;
    name_en?: string;
    description?: string;
    price_iqd?: number | null;
    sort_order?: number;
  };
  assignment?: CatalogFormAssignment;
}): Promise<{ error?: string; productId?: string }> {
  const user = await requireUser(["OWNER"]);
  const form = await getAdminForm(user, input.formId);
  if (!form) return { error: "النموذج غير موجود." };
  const assignment = normalizeCatalogAssignment(input.assignment);
  const audience = { formId: form.id, formType: form.type, batchId: form.batch_id };
  try {
    const { attachProductToForm, createCatalogProduct } = await import("@/lib/store/catalog-store");
    let productId = input.productId?.trim();
    if (!productId) {
      const created = input.create;
      if (!created?.name_ar?.trim() || !created.category_id) return { error: "اسم المنتج والتصنيف مطلوبان." };
      const product = await createCatalogProduct(user, {
        category_id: created.category_id,
        name_ar: created.name_ar,
        name_en: created.name_en,
        description: created.description,
        price_iqd: created.price_iqd,
        active: true,
        sort_order: created.sort_order ?? assignment.sortOrder ?? 0,
        availability: [{ scope: "forms", form_id: form.id }]
      });
      productId = product.id;
    } else {
      await attachProductToForm(productId, audience);
    }
    await patchFormCatalogAssignment(form.id, productId, assignment);
    revalidateAdmin();
    revalidatePath(`/admin/forms/${form.id}`);
    return { productId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر حفظ المنتج في النموذج." };
  }
}

export async function saveFormProductAssignmentAction(
  formId: string,
  productId: string,
  assignment: CatalogFormAssignment
): Promise<{ error?: string }> {
  await requireUser(["OWNER"]);
  try {
    await patchFormCatalogAssignment(formId, productId, normalizeCatalogAssignment(assignment));
    revalidateAdmin();
    revalidatePath(`/admin/forms/${formId}`);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر حفظ إعدادات المنتج." };
  }
}

export async function addFormOptionAction(
  formId: string,
  fieldKey: string,
  label: string
): Promise<{ error?: string }> {
  await requireUser(["OWNER"]);
  const name = label.trim();
  if (!name) return { error: "اسم الموديل مطلوب." };
  try {
    if (assertPersistenceAllowed() === "supabase") {
      await sbAddFormOption(formId, fieldKey, { label: name });
    } else {
      mutateDb((db) => {
        const form = db.forms.find((entry) => entry.id === formId);
        if (!form) throw new Error("النموذج غير موجود.");
        const value = safeSlug(name) || `opt-${Date.now().toString(36)}`;
        let found = false;
        form.definition = {
          ...form.definition,
          sections: form.definition.sections.map((section) => ({
            ...section,
            fields: section.fields.map((field) => {
              if (field.key !== fieldKey) return field;
              found = true;
              const existing = field.options ?? [];
              if (existing.some((option) => option.value === value || option.label === name)) {
                throw new Error("هذا الموديل موجود مسبقاً.");
              }
              return {
                ...field,
                options: [
                  ...existing,
                  { id: `opt-${randomUUID()}`, label: name, value, enabled: true }
                ]
              };
            })
          }))
        };
        if (!found) throw new Error("حقل الموديل غير موجود في هذا النموذج.");
        audit(db, "FORM_OPTION_ADDED", "booking_form", formId, { label: "owner" }, { fieldKey });
      });
    }
    revalidateAdmin();
    revalidatePath(`/admin/forms/${formId}`);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر إضافة الموديل." };
  }
}

async function patchFormCatalogAssignment(formId: string, productId: string, assignment: CatalogFormAssignment) {
  if (assertPersistenceAllowed() === "supabase") {
    await sbPatchFormCatalogAssignment(formId, productId, assignment);
    return;
  }
  mutateDb((db) => {
    const form = db.forms.find((entry) => entry.id === formId);
    if (!form) throw new Error("النموذج غير موجود.");
    const config = sanitizeOutfitConfig(form.definition.outfitConfig);
    form.definition = {
      ...form.definition,
      outfitConfig: {
        ...config,
        catalogAssignments: {
          ...config.catalogAssignments,
          [productId]: assignment
        }
      }
    };
    audit(db, "FORM_CATALOG_ASSIGNMENT_UPDATED", "booking_form", formId, { label: "owner" }, { productId });
  });
}

export async function copyFormConfigurationAction(
  targetFormId: string,
  sourceFormId: string,
  slices: CopyFormSlices
): Promise<{ error?: string }> {
  const user = await requireUser(["OWNER"]);
  if (targetFormId === sourceFormId) return { error: "اختر نموذجاً مختلفاً للنسخ." };
  const selected = Object.values(slices).some(Boolean);
  if (!selected) return { error: "اختر عنصراً واحداً على الأقل للنسخ." };
  try {
    let sourceDef: FormDefinition;
    let targetDef: FormDefinition;
    if (assertPersistenceAllowed() === "supabase") {
      sourceDef = await sbGetFormDefinition(sourceFormId);
      targetDef = await sbGetFormDefinition(targetFormId);
    } else {
      const db = readDb();
      const source = db.forms.find((entry) => entry.id === sourceFormId);
      const target = db.forms.find((entry) => entry.id === targetFormId);
      if (!source || !target) throw new Error("النموذج غير موجود.");
      sourceDef = source.definition;
      targetDef = target.definition;
    }
    const next = applyCopiedFormConfig(targetDef, sourceDef, slices);
    if (assertPersistenceAllowed() === "supabase") {
      await sbReplaceFormDefinition(targetFormId, next);
    } else {
      mutateDb((db) => {
        const form = db.forms.find((entry) => entry.id === targetFormId);
        if (!form) throw new Error("النموذج غير موجود.");
        form.definition = next;
        audit(db, "FORM_CONFIG_COPIED", "booking_form", targetFormId, { label: "owner" }, { sourceFormId, slices });
      });
    }
    if (slices.products) {
      const { attachProductToForm } = await import("@/lib/store/catalog-store");
      const target = await getAdminForm(user, targetFormId);
      if (target) {
        const audience = { formId: target.id, formType: target.type, batchId: target.batch_id };
        for (const productId of catalogProductIdsFromDefinition(sourceDef)) {
          await attachProductToForm(productId, audience).catch(() => undefined);
        }
      }
    }
    revalidateAdmin();
    revalidatePath(`/admin/forms/${targetFormId}`);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر نسخ الإعدادات." };
  }
}

export async function reorderFormOptionsAction(formId: string, fieldKey: string, orderedIds: string[]) {
  await requireUser(["OWNER"]);
  if (assertPersistenceAllowed() === "supabase") {
    await sbReorderFormOptions(formId, fieldKey, orderedIds);
  } else {
    mutateDb((db) => {
      const form = db.forms.find((entry) => entry.id === formId);
      if (!form) throw new Error("النموذج غير موجود.");
      let found = false;
      form.definition = {
        ...form.definition,
        sections: form.definition.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => {
            if (field.key !== fieldKey || !field.options?.length) return field;
            found = true;
            const byId = new Map(field.options.map((option) => [option.id, option]));
            const reordered = orderedIds.map((id) => byId.get(id)).filter((option): option is FormOption => Boolean(option));
            const leftovers = field.options.filter((option) => !orderedIds.includes(option.id));
            return { ...field, options: [...reordered, ...leftovers] };
          })
        }))
      };
      if (!found) throw new Error("الحقل غير موجود.");
      audit(db, "FORM_OPTIONS_REORDERED", "booking_form", formId, { label: "owner" }, { fieldKey });
    });
  }
  revalidateAdmin();
}

function patchLocalFieldMeta(
  definition: FormDefinition,
  fieldKey: string,
  patch: { showOptionImages?: boolean; uploadMode?: "single" | "multiple"; maxFiles?: number; required?: boolean }
): FormDefinition {
  let found = false;
  const next: FormDefinition = {
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
  if (found) return next;
  const live = applyOutfitArchitecture(definition);
  const liveSection = live.sections.find((section) => section.fields.some((field) => field.key === fieldKey));
  const liveField = liveSection?.fields.find((field) => field.key === fieldKey);
  if (!liveField || !liveSection) throw new Error("الحقل غير موجود.");
  const patched = { ...liveField, ...patch };
  if (next.sections.some((section) => section.id === liveSection.id)) {
    return {
      ...next,
      sections: next.sections.map((section) =>
        section.id === liveSection.id ? { ...section, fields: [...section.fields, patched] } : section
      )
    };
  }
  return { ...next, sections: [...next.sections, { ...liveSection, fields: [patched] }] };
}

export async function uploadFormOptionImageAction(formData: FormData) {
  await requireUser(["OWNER"]);

  const formId = String(formData.get("formId") ?? "").trim();
  const fieldKey = String(formData.get("fieldKey") ?? "").trim();
  const optionId = String(formData.get("optionId") ?? "").trim();
  const file = formData.get("file");

  if (!formId || !fieldKey || !optionId || !(file instanceof File)) {
    return { error: "بيانات الصورة غير مكتملة." };
  }
  if (file.size > MAX_OPTION_IMAGE_BYTES) {
    return { error: "حجم الصورة يتجاوز 5 ميغابايت." };
  }

  try {
    const mode = assertPersistenceAllowed();
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = sniffAllowedMime(buffer, OPTION_IMAGE_MIMES);
    if (!mimeType) {
      return { error: "نوع الصورة غير مسموح، يرجى استخدام jpg أو png أو webp." };
    }

    const stored = await storeOptionImage(formId, fieldKey, optionId, {
      buffer,
      mimeType,
      originalName: file.name
    });

    if (mode !== "supabase") {
      mutateDb((db) => {
        updateLocalFormOption(db, formId, fieldKey, optionId, (option) => ({
          ...option,
          imagePath: stored.imagePath,
          imageUrl: stored.imageUrl
        }));
        audit(db, "FORM_OPTION_IMAGE_UPLOADED", "booking_form", formId, { label: "owner" }, { fieldKey, optionId });
      });
    }

    revalidateAdmin();
    return { success: true as const, imagePath: stored.imagePath, imageUrl: stored.imageUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر رفع الصورة." };
  }
}

export async function deleteFormOptionImageAction(formId: string, fieldKey: string, optionId: string) {
  await requireUser(["OWNER"]);
  const mode = assertPersistenceAllowed();

  // In supabase mode this clears imagePath/imageUrl on the definition itself; in local mode
  // it is a no-op and we clear those fields on the local-db record below.
  await deleteOptionImage(formId, fieldKey, optionId);

  if (mode !== "supabase") {
    mutateDb((db) => {
      updateLocalFormOption(db, formId, fieldKey, optionId, (option) => ({
        ...option,
        imagePath: undefined,
        imageUrl: undefined
      }));
      audit(db, "FORM_OPTION_IMAGE_DELETED", "booking_form", formId, { label: "owner" }, { fieldKey, optionId });
    });
  }
  revalidateAdmin();
}

function patchLocalOutfitImage(
  formId: string,
  outfitId: string,
  productId: CoreProductId | undefined,
  image: { imagePath?: string; imageUrl?: string } | null
) {
  mutateDb((db) => {
    const form = db.forms.find((entry) => entry.id === formId);
    if (!form) throw new Error("النموذج غير موجود.");
    const config = sanitizeOutfitConfig(form.definition.outfitConfig);
    form.definition = {
      ...form.definition,
      outfitConfig: sanitizeOutfitConfig({
        ...config,
        fullOutfits: config.fullOutfits.map((outfit) => {
          if (outfit.id !== outfitId) return outfit;
          if (!productId) return { ...outfit, imagePath: image?.imagePath, imageUrl: image?.imageUrl };
          const productImages = { ...(outfit.productImages ?? {}) };
          if (!image) delete productImages[productId];
          else productImages[productId] = image;
          return { ...outfit, productImages: Object.keys(productImages).length ? productImages : undefined };
        })
      })
    };
    audit(db, productId ? "FORM_OUTFIT_PRODUCT_IMAGE_UPDATED" : "FORM_OUTFIT_IMAGE_UPDATED", "booking_form", formId, { label: "owner" }, {
      outfitId,
      productId
    });
  });
}

export async function uploadOutfitImageAction(formData: FormData) {
  await requireUser(["OWNER"]);
  const formId = String(formData.get("formId") ?? "").trim();
  const outfitId = String(formData.get("outfitId") ?? "").trim();
  const productRaw = String(formData.get("productId") ?? "").trim();
  const productId = CORE_PRODUCT_IDS.includes(productRaw as CoreProductId) ? (productRaw as CoreProductId) : undefined;
  const file = formData.get("file");
  if (!formId || !outfitId || !(file instanceof File)) return { error: "بيانات الصورة غير مكتملة." };
  if (file.size > MAX_OPTION_IMAGE_BYTES) return { error: "حجم الصورة يتجاوز 5 ميغابايت." };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = sniffAllowedMime(buffer, OPTION_IMAGE_MIMES);
    if (!mimeType) return { error: "نوع الصورة غير مسموح، يرجى استخدام jpg أو png أو webp." };
    const stored = await storeOutfitAsset(formId, outfitId, productId, {
      buffer,
      mimeType,
      originalName: file.name
    });
    if (assertPersistenceAllowed() === "supabase") {
      await sbPatchOutfitImage(formId, outfitId, productId, stored);
    } else {
      patchLocalOutfitImage(formId, outfitId, productId, stored);
    }
    revalidateAdmin();
    return { success: true as const, imagePath: stored.imagePath, imageUrl: stored.imageUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر رفع الصورة." };
  }
}

export async function deleteOutfitImageAction(formId: string, outfitId: string, productId?: CoreProductId) {
  await requireUser(["OWNER"]);
  if (!formId || !outfitId) return { error: "بيانات الصورة غير مكتملة." };
  try {
    let previousPath: string | undefined;
    if (assertPersistenceAllowed() === "supabase") {
      const definition = await sbGetFormDefinition(formId);
      const outfit = sanitizeOutfitConfig(definition.outfitConfig).fullOutfits.find((entry) => entry.id === outfitId);
      previousPath = productId ? outfit?.productImages?.[productId]?.imagePath : outfit?.imagePath;
      await sbPatchOutfitImage(formId, outfitId, productId, null);
    } else {
      const db = readDb();
      const form = db.forms.find((entry) => entry.id === formId);
      const outfit = sanitizeOutfitConfig(form?.definition.outfitConfig).fullOutfits.find((entry) => entry.id === outfitId);
      previousPath = productId ? outfit?.productImages?.[productId]?.imagePath : outfit?.imagePath;
      patchLocalOutfitImage(formId, outfitId, productId, null);
    }
    await deleteOutfitAssetFile(previousPath);
    revalidateAdmin();
    return { success: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر حذف الصورة." };
  }
}

export async function updateFormGeneralAction(_state: { error?: string; success?: string } | undefined, formData: FormData) {
  await requireUser(["OWNER"]);
  const formId = String(formData.get("form_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("internal_description") ?? "").trim();
  const opening = String(formData.get("opening_date") ?? "").trim();
  const closing = String(formData.get("closing_date") ?? "").trim();
  if (!formId || !name) return { error: "اسم النموذج مطلوب." };

  try {
    if (assertPersistenceAllowed() === "supabase") {
      await sbUpdateFormGeneral(formId, {
        name,
        internalDescription: description || undefined,
        openingDate: opening ? new Date(opening).toISOString() : null,
        closingDate: closing ? new Date(closing).toISOString() : null
      });
    } else {
      mutateDb((db) => {
        const form = db.forms.find((entry) => entry.id === formId);
        if (!form) throw new Error("النموذج غير موجود.");
        form.name = name;
        form.internal_description = description;
      });
    }
    revalidateAdmin();
    return { success: "تم حفظ الإعدادات العامة." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر الحفظ." };
  }
}

export async function duplicateFormAction(formId: string) {
  await requireUser(["OWNER"]);
  let createdId = formId;
  if (assertPersistenceAllowed() === "supabase") {
    const created = await sbDuplicateForm(formId);
    createdId = created.id;
  } else {
    mutateDb((db) => {
      const form = db.forms.find((entry) => entry.id === formId);
      if (!form) throw new Error("النموذج غير موجود.");
      createdId = randomUUID();
      db.forms.unshift({
        ...form,
        id: createdId,
        name: `${form.name} (نسخة)`,
        slug: `${form.slug}-copy-${Date.now().toString().slice(-4)}`,
        status: "draft"
      });
    });
  }
  revalidateAdmin();
  redirect(`/admin/forms/${createdId}`);
}

export async function getStudentCardAction(studentId: string) {
  const user = await requireUser();
  if (assertPersistenceAllowed() === "supabase") {
    return sbGetStudentCard(user, studentId);
  }
  const db = readDb();
  const student = db.students.find((entry) => entry.id === studentId);
  if (!student) throw new Error("الطالب غير موجود.");
  assertBatchAccess(db, user, student.batch_id);
  return toStudentWithState(db, studentId);
}

export async function exportBatchStudentsCsvAction(batchId: string) {
  const user = await requireUser();
  if (assertPersistenceAllowed() === "supabase") {
    return sbExportBatchStudentsCsv(user, batchId);
  }
  const db = readDb();
  assertBatchAccess(db, user, batchId);
  const rows = db.students
    .filter((student) => student.batch_id === batchId)
    .map((student) => {
      const state = toStudentWithState(db, student.id);
      return [
        state?.full_name ?? "",
        state?.phone ?? "",
        state?.code ?? "",
        state?.code_status ?? "",
        state?.submission_status ?? "",
        state?.booking_number ?? ""
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",");
    });
  return {
    filename: `students-${batchId}.csv`,
    csv: ["الاسم,الهاتف,الرمز,حالة الرمز,الحجز,رقم الحجز", ...rows].join("\n")
  };
}

export async function confirmPickupDeliveryAction(token: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "يجب تسجيل الدخول أولاً." };
  if (assertPersistenceAllowed() !== "supabase") return { error: "التسليم متاح في وضع Supabase فقط." };
  const result = await sbConfirmPickupDelivery(user, token);
  revalidatePath("/admin/pickup");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return result;
}

function parseProductFormData(formData: FormData) {
  const category_id = String(formData.get("category_id") ?? "").trim();
  const name_ar = String(formData.get("name_ar") ?? "").trim();
  const name_en = String(formData.get("name_en") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceRaw = String(formData.get("price_iqd") ?? "").trim();
  const active = String(formData.get("active") ?? "true") !== "false";
  const sort_order = Number(String(formData.get("sort_order") ?? "0"));
  const scope = String(formData.get("availability_scope") ?? "all") as "all" | "individual" | "selected";
  const batchIds = formData.getAll("batch_ids").map(String).filter(Boolean);
  const formIds = formData.getAll("form_ids").map(String).filter(Boolean);
  const availability =
    scope === "all"
      ? [{ scope: "all" as const }]
      : scope === "individual"
        ? [{ scope: "individual" as const }]
        : [
            ...batchIds.map((batch_id) => ({ scope: "batches" as const, batch_id })),
            ...formIds.map((form_id) => ({ scope: "forms" as const, form_id }))
          ];
  const price_iqd = priceRaw ? Number(priceRaw) : null;
  return { category_id, name_ar, name_en, description, price_iqd, active, sort_order, availability };
}

export async function createProductAction(_state: { error?: string } | undefined, formData: FormData) {
  const user = await requireUser(["OWNER"]);
  const input = parseProductFormData(formData);
  try {
    const {
      createCatalogProduct
    } = await import("@/lib/store/catalog-store");
    await createCatalogProduct(user, input);
    revalidateAdmin();
    redirect("/admin/products");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "تعذر حفظ المنتج." };
  }
}

export async function updateProductAction(_state: { error?: string } | undefined, formData: FormData) {
  const user = await requireUser(["OWNER"]);
  const productId = String(formData.get("product_id") ?? "").trim();
  if (!productId) return { error: "المنتج غير موجود." };
  const input = parseProductFormData(formData);
  try {
    const { updateCatalogProduct } = await import("@/lib/store/catalog-store");
    await updateCatalogProduct(user, productId, input);
    revalidateAdmin();
    redirect("/admin/products");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "تعذر تعديل المنتج." };
  }
}

export async function toggleProductActiveAction(productId: string, active: boolean) {
  await requireUser(["OWNER"]);
  const { setCatalogProductActive } = await import("@/lib/store/catalog-store");
  await setCatalogProductActive(productId, active);
  revalidateAdmin();
}

export async function archiveProductAction(productId: string) {
  await requireUser(["OWNER"]);
  const { archiveCatalogProduct } = await import("@/lib/store/catalog-store");
  await archiveCatalogProduct(productId);
  revalidateAdmin();
}

export async function reorderProductAction(formData: FormData) {
  await requireUser(["OWNER"]);
  const productId = String(formData.get("product_id") ?? "").trim();
  const sort_order = Number(String(formData.get("sort_order") ?? "0"));
  const { reorderCatalogProduct } = await import("@/lib/store/catalog-store");
  await reorderCatalogProduct(productId, sort_order);
  revalidateAdmin();
}

export async function createProductCategoryAction(formData: FormData) {
  await requireUser(["OWNER"]);
  const name_ar = String(formData.get("name_ar") ?? "").trim();
  const name_en = String(formData.get("name_en") ?? "").trim();
  const { createProductCategory } = await import("@/lib/store/catalog-store");
  await createProductCategory(name_ar, name_en || undefined);
  revalidateAdmin();
}

export async function uploadProductImageAction(formData: FormData) {
  await requireUser(["OWNER"]);
  const productId = String(formData.get("product_id") ?? "").trim();
  const file = formData.get("file");
  if (!productId || !(file instanceof File)) return { error: "بيانات الصورة غير مكتملة." };
  if (file.size > MAX_OPTION_IMAGE_BYTES) return { error: "حجم الصورة يتجاوز 5 ميغابايت." };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = sniffAllowedMime(buffer, OPTION_IMAGE_MIMES);
    if (!mimeType) return { error: "نوع الصورة غير مسموح، يرجى استخدام jpg أو png أو webp." };
    const { saveCatalogProductImage } = await import("@/lib/store/catalog-store");
    await saveCatalogProductImage(productId, { buffer, mimeType, originalName: file.name });
    revalidateAdmin();
    return { success: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذر رفع الصورة." };
  }
}

export type { AppUser };
