"use client";

import { useActionState } from "react";
import { saveBatchUniformAction } from "@/app/actions";
import { UniformPicker } from "@/components/uniform-picker";
import { Button, Card } from "@/components/ui";
import type { FormDefinition } from "@/lib/types";
import type { UniformSelectionMap } from "@/lib/form-uniform";

export function BatchUniformForm({
  formId,
  definition,
  value
}: {
  formId: string;
  definition: FormDefinition;
  value: UniformSelectionMap;
}) {
  const [state, action, pending] = useActionState(saveBatchUniformAction, undefined);

  return (
    <Card className="!rounded-[1.35rem]">
      <p className="text-xs font-bold text-[var(--gold)]">Batch Uniform</p>
      <h2 className="text-2xl font-black text-[var(--olive-dark)]">الزي الموحد للدفعة</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        الخيارات المثبتة تظهر وحدها في نموذج الطالب. الطلبات المرسلة سابقاً لا تتغير.
      </p>
      <form action={action} className="mt-4 grid gap-4">
        <input type="hidden" name="form_id" value={formId} />
        <UniformPicker definition={definition} value={value} />
        {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
        {state?.success ? <p className="rounded-2xl bg-[#386a3d12] p-3 text-sm font-bold text-[var(--success)]">تم حفظ الزي الموحد.</p> : null}
        <Button disabled={pending} className="min-h-12">
          {pending ? "جاري الحفظ..." : "حفظ الزي الموحد"}
        </Button>
      </form>
    </Card>
  );
}
