import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sbExportOrders } from "@/lib/store/supabase-db";
import type { OrderStatus } from "@/lib/types";
import { assertPersistenceAllowed } from "@/lib/persistence";

const headers = [
  "رقم الحجز",
  "اسم الطالب",
  "الهاتف",
  "العنوان",
  "الدفعة",
  "نوع الحجز",
  "الروب",
  "إضافات الروب",
  "الوشاح",
  "التطريز",
  "القبعة",
  "الحالة",
  "تاريخ الإنشاء",
  "تاريخ التحديث"
] as const;

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول أولاً." }, { status: 401 });
  if (user.role !== "OWNER") return NextResponse.json({ error: "التصدير متاح للمالك فقط." }, { status: 403 });
  if (assertPersistenceAllowed() !== "supabase") {
    return NextResponse.json({ error: "التصدير متاح في وضع Supabase فقط." }, { status: 400 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const batchId = url.searchParams.get("batch") || undefined;
  const individualOnly = url.searchParams.get("scope") === "individual";
  const status = (url.searchParams.get("status") || undefined) as OrderStatus | undefined;
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  try {
    const rows = await sbExportOrders(user, {
      batchId: individualOnly ? undefined : batchId,
      individualOnly,
      status: status && status.length ? status : undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined
    });
    const table = rows.map((row) => [
      row.booking_number,
      row.student_name,
      row.phone,
      row.address,
      row.batch,
      row.booking_type,
      row.robe,
      row.robe_additions,
      row.sash,
      row.embroidery,
      row.cap,
      row.status,
      row.created_at,
      row.updated_at
    ]);

    if (format === "csv") {
      const csv = `\uFEFF${[headers.join(","), ...table.map((line) => line.map(csvEscape).join(","))].join("\n")}`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="WARKA-orders-${stamp()}.csv"`
        }
      });
    }

    const XLSX = await import("@e965/xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([ [...headers], ...table ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "الطلبات");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="WARKA-orders-${stamp()}.xlsx"`
      }
    });
  } catch {
    return NextResponse.json({ error: "تعذر تصدير الطلبات." }, { status: 500 });
  }
}
