"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyFormConfigurationAction } from "@/app/actions";
import { Button, Card, FieldLabel, Select } from "@/components/ui";
import type { CopyFormSlices } from "@/lib/form-config";
import type { FormSummary } from "@/lib/types";

const SLICE_LABELS: Array<{ key: keyof CopyFormSlices; label: string }> = [
  { key: "products", label: "المنتجات" },
  { key: "models", label: "الموديلات" },
  { key: "outfits", label: "الأزياء الكاملة" },
  { key: "singleItem", label: "إعدادات الحجز المفرد" },
  { key: "customizations", label: "التخصيصات" },
  { key: "ordering", label: "الترتيب" },
  { key: "visibility", label: "الظهور" }
];

export function FormCopyPanel({
  formId,
  forms
}: {
  formId: string;
  forms: Array<Pick<FormSummary, "id" | "name">>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sourceId, setSourceId] = useState("");
  const [slices, setSlices] = useState<CopyFormSlices>({
    products: true,
    models: true,
    outfits: true,
    singleItem: true,
    customizations: true,
    ordering: true,
    visibility: true
  });
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string>();
  const others = forms.filter((form) => form.id !== formId);

  function toggle(key: keyof CopyFormSlices) {
    setSlices((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <Card>
      <h2 className="text-xl font-black text-[var(--olive-dark)]">نسخ إعدادات من نموذج</h2>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        يُعاد استخدام منتجات الكتالوج الحالية. لا تُنسخ الطلبات أو الملفات التاريخية.
      </p>
      {!others.length ? (
        <p className="mt-3 text-sm font-bold text-[var(--muted)]">لا يوجد نموذج آخر للنسخ منه.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          <div>
            <FieldLabel required>النموذج المصدر</FieldLabel>
            <Select
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
            >
              <option value="">اختر نموذجاً</option>
              {others.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            {SLICE_LABELS.map((slice) => (
              <label key={slice.key} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--olive-dark)]">
                <input type="checkbox" checked={Boolean(slices[slice.key])} onChange={() => toggle(slice.key)} />
                {slice.label}
              </label>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-[var(--olive-dark)]">
            <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
            أؤكد استبدال الإعدادات المحددة في هذا النموذج
          </label>
          {message ? <p className="text-sm font-bold text-[var(--olive)]">{message}</p> : null}
          <Button
            type="button"
            disabled={pending || !sourceId || !confirm}
            onClick={() =>
              startTransition(async () => {
                const result = await copyFormConfigurationAction(formId, sourceId, slices);
                if (result.error) {
                  setMessage(result.error);
                  return;
                }
                setMessage("✓ تم نسخ الإعدادات");
                router.refresh();
              })
            }
          >
            {pending ? "جاري النسخ..." : "نسخ الإعدادات المحددة"}
          </Button>
        </div>
      )}
    </Card>
  );
}
