import { NextResponse } from "next/server";
import { analyzeWorkbook } from "@/lib/imports";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "يرجى اختيار ملف Excel." }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls"].includes(extension ?? "")) {
    return NextResponse.json({ error: "الملف يجب أن يكون بصيغة XLS أو XLSX." }, { status: 400 });
  }

  if (file.size > 6 * 1024 * 1024) {
    return NextResponse.json({ error: "حجم الملف أكبر من الحد المسموح." }, { status: 400 });
  }

  return NextResponse.json(await analyzeWorkbook(file));
}
