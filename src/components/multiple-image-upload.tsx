"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useState } from "react";
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
  accept = ["image/jpeg", "image/png", "image/webp"],
  maxFiles = 1,
  multiple = false,
  value,
  onChange,
  error
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const limit = multiple ? maxFiles : 1;

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const remaining = limit - value.length;
    if (remaining <= 0) {
      setLocalError(`الحد الأقصى ${limit} صور.`);
      return;
    }

    setUploading(true);
    setLocalError(undefined);
    try {
      const next = [...value];
      const selected = Array.from(fileList).slice(0, remaining);
      for (const file of selected) {
        if (!accept.includes(file.type)) {
          setLocalError("صيغة الملف غير مدعومة.");
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
        <p className="text-xs font-bold text-[var(--olive)]">
          {value.length} / {limit} صور
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {value.map((file, index) => (
          <div key={`${file.path}-${index}`} className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.previewUrl ?? file.path} alt="" className="aspect-square w-full object-cover" />
            <button
              type="button"
              className="absolute left-2 top-2 rounded-full bg-[#9d2f2f] p-2 text-white"
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
              capture="environment"
              multiple={multiple}
              className="hidden"
              onChange={(event) => uploadFiles(event.target.files)}
            />
          </label>
        ) : null}
      </div>
      {(error || localError) && <p className="mt-2 text-sm font-bold text-[var(--danger)]">{error || localError}</p>}
    </div>
  );
}
