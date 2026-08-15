import { CreateBatchForm } from "@/components/create-batch-form";
import { requireUser } from "@/lib/auth";
import { getUniformTemplateDefinition, listRepresentatives } from "@/lib/data";

export default async function NewBatchPage() {
  await requireUser(["OWNER"]);
  const [representatives, definition] = await Promise.all([listRepresentatives(), getUniformTemplateDefinition()]);
  return (
    <div className="mx-auto grid max-w-3xl gap-4 sm:gap-6">
      <div>
        <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">إنشاء دفعة جديدة</h1>
      </div>
      <CreateBatchForm
        representatives={representatives.map((rep) => ({ id: rep.id, full_name: rep.full_name }))}
        definition={definition}
      />
    </div>
  );
}
