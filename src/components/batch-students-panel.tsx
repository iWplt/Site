"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  analyzeExcelAction,
  exportBatchStudentsCsvAction,
  importExcelColumnAction,
  importStudentsAction,
  regenerateStudentCodeAction,
  setAccessCodeStatusAction
} from "@/app/actions";
import { StudentManageList } from "@/components/student-manage-list";
import { Badge, Button, Card, TextArea, TextInput } from "@/components/ui";
import { statusLabels } from "@/lib/demo-data";
import type { ExcelWorkbookPreview, StudentWithState } from "@/lib/types";

export function BatchStudentsPanel({
  batchId,
  students,
  showImport
}: {
  batchId: string;
  students: StudentWithState[];
  showImport?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [paste, setPaste] = useState("");
  const [message, setMessage] = useState<string>();
  const [workbook, setWorkbook] = useState<ExcelWorkbookPreview | null>(null);
  const [sheetName, setSheetName] = useState<string>();
  const [columnKey, setColumnKey] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const filtered = students.filter((student) => {
    if (!query.trim()) return true;
    return [student.full_name, student.phone, student.code].filter(Boolean).some((value) => String(value).includes(query.trim()));
  });

  const activeSheet = useMemo(
    () => workbook?.sheets.find((sheet) => sheet.name === sheetName) ?? workbook?.sheets[0],
    [workbook, sheetName]
  );

  return (
    <div className="grid gap-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث داخل هذه الدفعة فقط" className="min-h-12" />
          <Button className="min-h-12" variant="secondary" onClick={() => router.refresh()}>
            تحديث
          </Button>
          <Button
            className="min-h-12"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await exportBatchStudentsCsvAction(batchId);
                const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = result.filename;
                anchor.click();
                URL.revokeObjectURL(url);
              })
            }
          >
            تصدير CSV
          </Button>
        </div>
      </Card>

      {(showImport || true) && (
        <>
          <Card>
            <h2 className="text-xl font-black text-[var(--olive-dark)]">إضافة طلاب بأسماء ملصقة</h2>
            <TextArea className="mt-3 min-h-40" value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={"علي أحمد حسن\nمصطفى سامر محمد"} />
            <Button
              className="mt-3 min-h-12"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const names = paste.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
                  const result = await importStudentsAction(batchId, names);
                  setMessage(
                    result.error ?? `تم استيراد ${"imported" in result ? result.imported : names.length} اسم إلى هذه الدفعة فقط.`
                  );
                  setPaste("");
                  router.refresh();
                })
              }
            >
              استيراد الأسماء إلى هذه الدفعة
            </Button>
          </Card>

          <Card>
            <h2 className="text-xl font-black text-[var(--olive-dark)]">استيراد Excel لهذه الدفعة</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">ارفع XLS/XLSX، اختر الورقة وعمود الأسماء، ثم أكّد الاستيراد إلى هذه الدفعة فقط.</p>
            <label className="mt-4 grid min-h-28 cursor-pointer place-items-center rounded-3xl border border-dashed border-[var(--olive)] bg-white/60 p-6 text-center font-bold text-[var(--olive)]">
              اختر ملف Excel
              <input
                className="hidden"
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  startTransition(async () => {
                    const form = new FormData();
                    form.append("file", file);
                    const result = await analyzeExcelAction(form);
                    if ("error" in result && result.error) {
                      setMessage(result.error);
                      return;
                    }
                    const preview = result as ExcelWorkbookPreview;
                    setWorkbook(preview);
                    setSheetName(preview.sheets[0]?.name);
                    setColumnKey(preview.sheets[0]?.columns[0]?.key);
                  });
                }}
              />
            </label>
            {activeSheet ? (
              <div className="mt-4 grid gap-3">
                <select
                  className="min-h-12 rounded-2xl border border-[var(--border)] bg-white px-4"
                  value={activeSheet.name}
                  onChange={(event) => {
                    setSheetName(event.target.value);
                    const next = workbook?.sheets.find((sheet) => sheet.name === event.target.value);
                    setColumnKey(next?.columns[0]?.key);
                  }}
                >
                  {workbook?.sheets.map((sheet) => (
                    <option key={sheet.name} value={sheet.name}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
                <label className="text-sm font-bold text-[var(--olive-dark)]">اختر العمود الذي يحتوي على أسماء الطلاب</label>
                <select
                  className="min-h-12 rounded-2xl border border-[var(--border)] bg-white px-4"
                  value={columnKey}
                  onChange={(event) => setColumnKey(event.target.value)}
                >
                  {activeSheet.columns.map((column) => (
                    <option key={column.key} value={column.key}>
                      {column.label}
                    </option>
                  ))}
                </select>
                <Button
                  className="min-h-12"
                  disabled={isPending || !columnKey}
                  onClick={() =>
                    startTransition(async () => {
                      if (!columnKey) return;
                      const result = await importExcelColumnAction(batchId, activeSheet.rows, columnKey);
                      setMessage(
                        result.error ??
                          `تم استيراد ${"imported" in result ? result.imported : 0} اسماً من Excel إلى هذه الدفعة.`
                      );
                      router.refresh();
                    })
                  }
                >
                  تأكيد استيراد العمود المحدد
                </Button>
              </div>
            ) : null}
          </Card>
        </>
      )}

      {message ? <p className="rounded-2xl bg-[#3f472d12] p-3 text-sm font-bold text-[var(--olive)]">{message}</p> : null}

      <StudentManageList
        students={filtered}
        empty={<Card>لم تتم إضافة طلاب لهذه الدفعة حتى الآن.</Card>}
        renderDetails={(student) => (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-black text-[var(--olive-dark)]">{student.full_name}</h3>
              <Badge>{statusLabels[student.code_status ?? "ACTIVE"]}</Badge>
              <Badge tone={student.submission_status === "submitted" ? "green" : "gold"}>
                {statusLabels[student.submission_status ?? "pending"]}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{student.phone ?? "لا يوجد هاتف"}</p>
            <div className="mt-3 inline-flex max-w-full rounded-2xl bg-[#3f472d0d] px-4 py-2 text-xl font-black tracking-[0.18em] ltr">
              {student.code ?? "------"}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                className="min-h-12"
                variant="secondary"
                onClick={async () => {
                  if (student.code) {
                    await navigator.clipboard.writeText(student.code);
                    setMessage(`تم نسخ ${student.code}`);
                  }
                }}
              >
                نسخ الرمز
              </Button>
              <Button
                className="min-h-12"
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await regenerateStudentCodeAction(student.id);
                    setMessage(`رمز جديد: ${result.code}`);
                    router.refresh();
                  })
                }
              >
                تغيير الرمز
              </Button>
              <Button
                className="min-h-12"
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await setAccessCodeStatusAction(student.id, student.code_status === "DISABLED" ? "ACTIVE" : "DISABLED");
                    router.refresh();
                  })
                }
              >
                {student.code_status === "DISABLED" ? "تفعيل" : "تعطيل"}
              </Button>
              {student.booking_number ? (
                <Button className="min-h-12" variant="ghost" onClick={() => router.push(`/admin/orders?q=${student.booking_number}`)}>
                  عرض الحجز
                </Button>
              ) : (
                <div />
              )}
            </div>
          </>
        )}
      />
    </div>
  );
}
