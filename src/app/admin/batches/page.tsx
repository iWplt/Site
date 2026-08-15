import { Badge, Card, LinkButton } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { listBatches } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";

export default async function BatchesPage() {
  const user = await requireUser();
  const batches = await listBatches(user);

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">Batch Management</p>
          <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">إدارة الدفعات</h1>
        </div>
        {user.role === "OWNER" ? <LinkButton href="/admin/batches/new">إنشاء دفعة جديدة</LinkButton> : null}
      </div>
      <div className="grid gap-4">
        {batches.map((batch) => (
          <Card key={batch.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black text-[var(--olive-dark)]">{batch.name}</h2>
                  <Badge>{statusLabels[batch.status]}</Badge>
                </div>
                <p className="mt-2 text-[var(--muted)]">
                  {batch.university} / {batch.college} / {batch.department}
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--olive)]">الممثل: {batch.representative_name ?? "غير معيّن"}</p>
              </div>
              <LinkButton href={`/admin/batches/${batch.id}`} variant="secondary">
                فتح الدفعة
              </LinkButton>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="الطلاب" value={batch.stats.total} />
              <Stat label="حجز مكتمل" value={batch.stats.submitted} />
              <Stat label="بانتظار الحجز" value={batch.stats.pending} />
              <Stat label="سنة التخرج" value={batch.graduation_year} />
            </div>
          </Card>
        ))}
        {!batches.length ? (
          <EmptyState
            title="لا توجد دفعات بعد"
            description="أنشئ دفعة لبدء استيراد الطلاب وفتح بطاقة الحجز."
            actionHref={user.role === "OWNER" ? "/admin/batches/new" : undefined}
            actionLabel={user.role === "OWNER" ? "إنشاء دفعة" : undefined}
          />
        ) : null}
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
