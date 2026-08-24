"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateFormUploadSettingsAction } from "@/app/actions";
import { Button, Card, FieldLabel, Select, TextInput } from "@/components/ui";

type FieldConfig = {
  key: string;
  label: string;
  type: string;
  uploadMode?: "single" | "multiple";
  maxFiles?: number;
  required?: boolean;
};

export function FormUploadSettings({ formId, fields }: { formId: string; fields: FieldConfig[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(fields);
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  if (!fields.length) return null;

  return (
    <Card className="mt-4">
      <h3 className="text-xl font-black text-[var(--olive-dark)]">إعدادات رفع الصور</h3>
      <div className="mt-4 grid gap-4">
        {rows.map((field, index) => (
          <div key={field.key} className="rounded-3xl bg-white/60 p-4">
            <p className="font-black text-[var(--olive-dark)]">{field.label}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel>وضع الرفع</FieldLabel>
                <Select
                  value={field.uploadMode ?? "single"}
                  onChange={(event) => {
                    const uploadMode = event.target.value as "single" | "multiple";
                    setRows((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, uploadMode, maxFiles: uploadMode === "single" ? 1 : row.maxFiles ?? 5 } : row
                      )
                    );
                  }}
                >
                  <option value="single">صورة واحدة</option>
                  <option value="multiple">صور متعددة</option>
                </Select>
              </div>
              <div>
                <FieldLabel>الحد الأقصى</FieldLabel>
                <TextInput
                  type="number"
                  min={1}
                  max={10}
                  value={field.maxFiles ?? 1}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((row, i) => (i === index ? { ...row, maxFiles: Number(event.target.value) || 1 } : row))
                    )
                  }
                />
              </div>
              <div>
                <FieldLabel>مطلوب؟</FieldLabel>
                <Select
                  value={field.required ? "yes" : "no"}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((row, i) => (i === index ? { ...row, required: event.target.value === "yes" } : row))
                    )
                  }
                >
                  <option value="no">لا</option>
                  <option value="yes">نعم</option>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button
        className="mt-4"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              await updateFormUploadSettingsAction(formId, rows);
              setMessage("تم حفظ إعدادات الرفع.");
              router.refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "تعذر الحفظ.");
            }
          })
        }
      >
        حفظ إعدادات الرفع
      </Button>
      {message ? <p className="mt-3 text-sm font-bold text-[var(--olive)]">{message}</p> : null}
    </Card>
  );
}
