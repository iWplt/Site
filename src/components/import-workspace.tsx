"use client";

import { useState, useTransition } from "react";
import { Button, Card, TextArea } from "@/components/ui";
import type { ExcelWorkbookPreview, ImportPreviewRow } from "@/lib/types";

export function ImportWorkspace() {
  const [names, setNames] = useState("");
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [workbook, setWorkbook] = useState<ExcelWorkbookPreview | null>(null);
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
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">إضافة الطلاب باستخدام الأسماء الملصقة</h2>
        <p className="mt-2 leading-8 text-[var(--muted)]">كل سطر يمثل طالباً واحداً. ستظهر معاينة قبل الحفظ.</p>
        <TextArea className="mt-5 min-h-56" value={names} onChange={(event) => setNames(event.target.value)} placeholder={"Ali Ahmed Hassan\nMustafa Samer Mohammed\nHussein Ali Jabbar"} />
        <Button className="mt-4" disabled={isPending} onClick={previewNames}>تحليل الأسماء</Button>
        <PreviewTable rows={rows} />
      </Card>
      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">استيراد ملف Excel</h2>
        <p className="mt-2 leading-8 text-[var(--muted)]">ارفع XLS أو XLSX، ثم اختر الورقة والعمود الذي يحتوي على أسماء الطلاب.</p>
        <label className="mt-5 grid cursor-pointer place-items-center rounded-3xl border border-dashed border-[var(--olive)] bg-white/60 p-10 text-center font-bold text-[var(--olive)]">
          اختر ملف Excel
          <input className="hidden" type="file" accept=".xlsx,.xls" onChange={(event) => event.target.files?.[0] && analyzeExcel(event.target.files[0])} />
        </label>
        {workbook ? (
          <div className="mt-6 grid gap-4">
            {workbook.sheets.map((sheet) => (
              <div key={sheet.name} className="rounded-3xl bg-white/60 p-4">
                <h3 className="font-black text-[var(--olive-dark)]">{sheet.name}</h3>
                <p className="mt-2 text-sm font-bold text-[var(--muted)]">الأعمدة المكتشفة</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sheet.columns.map((column) => (
                    <button key={column.key} className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-sm font-bold">{column.label}</button>
                  ))}
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[500px] text-sm">
                    <tbody>
                      {sheet.rows.slice(0, 5).map((row, index) => (
                        <tr key={index} className="border-b border-[var(--border)]">
                          {sheet.columns.slice(0, 5).map((column) => (
                            <td key={column.key} className="p-2">{String(row[column.key] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
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
