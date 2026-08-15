"use client";

import { useActionState } from "react";
import { createFormAction } from "@/app/actions";
import { Button, FieldLabel, TextInput } from "@/components/ui";

export function CreateFormPanel({ batches }: { batches: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(createFormAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <div>
        <FieldLabel required>اسم النموذج</FieldLabel>
        <TextInput name="name" required className="min-h-12" />
      </div>
      <div>
        <FieldLabel required>الرابط العام</FieldLabel>
        <TextInput name="slug" required placeholder="cybersecurity-2027" className="min-h-12 ltr" />
      </div>
      <div>
        <FieldLabel>الوصف الداخلي</FieldLabel>
        <TextInput name="internal_description" className="min-h-12" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>النوع</FieldLabel>
          <select name="type" className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4">
            <option value="BATCH">نموذج دفعة</option>
            <option value="INDIVIDUAL">طلب فردي</option>
          </select>
        </div>
        <div>
          <FieldLabel>الدفعة</FieldLabel>
          <select name="batch_id" className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4">
            <option value="">بدون دفعة</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
      <Button disabled={pending} className="min-h-12">
        {pending ? "جاري الإنشاء..." : "إنشاء النموذج"}
      </Button>
    </form>
  );
}
