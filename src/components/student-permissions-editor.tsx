"use client";

import {
  STUDENT_PERMISSION_KEYS,
  STUDENT_PERMISSION_LABELS,
  type StudentCustomizationPermissions,
  type StudentPermissionKey,
  type StudentPermissionPolicy
} from "@/lib/student-permissions";
import { cn } from "@/lib/utils";

function Toggle({
  checked,
  disabled,
  label,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white/80 px-3 py-2",
        disabled && "opacity-60"
      )}
    >
      <span className="text-sm font-bold text-[var(--olive-dark)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full transition-colors",
          checked ? "bg-[var(--olive)]" : "bg-[#cfc3ad]"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-6 w-6 rounded-full bg-white transition-all",
            checked ? "left-1" : "right-1"
          )}
        />
      </button>
    </label>
  );
}

export function StudentPermissionsEditor({
  title,
  description,
  value,
  onChange,
  disabled,
  ceiling
}: {
  title: string;
  description?: string;
  value: StudentCustomizationPermissions;
  onChange: (next: StudentCustomizationPermissions) => void;
  disabled?: boolean;
  /** When set, keys that are false in the ceiling cannot be turned on. */
  ceiling?: StudentCustomizationPermissions;
}) {
  function setKey(key: StudentPermissionKey, next: boolean) {
    if (ceiling && next && !ceiling[key]) return;
    onChange({ ...value, [key]: next });
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-black text-[var(--olive-dark)]">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-7 text-[var(--muted)]">{description}</p> : null}
      </div>
      <div className="grid gap-2">
        {STUDENT_PERMISSION_KEYS.map((key) => {
          const blockedByCeiling = Boolean(ceiling && !ceiling[key]);
          return (
            <Toggle
              key={key}
              label={STUDENT_PERMISSION_LABELS[key]}
              checked={value[key]}
              disabled={disabled || blockedByCeiling}
              onChange={(next) => setKey(key, next)}
            />
          );
        })}
      </div>
    </section>
  );
}

export function OwnerPermissionPolicyEditor({
  value,
  onChange,
  disabled
}: {
  value: StudentPermissionPolicy;
  onChange: (next: StudentPermissionPolicy) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-5">
      <Toggle
        label="السماح للممثل بتعديل صلاحيات تخصيص الطلاب"
        checked={value.allowRepresentativesToConfigure}
        disabled={disabled}
        onChange={(next) =>
          onChange({
            ...value,
            allowRepresentativesToConfigure: next
          })
        }
      />
      <StudentPermissionsEditor
        title="صلاحيات التخصيص الافتراضية للطلاب"
        description="هذه القيم هي الحد الأعلى. الممثل لا يستطيع منح صلاحية أوقفها المالك."
        value={value.defaults}
        disabled={disabled}
        onChange={(defaults) => onChange({ ...value, defaults })}
      />
    </div>
  );
}
