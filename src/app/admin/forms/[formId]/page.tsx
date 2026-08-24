import { notFound } from "next/navigation";
import { duplicateFormAction, setFormStatusAction, archiveFormAction } from "@/app/actions";
import { ArchiveConfirmButton } from "@/components/archive-confirm-button";
import { BatchFormRelationshipCard } from "@/components/batch-form-relationship";
import { BookingWorkspaceNav, formWorkspaceItems } from "@/components/booking-workspace-nav";
import { CopyLinkButton } from "@/components/copy-link-button";
import { FormCopyPanel } from "@/components/form-copy-panel";
import { FormConfigWarnings } from "@/components/form-config-warnings";
import { FormOutfitWorkspace } from "@/components/form-outfit-workspace";
import { FormFieldsManager } from "@/components/form-fields-manager";
import { FormGeneralSettings } from "@/components/form-general-settings";
import { FormProductsPanel } from "@/components/form-products-panel";
import { FormTabsNav } from "@/components/form-tabs-nav";
import { FORM_TABS, resolveFormTab, type FormTabId } from "@/lib/form-tabs";
import { FormUploadSettings } from "@/components/form-upload-settings";
import { Badge, Button, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getAdminForm, getBatch, listFormSummaries } from "@/lib/data";
import { uploadFieldsFromDefinition } from "@/lib/form-summary";
import { formStatusLabels } from "@/lib/labels";
import { getPublicAppUrl, requestOrigin } from "@/lib/public-url";
import { listCatalogProducts, listProductCategories } from "@/lib/store/catalog-store";
import type { CatalogProduct, ProductCategory } from "@/lib/types";

