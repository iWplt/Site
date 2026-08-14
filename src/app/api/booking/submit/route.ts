import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { demoForm, demoStudents } from "@/lib/demo-data";
import { getPublicForm } from "@/lib/data";
import { hasSupabaseConfig } from "@/lib/env";
import { verifyBookingSession } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { submissionSchema, validateDynamicAnswers } from "@/lib/validation";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = verifyBookingSession(cookieStore.get("warka_booking_session")?.value);
  if (!session) return NextResponse.json({ error: "انتهت جلسة الحجز، يرجى إدخال الرمز مرة أخرى." }, { status: 401 });

  const body = await request.json();
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success || parsed.data.slug !== session.slug) {
    return NextResponse.json({ error: "بيانات الطلب غير صحيحة." }, { status: 400 });
  }

  const form = await getPublicForm(session.slug);
  if (!form || form.id !== session.formId) {
    return NextResponse.json({ error: "النموذج غير متاح حالياً." }, { status: 404 });
  }

  const answers = {
    ...parsed.data.answers,
    student_name: session.studentName
  };
  const validation = validateDynamicAnswers(form.definition, answers);
  if (!validation.valid) return NextResponse.json({ error: "يرجى مراجعة الحقول المطلوبة.", fieldErrors: validation.errors }, { status: 422 });

  if (!hasSupabaseConfig()) {
    const student = demoStudents.find((entry) => entry.id === session.studentId);
    return NextResponse.json({
      bookingNumber: "WK-2027-00582",
      studentName: student?.full_name ?? session.studentName ?? "عميل WARKA",
      status: "SUBMITTED",
      submittedAt: new Date().toISOString()
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("submit_booking_transaction", {
    p_form_id: session.formId,
    p_batch_id: session.batchId ?? null,
    p_student_id: session.studentId ?? null,
    p_access_code_id: session.accessCodeId ?? null,
    p_answers: answers,
    p_files: parsed.data.files
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  cookieStore.delete("warka_booking_session");
  return NextResponse.json(data);
}
