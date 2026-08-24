"use client";

import { useActionState } from "react";
import { updateFormGeneralAction } from "@/app/actions";
import { Button, Card, FieldLabel, TextArea, TextInput } from "@/components/ui";
import type { BookingFormRecord } from "@/lib/types";

function toLocalInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function FormGeneralSettings({ form }: { form: BookingFormRecord }) {
  const [state, action, pending] = useActionState(updateFormGeneralAction, undefined);

  return (
    <Card>
      <h2 className="text-2xl font-black text-[var(--olive-dark)]">الإعدادات العامة</h2>
      <form action={action} className="mt-4 grid gap-4">
        <input type="hidden" name="form_id" value={form.id} />
        <div>
          <FieldLabel required>اسم النموذج</FieldLabel>
          <TextInput name="name" required defaultValue={form.name} />
        </div>
        <div>
          <FieldLabel>الرابط العام</FieldLabel>
          <TextInput readOnly value={`/f/${form.slug}`} className="ltr bg-white/70" />
          <p className="mt-2 text-xs font-bold text-[var(--muted)]">الرابط العام ثابت حتى لا تتأثر حجوزات الطلاب الحالية.</p>
        </div>
        <div>
          <FieldLabel>الوصف الداخلي</FieldLabel>
          <TextArea name="internal_description" defaultValue={form.internal_description ?? ""} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>نوع النموذج</FieldLabel>
            <p className="rounded-2xl bg-white/70 px-4 py-3 font-black text-[var(--olive-dark)]">
              {form.type === "INDIVIDUAL" ? "حجز فردي" : "دفعة"}
            </p>
          </div>
          <div>
            <FieldLabel>الحالة</FieldLabel>
            <p className="rounded-2xl bg-white/70 px-4 py-3 font-black text-[var(--olive-dark)]">
              {form.status === "published" ? "منشور" : form.status === "closed" ? "مغلق" : "مسودة"}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>يفتح في</FieldLabel>
            <TextInput type="datetime-local" name="opening_date" defaultValue={toLocalInput(form.opening_date)} className="ltr" />
          </div>
          <div>
            <FieldLabel>يغلق في</FieldLabel>
            <TextInput type="datetime-local" name="closing_date" defaultValue={toLocalInput(form.closing_date)} className="ltr" />
          </div>
        </div>
        {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
        {state?.success ? <p className="rounded-2xl bg-[#386a3d12] p-3 text-sm font-bold text-[var(--success)]">{state.success}</p> : null}
        <Button disabled={pending}>
          {pending ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </form>
    </Card>
  );
}
