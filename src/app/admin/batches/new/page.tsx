import { CreateBatchForm } from "@/components/create-batch-form";
import { requireUser } from "@/lib/auth";
import { listRepresentatives } from "@/lib/data";

export default async function NewBatchPage() {
  await requireUser(["OWNER"]);
  const representatives = await listRepresentatives();
  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">Create Batch</p>
        <h1 className="text-4xl font-black text-[var(--olive-dark)]">إنشاء دفعة جديدة</h1>
      </div>
      <CreateBatchForm representatives={representatives.map((rep) => ({ id: rep.id, full_name: rep.full_name }))} />
    </div>
  );
}
