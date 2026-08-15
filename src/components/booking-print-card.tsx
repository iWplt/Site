import type { ReactNode } from "react";
import { CalendarDays, ClipboardList, GraduationCap, Hash, MapPin, Phone, UserRound } from "lucide-react";
import { signBookingReceipt } from "@/lib/booking-receipt";
import { statusLabels } from "@/lib/labels";
import { buildOrderSectionsFromSnapshot, type OrderSectionView } from "@/lib/order-view";
import { snapshotOrFallback } from "@/lib/order-snapshot";
import { absoluteAppUrl, requestOrigin } from "@/lib/public-url";
import { sbEnsurePickupToken } from "@/lib/store/supabase-db";
import { bookingQrDataUrl } from "@/lib/qr";
import { cn, formatBookingCardDate } from "@/lib/utils";
import type { SubmissionDetail } from "@/lib/store/supabase-db";
import { PrintToolbar } from "@/components/print-toolbar";
import { WARKA_LOGOS } from "@/lib/brand-logo";

const SKIP_DETAIL_KEYS = new Set(["student_name", "address", "phone", "booking_type"]);

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
  const token =
    receiptToken ??
    signBookingReceipt({
      submissionId: detail.submission.id,
      bookingNumber: detail.submission.booking_number
    });

  const bookingType = detail.batch?.name?.trim() || "حجز فردي";
  const submittedAt = formatBookingCardDate(detail.submission.submitted_at);
  const studentName = detail.student?.full_name || String(detail.submission.answers.student_name ?? "") || "غير محدد";
  const phone = detail.student?.phone || String(detail.submission.answers.phone ?? "") || "غير محدد";
  const address = String(detail.submission.answers.address ?? "").trim() || "غير محدد";
  const status = detail.submission.status;
  const statusLabel = statusLabels[status] ?? status;
  const productSections = sections
    .map((section) => ({
      ...section,
      lines: section.lines.filter((line) => !SKIP_DETAIL_KEYS.has(line.key) && line.studentImages.length === 0)
    }))
    .filter((section) => section.lines.length && section.id !== "student" && section.id !== "uploads");
  const studentUploads = sections.flatMap((section) =>
    section.lines.flatMap((line) => line.studentImages.map((image) => ({ ...image, label: line.label })))
  );

  return (
    <div className="booking-print-root mx-auto w-full min-w-0 max-w-[920px]">
      {showActions ? <PrintToolbar confirmationHref={`/b/${token}`} /> : null}

      <article className="booking-sheet relative overflow-hidden rounded-[1.85rem] border border-[rgba(63,71,45,0.14)] bg-[#fffaf0] px-4 py-5 shadow-[0_18px_50px_rgba(37,43,28,0.08)] sm:px-8 sm:py-8">
        <span aria-hidden className="booking-sheet-accent" />

        <header className="grid min-w-0 gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-8">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--muted)]">رقم الحجز</p>
            <h1 className="booking-number mt-1 break-all text-[1.85rem] leading-none text-[var(--olive-dark)] sm:text-[2.35rem]">
              {detail.submission.booking_number}
            </h1>
            <StatusPill status={status} label={statusLabel} />
            <div className="mt-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <MetaChip icon={<GraduationCap size={14} />} label="نوع الحجز" value={bookingType} />
              <span aria-hidden className="hidden h-8 w-px bg-[rgba(63,71,45,0.16)] sm:block" />
              <MetaChip icon={<CalendarDays size={14} />} label="تاريخ الإرسال" value={submittedAt} />
            </div>
          </div>

          <div className="flex shrink-0 items-start justify-between gap-4 sm:flex-col sm:items-center">
            {/* Native img so print/PDF stays sharp and size-constrained. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={WARKA_LOGOS.primary.src}
              alt="WARKA"
              width={88}
              height={102}
              className="booking-logo"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="رمز استلام الطلب"
              className="booking-qr rounded-[0.9rem] border-[1.5px] border-[var(--gold)] bg-white p-1.5"
            />
          </div>
        </header>

        <SectionHeading>بيانات الطالب</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoTile icon={<UserRound size={14} />} label="الاسم الكامل" value={studentName} />
          <InfoTile icon={<Phone size={14} />} label="الهاتف" value={phone} ltr />
          <InfoTile icon={<MapPin size={14} />} label="العنوان" value={address} className="sm:col-span-2" />
        </div>

        <SectionHeading>ملخص الطلب</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile icon={<Hash size={15} />} label="رقم الحجز" value={detail.submission.booking_number} ltr />
          <SummaryTile icon={<ClipboardList size={15} />} label="نوع الحجز" value={bookingType} />
          <SummaryTile icon={<CalendarDays size={15} />} label="تاريخ الإرسال" value={submittedAt} />
        </div>

        {productSections.length ? (
          <>
            <SectionHeading>تفاصيل الطلب</SectionHeading>
            <div className="grid gap-3">
              {productSections.map((section) => (
                <ProductGroup key={section.id} section={section} />
              ))}
            </div>
          </>
        ) : null}

        {studentUploads.length ? (
          <>
            <SectionHeading>تصاميم الطالب</SectionHeading>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {studentUploads.map((image, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${image.src}-${index}`}
                  src={image.src}
                  alt={image.alt}
                  className="aspect-square w-full rounded-xl border border-[var(--border)] object-cover"
                />
              ))}
            </div>
          </>
        ) : null}

        <footer className="mt-7 border-t border-[rgba(63,71,45,0.12)] pt-4 text-center">
          <p className="text-[11px] leading-6 text-[var(--muted)]">
            رمز QR مخصص لاستلام الطلب من المتجر — بدون بيانات شخصية أو أسرار النظام.
          </p>
        </footer>
      </article>
    </div>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <div className="mt-7 mb-4">
      <h2 className="text-center text-lg font-black text-[var(--olive-dark)] sm:text-xl">{children}</h2>
      <div className="booking-ornament mt-2" aria-hidden>
        <span />
        <i />
        <span />
      </div>
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const received = ["SUBMITTED", "CONFIRMED", "READY", "DELIVERED"].includes(status);
  return (
    <p
      className={cn(
        "mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
        received ? "bg-[#e7f3ea] text-[#386a3d]" : status === "CANCELLED" ? "bg-[#9d2f2f14] text-[var(--danger)]" : "bg-[#3f472d12] text-[var(--olive)]"
      )}
    >
      {received ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2.2 6.2 4.7 8.6 9.8 3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {label}
    </p>
  );
}

function MetaChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#3f472d12] text-[var(--olive)]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-[var(--muted)]">{label}</p>
        <p className="break-words text-sm font-black text-[var(--olive-dark)]">{value}</p>
      </div>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
  ltr,
  className
}: {
  icon: ReactNode;
  label: string;
  value: string;
  ltr?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3 rounded-[1.15rem] border border-[rgba(63,71,45,0.12)] bg-[#fbf6ea] px-4 py-3.5", className)}>
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--olive)] text-[var(--paper)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-[var(--muted)]">{label}</p>
        <p className={cn("mt-0.5 break-words text-base font-black leading-7 text-[var(--olive-dark)]", ltr && "ltr text-left")}>{value}</p>
      </div>
    </div>
  );
}

function SummaryTile({ icon, label, value, ltr }: { icon: ReactNode; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center rounded-[1.15rem] border border-[rgba(63,71,45,0.12)] bg-[#fbf6ea] px-3 py-4 text-center">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#3f472d12] text-[var(--olive)]">{icon}</span>
      <p className="mt-2 text-[11px] font-bold text-[var(--muted)]">{label}</p>
      <p className={cn("mt-1 w-full break-words text-sm font-black leading-6 text-[var(--olive-dark)]", ltr && "ltr")}>{value}</p>
    </div>
  );
}

function ProductGroup({ section }: { section: OrderSectionView }) {
  return (
    <section className="break-inside-avoid rounded-[1.15rem] border border-[rgba(63,71,45,0.12)] bg-[#fbf6ea] p-3.5">
      <h3 className="text-sm font-black text-[var(--olive-dark)]">{section.title}</h3>
      <div className="mt-2 grid gap-2">
        {section.lines.map((line) => (
          <div key={line.key} className="flex min-w-0 items-center gap-3">
            {line.referenceImages[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={line.referenceImages[0].src}
                alt=""
                className="booking-thumb shrink-0 rounded-lg border border-[var(--border)] object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[var(--muted)]">{line.label}</p>
              <p className="break-words text-sm font-black leading-6 text-[var(--olive-dark)]">{line.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
