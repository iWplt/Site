import { notFound } from "next/navigation";
import { reopenSubmissionAction, updateOrderStatusAction } from "@/app/actions";
import { Badge, Button, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSubmissionDetail } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";
import { optionLabel } from "@/lib/form-definition";
import { formatArabicDate } from "@/lib/utils";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser();
  const { orderId } = await params;
  const detail = await getSubmissionDetail(user, orderId);
  if (!detail) notFound();
  const { submission, student, form, batch, files, history } = detail;

  const grouped = files.reduce<Record<string, typeof files>>((acc, file) => {
    acc[file.field_key] = acc[file.field_key] ?? [];
    acc[file.field_key].push(file);
    return acc;
  }, {});

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">تفاصيل الطلب</p>
          <h1 className="text-4xl font-black text-[var(--olive-dark)] ltr">{submission.booking_number}</h1>
          <p className="mt-2 text-[var(--muted)]">
            {student?.full_name} · {batch?.name}
          </p>
        </div>
        <Badge tone="green">{statusLabels[submission.status]}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
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
        <div className="mt-4 grid gap-3">
          <Row label="الاسم" value={student?.full_name} />
          <Row label="الهاتف" value={student?.phone ?? String(submission.answers.phone ?? "")} />
          <Row label="العنوان" value={String(submission.answers.address ?? "")} />
          <Row label="تاريخ الإرسال" value={formatArabicDate(submission.submitted_at)} />
        </div>
      </Card>

      {form?.definition.sections.map((section) => (
        <Card key={section.id}>
          <h2 className="text-2xl font-black text-[var(--olive-dark)]">{section.title}</h2>
          <div className="mt-4 grid gap-3">
            {section.fields.map((field) => {
              if (["image_upload", "file_upload"].includes(field.type)) {
                const fieldFiles = grouped[field.key] ?? [];
                return (
                  <div key={field.id}>
                    <p className="mb-2 text-sm font-bold text-[var(--muted)]">{field.label}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {fieldFiles.map((file) => (
                        <a key={file.id} href={file.preview_url ?? file.storage_path} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-[var(--border)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={file.preview_url ?? file.storage_path} alt="" className="aspect-square w-full object-cover" />
                        </a>
                      ))}
                      {!fieldFiles.length ? <p className="text-sm text-[var(--muted)]">لا توجد صور</p> : null}
                    </div>
                  </div>
                );
              }
              return <Row key={field.id} label={field.label} value={optionLabel(field.options, submission.answers[field.key])} />;
            })}
          </div>
        </Card>
      ))}

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
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/50 p-3">
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-black text-[var(--olive-dark)]">{value || "غير محدد"}</p>
    </div>
  );
}
