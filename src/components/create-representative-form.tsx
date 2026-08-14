"use client";

import { useActionState } from "react";
import { createRepresentativeAction } from "@/app/actions";
import { Button, Card, FieldLabel, TextInput } from "@/components/ui";

export function CreateRepresentativeForm({ batches }: { batches: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(createRepresentativeAction, undefined);

  return (
    <Card>
      <h2 className="text-2xl font-black text-[var(--olive-dark)]">إنشاء ممثل</h2>
      <form action={action} className="mt-4 grid gap-4">
        <div>
          <FieldLabel required>الاسم</FieldLabel>
          <TextInput name="full_name" required className="min-h-12" />
        </div>
        <div>
          <FieldLabel>الهاتف</FieldLabel>
          <TextInput name="phone" className="min-h-12" />
        </div>
        <div>
          <FieldLabel required>البريد لتسجيل الدخول</FieldLabel>
          <TextInput name="email" type="email" required className="min-h-12" />
        </div>
        <div>
          <FieldLabel>كلمة المرور الابتدائية</FieldLabel>
          <TextInput name="password" defaultValue="rep123" className="min-h-12" />
        </div>
        <div>
          <FieldLabel>تعيين الدفعات</FieldLabel>
          <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-white/60 p-3">
            {batches.map((batch) => (
              <label key={batch.id} className="flex items-center gap-3 text-sm font-bold">
                <input type="checkbox" name="batch_ids" value={batch.id} />
                {batch.name}
              </label>
            ))}
            {!batches.length ? <p className="text-sm text-[var(--muted)]">أنشئ دفعة أولاً.</p> : null}
          </div>
        </div>
        {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
        <Button disabled={pending} className="min-h-12">
          {pending ? "جاري الإنشاء..." : "إنشاء حساب الممثل"}
        </Button>
      </form>
    </Card>
  );
}
