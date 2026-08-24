import { CreateBatchForm } from "@/components/create-batch-form";
import { requireUser } from "@/lib/auth";
import { listRepresentatives } from "@/lib/data";

export default async function NewBatchPage() {
  await requireUser(["OWNER"]);
  const representatives = await listRepresentatives();
  return (
    <div className="mx-auto grid max-w-3xl gap-4 sm:gap-6">
      <div>
        <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">إنشاء دفعة جديدة</h1>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          المنتجات والأزياء تُضبط لاحقاً من النموذج المرتبط بالدفعة، وليس أثناء إنشاء الدفعة.
        </p>
      </div>
      <CreateBatchForm representatives={representatives.map((rep) => ({ id: rep.id, full_name: rep.full_name }))} />
    </div>
  );
}
