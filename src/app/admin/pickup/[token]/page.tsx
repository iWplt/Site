import { ConfirmDeliveryButton } from "@/components/confirm-delivery-button";
import { Badge, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { statusLabels } from "@/lib/labels";
import { parsePickupTokenInput } from "@/lib/pickup-token";
import { sbGetPickupByToken } from "@/lib/store/supabase-db";
import { formatArabicDate } from "@/lib/utils";

export default async function PickupTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const user = await requireUser();
  const { token: raw } = await params;
  const token = parsePickupTokenInput(decodeURIComponent(raw));
  const view = await sbGetPickupByToken(user, token);

  if ("error" in view) {
    return (
      <Card className="mx-auto max-w-xl">
        <h1 className="text-2xl font-black text-[var(--olive-dark)]">تعذر فتح طلب الاستلام</h1>
        <p className="mt-3 text-[var(--muted)]">{view.error}</p>
        <LinkButton href="/admin/pickup" className="mt-4" variant="secondary">
          العودة للماسح
        </LinkButton>
      </Card>
    );
  }

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">استلام الطلب</p>
        <h1 className="text-3xl font-black text-[var(--olive-dark)]">{view.studentName}</h1>
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-2xl font-black ltr">{view.bookingNumber}</p>
          <Badge tone={view.alreadyDelivered ? "green" : "gold"}>{statusLabels[view.status]}</Badge>
        </div>
        <p className="mt-3 text-[var(--muted)]">{view.individual ? "حجز فردي" : view.batchName}</p>
        {view.phone ? <p className="mt-1 font-bold ltr">{view.phone}</p> : null}
        <p className="mt-4 text-sm font-bold text-[var(--olive)]">{view.summary}</p>
        {view.alreadyDelivered ? (
          <p className="mt-4 rounded-2xl bg-[#386a3d12] p-3 font-black text-[var(--success)]">
            تم تسليم هذا الطلب مسبقاً
            {view.deliveredAt ? ` · ${formatArabicDate(view.deliveredAt)}` : ""}
          </p>
        ) : (
          <div className="mt-5">
            <ConfirmDeliveryButton token={token} alreadyDelivered={false} />
          </div>
        )}
        <LinkButton href={`/admin/orders/${view.submissionId}`} variant="secondary" className="mt-3 min-h-12 w-full">
          فتح تفاصيل الطلب
        </LinkButton>
      </Card>
    </div>
  );
}
