import { CreateFormPanel } from "@/components/create-form-panel";
import { FormOverviewCard } from "@/components/form-overview-card";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { listBatches, listFormSummaries } from "@/lib/data";
import { getPublicAppUrl, requestOrigin } from "@/lib/public-url";

export default async function FormsPage() {
  const user = await requireUser();
  const [forms, batches, origin] = await Promise.all([
    listFormSummaries(user),
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
        <p className="text-sm font-bold text-[var(--gold)]">نماذج الحجز</p>
        <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">النماذج</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          نظرة عامة فقط. افتح النموذج لإدارة الحقول والرفع والمنتجات.
        </p>
      </div>

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
    </div>
  );
}
