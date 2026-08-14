import { Badge, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listBatches, listStudents } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";

export default async function BatchesPage() {
  const user = await requireUser();
  const [batches, students] = await Promise.all([listBatches(user), listStudents(user)]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">Batch Management</p>
          <h1 className="text-4xl font-black text-[var(--olive-dark)]">إدارة الدفعات</h1>
        </div>
        {user.role === "OWNER" ? <LinkButton href="/admin/batches/new">إنشاء دفعة</LinkButton> : null}
      </div>
      <div className="grid gap-5">
        {batches.map((batch) => {
          const batchStudents = students.filter((student) => student.batch_id === batch.id);
          const submitted = batchStudents.filter((student) => student.submission_status === "submitted").length;
          return (
            <Card key={batch.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-[var(--olive-dark)]">{batch.name}</h2>
                    <Badge>{statusLabels[batch.status]}</Badge>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">{batch.university} / {batch.college} / {batch.department}</p>
                </div>
                <LinkButton href={`/admin/students?batch=${batch.id}`} variant="secondary">عرض الطلاب</LinkButton>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-5">
                <Stat label="المرحلة" value={batch.stage} />
                <Stat label="سنة التخرج" value={batch.graduation_year} />
                <Stat label="الطلاب" value={batchStudents.length} />
                <Stat label="مرسل" value={submitted} />
                <Stat label="لم يرسل" value={batchStudents.length - submitted} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white/60 p-4">
      <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-black text-[var(--olive-dark)]">{value}</p>
    </div>
  );
}
