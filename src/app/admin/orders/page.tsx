import { Badge, Card, LinkButton } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { listBatches, listSubmissions } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";
import { formatArabicDate } from "@/lib/utils";

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<{ batch?: string; q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const { batch, q, page } = await searchParams;
  const pageSize = 40;
  const pageNumber = Math.max(1, Number(page) || 1);
  const [batches, submissions] = await Promise.all([
    listBatches(user),
    listSubmissions(user, {
      ...(batch === "individual" ? { individualOnly: true } : { batchId: batch }),
      limit: pageSize * pageNumber
    })
  ]);
  const filtered = q
    ? submissions.filter((submission) =>
        [submission.booking_number, submission.student_name, submission.batch_name].some((value) => String(value ?? "").includes(q))
      )
    : submissions;
  const visible = filtered.slice(0, pageSize * pageNumber);

  return (
    <div className="grid gap-4 sm:gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">Order Management</p>
        <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">الطلبات والحجوزات</h1>
      </div>
      <Card>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/admin/orders" variant={!batch ? "primary" : "secondary"}>
            الكل
          </LinkButton>
          <LinkButton href="/admin/orders?batch=individual" variant={batch === "individual" ? "primary" : "secondary"}>
            حجوزات فردية
          </LinkButton>
          {batches.map((entry) => (
            <LinkButton key={entry.id} href={`/admin/orders?batch=${entry.id}`} variant={batch === entry.id ? "primary" : "secondary"}>
              {entry.name}
            </LinkButton>
          ))}
        </div>
      </Card>
      <Card>
        <div className="grid gap-3">
          {visible.map((submission) => (
            <LinkButton key={submission.id} href={`/admin/orders/${submission.id}`} variant="ghost" className="grid gap-2 border border-[var(--border)] bg-white/65 p-4 text-right sm:grid-cols-[160px_1fr_auto] sm:items-center">
              <span className="font-black ltr">{submission.booking_number}</span>
              <span>
                <span className="block font-bold">{submission.student_name}</span>
                <span className="block text-sm text-[var(--muted)]">
                  {submission.batch_name ?? "حجز فردي"} · {formatArabicDate(submission.submitted_at)}
                </span>
              </span>
              <Badge tone="green">{statusLabels[submission.status]}</Badge>
            </LinkButton>
          ))}
          {!visible.length ? (
            <EmptyState title="لا توجد طلبات" description="لا توجد حجوزات ضمن النطاق الحالي." actionHref="/admin/batches" actionLabel="فتح الدفعات" />
          ) : null}
          {submissions.length >= pageSize * pageNumber ? (
            <LinkButton
              href={`/admin/orders?${new URLSearchParams({
                ...(batch ? { batch } : {}),
                ...(q ? { q } : {}),
                page: String(pageNumber + 1)
              }).toString()}`}
              variant="secondary"
            >
              المزيد
            </LinkButton>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
