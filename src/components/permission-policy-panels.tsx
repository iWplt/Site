"use client";

import { useState, useTransition } from "react";
import {
  updateBatchPermissionPolicyAction,
  updateFormPermissionPolicyAction,
  updateStudentCustomizationPermissionsAction
} from "@/app/actions";
import { OwnerPermissionPolicyEditor, StudentPermissionsEditor } from "@/components/student-permissions-editor";
import {
  DEFAULT_STUDENT_PERMISSIONS,
  normalizeStudentPermissionPolicy,
  normalizeStudentPermissions,
  type StudentCustomizationPermissions,
  type StudentPermissionOverride,
  type StudentPermissionPolicy
} from "@/lib/student-permissions";
import { Button } from "@/components/ui";

export function BatchPermissionPolicyPanel({
  batchId,
  initial
}: {
  batchId: string;
  initial?: StudentPermissionPolicy | null;
}) {
  const [policy, setPolicy] = useState(() => normalizeStudentPermissionPolicy(initial));
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <section className="warka-card space-y-4 rounded-[1.5rem] p-4 sm:p-5">
      <h2 className="text-xl font-black text-[var(--olive-dark)]">صلاحيات تخصيص الطلاب</h2>
      <p className="text-sm leading-7 text-[var(--muted)]">
        يحدّد المالك الصلاحيات الافتراضية وما إذا كان الممثلون يستطيعون تعديلها لكل طالب.
      </p>
      <OwnerPermissionPolicyEditor value={policy} onChange={setPolicy} disabled={pending} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await updateBatchPermissionPolicyAction(batchId, policy);
              setMessage(result.success ? "تم الحفظ" : result.error);
            });
          }}
        >
          حفظ الصلاحيات
        </Button>
        {message ? <span className="text-xs font-bold text-[var(--olive)]">{message}</span> : null}
      </div>
    </section>
  );
}

export function FormPermissionPolicyPanel({
  formId,
  initial
}: {
  formId: string;
  initial?: StudentPermissionPolicy | null;
}) {
  const [policy, setPolicy] = useState(() => normalizeStudentPermissionPolicy(initial));
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <section className="warka-card space-y-4 rounded-[1.5rem] p-4 sm:p-5">
      <h2 className="text-xl font-black text-[var(--olive-dark)]">صلاحيات تخصيص الطلاب</h2>
      <OwnerPermissionPolicyEditor value={policy} onChange={setPolicy} disabled={pending} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await updateFormPermissionPolicyAction(formId, policy);
              setMessage(result.success ? "تم الحفظ" : result.error);
            });
          }}
        >
          حفظ الصلاحيات
        </Button>
        {message ? <span className="text-xs font-bold text-[var(--olive)]">{message}</span> : null}
      </div>
    </section>
  );
}

export function StudentPermissionOverridePanel({
  studentId,
  policy,
  initialOverride,
  canEdit,
  allowAboveCeiling
}: {
  studentId: string;
  policy: StudentPermissionPolicy;
  initialOverride?: StudentPermissionOverride | null;
  canEdit: boolean;
  allowAboveCeiling: boolean;
}) {
  const ceiling = normalizeStudentPermissions(policy.defaults);
  const [value, setValue] = useState<StudentCustomizationPermissions>(() =>
    normalizeStudentPermissions({ ...ceiling, ...(initialOverride ?? {}) })
  );
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!canEdit && !initialOverride) {
    return (
      <section className="warka-card rounded-[1.5rem] p-4 sm:p-5">
        <h2 className="text-lg font-black text-[var(--olive-dark)]">صلاحيات تخصيص هذا الطالب</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">يستخدم هذا الطالب الصلاحيات الافتراضية للدفعية/النموذج.</p>
      </section>
    );
  }

  return (
    <section className="warka-card space-y-4 rounded-[1.5rem] p-4 sm:p-5">
      <StudentPermissionsEditor
        title="صلاحيات تخصيص هذا الطالب"
        description={
          allowAboveCeiling
            ? "تجاوز خاص بهذا الطالب (صلاحية المالك)."
            : "يمكن تقييد الصلاحيات ضمن الحد الذي حدّده المالك فقط."
        }
        value={value}
        ceiling={allowAboveCeiling ? undefined : ceiling}
        disabled={!canEdit || pending}
        onChange={setValue}
      />
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await updateStudentCustomizationPermissionsAction(studentId, value);
                setMessage(result.success ? "تم الحفظ" : result.error);
              });
            }}
          >
            حفظ صلاحيات الطالب
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await updateStudentCustomizationPermissionsAction(studentId, null);
                if (result.success) setValue({ ...DEFAULT_STUDENT_PERMISSIONS, ...ceiling });
                setMessage(result.success ? "تمت إعادة الافتراضي" : result.error);
              });
            }}
          >
            إعادة للافتراضي
          </Button>
          {message ? <span className="text-xs font-bold text-[var(--olive)]">{message}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
