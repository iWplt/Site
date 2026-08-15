import Link from "next/link";
import { FormOptionImageEditor } from "@/components/form-option-image-editor";
import { Card } from "@/components/ui";
import { filterAvailableProducts, type CatalogAudience } from "@/lib/product-catalog";
import type { CatalogProduct, FormDefinition } from "@/lib/types";

export function FormProductsPanel({
  formId,
  definition,
  products,
  audience,
  canManage
}: {
  formId: string;
  definition: FormDefinition;
  products: CatalogProduct[];
  audience: CatalogAudience;
  canManage: boolean;
}) {
  const assigned = filterAvailableProducts(products, audience);
  const fields = definition.sections.flatMap((section) => section.fields);

  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">المنتجات الظاهرة للطلاب</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          هذه المنتجات تُضاف إلى خيارات النموذج حسب التوفر. إدارة الكتالوج تتم من صفحة المنتجات.
        </p>
        <div className="mt-4 grid gap-2">
          {assigned.map((product) => (
            <div key={product.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-3">
              <div className="min-w-0">
                <p className="font-black text-[var(--olive-dark)]">{product.name_ar}</p>
                <p className="text-xs font-bold text-[var(--muted)]">{product.category?.name_ar ?? "بدون تصنيف"}</p>
              </div>
            </div>
          ))}
          {!assigned.length ? <p className="text-sm font-bold text-[var(--muted)]">لا توجد منتجات كتالوج مخصصة لهذا النموذج بعد.</p> : null}
        </div>
        {canManage ? (
          <Link href="/admin/products" className="mt-4 inline-flex min-h-11 items-center font-bold text-[var(--olive)]">
            إدارة الكتالوج
          </Link>
        ) : null}
      </Card>
      {canManage ? <FormOptionImageEditor formId={formId} fields={fields} /> : null}
    </div>
  );
}
