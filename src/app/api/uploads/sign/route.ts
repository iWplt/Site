import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cookies } from "next/headers";
import { verifyBookingSession } from "@/lib/security";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxBytes = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = verifyBookingSession(cookieStore.get("warka_booking_session")?.value);
  if (!session) return NextResponse.json({ error: "انتهت جلسة الحجز." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const fieldKey = String(formData.get("fieldKey") ?? "");
  if (!(file instanceof File) || !fieldKey) {
    return NextResponse.json({ error: "بيانات الملف غير مكتملة." }, { status: 400 });
  }
  if (!allowedTypes.has(file.type) || file.size > maxBytes) {
    return NextResponse.json({ error: "نوع الملف أو حجمه غير مسموح." }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeName = `${randomUUID()}.${extension}`;
  const relativeDir = join(
    "uploads",
    "batch",
    session.batchId ?? "individual",
    "student",
    session.studentId ?? "guest",
    "field",
    fieldKey
  );
  const absoluteDir = join(process.cwd(), "public", relativeDir);
  mkdirSync(absoluteDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  writeFileSync(join(absoluteDir, safeName), buffer);

  const path = `/${relativeDir}/${safeName}`.replaceAll("\\", "/");
  return NextResponse.json({
    path,
    previewUrl: path,
    originalName: file.name,
    mimeType: file.type,
    size: file.size
  });
}
