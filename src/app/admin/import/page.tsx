import { ImportWorkspace } from "@/components/import-workspace";
import { requireUser } from "@/lib/auth";
import { listBatches } from "@/lib/data";

export default async function ImportPage() {
  const user = await requireUser();
  const batches = await listBatches(user);
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">Student Import</p>
        <h1 className="text-4xl font-black text-[var(--olive-dark)]">استيراد الطلاب</h1>
        <p className="mt-2 text-[var(--muted)]">الاستيراد مرتبط بدفعة محددة ولا يخلط الطلاب بين الدفعات.</p>
      </div>
      <ImportWorkspace batches={batches.map((batch) => ({ id: batch.id, name: batch.name }))} />
    </div>
  );
}
