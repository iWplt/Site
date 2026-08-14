"use client";

import { useActionState } from "react";
import { createBatchAction } from "@/app/actions";
import { Button, Card, FieldLabel, TextArea, TextInput } from "@/components/ui";

export function CreateBatchForm({
  representatives
}: {
  representatives: Array<{ id: string; full_name: string }>;
}) {
  const [state, action, pending] = useActionState(createBatchAction, undefined);

  return (
    <Card>
      <form action={action} className="grid gap-4">
        <div>
          <FieldLabel required>اسم الدفعة</FieldLabel>
          <TextInput name="name" required placeholder="هندسة تقنيات الأمن السيبراني 2027" className="min-h-12" />
        </div>
        <div>
          <FieldLabel required>الجامعة</FieldLabel>
          <TextInput name="university" required defaultValue="جامعة العين العراقية" className="min-h-12" />
        </div>
        <div>
          <FieldLabel required>الكلية</FieldLabel>
          <TextInput name="college" required className="min-h-12" />
        </div>
        <div>
          <FieldLabel required>القسم</FieldLabel>
          <TextInput name="department" required className="min-h-12" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel required>المرحلة</FieldLabel>
            <TextInput name="stage" required defaultValue="الرابعة" className="min-h-12" />
          </div>
          <div>
            <FieldLabel required>سنة التخرج</FieldLabel>
            <TextInput name="graduation_year" type="number" required defaultValue="2027" className="min-h-12" />
          </div>
        </div>
        <div>
          <FieldLabel>وصف اختياري</FieldLabel>
          <TextArea name="description" className="min-h-28" />
        </div>
        <div>
          <FieldLabel>الممثل</FieldLabel>
          <select name="representative_id" className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4">
            <option value="">بدون ممثل حالياً</option>
            {representatives.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>حالة الدفعة</FieldLabel>
          <select name="status" defaultValue="active" className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4">
            <option value="draft">مسودة</option>
            <option value="active">نشطة</option>
            <option value="closed">مغلقة</option>
            <option value="archived">مؤرشفة</option>
          </select>
        </div>
        {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
        <Button disabled={pending} className="min-h-12">
          {pending ? "جاري الحفظ..." : "إنشاء الدفعة"}
        </Button>
      </form>
    </Card>
  );
}
