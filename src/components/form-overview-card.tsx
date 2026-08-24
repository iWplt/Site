import Link from "next/link";
import { duplicateFormAction, setFormStatusAction, archiveFormAction } from "@/app/actions";
import { ArchiveConfirmButton } from "@/components/archive-confirm-button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { Badge, Button, LinkButton } from "@/components/ui";
import { formStatusLabels } from "@/lib/labels";
import { formatArabicDate } from "@/lib/utils";
import type { FormSummary } from "@/lib/types";

export function FormOverviewCard({
  form,
  origin,
  canManage
}: {
  form: FormSummary;
  origin: string;
  canManage: boolean;
}) {
  const publicPath = `/f/${form.slug}`;
  const publicUrl = `${origin}${publicPath}`;
  const href = `/admin/forms/${form.id}`;
  const isIndividual = form.type === "INDIVIDUAL";

  return (
    <article className="warka-card relative flex min-w-0 flex-col rounded-[1.6rem] p-4 sm:p-5">
      <Link href={href} prefetch className="absolute inset-0 rounded-[1.6rem]" aria-label={`إدارة ${form.name}`} />
      <div className="relative z-10 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black leading-7 text-[var(--olive-dark)] sm:text-xl">{form.name}</h2>
            <Badge tone={form.status === "published" ? "green" : "gold"}>{formStatusLabels[form.status] ?? form.status}</Badge>
          </div>
          <p className="mt-1 text-sm font-bold text-[var(--olive)]">
            {isIndividual ? "طالب فردي" : "دفعة"}
            {form.batch_name ? ` · ${form.batch_name}` : ""}
          </p>
        </div>
      </div>

      <dl className="relative z-10 mt-4 grid gap-2 text-sm">
        <div className="flex min-w-0 justify-between gap-3">
          <dt className="shrink-0 text-[var(--muted)]">الرابط</dt>
          <dd className="ltr min-w-0 truncate text-left font-bold text-[var(--olive-dark)]" dir="ltr">
            {publicPath}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">الأقسام / الحقول</dt>
          <dd className="font-black text-[var(--olive-dark)]">
            {form.sectionCount} / {form.fieldCount}
          </dd>
        </div>
        {form.productOptionCount ? (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--muted)]">خيارات المنتجات</dt>
            <dd className="font-black text-[var(--olive-dark)]">{form.productOptionCount}</dd>
          </div>
        ) : null}
        {form.updated_at || form.created_at ? (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--muted)]">آخر تحديث</dt>
            <dd className="font-bold text-[var(--olive-dark)]">{formatArabicDate(form.updated_at || form.created_at || "")}</dd>
          </div>
        ) : null}
      </dl>

      <div className="relative z-10 mt-4 flex flex-wrap gap-2">
        <LinkButton href={href} prefetch className="min-h-11 px-4 py-2">
          إدارة النموذج
        </LinkButton>
        <LinkButton href={`${href}?tab=outfits`} prefetch variant="secondary" className="min-h-11 px-4 py-2">
          الزي والمنتجات
        </LinkButton>
        {canManage ? (
          <>
            <form
              action={async () => {
                "use server";
                await setFormStatusAction(form.id, form.status === "published" ? "closed" : "published");
              }}
            >
              <Button type="submit" variant="secondary" className="min-h-11 px-4 py-2">
                {form.status === "published" ? "إغلاق" : "تفعيل"}
              </Button>
            </form>
            <form
              action={async () => {
                "use server";
                await duplicateFormAction(form.id);
              }}
            >
              <Button type="submit" variant="secondary" className="min-h-11 px-4 py-2">
                نسخ النموذج
              </Button>
            </form>
            <ArchiveConfirmButton
              label="أرشفة"
              title={`أرشفة «${form.name}»؟`}
              warning="لن تُحذف الحجوزات أو الملفات أو لقطات الطلب السابقة. النموذج سيختفي من القائمة النشطة ويتوقف الحجز العام. الطلبات القديمة تبقى قابلة للقراءة."
              action={archiveFormAction}
              hiddenFields={{ formId: form.id }}
            />
          </>
        ) : null}
        <CopyLinkButton value={publicUrl} />
      </div>
    </article>
  );
}
