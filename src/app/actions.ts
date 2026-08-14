"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoForm, demoStudents } from "@/lib/demo-data";
import { hasSupabaseConfig } from "@/lib/env";
import { accessCodeFingerprint, encryptAccessCode, generateNumericCode, signBookingSession } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessCodeSchema } from "@/lib/validation";

const bookingCookie = "warka_booking_session";

export async function verifyAccessCodeAction(_state: { error?: string } | undefined, formData: FormData) {
  const parsed = accessCodeSchema.safeParse({
    slug: formData.get("slug"),
    code: formData.get("code")
  });

  if (!parsed.success) {
    return { error: "رمز الحجز غير صحيح أو غير متاح." };
  }

  const { slug, code } = parsed.data;

  if (!hasSupabaseConfig()) {
    const student = demoStudents.find((entry) => entry.code === code);
    if (!student || student.code_status !== "ACTIVE" || slug !== demoForm.slug) {
      return { error: "رمز الحجز غير صحيح أو غير متاح." };
    }

    const cookieStore = await cookies();
    cookieStore.set(
      bookingCookie,
      signBookingSession({
        formId: demoForm.id,
        slug,
        formType: "BATCH",
        batchId: demoForm.batch_id,
        accessCodeId: "demo-code",
        studentId: student.id,
        studentName: student.full_name,
        expiresAt: Date.now() + 1000 * 60 * 45
      }),
      { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" }
    );
    redirect(`/f/${slug}/book`);
  }

  const admin = createAdminClient();
  const { data: form } = await admin
    .from("booking_forms")
    .select("id, slug, type, status, batch_id, opening_date, closing_date")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const invalid = { error: "رمز الحجز غير صحيح أو غير متاح." };
  if (!form) return invalid;

  const now = Date.now();
  if (form.opening_date && new Date(form.opening_date).getTime() > now) return invalid;
  if (form.closing_date && new Date(form.closing_date).getTime() < now) return invalid;

  const fingerprint = accessCodeFingerprint(code, form.batch_id ?? form.id);
  const { data: accessCode } = await admin
    .from("student_access_codes")
    .select("id, student_id, batch_id, status")
    .eq("form_id", form.id)
    .eq("code_fingerprint", fingerprint)
    .maybeSingle();

  if (!accessCode || accessCode.status !== "ACTIVE") return invalid;

  const { data: student } = await admin
    .from("students")
    .select("id, full_name, batch_id")
    .eq("id", accessCode.student_id)
    .maybeSingle();

  if (!student || student.batch_id !== accessCode.batch_id) return invalid;

  const { data: existing } = await admin
    .from("submissions")
    .select("id")
    .eq("student_id", student.id)
    .eq("form_id", form.id)
    .eq("is_current", true)
    .maybeSingle();

  if (existing) {
    return { error: "تم استخدام رمز الحجز مسبقاً وإرسال الطلب بنجاح." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    bookingCookie,
    signBookingSession({
      formId: form.id,
      slug,
      formType: form.type,
      batchId: form.batch_id ?? undefined,
      accessCodeId: accessCode.id,
      studentId: student.id,
      studentName: student.full_name,
      expiresAt: Date.now() + 1000 * 60 * 45
    }),
    { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" }
  );

  redirect(`/f/${slug}/book`);
}

export async function regenerateStudentCode(studentId: string, formId: string, batchId: string) {
  const code = generateNumericCode();
  if (!hasSupabaseConfig()) return { code };

  const admin = createAdminClient();
  const { error } = await admin.rpc("regenerate_student_access_code", {
    p_student_id: studentId,
    p_form_id: formId,
    p_batch_id: batchId,
    p_code_ciphertext: encryptAccessCode(code),
    p_fingerprint: accessCodeFingerprint(code, batchId)
  });
  if (error) throw error;
  return { code };
}
