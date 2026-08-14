"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignRepresentativeBatchesAction } from "@/app/actions";
import { Button, Card } from "@/components/ui";

export function AssignBatchesForm({
  representativeId,
  batches,
  selected
}: {
  representativeId: string;
  batches: Array<{ id: string; name: string }>;
  selected: string[];
}) {
  const router = useRouter();
  const [batchIds, setBatchIds] = useState(selected);
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="mt-4 !rounded-[1.5rem] !p-4">
      <h3 className="font-black text-[var(--olive-dark)]">تعيين الدفعات</h3>
      <div className="mt-3 grid gap-2">
        {batches.map((batch) => {
          const checked = batchIds.includes(batch.id);
          return (
            <label key={batch.id} className="flex min-h-11 items-center gap-3 rounded-2xl bg-white/70 px-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  setBatchIds((current) =>
                    event.target.checked ? [...current, batch.id] : current.filter((id) => id !== batch.id)
                  );
                }}
              />
              {batch.name}
            </label>
          );
        })}
      </div>
      <Button
        className="mt-3 min-h-11"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await assignRepresentativeBatchesAction(representativeId, batchIds);
            setMessage("تم تحديث تعيين الدفعات.");
            router.refresh();
          })
        }
      >
        حفظ التعيين
      </Button>
      {message ? <p className="mt-2 text-sm font-bold text-[var(--success)]">{message}</p> : null}
    </Card>
  );
}
