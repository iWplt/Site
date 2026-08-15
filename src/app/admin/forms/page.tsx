import { duplicateFormAction, setFormStatusAction } from "@/app/actions";
import { CreateFormPanel } from "@/components/create-form-panel";
import { FormOptionImageEditor } from "@/components/form-option-image-editor";
import { FormUploadSettings } from "@/components/form-upload-settings";
import { Badge, Button, Card, LinkButton } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { listBatches, listForms } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";

export default async function FormsPage() {
  const user = await requireUser();
  const [forms, batches] = await Promise.all([listForms(user), listBatches(user)]);

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">Dynamic Form Builder</p>
          <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">النماذج الديناميكية</h1>
        </div>
      </div>
      {user.role === "OWNER" ? <CreateFormPanel batches={batches.map((batch) => ({ id: batch.id, name: batch.name }))} /> : null}
      <div className="grid gap-4">
        {forms.map((form) => {
          const batch = batches.find((entry) => entry.id === form.batch_id);
          const fields = form.definition.sections.reduce((count, section) => count + section.fields.length, 0);
          const allFields = form.definition.sections.flatMap((section) => section.fields);
          const uploadFields = allFields
            .filter((field) => ["image_upload", "file_upload"].includes(field.type))
            .map((field) => ({
              key: field.key,
              label: field.label,
              type: field.type,
              uploadMode: field.uploadMode,
              maxFiles: field.maxFiles,
              required: field.required
            }));
          return (
            <Card key={form.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-[var(--olive-dark)]">{form.name}</h2>
                    <Badge tone={form.status === "published" ? "green" : "gold"}>{statusLabels[form.status]}</Badge>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">{form.internal_description}</p>
                </div>
                <LinkButton href={`/f/${form.slug}`} variant="secondary">
                  فتح الرابط العام
                </LinkButton>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                <Info label="النوع" value={form.type === "BATCH" ? "نموذج دفعة" : "طلب فردي"} />
                <Info label="الرابط" value={`/f/${form.slug}`} ltr />
                <Info label="الدفعة" value={batch?.name ?? "غير مرتبط"} />
                <Info label="الأقسام / الحقول" value={`${form.definition.sections.length} / ${fields}`} />
              </div>
              {user.role === "OWNER" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await setFormStatusAction(form.id, form.status === "published" ? "closed" : "published");
                    }}
                  >
                    <Button type="submit" variant="secondary">
                      {form.status === "published" ? "إغلاق النموذج" : "نشر النموذج"}
                    </Button>
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
                </div>
              ) : null}
              {user.role === "OWNER" ? <FormUploadSettings formId={form.id} fields={uploadFields} /> : null}
              {user.role === "OWNER" ? <FormOptionImageEditor formId={form.id} fields={allFields} /> : null}
            </Card>
          );
        })}
        {!forms.length ? (
          <EmptyState title="لا توجد نماذج" description="أنشئ نموذجاً أو أنشئ دفعة ليُنشأ نموذج الحجز تلقائياً." actionHref="/admin/batches/new" actionLabel="إنشاء دفعة" />
        ) : null}
      </div>
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-3xl bg-white/60 p-4">
      <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
      <p className={ltr ? "ltr mt-1 text-left font-black text-[var(--olive-dark)]" : "mt-1 font-black text-[var(--olive-dark)]"}>{value}</p>
    </div>
  );
}
