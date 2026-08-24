"use client";

import { useActionState, useState } from "react";
import { createProductAction, createProductCategoryAction, updateProductAction, uploadProductImageAction } from "@/app/actions";
import { Button, Card, FieldLabel, LinkButton, Select, TextArea, TextInput } from "@/components/ui";
import type { CatalogProduct, ProductCategory } from "@/lib/types";

type Props = {
  categories: ProductCategory[];
  batches: Array<{ id: string; name: string }>;
  forms: Array<{ id: string; name: string; slug: string }>;
  product?: CatalogProduct;
};

export function ProductEditor({ categories, batches, forms, product }: Props) {
  const action = product ? updateProductAction : createProductAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  const initialScope = product?.availability.some((row) => row.scope === "individual")
    ? "individual"
    : product?.availability.some((row) => row.scope === "batches" || row.scope === "forms")
      ? "selected"
      : "all";
  const [scope, setScope] = useState<"all" | "individual" | "selected">(initialScope);
  const [message, setMessage] = useState<string>();

  return (
    <Card>
      <h2 className="text-2xl font-black text-[var(--olive-dark)]">{product ? "تعديل منتج" : "إضافة منتج"}</h2>
      <form action={formAction} className="mt-4 grid min-w-0 gap-4">
        {product ? <input type="hidden" name="product_id" value={product.id} /> : null}
        <div>
          <FieldLabel required>اسم المنتج</FieldLabel>
          <TextInput name="name_ar" required defaultValue={product?.name_ar} />
        </div>
        <div>
          <FieldLabel>الاسم الإنجليزي</FieldLabel>
          <TextInput name="name_en" defaultValue={product?.name_en ?? ""} className="ltr" />
        </div>
        <div>
          <FieldLabel required>التصنيف</FieldLabel>
          <Select name="category_id" required defaultValue={product?.category_id}>
            <option value="">اختر التصنيف</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name_ar}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>الوصف</FieldLabel>
          <TextArea name="description" defaultValue={product?.description ?? ""} className="min-h-24" />
        </div>
        <div>
          <FieldLabel>السعر</FieldLabel>
          <TextInput name="price_iqd" type="number" min="0" step="1" defaultValue={product?.price_iqd ?? ""} className="ltr" placeholder="اختياري" />
        </div>
        <div>
          <FieldLabel>حالة المنتج</FieldLabel>
          <Select name="active" defaultValue={product?.active === false ? "false" : "true"}>
            <option value="true">نشط</option>
            <option value="false">مخفي</option>
          </Select>
        </div>
        <div>
          <FieldLabel>الترتيب</FieldLabel>
          <TextInput name="sort_order" type="number" defaultValue={product?.sort_order ?? 0} className="ltr" />
        </div>
        <div>
          <FieldLabel>مكان الظهور</FieldLabel>
          <input type="hidden" name="availability_scope" value={scope} />
          <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-white/60 p-3 text-sm font-bold">
            <label className="flex items-center gap-2">
              <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} />
              الكل
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={scope === "individual"} onChange={() => setScope("individual")} />
              الحجز الفردي
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={scope === "selected"} onChange={() => setScope("selected")} />
              دفعات أو نماذج محددة
            </label>
          </div>
          {scope === "selected" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-white/60 p-3">
                <p className="text-sm font-bold text-[var(--olive-dark)]">دفعات محددة</p>
                {batches.map((batch) => (
                  <label key={batch.id} className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="batch_ids"
                      value={batch.id}
                      defaultChecked={product?.availability.some((row) => row.batch_id === batch.id)}
                    />
                    {batch.name}
                  </label>
                ))}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white/60 p-3">
                <p className="text-sm font-bold text-[var(--olive-dark)]">نماذج محددة</p>
                {forms.map((form) => (
                  <label key={form.id} className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="form_ids"
                      value={form.id}
                      defaultChecked={product?.availability.some((row) => row.form_id === form.id)}
                    />
                    {form.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending}>
            {pending ? "جاري الحفظ..." : "حفظ المنتج"}
          </Button>
          <LinkButton href="/admin/products" variant="ghost">
            إلغاء
          </LinkButton>
        </div>
      </form>
      {product ? (
        <form
          className="mt-4"
          action={async (formData) => {
            formData.set("product_id", product.id);
            const result = await uploadProductImageAction(formData);
            setMessage(result.success ? "تم رفع الصورة." : result.error);
          }}
        >
          <FieldLabel>الصورة</FieldLabel>
          <input type="file" name="file" accept="image/jpeg,image/png,image/webp" className="mt-2 w-full min-w-0 text-sm" />
          <Button type="submit" variant="secondary" className="mt-3">
            رفع الصورة المرجعية
          </Button>
          {message ? <p className="mt-2 text-sm font-bold text-[var(--olive)]">{message}</p> : null}
        </form>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">احفظ المنتج أولاً ثم ارفع الصورة المرجعية.</p>
      )}
      <form action={createProductCategoryAction} className="mt-6 grid gap-2 rounded-2xl border border-dashed border-[var(--border)] p-4">
        <p className="font-black text-[var(--olive-dark)]">تصنيف جديد</p>
        <TextInput name="name_ar" placeholder="اسم التصنيف بالعربي" />
        <Button type="submit" variant="secondary" size="sm">
          إضافة تصنيف
        </Button>
      </form>
    </Card>
  );
}