export default async function FormManagePage({
  params,
  searchParams
}: {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { formId } = await params;
  const { tab: rawTab } = await searchParams;
  const requested = resolveFormTab(rawTab);

  const form = await getAdminForm(user, formId, {
    resolveImages: requested === "products" || requested === "outfits" || requested === "customizations" || requested === "booking"
  });
  if (!form) notFound();

  const isBatch = form.type === "BATCH" && Boolean(form.batch_id);
  const tab: FormTabId = requested;
  const canManage = user.role === "OWNER";
  const origin = getPublicAppUrl(await requestOrigin());
  const publicPath = `/f/${form.slug}`;
  const publicUrl = `${origin}${publicPath}`;
  const previewHref = `/admin/forms/${form.id}/preview`;
  const batch = form.batch_id ? await getBatch(user, form.batch_id) : null;

  let products: CatalogProduct[] = [];
  let categories: ProductCategory[] = [];
  if (tab === "products") {
    try {
      [products, categories] = await Promise.all([listCatalogProducts({ resolveImages: false }), listProductCategories()]);
    } catch {
      products = [];
      categories = [];
    }
  }

  const otherForms = canManage && tab === "publish" ? await listFormSummaries(user) : [];

  return (
    <div className="grid min-w-0 gap-4 pb-16">
      <div>
        <LinkButton href="/admin/forms" variant="ghost" size="sm" className="mb-3 px-0">
          العودة إلى النماذج
        </LinkButton>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">{form.name}</h1>
            <p className="mt-2 text-sm font-bold text-[var(--olive)]">
              {form.type === "INDIVIDUAL" ? "حجز فردي" : "دفعة"}
              {batch?.name ? ` · ${batch.name}` : ""}
            </p>
          </div>
          <Badge tone={form.status === "published" ? "green" : "gold"}>{formStatusLabels[form.status] ?? form.status}</Badge>
        </div>
      </div>

      <BookingWorkspaceNav
        items={formWorkspaceItems({
          formId: form.id,
          batchId: form.batch_id,
          current: tab === "outfits" ? "outfits" : tab === "products" ? "products" : "form"
        })}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[1.2rem] border border-[var(--border)] bg-white/70 p-3">
        <div className="flex flex-wrap gap-2">
          <LinkButton href={previewHref} target="_blank" rel="noreferrer">
            👁️ معاينة كطالب
          </LinkButton>
          <CopyLinkButton value={publicUrl} />
        </div>
        {canManage ? (
          <form
            action={async () => {
              "use server";
              await setFormStatusAction(form.id, form.status === "published" ? "closed" : "published");
            }}
          >
            <Button type="submit" variant={form.status === "published" ? "secondary" : "primary"}>
              {form.status === "published" ? "إغلاق النموذج" : "نشر النموذج"}
            </Button>
          </form>
        ) : null}
      </div>

      <FormTabsNav formId={form.id} active={tab} tabs={[...FORM_TABS]} />
      {tab !== "booking" ? <FormConfigWarnings definition={form.definition} /> : null}

      {tab === "booking" ? (
        <div className="grid gap-4">
          {canManage ? (
            <FormGeneralSettings form={form} />
          ) : (
            <Card>
              <p className="font-bold text-[var(--muted)]">عرض فقط. إدارة النموذج متاحة للمالك.</p>
            </Card>
          )}
          {isBatch && batch ? (
            <div className="grid gap-4">
              <Card>
                <h2 className="text-xl font-black text-[var(--olive-dark)]">إعدادات الدفعة</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Meta label="الدفعة" value={batch.name} />
                  <Meta label="الممثل" value={batch.representative_name ?? "غير معيّن"} />
                </div>
              </Card>
              <BatchFormRelationshipCard
                formId={form.id}
                formName={form.name}
                formSlug={form.slug}
                batchId={batch.id}
                batchName={batch.name}
                definition={form.definition}
              />
            </div>
          ) : null}
          <details className="warka-card rounded-[1.5rem] p-4 sm:p-5">
            <summary className="cursor-pointer font-black text-[var(--olive-dark)]">الحقول والأقسام المتقدمة</summary>
            <div className="mt-4">
              <FormFieldsManager formId={form.id} definition={form.definition} canManage={canManage} />
            </div>
          </details>
        </div>
      ) : null}

      {tab === "outfits" ? (
        <FormOutfitWorkspace
          formId={form.id}
          definition={form.definition}
          canManage={canManage}
          focus="outfits"
        />
      ) : null}

      {tab === "customizations" ? (
        <div className="grid gap-4">
          <FormOutfitWorkspace
            formId={form.id}
            definition={form.definition}
            canManage={canManage}
            focus="customizations"
          />
          {canManage ? <FormUploadSettings formId={form.id} fields={uploadFieldsFromDefinition(form.definition)} /> : null}
        </div>
      ) : null}

      {tab === "products" ? (
        <div className="grid gap-4">
          <Card>
            <h2 className="text-xl font-black text-[var(--olive-dark)]">منتجات هذا النموذج</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              النموذج هو المصدر الوحيد للمنتجات الظاهرة للطلاب. الأزياء إعدادات تستخدم هذه المنتجات، ولا تُدار المنتجات من شاشة الدفعة.
            </p>
          </Card>
          <FormProductsPanel
            formId={form.id}
            definition={form.definition}
            products={products}
            categories={categories}
            audience={{ formId: form.id, formType: form.type, batchId: form.batch_id }}
            canManage={canManage}
          />
          <FormOutfitWorkspace
            formId={form.id}
            definition={form.definition}
            canManage={canManage}
            focus="products"
          />
        </div>
      ) : null}

      {tab === "preview" ? (
        <Card>
          <h2 className="text-xl font-black text-[var(--olive-dark)]">معاينة الطالب</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            افتح المعاينة كما يراها الطالب: البيانات، نوع الحجز، الزي، المنتجات، التخصيصات، التصاميم، ثم المراجعة.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href={previewHref} target="_blank" rel="noreferrer">
              👁️ معاينة كطالب
            </LinkButton>
            <LinkButton href={publicPath} target="_blank" rel="noreferrer" variant="secondary">
              الرابط العام
            </LinkButton>
          </div>
        </Card>
      ) : null}

      {tab === "publish" ? (
        <div className="grid gap-4">
          <Card>
            <h2 className="text-xl font-black text-[var(--olive-dark)]">الحفظ والنشر</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              النشر يظهر البطاقة للطلاب. الأرشفة تخفي النموذج دون حذف الطلبات أو اللقطات أو الملفات.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {canManage ? (
                <>
                  <form
                    action={async () => {
                      "use server";
                      await setFormStatusAction(form.id, form.status === "published" ? "closed" : "published");
                    }}
                  >
                    <Button type="submit">{form.status === "published" ? "إغلاق" : "نشر"}</Button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await duplicateFormAction(form.id);
                    }}
                  >
                    <Button type="submit" variant="secondary">
                      نسخ النموذج
                    </Button>
                  </form>
                  {form.status !== "archived" ? (
                    <ArchiveConfirmButton
                      label="أرشفة النموذج"
                      title={`أرشفة «${form.name}»؟`}
                      warning="سيتم أرشفة هذا النموذج ولن يظهر ضمن النماذج النشطة. الطلبات القديمة واللقطات والملفات المرتبطة به ستبقى محفوظة."
                      action={archiveFormAction}
                      hiddenFields={{ formId: form.id }}
                    />
                  ) : null}
                </>
              ) : (
                <p className="font-bold text-[var(--muted)]">النشر والأرشفة متاحان للمالك فقط.</p>
              )}
            </div>
          </Card>
          {canManage ? <FormCopyPanel formId={form.id} forms={otherForms} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Meta({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-[1.2rem] bg-white/70 p-4">
      <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
      <p className={ltr ? "ltr mt-1 break-all text-left font-black text-[var(--olive-dark)]" : "mt-1 break-words font-black text-[var(--olive-dark)]"}>
        {value}
      </p>
    </div>
  );
}
