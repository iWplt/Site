import { Badge, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listBatches, listSubmissions } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";
import { formatArabicDate } from "@/lib/utils";

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<{ batch?: string; q?: string }>;
}) {
  const user = await requireUser();
  const { batch, q } = await searchParams;
  const [batches, submissions] = await Promise.all([listBatches(user), listSubmissions(user, { batchId: batch })]);
  const filtered = q
    ? submissions.filter((submission) =>
        [submission.booking_number, submission.student_name, submission.batch_name].some((value) => String(value ?? "").includes(q))
      )
    : submissions;

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">Order Management</p>
        <h1 className="text-4xl font-black text-[var(--olive-dark)]">الطلبات والحجوزات</h1>
      </div>
      <Card>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/admin/orders" variant={!batch ? "primary" : "secondary"}>
            كل الدفعات
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
          {filtered.map((submission) => (
            <LinkButton key={submission.id} href={`/admin/orders/${submission.id}`} variant="ghost" className="grid gap-2 border border-[var(--border)] bg-white/65 p-4 text-right sm:grid-cols-[160px_1fr_auto] sm:items-center">
              <span className="font-black ltr">{submission.booking_number}</span>
              <span>
                <span className="block font-bold">{submission.student_name}</span>
                <span className="block text-sm text-[var(--muted)]">
                  {submission.batch_name} · {formatArabicDate(submission.submitted_at)}
                </span>
              </span>
              <Badge tone="green">{statusLabels[submission.status]}</Badge>
            </LinkButton>
          ))}
          {!filtered.length ? <p className="text-[var(--muted)]">لا توجد حجوزات مستلمة.</p> : null}
        </div>
      </Card>
    </div>
  );
}
