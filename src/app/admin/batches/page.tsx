import { archiveBatchAction } from "@/app/actions";
import { ArchiveConfirmButton } from "@/components/archive-confirm-button";
import { BookingWorkspaceNav } from "@/components/booking-workspace-nav";
import { Badge, Card, LinkButton } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { listBatches } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";

export default async function BatchesPage() {
  const user = await requireUser();
  const [batches, archived] = await Promise.all([
    listBatches(user),
    user.role === "OWNER" ? listBatches(user, { archived: true }) : Promise.resolve([])
  ]);
  const canManage = user.role === "OWNER";

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">النماذج والمنتجات</p>
          <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">الدفعات</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            من هنا تُدار الدفعة وطلابها. المنتجات والأزياء تُدار من النموذج المرتبط، والكتالوج العام يبقى مصدر المنتجات.
          </p>
        </div>
        {canManage ? <LinkButton href="/admin/batches/new">إنشاء دفعة جديدة</LinkButton> : null}
      </div>
      {user.role === "OWNER" ? (
        <BookingWorkspaceNav
          items={[
            { href: "/admin/batches", label: "الدفعات", current: true },
            { href: "/admin/forms", label: "النماذج" },
            { href: "/admin/products", label: "المنتجات" },
            { href: "/admin/products?view=models", label: "الموديلات" },
            { href: "/admin/settings", label: "الصلاحيات" }
          ]}
        />
      ) : null}
      <div className="grid gap-4">
        {batches.map((batch) => (
          <Card key={batch.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black text-[var(--olive-dark)]">{batch.name}</h2>
                  <Badge>{statusLabels[batch.status]}</Badge>
                </div>
                <p className="mt-2 text-[var(--muted)]">
                  {batch.university} / {batch.college} / {batch.department}
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--olive)]">الممثل: {batch.representative_name ?? "غير معيّن"}</p>
              </div>
              <LinkButton href={`/admin/batches/${batch.id}`} variant="secondary">
                فتح الدفعة
              </LinkButton>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="الطلاب" value={batch.stats.total} />
              <Stat label="حجز مكتمل" value={batch.stats.submitted} />
              <Stat label="بانتظار الحجز" value={batch.stats.pending} />
              <Stat label="سنة التخرج" value={batch.graduation_year} />
            </div>
            <div className="relative z-10 mt-4 flex flex-wrap gap-2">
              {batch.form ? (
                <>
                  <LinkButton href={`/admin/forms/${batch.form.id}`} variant="secondary" size="sm">
                    النموذج
                  </LinkButton>
                  <LinkButton href={`/admin/forms/${batch.form.id}?tab=products`} variant="secondary" size="sm">
                    منتجات النموذج
                  </LinkButton>
                  <LinkButton href={`/admin/forms/${batch.form.id}?tab=outfits`} variant="secondary" size="sm">
                    الأزياء
                  </LinkButton>
                </>
              ) : (
                <LinkButton href="/admin/forms" variant="secondary" size="sm">
                  النماذج
                </LinkButton>
              )}
              {canManage ? (
                <ArchiveConfirmButton
                  label="أرشفة الدفعة"
                  title={`أرشفة «${batch.name}»؟`}
                  warning="سيتم أرشفة هذه الدفعة ولن تظهر ضمن الدفعات النشطة. الطلبات القديمة المرتبطة بها ستبقى محفوظة."
                  action={archiveBatchAction}
                  hiddenFields={{ batchId: batch.id }}
                />
              ) : null}
            </div>
          </Card>
        ))}
        {!batches.length ? (
          <EmptyState
            title="لا توجد دفعات بعد"
            description="أنشئ دفعة لبدء استيراد الطلاب وفتح بطاقة الحجز."
            actionHref={canManage ? "/admin/batches/new" : undefined}
            actionLabel={canManage ? "إنشاء دفعة" : undefined}
          />
        ) : null}
      </div>
      {canManage && archived.length ? (
        <details className="warka-card rounded-[1.6rem] p-4 sm:p-5">
          <summary className="cursor-pointer text-lg font-black text-[var(--olive-dark)]">الدفعات المؤرشفة ({archived.length})</summary>
          <div className="mt-4 grid gap-3">
            {archived.map((batch) => (
              <div key={batch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/60 p-3">
                <div>
                  <p className="font-black text-[var(--olive-dark)]">{batch.name}</p>
                  <p className="text-xs font-bold text-[var(--muted)]">الطلبات القديمة تبقى ظاهرة من صفحة الطلبات</p>
                </div>
                <LinkButton href={`/admin/batches/${batch.id}`} variant="secondary" size="sm">
                  عرض
                </LinkButton>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white/60 p-4">
      <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-black text-[var(--olive-dark)]">{value}</p>
    </div>
  );
}
