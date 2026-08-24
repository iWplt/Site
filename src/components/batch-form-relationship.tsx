import { Card, LinkButton } from "@/components/ui";
import { CORE_PRODUCT_LABELS, sanitizeOutfitConfig } from "@/lib/outfit-architecture";
import type { FormDefinition } from "@/lib/types";

export function BatchFormRelationshipCard({
  formId,
  formName,
  formSlug,
  batchId,
  batchName,
  definition,
  singleItemEnabled
}: {
  formId: string;
  formName: string;
  formSlug?: string;
  batchId?: string | null;
  batchName?: string | null;
  definition: FormDefinition;
  singleItemEnabled?: boolean;
}) {
  const config = sanitizeOutfitConfig(definition.outfitConfig);
  const outfits = config.fullOutfits.filter((outfit) => outfit.enabled !== false);
  const singleEnabled = singleItemEnabled ?? config.singleItemEnabled;

  return (
    <Card className="!rounded-[1.35rem]">
      <h2 className="text-xl font-black text-[var(--olive-dark)]">علاقة الدفعة بالنموذج</h2>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        الدفعة لا تدير منتجات أو موديلات. الطلاب يرون منتجات النموذج المفعّلة، ثم الزي الكامل المختار من إعدادات الأزياء.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Meta label="النموذج المرتبط" value={formName} />
        <Meta label="الدفعة" value={batchName ?? "—"} />
        <Meta label="الحجز المفرد" value={singleEnabled ? "مفعّل حسب النموذج" : "معطّل في النموذج"} />
        <Meta label="عدد الأزياء المفعّلة" value={String(outfits.length)} />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-black text-[var(--olive)]">الأزياء المفعّلة من هذا النموذج</h3>
        {outfits.length ? (
          <ul className="mt-2 grid gap-2">
            {outfits.map((outfit) => (
              <li key={outfit.id} className="rounded-2xl border border-[var(--border)] bg-white/70 px-3 py-2.5">
                <p className="font-black text-[var(--olive-dark)]">{outfit.name}</p>
                <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                  {(outfit.productOrder ?? config.productOrder)
                    .map((product) => CORE_PRODUCT_LABELS[product])
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm font-bold text-[var(--muted)]">لا توجد أزياء مفعّلة. أضفها من تبويب الأزياء.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton href={`/admin/forms/${formId}?tab=products`} size="sm">
          منتجات النموذج
        </LinkButton>
        <LinkButton href={`/admin/forms/${formId}?tab=outfits`} variant="secondary" size="sm">
          إعدادات الأزياء
        </LinkButton>
        {batchId ? (
          <LinkButton href={`/admin/batches/${batchId}`} variant="secondary" size="sm">
            صفحة الدفعة
          </LinkButton>
        ) : null}
        {formSlug ? (
          <LinkButton href={`/f/${formSlug}`} variant="secondary" size="sm">
            الرابط العام
          </LinkButton>
        ) : null}
      </div>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#3f472d0d] px-3 py-2.5">
      <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-[var(--olive-dark)]">{value}</p>
    </div>
  );
}
