import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyBookingSession } from "@/lib/security";
import { assertPersistenceAllowed } from "@/lib/persistence";
import { storeStudentUpload } from "@/lib/storage/uploads";
import { sniffAllowedMime, STUDENT_UPLOAD_MIMES } from "@/lib/upload-security";
import { STUDENT_UPLOAD_MAX_BYTES } from "@/lib/upload-limits";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = verifyBookingSession(cookieStore.get("warka_booking_session")?.value);
  if (!session?.studentId) return NextResponse.json({ error: "انتهت جلسة الحجز." }, { status: 401 });

  try {
    assertPersistenceAllowed();
  } catch {
    return NextResponse.json({ error: "تعذر رفع الملف." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const fieldKey = String(formData.get("fieldKey") ?? "");
  if (!(file instanceof File) || !fieldKey) {
    return NextResponse.json({ error: "بيانات الملف غير مكتملة." }, { status: 400 });
  }
  if (file.size > STUDENT_UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: "نوع الملف أو حجمه غير مسموح." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = sniffAllowedMime(buffer, STUDENT_UPLOAD_MIMES);
    if (!mimeType) {
      return NextResponse.json({ error: "نوع الملف أو حجمه غير مسموح." }, { status: 400 });
    }
    const stored = await storeStudentUpload(session, fieldKey, {
      buffer,
      mimeType,
      originalName: file.name
    });
    return NextResponse.json(stored);
  } catch {
    return NextResponse.json({ error: "تعذر رفع الملف." }, { status: 400 });
  }
}
