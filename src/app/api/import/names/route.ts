import { NextResponse } from "next/server";
import { previewPastedNames } from "@/lib/imports";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });

  const body = (await request.json()) as { text?: string; existingNames?: string[] };
  const rows = previewPastedNames(body.text ?? "", body.existingNames ?? []);
  return NextResponse.json({
    totalLines: (body.text ?? "").split(/\r?\n/).filter((line) => line.trim()).length,
    validStudents: rows.filter((row) => row.valid).length,
    duplicates: rows.filter((row) => row.duplicateReason).length,
    skippedRows: rows.filter((row) => !row.valid).length,
    rows
  });
}
