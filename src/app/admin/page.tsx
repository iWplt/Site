import { Badge, Card, LinkButton } from "@/components/ui";
import { BrandPhoto } from "@/components/brand-photo";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand-assets";
import { getDashboardMetrics, listBatches, listSubmissions } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";
import { RepresentativeSearch } from "@/components/representative-search";
import { listStudents } from "@/lib/data";
import { formatArabicDate } from "@/lib/utils";

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
    listSubmissions(user, { limit: 8 })
  ]);

  if (user.role === "REPRESENTATIVE") {
    const students = await listStudents(user, { search: q });
    return (
      <div className="grid gap-5">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">لوحة الممثل</p>
          <h1 className="text-3xl font-black text-[var(--olive-dark)]">دفعاتي اليوم</h1>
        </div>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="طلبات اليوم" value={metrics.todayOrders} />
          <Metric label="إجمالي الطلبات" value={metrics.submittedOrders} />
          <Metric label="قيد المراجعة" value={metrics.reviewed} />
          <Metric label="تمت الموافقة" value={metrics.confirmed} />
          <Metric label="قيد الطباعة" value={metrics.inProduction} />
          <Metric label="جاهزة للاستلام" value={metrics.ready} />
          <Metric label="تم التسليم" value={metrics.delivered} />
          <Metric label="طلاب لم يرسلوا طلباً بعد" value={metrics.pendingStudents} />
        </section>
        <Card>
          <h2 className="text-2xl font-black text-[var(--olive-dark)]">آخر الطلبات</h2>
          <div className="mt-4 grid gap-3">
            {submissions.slice(0, 5).map((submission) => (
              <LinkButton key={submission.id} href={`/admin/orders/${submission.id}`} variant="ghost" className="justify-between border border-[var(--border)] bg-white/60">
                <span>
                  {submission.booking_number} · {submission.student_name}
                  <span className="mt-1 block text-xs text-[var(--muted)]">{formatArabicDate(submission.submitted_at)}</span>
                </span>
                <Badge tone="green">{statusLabels[submission.status]}</Badge>
              </LinkButton>
            ))}
            {!submissions.length ? (
              <EmptyState title="لا توجد طلبات في دفعاتك" description="ستظهر طلبات الطلاب المعيّنين لك هنا." actionHref="/admin/batches" actionLabel="فتح دفعاتي" />
            ) : null}
          </div>
        </Card>
        <RepresentativeSearch initialQuery={q ?? ""} students={students} />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandPhoto
            asset={BRAND.adminAccent}
            aspect="1/1"
            sizes="72px"
            className="h-14 w-14 shrink-0 !rounded-2xl"
            rounded={false}
          />
          <div>
            <p className="text-sm font-bold text-[var(--gold)]">WARKA Booking Management</p>
            <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">لوحة التحكم</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/admin/batches/new">إنشاء دفعة</LinkButton>
          <LinkButton href="/admin/forms" variant="secondary">إدارة النماذج</LinkButton>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="طلبات اليوم" value={metrics.todayOrders} />
        <Metric label="إجمالي الطلبات" value={metrics.submittedOrders} />
        <Metric label="قيد المراجعة" value={metrics.reviewed} />
        <Metric label="تمت الموافقة" value={metrics.confirmed} />
        <Metric label="قيد الطباعة" value={metrics.inProduction} />
        <Metric label="جاهزة للاستلام" value={metrics.ready} />
        <Metric label="تم التسليم" value={metrics.delivered} />
        <Metric label="طلاب لم يرسلوا طلباً بعد" value={metrics.pendingStudents} />
        <Metric label="الدفعات النشطة" value={metrics.activeBatches} />
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
              <span>
                {submission.booking_number} · {submission.student_name}
                <span className="mt-1 block text-xs text-[var(--muted)]">{formatArabicDate(submission.submitted_at)}</span>
              </span>
              <Badge tone="green">{statusLabels[submission.status]}</Badge>
            </LinkButton>
          ))}
          {!submissions.length ? (
            <EmptyState title="لا توجد طلبات بعد" description="ستظهر هنا أحدث الحجوزات بعد إرسال الطلاب لطلباتهم." actionHref="/admin/batches" actionLabel="فتح الدفعات" />
          ) : null}
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
