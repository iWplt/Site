import { notFound } from "next/navigation";
import { BatchUniformForm } from "@/components/batch-uniform-form";
import { Badge, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getBatch, getFixedOptions, getPublicForm, listStudents, listSubmissions } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";

export default async function BatchDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requireUser();
  const { batchId } = await params;
  const { created } = await searchParams;
  const batch = await getBatch(user, batchId);
  if (!batch) notFound();
  const [students, orders, uniform, formWithImages] = await Promise.all([
    listStudents(user, { batchId }),
    listSubmissions(user, { batchId }),
    batch.form ? getFixedOptions(user, batch.form.id) : Promise.resolve({}),
    batch.form ? getPublicForm(batch.form.slug) : Promise.resolve(null)
  ]);

  return (
    <div className="grid gap-4 sm:gap-6">
      {created ? (
        <Card className="border-[var(--success)] bg-[#386a3d12]">
          <h2 className="text-2xl font-black text-[var(--olive-dark)]">تم إنشاء الدفعة بنجاح</h2>
          <p className="mt-2 text-[var(--muted)]">{batch.name}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href={`/admin/batches/${batch.id}/students`}>إضافة الطلاب</LinkButton>
            <LinkButton href={`/admin/batches/${batch.id}/students?import=1`} variant="secondary">
              استيراد Excel
            </LinkButton>
            <LinkButton href="/admin/representatives" variant="secondary">
              تعيين ممثل
            </LinkButton>
            <LinkButton href="/admin/forms" variant="secondary">
              ربط نموذج
            </LinkButton>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">{batch.university}</p>
          <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">{batch.name}</h1>
          <p className="mt-2 text-[var(--muted)]">
            {batch.college} / {batch.department} / {batch.stage}
          </p>
        </div>
        <Badge>{statusLabels[batch.status]}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <LinkButton href={`/admin/batches/${batch.id}`} variant="secondary">نظرة عامة</LinkButton>
        <LinkButton href={`/admin/batches/${batch.id}/students`} variant="secondary">الطلاب</LinkButton>
        <LinkButton href={`/admin/batches/${batch.id}/orders`} variant="secondary">الحجوزات</LinkButton>
        <LinkButton href={batch.form ? `/admin/forms/${batch.form.id}` : "/admin/forms"} variant="secondary">
          النموذج
        </LinkButton>
        <LinkButton href="/admin/representatives" variant="secondary">الممثلون</LinkButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="الطلاب" value={batch.stats.total} />
        <Stat label="أرسلوا الحجز" value={batch.stats.submitted} />
        <Stat label="لم يرسلوا" value={batch.stats.pending} />
        <Stat label="الطلبات الظاهرة" value={orders.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-black text-[var(--olive-dark)]">الممثل</h2>
          <p className="mt-3 font-bold">{batch.representative_name ?? "غير معيّن"}</p>
          <h3 className="mt-6 font-black text-[var(--olive)]">النموذج</h3>
          <p className="mt-2">{batch.form?.name ?? "لا يوجد نموذج مرتبط"}</p>
          {batch.form ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton href={`/f/${batch.form.slug}`} variant="secondary">
                فتح الرابط العام
              </LinkButton>
              <LinkButton href={`/admin/forms/${batch.form.id}`} variant="secondary">
                إدارة النموذج
              </LinkButton>
            </div>
          ) : null}
        </Card>
        <Card>
          <h2 className="text-2xl font-black text-[var(--olive-dark)]">آخر الطلاب</h2>
          <div className="mt-4 grid gap-2">
            {students.slice(0, 5).map((student) => (
              <div key={student.id} className="rounded-2xl bg-white/60 p-3">
                <p className="font-bold">{student.full_name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {student.code} · {statusLabels[student.submission_status ?? "pending"]}
                </p>
              </div>
            ))}
            {!students.length ? <p className="text-[var(--muted)]">لم تتم إضافة طلاب لهذه الدفعة حتى الآن.</p> : null}
          </div>
        </Card>
      </div>

      {formWithImages ? (
        <BatchUniformForm formId={formWithImages.id} definition={formWithImages.definition} value={uniform} />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[var(--olive-dark)]">{value}</p>
    </Card>
  );
}
