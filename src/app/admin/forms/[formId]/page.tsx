import { notFound } from "next/navigation";
import { duplicateFormAction, setFormStatusAction, archiveFormAction } from "@/app/actions";
import { ArchiveConfirmButton } from "@/components/archive-confirm-button";
import { BatchUniformForm } from "@/components/batch-uniform-form";
import { BookingWorkspaceNav, formWorkspaceItems } from "@/components/booking-workspace-nav";
import { CopyLinkButton } from "@/components/copy-link-button";
import { FormOutfitWorkspace } from "@/components/form-outfit-workspace";
import { FormFieldsManager } from "@/components/form-fields-manager";
import { FormGeneralSettings } from "@/components/form-general-settings";
import { FormProductsPanel } from "@/components/form-products-panel";
import { FormTabsNav } from "@/components/form-tabs-nav";
import { FORM_TABS, type FormTabId } from "@/lib/form-tabs";
import { FormUploadSettings } from "@/components/form-upload-settings";
import { Badge, Button, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getAdminForm, getBatch, getFixedOptions } from "@/lib/data";
import { uploadFieldsFromDefinition } from "@/lib/form-summary";
import { formStatusLabels } from "@/lib/labels";
import { getPublicAppUrl, requestOrigin } from "@/lib/public-url";
import { listCatalogProducts } from "@/lib/store/catalog-store";

const TAB_IDS = new Set(FORM_TABS.map((tab) => tab.id));

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
  const requested = TAB_IDS.has(rawTab as FormTabId) ? (rawTab as FormTabId) : "general";

  const form = await getAdminForm(user, formId, {
    resolveImages: requested === "products" || requested === "batch"
  });
  if (!form) notFound();

  const isBatch = form.type === "BATCH" && Boolean(form.batch_id);
  const tabs = FORM_TABS.filter((tab) => (tab.id === "batch" ? isBatch : true));
  const tab = requested === "batch" && !isBatch ? "general" : requested;
  const canManage = user.role === "OWNER";
  const origin = getPublicAppUrl(await requestOrigin());
  const publicPath = `/f/${form.slug}`;
  const publicUrl = `${origin}${publicPath}`;
  const batch = form.batch_id ? await getBatch(user, form.batch_id) : null;

  let products: Awaited<ReturnType<typeof listCatalogProducts>> = [];
  if (tab === "products") {
    try {
      products = await listCatalogProducts({ resolveImages: false });
    } catch {
      products = [];
    }
  }

  const uniform = tab === "batch" && form.batch_id ? await getFixedOptions(user, form.id) : {};

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6">
      <div>
        <LinkButton href="/admin/forms" variant="ghost" className="mb-3 px-0 py-2">
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Meta label="نوع النموذج" value={form.type === "INDIVIDUAL" ? "حجز فردي" : "دفعة"} />
        <Meta label="الرابط" value={publicPath} ltr />
        <Meta label="الدفعة" value={batch?.name ?? (form.type === "INDIVIDUAL" ? "طالب فردي" : "غير مرتبط")} />
        <Meta
          label="عدد الحقول"
          value={String(form.definition.sections.reduce((count, section) => count + section.fields.length, 0))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <LinkButton href={publicPath} target="_blank" rel="noreferrer" variant="secondary" className="min-h-11 px-4 py-2">
          فتح الرابط العام
        </LinkButton>
        <CopyLinkButton value={publicUrl} />
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
            {form.status !== "archived" ? (
              <ArchiveConfirmButton
                label="أرشفة النموذج"
                title={`أرشفة «${form.name}»؟`}
                warning="لن تُحذف الحجوزات أو الملفات أو لقطات الطلب السابقة. النموذج سيختفي من القائمة النشطة ويتوقف الحجز العام."
                action={archiveFormAction}
                hiddenFields={{ formId: form.id }}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <FormTabsNav formId={form.id} active={tab} tabs={tabs} />

      {tab === "general" ? (
        canManage ? (
          <FormGeneralSettings form={form} />
        ) : (
          <Card>
            <p className="font-bold text-[var(--muted)]">عرض فقط. إدارة النموذج متاحة للمالك.</p>
          </Card>
        )
      ) : null}

      {tab === "outfits" ? <FormOutfitWorkspace formId={form.id} definition={form.definition} canManage={canManage} /> : null}

      {tab === "fields" ? <FormFieldsManager formId={form.id} definition={form.definition} canManage={canManage} /> : null}

      {tab === "uploads" ? (
        canManage ? (
          <FormUploadSettings formId={form.id} fields={uploadFieldsFromDefinition(form.definition)} />
        ) : (
          <Card>
            <p className="font-bold text-[var(--muted)]">إعدادات الرفع متاحة للمالك فقط.</p>
          </Card>
        )
      ) : null}

      {tab === "products" ? (
        <FormProductsPanel
          formId={form.id}
          definition={form.definition}
          products={products}
          audience={{ formId: form.id, formType: form.type, batchId: form.batch_id }}
          canManage={canManage}
        />
      ) : null}

      {tab === "batch" && batch ? (
        <div className="grid gap-4">
          <Card>
            <h2 className="text-2xl font-black text-[var(--olive-dark)]">إعدادات الدفعة</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Meta label="الدفعة" value={batch.name} />
              <Meta label="الممثل" value={batch.representative_name ?? "غير معيّن"} />
            </div>
          </Card>
          {canManage ? <BatchUniformForm formId={form.id} definition={form.definition} value={uniform} /> : null}
        </div>
      ) : null}

      {tab === "preview" ? (
        <Card>
          <h2 className="text-2xl font-black text-[var(--olive-dark)]">معاينة نموذج الطالب</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            تُفتح المعاينة في تبويب جديد حتى لا تختلط جلسة الإدارة مع نموذج الطالب.
          </p>
          <LinkButton href={publicPath} target="_blank" rel="noreferrer" className="mt-4">
            معاينة نموذج الطالب
          </LinkButton>
        </Card>
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
