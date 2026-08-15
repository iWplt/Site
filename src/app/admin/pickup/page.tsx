import { PickupScanner } from "@/components/pickup-scanner";
import { EmptyState } from "@/components/empty-state";
import { BrandIcon } from "@/components/brand-logo";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function PickupIndexPage() {
  await requireUser();
  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <div className="flex items-start gap-3">
        <BrandIcon size={40} decorative />
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">الاستلام</p>
          <h1 className="text-3xl font-black text-[var(--olive-dark)]">مسح بطاقة الحجز</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">امسح رمز QR من بطاقة الطالب أو الصق الرابط لتأكيد التسليم.</p>
        </div>
      </div>
      <Card>
        <PickupScanner />
      </Card>
      <EmptyState
        title="لا طلبات معروضة هنا"
        description="افتح الطلب عبر المسح أو من قائمة الطلبات الجاهزة."
        actionHref="/admin/orders"
        actionLabel="فتح الطلبات"
      />
    </div>
  );
}
