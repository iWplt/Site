import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasSupabaseConfig } from "@/lib/env";
import { verifyBookingSession } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxBytes = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = verifyBookingSession(cookieStore.get("warka_booking_session")?.value);
  if (!session) return NextResponse.json({ error: "انتهت جلسة الحجز." }, { status: 401 });

  const body = (await request.json()) as { fieldKey?: string; fileName?: string; mimeType?: string; size?: number };
  if (!body.fieldKey || !body.fileName || !body.mimeType || !body.size) {
    return NextResponse.json({ error: "بيانات الملف غير مكتملة." }, { status: 400 });
  }

  if (!allowedTypes.has(body.mimeType) || body.size > maxBytes) {
    return NextResponse.json({ error: "نوع الملف أو حجمه غير مسموح." }, { status: 400 });
  }

  const extension = body.fileName.split(".").pop()?.toLowerCase() || "bin";
  const path = [
    "batch",
    session.batchId ?? "individual",
    "student",
    session.studentId ?? "guest",
    "submission",
    crypto.randomUUID(),
    `${body.fieldKey}.${extension}`
  ].join("/");

  if (!hasSupabaseConfig()) {
    return NextResponse.json({
      path,
      signedUrl: null,
      demo: true,
      message: "Supabase Storage غير مهيأ محلياً؛ تم إنشاء مسار آمن للملف فقط."
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("booking-uploads").createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ path, signedUrl: data.signedUrl, token: data.token });
}
