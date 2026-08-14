import { Badge, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDashboardMetrics, listBatches, listSubmissions } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";
import { RepresentativeSearch } from "@/components/representative-search";
import { listStudents } from "@/lib/data";

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const [metrics, batches, submissions] = await Promise.all([
    getDashboardMetrics(user),
    listBatches(user),
    listSubmissions(user)
  ]);

  if (user.role === "REPRESENTATIVE") {
    const students = await listStudents(user, { search: q });
    return (
      <div className="grid gap-5">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">Representative Mobile Desk</p>
          <h1 className="text-3xl font-black text-[var(--olive-dark)]">بحث عن الطالب</h1>
        </div>
        <RepresentativeSearch initialQuery={q ?? ""} students={students} />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">WARKA Booking Management</p>
          <h1 className="text-4xl font-black text-[var(--olive-dark)]">لوحة التحكم</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/admin/batches/new">إنشاء دفعة</LinkButton>
          <LinkButton href="/f/cybersecurity-2027" variant="secondary">معاينة النموذج</LinkButton>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Metric label="الدفعات النشطة" value={metrics.activeBatches} />
        <Metric label="إجمالي الطلاب" value={metrics.totalStudents} />
        <Metric label="الطلبات المستلمة" value={metrics.submittedOrders} />
        <Metric label="طلاب غير مكتملين" value={metrics.pendingStudents} />
        <Metric label="قيد التجهيز" value={metrics.inProduction} />
        <Metric label="جاهزة" value={metrics.ready} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {batches.slice(0, 4).map((batch) => (
          <Card key={batch.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-[var(--olive-dark)]">{batch.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{batch.university} / {batch.department}</p>
              </div>
              <Badge>{statusLabels[batch.status]}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Mini label="طلاب" value={batch.stats.total} />
              <Mini label="مكتمل" value={batch.stats.submitted} />
              <Mini label="بانتظار" value={batch.stats.pending} />
            </div>
            <LinkButton href={`/admin/batches/${batch.id}`} className="mt-4" variant="secondary">
              فتح الدفعة
            </LinkButton>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">آخر الطلبات</h2>
        <div className="mt-4 grid gap-3">
          {submissions.slice(0, 5).map((submission) => (
            <LinkButton key={submission.id} href={`/admin/orders/${submission.id}`} variant="ghost" className="justify-between border border-[var(--border)] bg-white/60">
              <span>{submission.booking_number} · {submission.student_name}</span>
              <Badge tone="green">{statusLabels[submission.status]}</Badge>
            </LinkButton>
          ))}
          {!submissions.length ? <p className="text-[var(--muted)]">لا توجد حجوزات مستلمة حتى الآن.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-3xl">
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-4xl font-black text-[var(--olive-dark)]">{value}</p>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/60 p-3">
      <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
      <p className="font-black text-[var(--olive-dark)]">{value}</p>
    </div>
  );
}
