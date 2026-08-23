"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useState } from "react";
import { optimizeStudentImage } from "@/lib/optimize-student-image";
import {
  STUDENT_UPLOAD_MAX_BYTES,
  STUDENT_UPLOAD_MAX_FILES,
  STUDENT_UPLOAD_TYPES
} from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

export type UploadedFile = {
  path: string;
  originalName: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
};

type Props = {
  fieldKey: string;
  label: string;
  accept?: string[];
  maxFiles?: number;
  multiple?: boolean;
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  error?: string;
};

export function MultipleImageUpload({
  fieldKey,
  label,
  accept = [...STUDENT_UPLOAD_TYPES],
  maxFiles = 1,
  multiple = false,
  value,
  onChange,
  error
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const limit = Math.min(multiple ? maxFiles : 1, STUDENT_UPLOAD_MAX_FILES);
  const maxMb = Math.round(STUDENT_UPLOAD_MAX_BYTES / (1024 * 1024));

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const remaining = limit - value.length;
    if (remaining <= 0) {
      setLocalError(`الحد الأقصى ${limit} ملفات.`);
      return;
    }

    setUploading(true);
    setLocalError(undefined);
    try {
      const next = [...value];
      const selected = Array.from(fileList).slice(0, remaining);
      for (const original of selected) {
        const allowed = accept.includes(original.type) || (original.type === "application/pdf" && accept.includes("application/pdf"));
        if (!allowed) {
          setLocalError("صيغة الملف غير مدعومة. استخدم JPEG أو PNG أو WebP أو PDF.");
          continue;
        }

        let file = original;
        try {
          if (original.type.startsWith("image/")) {
            file = await optimizeStudentImage(original);
          } else if (original.size > STUDENT_UPLOAD_MAX_BYTES) {
            setLocalError(`الملف أكبر من الحد المسموح (${maxMb} ميجابايت).`);
            continue;
          }
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : "تعذر ضغط الصورة.";
          if (original.size > STUDENT_UPLOAD_MAX_BYTES) {
            setLocalError(message);
            continue;
          }
          setLocalError(message);
          continue;
        }

        if (file.size > STUDENT_UPLOAD_MAX_BYTES) {
          setLocalError(`الملف أكبر من الحد المسموح (${maxMb} ميجابايت).`);
          continue;
        }

        const body = new FormData();
        body.append("file", file);
        body.append("fieldKey", fieldKey);
        const response = await fetch("/api/uploads/sign", { method: "POST", body });
        const payload = await response.json();
        if (!response.ok) {
          setLocalError(payload.error ?? "تعذر رفع الملف.");
          continue;
        }
        next.push({
          path: payload.path,
          originalName: payload.originalName ?? file.name,
          mimeType: payload.mimeType ?? file.type,
          size: payload.size ?? file.size,
          previewUrl: payload.previewUrl ?? payload.path
        });
      }
      onChange(next);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
        <p className="text-xs font-bold text-[var(--olive)]">
          {value.length} / {limit}
        </p>
      </div>
      <p className="mb-3 text-xs leading-6 text-[var(--muted)]">
        الصيغ المسموحة: JPEG و PNG و WebP{accept.includes("application/pdf") ? " و PDF" : ""}. الحد {maxMb}{" "}
        ميجابايت لكل ملف. تُضغط الصور تلقائياً قبل الرفع.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {value.map((file, index) => (
          <div key={`${file.path}-${index}`} className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.previewUrl ?? file.path} alt="" className="aspect-square w-full bg-[#f3ead6] object-contain" />
            <button
              type="button"
              className="absolute left-2 top-2 min-h-11 min-w-11 rounded-full bg-[#9d2f2f] p-2 text-white"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label="حذف الصورة"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {value.length < limit ? (
          <label
            className={cn(
              "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--olive)] bg-white/70 p-4 text-center"
            )}
          >
            {uploading ? <Loader2 className="animate-spin text-[var(--olive)]" /> : <ImagePlus className="text-[var(--olive)]" />}
            <span className="text-sm font-bold text-[var(--olive)]">+ إضافة صورة</span>
            <input
              type="file"
              accept={accept.join(",")}
              multiple={multiple}
              className="hidden"
              onChange={(event) => {
                void uploadFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        ) : null}
      </div>
      {(error || localError) && <p className="mt-2 text-sm font-bold text-[var(--danger)]">{error || localError}</p>}
    </div>
  );
}
