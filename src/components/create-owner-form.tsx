"use client";

import { useActionState } from "react";
import { createOwnerAction } from "@/app/actions";
import { Button, Card, FieldLabel, TextInput } from "@/components/ui";

export function CreateOwnerForm() {
  const [state, action, pending] = useActionState(createOwnerAction, undefined);

  return (
    <Card>
      <h2 className="text-2xl font-black text-[var(--olive-dark)]">إضافة مالك</h2>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        ينشئ حساب الدخول وملف المالك معاً. الدور يُثبت من الخادم ولا يمكن اختياره من المتصفح.
      </p>
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
          <FieldLabel required>كلمة المرور الابتدائية</FieldLabel>
          <TextInput name="password" type="password" required minLength={8} className="min-h-12" />
        </div>
        {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
        <Button disabled={pending} className="min-h-12">
          {pending ? "جاري الإنشاء..." : "إنشاء حساب مالك"}
        </Button>
      </form>
    </Card>
  );
}
