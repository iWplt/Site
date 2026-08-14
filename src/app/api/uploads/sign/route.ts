import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyBookingSession } from "@/lib/security";
import { assertPersistenceAllowed } from "@/lib/persistence";
import { storeStudentUpload } from "@/lib/storage/uploads";

const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]);
const maxBytes = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = verifyBookingSession(cookieStore.get("warka_booking_session")?.value);
  if (!session) return NextResponse.json({ error: "انتهت جلسة الحجز." }, { status: 401 });

  // Throws in production if Supabase isn't configured — guards against ever falling back to
  // writing student uploads onto the app server's public filesystem in that environment.
  try {
    assertPersistenceAllowed();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر رفع الملف." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const fieldKey = String(formData.get("fieldKey") ?? "");
  if (!(file instanceof File) || !fieldKey) {
    return NextResponse.json({ error: "بيانات الملف غير مكتملة." }, { status: 400 });
  }
  if (!allowedTypes.has(file.type) || file.size > maxBytes) {
    return NextResponse.json({ error: "نوع الملف أو حجمه غير مسموح." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeStudentUpload(session, fieldKey, {
      buffer,
      mimeType: file.type,
      originalName: file.name
    });
    return NextResponse.json(stored);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر رفع الملف." },
      { status: 500 }
    );
  }
}
