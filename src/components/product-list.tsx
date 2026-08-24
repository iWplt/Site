"use client";

import { useMemo, useState } from "react";
import { archiveProductAction, reorderProductAction, toggleProductActiveAction } from "@/app/actions";
import { Badge, Button, Card, LinkButton, Select, TextInput } from "@/components/ui";
import { formatProductPrice } from "@/lib/product-catalog";
import type { CatalogProduct, ProductCategory } from "@/lib/types";

function availabilityLabel(product: CatalogProduct) {
  if (!product.availability.length || product.availability.some((row) => row.scope === "all")) return "الكل";
  if (product.availability.some((row) => row.scope === "individual") && product.availability.length === 1) return "الحجز الفردي";
  return "محدد";
}

export function ProductList({
  products,
  categories
}: {
  products: CatalogProduct[];
  categories: ProductCategory[];
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "hidden">("all");

  const visible = useMemo(() => {
    return products.filter((product) => {
      if (product.archived) return false;
      if (categoryId && product.category_id !== categoryId) return false;
      if (status === "active" && !product.active) return false;
      if (status === "hidden" && product.active) return false;
      if (query && !`${product.name_ar} ${product.name_en ?? ""}`.includes(query.trim())) return false;
      return true;
    });
  }, [products, query, categoryId, status]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث عن منتج..."
        />
        <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">كل التصنيفات</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name_ar}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="all">الكل</option>
          <option value="active">نشط</option>
          <option value="hidden">مخفي</option>
        </Select>
      </div>
      {visible.map((product) => (
        <Card key={product.id} className="min-w-0">
          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
            <div className="overflow-hidden rounded-2xl bg-[#f3ead6]">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image_url} alt={product.name_ar} className="h-28 w-full object-cover" />
              ) : (
                <div className="grid h-28 place-items-center text-xs font-bold text-[var(--muted)]">بدون صورة</div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words text-xl font-black text-[var(--olive-dark)]">{product.name_ar}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{product.category?.name_ar ?? "بدون تصنيف"}</p>
                </div>
                <Badge tone={product.active ? "green" : "gold"}>{product.active ? "نشط" : "مخفي"}</Badge>
              </div>
              <p className="mt-2 text-sm font-bold text-[var(--olive)]">
                {formatProductPrice(product.price_iqd) ?? "بدون سعر"} · {availabilityLabel(product)} · ترتيب {product.sort_order}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <LinkButton href={`/admin/products?edit=${product.id}`} variant="secondary" size="sm">
                  تعديل
                </LinkButton>
                <form
                  action={async () => {
                    await toggleProductActiveAction(product.id, !product.active);
                  }}
                >
                  <Button type="submit" variant="secondary" size="sm">
                    {product.active ? "إخفاء" : "تفعيل"}
                  </Button>
                </form>
                <form
                  action={async () => {
                    await archiveProductAction(product.id);
                  }}
                >
                  <Button type="submit" variant="ghost" size="sm">
                    حذف
                  </Button>
                </form>
                <form action={reorderProductAction} className="flex min-w-0 items-center gap-2">
                  <input type="hidden" name="product_id" value={product.id} />
                  <input name="sort_order" defaultValue={product.sort_order} className="h-9 w-20 rounded-xl border border-[var(--border)] px-3 ltr" />
                  <Button type="submit" variant="ghost" size="sm">
                    حفظ الترتيب
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </Card>
      ))}
      {!visible.length ? <p className="text-sm font-bold text-[var(--muted)]">لا توجد منتجات مطابقة.</p> : null}
    </div>
  );
}
