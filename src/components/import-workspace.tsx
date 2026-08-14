"use client";

import { useState, useTransition } from "react";
import { importExcelColumnAction, importStudentsAction } from "@/app/actions";
import { Button, Card, TextArea } from "@/components/ui";
import type { ExcelWorkbookPreview, ImportPreviewRow } from "@/lib/types";

export function ImportWorkspace({ batches }: { batches: Array<{ id: string; name: string }> }) {
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [names, setNames] = useState("");
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [workbook, setWorkbook] = useState<ExcelWorkbookPreview | null>(null);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [selectedColumn, setSelectedColumn] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function previewNames() {
    startTransition(async () => {
      const response = await fetch("/api/import/names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: names })
      });
      const payload = await response.json();
      setRows(payload.rows);
    });
  }

  function analyzeExcel(file: File) {
    startTransition(async () => {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/import/excel", { method: "POST", body: form });
      const payload = await response.json();
      setWorkbook(payload);
      setSelectedSheet(0);
      setSelectedColumn(undefined);
    });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <label className="text-sm font-bold text-[var(--olive-dark)]">اختر الدفعة أولاً</label>
        <select
          className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4"
          value={batchId}
          onChange={(event) => setBatchId(event.target.value)}
        >
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name}
            </option>
          ))}
        </select>
        {message ? <p className="mt-3 text-sm font-bold text-[var(--success)]">{message}</p> : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-black text-[var(--olive-dark)]">إضافة الطلاب باستخدام الأسماء الملصقة</h2>
          <TextArea className="mt-5 min-h-56" value={names} onChange={(event) => setNames(event.target.value)} placeholder={"Ali Ahmed Hassan\nMustafa Samer Mohammed"} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={isPending} onClick={previewNames}>
              تحليل الأسماء
            </Button>
            <Button
              disabled={isPending || !batchId}
              onClick={() =>
                startTransition(async () => {
                  const valid = rows.filter((row) => row.valid).map((row) => row.normalizedName);
                  const result = await importStudentsAction(batchId, valid.length ? valid : names.split(/\r?\n/));
                  setMessage(result.error ?? "تم استيراد الأسماء إلى الدفعة المحددة.");
                })
              }
            >
              تأكيد الاستيراد
            </Button>
          </div>
          <PreviewTable rows={rows} />
        </Card>

        <Card>
          <h2 className="text-2xl font-black text-[var(--olive-dark)]">استيراد ملف Excel</h2>
          <label className="mt-5 grid cursor-pointer place-items-center rounded-3xl border border-dashed border-[var(--olive)] bg-white/60 p-10 text-center font-bold text-[var(--olive)]">
            اختر ملف Excel
            <input className="hidden" type="file" accept=".xlsx,.xls" onChange={(event) => event.target.files?.[0] && analyzeExcel(event.target.files[0])} />
          </label>
          {workbook ? (
            <div className="mt-6 grid gap-4">
              <div className="flex flex-wrap gap-2">
                {workbook.sheets.map((sheet, index) => (
                  <button
                    key={sheet.name}
                    type="button"
                    className={`rounded-full px-3 py-1 text-sm font-bold ${selectedSheet === index ? "bg-[var(--olive)] text-white" : "bg-white border border-[var(--border)]"}`}
                    onClick={() => {
                      setSelectedSheet(index);
                      setSelectedColumn(undefined);
                    }}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>
              <p className="text-sm font-bold text-[var(--muted)]">اختر العمود الذي يحتوي على أسماء الطلاب</p>
              <div className="flex flex-wrap gap-2">
                {workbook.sheets[selectedSheet]?.columns.map((column) => (
                  <button
                    key={column.key}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-sm font-bold ${selectedColumn === column.key ? "border-[var(--olive)] bg-[#3f472d12]" : "border-[var(--border)] bg-white"}`}
                    onClick={() => setSelectedColumn(column.key)}
                  >
                    {column.label}
                  </button>
                ))}
              </div>
              <Button
                disabled={!selectedColumn || !batchId || isPending}
                onClick={() =>
                  startTransition(async () => {
                    const sheet = workbook.sheets[selectedSheet];
                    const result = await importExcelColumnAction(batchId, sheet.rows, selectedColumn!);
                    setMessage(result.error ?? "تم استيراد عمود الأسماء إلى الدفعة.");
                  })
                }
              >
                استيراد العمود المحدد
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function PreviewTable({ rows }: { rows: ImportPreviewRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--border)]">
      <div className="grid grid-cols-4 bg-[#3f472d0d] p-3 text-sm font-black">
        <span>السطر</span>
        <span className="col-span-2">الاسم</span>
        <span>الحالة</span>
      </div>
      {rows.map((row) => (
        <div key={`${row.rowNumber}-${row.normalizedName}`} className="grid grid-cols-4 border-t border-[var(--border)] bg-white/60 p-3 text-sm">
          <span>{row.rowNumber}</span>
          <span className="col-span-2 font-bold">{row.normalizedName}</span>
          <span className={row.valid ? "text-[var(--success)]" : "text-[var(--danger)]"}>{row.valid ? "صالح" : row.duplicateReason ?? "متروك"}</span>
        </div>
      ))}
    </div>
  );
}
