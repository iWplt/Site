import { notFound } from "next/navigation";
import { reopenSubmissionAction, updateOrderStatusAction } from "@/app/actions";
import { OrderVisual } from "@/components/order-visual";
import { Badge, Button, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { signBookingReceipt } from "@/lib/booking-receipt";
import { getSubmissionDetail } from "@/lib/data";
import { statusLabels } from "@/lib/labels";
import { snapshotOrFallback } from "@/lib/order-snapshot";
import { buildOrderSectionsFromSnapshot } from "@/lib/order-view";
import { formatArabicDate } from "@/lib/utils";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser();
  const { orderId } = await params;
  const detail = await getSubmissionDetail(user, orderId);
  if (!detail) notFound();
  const { submission, student, form, batch, files, history, referenceImageUrls } = detail;
  const snapshot = snapshotOrFallback(submission.answers, form?.definition, form?.id ?? submission.form_id, form?.name ?? "طلب WARKA");
  const sections = buildOrderSectionsFromSnapshot(snapshot, files, referenceImageUrls);
  const receipt = signBookingReceipt({ submissionId: submission.id, bookingNumber: submission.booking_number });

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--gold)]">تفاصيل الطلب</p>
          <h1 className="break-all text-3xl font-black text-[var(--olive-dark)] ltr sm:text-4xl">{submission.booking_number}</h1>
          <p className="mt-2 text-[var(--muted)]">
            {student?.full_name} · {batch?.name ?? "حجز فردي"}
          </p>
        </div>
        <Badge tone="green">{statusLabels[submission.status]}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <LinkButton href={`/print/order/${submission.id}`} variant="primary">
          طباعة الطلب
        </LinkButton>
        <LinkButton href={`/print/order/${submission.id}`} variant="secondary">
          PDF
        </LinkButton>
        <LinkButton href={`/print/order/${submission.id}`} variant="secondary">
          معاينة بطاقة الحجز
        </LinkButton>
        {user.role === "OWNER" ? (
          <form
            action={async () => {
              "use server";
              await reopenSubmissionAction(submission.id);
            }}
          >
            <Button type="submit" variant="secondary">
              إعادة فتح الطلب
            </Button>
          </form>
        ) : null}
        <form
          action={async () => {
            "use server";
            await updateOrderStatusAction(submission.id, "REVIEWED");
          }}
        >
          <Button type="submit" variant="secondary">
            وضع قيد المراجعة
          </Button>
        </form>
        <form
          action={async () => {
            "use server";
            await updateOrderStatusAction(submission.id, "IN_PRODUCTION");
          }}
        >
          <Button type="submit" variant="secondary">
            قيد التجهيز
          </Button>
        </form>
        <LinkButton href="/admin/orders" variant="ghost">
          رجوع
        </LinkButton>
      </div>

      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">بيانات الطالب</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Row label="الاسم" value={student?.full_name} />
          <Row label="الهاتف" value={student?.phone ?? String(submission.answers.phone ?? "")} />
          <Row label="العنوان" value={String(submission.answers.address ?? "")} />
          <Row label="نوع الحجز" value={batch?.name ?? "حجز فردي"} />
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">معلومات الطلب</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Row label="رقم الحجز" value={submission.booking_number} ltr />
          <Row label="تاريخ الإرسال" value={formatArabicDate(submission.submitted_at)} />
          <Row label="النموذج" value={form?.name} />
          <Row label="الحالة" value={statusLabels[submission.status]} />
        </div>
      </Card>

      {snapshot.fields.some((field) => field.fixed) ? (
        <Card>
          <h2 className="text-2xl font-black text-[var(--olive-dark)]">الزي الموحد للدفعة</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">هذه الاختيارات كانت مثبتة عند الإرسال ولا تتغير لاحقاً.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {snapshot.fields
              .filter((field) => field.fixed)
              .map((field) => (
                <Row key={field.key} label={field.label} value={`${field.optionLabel || field.displayValue} · اختيار موحد للدفعة`} />
              ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">تفاصيل الزي</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">صورة الخيار مرجع من المالك. الصورة المرفقة من الطالب تصميم خاص بالطلب.</p>
        <div className="mt-4">
          <OrderVisual sections={sections} />
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">سجل الحالات</h2>
        <div className="mt-4 grid gap-2">
          {history.map((entry) => (
            <div key={entry.id} className="rounded-2xl bg-white/60 p-3 text-sm">
              <p className="font-bold">
                {entry.old_status ? statusLabels[entry.old_status] : "—"} → {statusLabels[entry.new_status]}
              </p>
              <p className="text-[var(--muted)]">
                {formatArabicDate(entry.changed_at)} {entry.notes ? `· ${entry.notes}` : ""}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">معلومات إدارية</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Row label="معرف الطلب" value={submission.id} ltr />
          <Row label="مرجع البطاقة" value="متاح عبر رابط الطباعة الموقع" />
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">مرجع التأكيد العام محمي بتوقيع ولا يمكن تخمينه من رقم الحجز وحده. {receipt ? "" : ""}</p>
      </Card>
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value?: string | null; ltr?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/50 p-3">
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
      <p className={`mt-1 break-words font-black text-[var(--olive-dark)] ${ltr ? "ltr text-left" : ""}`}>{value || "غير محدد"}</p>
    </div>
  );
}
