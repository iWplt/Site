import dynamic from "next/dynamic";
import { requireUser } from "@/lib/auth";
import { listBatches } from "@/lib/data";

const ImportWorkspace = dynamic(() => import("@/components/import-workspace").then((mod) => mod.ImportWorkspace), {
  loading: () => <p className="text-[var(--muted)]">جاري تحميل أداة الاستيراد...</p>
});

export default async function ImportPage() {
  const user = await requireUser();
  const batches = await listBatches(user);
  return (
    <div className="grid gap-4 sm:gap-6">
      <div>
        <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">استيراد الطلاب</h1>
        <p className="mt-2 text-[var(--muted)]">الاستيراد مرتبط بدفعة محددة ولا يخلط الطلاب بين الدفعات.</p>
      </div>
      <ImportWorkspace batches={batches.map((batch) => ({ id: batch.id, name: batch.name }))} />
    </div>
  );
}
