"use client";

import { useActionState, useState } from "react";
import { createIndividualStudentAction } from "@/app/actions";
import { UniformPicker } from "@/components/uniform-picker";
import { Button, Card, FieldLabel, TextArea, TextInput } from "@/components/ui";
import type { FormDefinition } from "@/lib/types";

export function CreateIndividualStudentForm({ definition }: { definition: FormDefinition }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createIndividualStudentAction, undefined);

  if (!open) {
    return (
      <Button type="button" className="min-h-12 w-full sm:w-auto" onClick={() => setOpen(true)}>
        + إضافة طالب فردي
      </Button>
    );
  }

  return (
    <Card className="!rounded-[1.35rem]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--gold)]">حجز فردي</p>
          <h2 className="text-xl font-black text-[var(--olive-dark)]">إضافة طالب فردي</h2>
        </div>
        <button type="button" className="text-sm font-bold text-[var(--muted)]" onClick={() => setOpen(false)}>
          إغلاق
        </button>
      </div>
      <form action={action} className="mt-4 grid gap-4">
        <div>
          <FieldLabel required>اسم الطالب</FieldLabel>
          <TextInput name="full_name" required className="min-h-12" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>الهاتف</FieldLabel>
            <TextInput name="phone" className="min-h-12" placeholder="07xx xxx xxxx" />
          </div>
          <div>
            <FieldLabel>العنوان</FieldLabel>
            <TextInput name="address" className="min-h-12" />
          </div>
        </div>
        <div>
          <FieldLabel>ملاحظات</FieldLabel>
          <TextArea name="notes" className="min-h-24" />
        </div>
        <div>
          <h3 className="mb-2 font-black text-[var(--olive-dark)]">تثبيت خيارات لهذا الطالب (اختياري)</h3>
          <p className="mb-3 text-sm text-[var(--muted)]">يثبّت خيارات من منتجات النموذج المفعّلة فقط، أو اتركها فارغة ليختار الطالب.</p>
          <UniformPicker definition={definition} />
        </div>
        {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
        {state?.code ? (
          <p className="rounded-2xl bg-[#386a3d12] p-3 text-sm font-bold text-[var(--success)]">
            تم الإنشاء. الرمز: <span className="ltr">{state.code}</span>
          </p>
        ) : null}
        <Button disabled={pending} className="min-h-12">
          {pending ? "جاري الحفظ..." : "إنشاء الطالب والرمز"}
        </Button>
      </form>
    </Card>
  );
}
