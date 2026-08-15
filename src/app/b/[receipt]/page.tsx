import { OrderVisual } from "@/components/order-visual";
import {
  EditorialPhotoSection,
  PhotoMosaic,
  PublicVisualHero,
  PublicVisualShell,
  StudentGalleryStrip
} from "@/components/public-visuals";
import { Card, LinkButton, LogoMark } from "@/components/ui";
import { PublicNotice } from "@/components/public-notice";
import { PUBLIC_VISUALS } from "@/lib/brand-assets";
import { inspectBookingReceipt } from "@/lib/booking-receipt";
import { getPublicSubmissionByReceipt } from "@/lib/data";
import { statusLabels } from "@/lib/labels";
import { snapshotOrFallback } from "@/lib/order-snapshot";
import { buildOrderSectionsFromSnapshot } from "@/lib/order-view";
import { formatArabicDate } from "@/lib/utils";

export default async function BookingConfirmationPage({ params }: { params: Promise<{ receipt: string }> }) {
  const { receipt } = await params;
  const token = decodeURIComponent(receipt);
  const inspected = inspectBookingReceipt(token);
  if (inspected === "expired") {
    return (
      <PublicNotice
        title="انتهت صلاحية رابط التأكيد"
        description="رابط التأكيد لم يعد صالحاً. يمكنك مراجعة المتجر برقم الحجز الظاهر على البطاقة."
      />
    );
  }
  if (inspected === "invalid") {
    return (
      <PublicNotice title="رابط التأكيد غير صالح" description="تعذر التحقق من رابط التأكيد. تأكد من نسخه كاملاً." />
    );
  }
  const detail = await getPublicSubmissionByReceipt(token);
  if (!detail) {
    return <PublicNotice title="الطلب غير موجود" description="لم يتم العثور على طلب مطابق لهذا الرابط." />;
  }
  const visuals = PUBLIC_VISUALS.receipt;

  const snapshot = snapshotOrFallback(
    detail.submission.answers,
    detail.form?.definition,
    detail.form?.id ?? detail.submission.form_id,
    detail.form?.name ?? "طلب WARKA"
  );
  const sections = buildOrderSectionsFromSnapshot(snapshot, detail.files, detail.referenceImageUrls);

  return (
    <PublicVisualShell variant="receipt">
      <LogoMark priority />
      <PublicVisualHero
        asset={visuals.hero}
        aspect="1/1"
        highPriority
        sizes="(max-width: 768px) 100vw, 640px"
        className="mt-4 mx-auto w-full max-h-[20rem] max-w-[20rem] sm:max-h-[24rem] sm:max-w-[24rem]"
      />
      <Card className="relative z-10 mt-4 text-center !bg-[var(--paper)]">
        <p className="text-sm font-bold text-[var(--gold)]">تأكيد الحجز</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--olive-dark)]">تم تسجيل طلبك بنجاح</h1>
        <p className="mt-4 text-sm font-bold text-[var(--muted)]">رقم الحجز</p>
        <p className="text-4xl font-black ltr">{detail.submission.booking_number}</p>
        <p className="mt-3 text-[var(--muted)]">
          {detail.student?.full_name} · {detail.batch?.name} · {statusLabels[detail.submission.status]}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">{formatArabicDate(detail.submission.submitted_at)}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <LinkButton href={`/b/${token}/print`}>طباعة بطاقة الحجز</LinkButton>
          <LinkButton href={`/b/${token}/print`} variant="secondary">
            حفظ PDF
          </LinkButton>
        </div>
      </Card>
      <StudentGalleryStrip items={visuals.gallery} title="من عالم WARKA" className="mt-5" />
      <Card className="relative z-10 mt-5 !bg-[var(--paper)]">
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">ملخص الطلب</h2>
        <div className="mt-4">
          <OrderVisual sections={sections} />
        </div>
      </Card>
      <PhotoMosaic assets={visuals.mosaic} className="mt-5" />
      <EditorialPhotoSection items={visuals.editorial} className="mt-5" />
    </PublicVisualShell>
  );
}
