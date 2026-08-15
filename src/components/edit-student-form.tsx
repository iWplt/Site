"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStudentsAction, updateStudentAction } from "@/app/actions";
import { UniformPicker } from "@/components/uniform-picker";
import { Button, Card, FieldLabel, TextArea, TextInput } from "@/components/ui";
import type { FormDefinition } from "@/lib/types";
import type { UniformSelectionMap } from "@/lib/form-uniform";
import type { StudentWithState } from "@/lib/types";

export function EditStudentForm({
  student,
  definition,
  uniform
}: {
  student: StudentWithState;
  definition: FormDefinition;
  uniform: UniformSelectionMap;
}) {
  const [state, action, pending] = useActionState(updateStudentAction, undefined);

  return (
    <Card>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="student_id" value={student.id} />
        <div>
          <FieldLabel required>اسم الطالب</FieldLabel>
          <TextInput name="full_name" required defaultValue={student.full_name} className="min-h-12" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>الهاتف</FieldLabel>
            <TextInput name="phone" defaultValue={student.phone ?? ""} className="min-h-12" />
          </div>
          <div>
            <FieldLabel>العنوان</FieldLabel>
            <TextInput name="address" defaultValue={student.address ?? ""} className="min-h-12" />
          </div>
        </div>
        <div>
          <FieldLabel>ملاحظات</FieldLabel>
          <TextArea name="notes" defaultValue={student.notes ?? ""} className="min-h-24" />
        </div>
        {!student.batch_id ? (
          <div>
            <h2 className="mb-3 text-xl font-black text-[var(--olive-dark)]">تثبيت خيارات لهذا الطالب</h2>
            <p className="mb-3 text-sm text-[var(--muted)]">اترك الحقول فارغة ليختار الطالب بنفسه.</p>
            <UniformPicker definition={definition} value={uniform} />
          </div>
        ) : null}
        {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
        {state?.success ? <p className="rounded-2xl bg-[#386a3d12] p-3 text-sm font-bold text-[var(--success)]">تم الحفظ.</p> : null}
        <Button disabled={pending} className="min-h-12">
          {pending ? "جاري الحفظ..." : "حفظ"}
        </Button>
      </form>
      <StudentEditDelete student={student} />
    </Card>
  );
}

function StudentEditDelete({ student }: { student: StudentWithState }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-6 border-t border-[var(--border)] pt-4">
      <Button variant="danger" className="min-h-12 w-full" disabled={pending} onClick={() => setConfirm(true)}>
        حذف الطالب
      </Button>
      {message ? <p className="mt-3 text-sm font-bold text-[var(--olive)]">{message}</p> : null}
      {confirm ? (
        <div className="mt-3 rounded-2xl bg-[#9d2f2f12] p-3">
          <p className="font-black text-[var(--danger)]">هل أنت متأكد من حذف {student.full_name}؟</p>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            إذا كان للطالب طلب مسجل فلن يُحذف. وإلا سيُحذف مع رموزه غير المستخدمة وملفاته المؤقتة.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" className="min-h-12" onClick={() => setConfirm(false)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              className="min-h-12"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteStudentsAction([student.id]);
                  setMessage(result.message);
                  setConfirm(false);
                  if (result.deleted) {
                    router.push(student.batch_id ? `/admin/batches/${student.batch_id}/students` : "/admin/students");
                    router.refresh();
                  }
                })
              }
            >
              تأكيد الحذف
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
