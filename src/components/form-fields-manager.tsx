"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateFormFieldMetaAction } from "@/app/actions";
import { Card } from "@/components/ui";
import { FIELD_TYPE_LABELS } from "@/lib/form-summary";
import type { FormDefinition } from "@/lib/types";

export function FormFieldsManager({
  formId,
  definition,
  canManage
}: {
  formId: string;
  definition: FormDefinition;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-4">
      {definition.sections.map((section) => (
        <Card key={section.id} className="!rounded-[1.4rem]">
          <h3 className="text-xl font-black text-[var(--olive-dark)]">{section.title}</h3>
          {section.description ? <p className="mt-1 text-sm text-[var(--muted)]">{section.description}</p> : null}
          <div className="mt-4 grid gap-3">
            {section.fields.map((field) => (
              <div key={field.id} className="rounded-[1.15rem] border border-[var(--border)] bg-white/60 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--gold)]">{field.key}</p>
                    <p className="font-black text-[var(--olive-dark)]">{field.label}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{FIELD_TYPE_LABELS[field.type] ?? field.type}</p>
                  </div>
                  {canManage ? (
                  <label className="inline-flex items-center gap-2 rounded-2xl bg-[#3f472d0d] px-3 py-2 text-sm font-bold text-[var(--olive)]">
                    <input
                      type="checkbox"
                      defaultChecked={Boolean(field.required)}
                      disabled={pending}
                      onChange={(event) => {
                        const required = event.target.checked;
                        startTransition(async () => {
                          await updateFormFieldMetaAction(formId, field.key, { required });
                          router.refresh();
                        });
                      }}
                    />
                    مطلوب
                  </label>
                  ) : (
                    <p className="text-xs font-bold text-[var(--muted)]">{field.required ? "مطلوب" : "اختياري"}</p>
                  )}
                </div>
                {field.options?.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {field.options.map((option) => (
                      <li key={option.id} className="rounded-full bg-[#3f472d0d] px-3 py-1 text-xs font-bold text-[var(--olive)]">
                        {option.label}
                        {option.children?.length ? ` (${option.children.length})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
