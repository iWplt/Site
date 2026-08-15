import { signBookingReceipt } from "@/lib/booking-receipt";
import { statusLabels } from "@/lib/labels";
import { buildOrderSectionsFromSnapshot } from "@/lib/order-view";
import { snapshotOrFallback } from "@/lib/order-snapshot";
import { absoluteAppUrl, requestOrigin } from "@/lib/public-url";
import { sbEnsurePickupToken } from "@/lib/store/supabase-db";
import { bookingQrDataUrl } from "@/lib/qr";
import { formatArabicDate } from "@/lib/utils";
import type { SubmissionDetail } from "@/lib/store/supabase-db";
import { OrderVisual } from "@/components/order-visual";
import { PrintToolbar } from "@/components/print-toolbar";
import { LogoMark } from "@/components/ui";

export async function BookingPrintCard({
  detail,
  referenceImageUrls = {},
  showActions = false,
  receiptToken
}: {
  detail: SubmissionDetail;
  referenceImageUrls?: Record<string, string>;
  showActions?: boolean;
  receiptToken?: string;
}) {
  const snapshot = snapshotOrFallback(
    detail.submission.answers,
    detail.form?.definition,
    detail.form?.id ?? detail.submission.form_id,
    detail.form?.name ?? "بطاقة حجز WARKA"
  );
  const sections = buildOrderSectionsFromSnapshot(snapshot, detail.files, referenceImageUrls);
  const pickupToken = await sbEnsurePickupToken(detail.submission.id);
  const pickupUrl = absoluteAppUrl(`/admin/pickup/${pickupToken}`, await requestOrigin());
  const qr = await bookingQrDataUrl(pickupUrl);
  const token = receiptToken ?? signBookingReceipt({
    submissionId: detail.submission.id,
    bookingNumber: detail.submission.booking_number
  });

  return (
    <div className="booking-print-root">
      {showActions ? <PrintToolbar confirmationHref={`/b/${token}`} /> : null}

      <article className="booking-sheet mx-auto w-full max-w-[210mm] bg-[var(--paper)] p-6 sm:p-8">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <LogoMark printFallback />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="رمز استلام الطلب" className="h-24 w-24 rounded-xl border border-[var(--border)] bg-white p-1" />
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Info label="رقم الحجز" value={detail.submission.booking_number} ltr />
          <Info label="تاريخ الإرسال" value={formatArabicDate(detail.submission.submitted_at)} />
          <Info label="نوع الحجز" value={detail.batch?.name ? detail.batch.name : "حجز فردي"} />
          <Info label="الحالة" value={statusLabels[detail.submission.status] ?? detail.submission.status} />
        </div>

        <section className="mt-6">
          <h2 className="text-xl font-black text-[var(--olive-dark)]">بيانات الطالب</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Info label="الاسم الكامل" value={detail.student?.full_name ?? String(detail.submission.answers.student_name ?? "")} />
            <Info label="الهاتف" value={detail.student?.phone ?? String(detail.submission.answers.phone ?? "")} />
            <Info label="العنوان" value={String(detail.submission.answers.address ?? "")} className="sm:col-span-2" />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-black text-[var(--olive-dark)]">ملخص الطلب</h2>
          <div className="mt-3">
            <OrderVisual sections={sections} printMode />
          </div>
        </section>

        <footer className="mt-8 border-t border-[var(--border)] pt-4 text-center">
          <p className="text-xs font-bold tracking-[0.25em] text-[var(--gold)] ltr">WARKA</p>
          <p className="mt-1 font-black text-[var(--olive-dark)]">WARKA Graduation&apos;s Clothing Store</p>
          <p className="mt-2 text-xs text-[var(--muted)]">رمز QR مخصص لاستلام الطلب من المتجر — بدون بيانات شخصية أو أسرار النظام.</p>
        </footer>
      </article>
    </div>
  );
}

function Info({
  label,
  value,
  ltr,
  className
}: {
  label: string;
  value: string;
  ltr?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-white/80 p-3 ${className ?? ""}`}>
      <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
      <p className={`mt-1 font-black text-[var(--olive-dark)] ${ltr ? "ltr text-left" : ""}`}>{value || "غير محدد"}</p>
    </div>
  );
}
