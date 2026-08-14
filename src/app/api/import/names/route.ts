import { NextResponse } from "next/server";
import { previewPastedNames } from "@/lib/imports";

export async function POST(request: Request) {
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
