import { NextResponse } from "next/server";
import { analyzeWorkbook } from "@/lib/imports";

const allowedTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream"
]);

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "يرجى اختيار ملف Excel." }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls"].includes(extension ?? "") || !allowedTypes.has(file.type || "application/octet-stream")) {
    return NextResponse.json({ error: "الملف يجب أن يكون بصيغة XLS أو XLSX." }, { status: 400 });
  }

  if (file.size > 6 * 1024 * 1024) {
    return NextResponse.json({ error: "حجم الملف أكبر من الحد المسموح." }, { status: 400 });
  }

  return NextResponse.json(await analyzeWorkbook(file));
}
