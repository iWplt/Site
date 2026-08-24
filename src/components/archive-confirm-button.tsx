"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

function ConfirmSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "جاري الأرشفة..." : label}
    </Button>
  );
}

export function ArchiveConfirmButton({
  label,
  title,
  warning,
  confirmLabel = "تأكيد الأرشفة",
  action,
  hiddenFields
}: {
  label: string;
  title: string;
  warning: string;
  confirmLabel?: string;
  action: (formData: FormData) => Promise<void>;
  hiddenFields?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="danger" className="min-h-11 px-4 py-2" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="archive-title">
          <div className="w-full max-w-md rounded-[1.6rem] bg-[var(--paper)] p-5 shadow-2xl">
            <h3 id="archive-title" className="text-xl font-black text-[var(--olive-dark)]">
              {title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{warning}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <form action={action}>
                {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
                <ConfirmSubmit label={confirmLabel} />
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
