import * as XLSX from "@e965/xlsx";
import { normalizeArabicText } from "@/lib/utils";
import type { ExcelWorkbookPreview, ImportPreviewRow } from "@/lib/types";

export function previewPastedNames(input: string, existingNames: string[] = []): ImportPreviewRow[] {
  const existing = new Set(existingNames.map(normalizeArabicText));
  const seen = new Set<string>();

  return input
    .split(/\r?\n/)
    .map((line, index) => ({ line, rowNumber: index + 1 }))
    .filter(({ line }) => line.trim().length > 0)
    .map(({ line, rowNumber }) => {
      const normalizedName = line.replace(/\s+/g, " ").trim();
      const comparable = normalizeArabicText(normalizedName);
      const duplicateReason = existing.has(comparable)
        ? "موجود مسبقاً"
        : seen.has(comparable)
          ? "مكرر داخل القائمة"
          : undefined;
      seen.add(comparable);
      return {
        rowNumber,
        rawValue: line,
        normalizedName,
        duplicateReason,
        valid: normalizedName.length >= 3 && !duplicateReason
      };
    });
}

function columnLabel(index: number) {
  let label = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - remainder) / 26);
  }
  return label;
}

export async function analyzeWorkbook(file: File): Promise<ExcelWorkbookPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  return {
    sheets: workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        header: "A",
        defval: "",
        blankrows: false,
        raw: false
      });
      const width = rows.reduce((max, row) => Math.max(max, Object.keys(row).length), 0);
      const columns = Array.from({ length: width }, (_, index) => {
        const key = columnLabel(index);
        const sampleHeader = String(rows[0]?.[key] ?? "").trim();
        return { key, label: sampleHeader ? `${key} — ${sampleHeader}` : key, index };
      });
      return {
        name,
        columns,
        rows: rows.slice(0, 8)
      };
    })
  };
}

export function previewExcelNames(rows: Record<string, unknown>[], columnKey: string, existingNames: string[] = []) {
  return previewPastedNames(
    rows
      .map((row) => {
        const value = row[columnKey];
        return value == null ? "" : String(value);
      })
      .join("\n"),
    existingNames
  );
}
