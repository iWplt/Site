import { CreateFormPanel } from "@/components/create-form-panel";
import { FormOverviewCard } from "@/components/form-overview-card";
import { BookingWorkspaceNav } from "@/components/booking-workspace-nav";
import { EmptyState } from "@/components/empty-state";
import { LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listBatches, listFormSummaries } from "@/lib/data";
import { getPublicAppUrl, requestOrigin } from "@/lib/public-url";

export default async function FormsPage() {
  const user = await requireUser();
  const [forms, archived, batches, origin] = await Promise.all([
    listFormSummaries(user),
    user.role === "OWNER" ? listFormSummaries(user, { archived: true }) : Promise.resolve([]),
    listBatches(user),
    requestOrigin()
  ]);
  const publicOrigin = getPublicAppUrl(origin);
  const cards = forms.map((form) => ({
    ...form,
    batch_name: form.batch_name || batches.find((batch) => batch.id === form.batch_id)?.name
  }));

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">إدارة الحجوزات والمنتجات</p>
        <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">النماذج والزي</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          افتح النموذج لإدارة الحقول، الرفع، المنتجات، الزي الكامل، والحجز المفرد. الأرشفة تخفي النموذج دون حذف الطلبات السابقة.
        </p>
      </div>
      {user.role === "OWNER" ? (
        <BookingWorkspaceNav
          items={[
            { href: "/admin/batches", label: "الدفعات" },
            { href: "/admin/forms", label: "النماذج والزي", current: true },
            { href: "/admin/products", label: "المنتجات المتاحة" },
            { href: "/admin/settings", label: "الصلاحيات" }
          ]}
        />
      ) : null}

      {user.role === "OWNER" ? (
        <details className="warka-card rounded-[1.6rem] p-4 sm:p-5">
          <summary className="cursor-pointer text-lg font-black text-[var(--olive-dark)]">إنشاء نموذج</summary>
          <div className="mt-4">
            <CreateFormPanel batches={batches.map((batch) => ({ id: batch.id, name: batch.name }))} />
          </div>
        </details>
      ) : null}

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((form) => (
          <FormOverviewCard key={form.id} form={form} origin={publicOrigin} canManage={user.role === "OWNER"} />
        ))}
      </div>
      {!cards.length ? (
        <EmptyState
          title="لا توجد نماذج"
          description="أنشئ نموذجاً أو أنشئ دفعة ليُنشأ نموذج الحجز تلقائياً."
          actionHref="/admin/batches/new"
          actionLabel="إنشاء دفعة"
        />
      ) : null}
      {user.role === "OWNER" && archived.length ? (
        <details className="warka-card rounded-[1.6rem] p-4 sm:p-5">
          <summary className="cursor-pointer text-lg font-black text-[var(--olive-dark)]">النماذج المؤرشفة ({archived.length})</summary>
          <div className="mt-4 grid gap-3">
            {archived.map((form) => (
              <div key={form.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/60 p-3">
                <p className="font-black text-[var(--olive-dark)]">{form.name}</p>
                <LinkButton href={`/admin/forms/${form.id}`} variant="secondary" className="min-h-10 px-4 py-2">
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
