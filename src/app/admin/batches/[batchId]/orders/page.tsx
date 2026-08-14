import { notFound } from "next/navigation";
import { Badge, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getBatch, listSubmissions } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";
import { formatArabicDate } from "@/lib/utils";

export default async function BatchOrdersPage({ params }: { params: Promise<{ batchId: string }> }) {
  const user = await requireUser();
  const { batchId } = await params;
  const batch = await getBatch(user, batchId);
  if (!batch) notFound();
  const orders = await listSubmissions(user, { batchId });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">{batch.name}</p>
          <h1 className="text-4xl font-black text-[var(--olive-dark)]">حجوزات الدفعة</h1>
        </div>
        <LinkButton href={`/admin/batches/${batchId}`} variant="secondary">
          رجوع للدفعة
        </LinkButton>
      </div>
      <Card>
        <div className="grid gap-3">
          {orders.map((order) => (
            <LinkButton key={order.id} href={`/admin/orders/${order.id}`} variant="ghost" className="justify-between border border-[var(--border)] bg-white/60">
              <span className="text-right">
                <span className="block font-black ltr">{order.booking_number}</span>
                <span className="block text-sm text-[var(--muted)]">
                  {order.student_name} · {formatArabicDate(order.submitted_at)}
                </span>
              </span>
              <Badge tone="green">{statusLabels[order.status]}</Badge>
            </LinkButton>
          ))}
          {!orders.length ? <p className="text-[var(--muted)]">لا توجد حجوزات مستلمة لهذه الدفعة حتى الآن.</p> : null}
        </div>
      </Card>
    </div>
  );
}
