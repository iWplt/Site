import { notFound } from "next/navigation";
import { BatchStudentsPanel } from "@/components/batch-students-panel";
import { LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getBatch, listStudents } from "@/lib/data";

export default async function BatchStudentsPage({
  params,
  searchParams
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ import?: string }>;
}) {
  const user = await requireUser();
  const { batchId } = await params;
  const { import: showImport } = await searchParams;
  const batch = await getBatch(user, batchId);
  if (!batch) notFound();
  const students = await listStudents(user, { batchId });

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">طلاب الدفعة</h1>
          <p className="mt-2 text-[var(--muted)]">
            {batch.stats.total} طالب · {batch.stats.submitted} مكتمل · {batch.stats.pending} غير مكتمل
          </p>
        </div>
        <LinkButton href={`/admin/batches/${batchId}`} variant="secondary">
          رجوع للدفعة
        </LinkButton>
      </div>
      <BatchStudentsPanel batchId={batchId} students={students} showImport={Boolean(showImport)} />
    </div>
  );
}
