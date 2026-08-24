"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFormCatalogProductAction } from "@/app/actions";
import { OptimizedThumb } from "@/components/optimized-thumb";
import { Button, FieldLabel, LinkButton, Select, TextInput } from "@/components/ui";
import { normalizeCatalogAssignment } from "@/lib/outfit-architecture";
import { isCatalogProductAttachedToForm, type CatalogAudience } from "@/lib/product-catalog";
import type { CatalogProduct, FormDefinition, ProductCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "attach" | "create";

/**
 * Lightweight "attach catalog product to this form" dialog.
 * Configuration of the Form Product assignment lives on the product card, not here.
 */
export function FormProductAssignModal({
  formId,
  products,
  categories,
  definition,
  audience,
  lockedCategoryId,
  onClose,
  onOpenExisting
}: {
  formId: string;
  products: CatalogProduct[];
  categories: ProductCategory[];
  definition: FormDefinition;
  audience: CatalogAudience;
  lockedCategoryId?: string;
  onClose: () => void;
  /** Called when the selected product is already attached — open its Form Product settings. */
  onOpenExisting?: (productId: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("attach");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [categoryId, setCategoryId] = useState(lockedCategoryId || categories[0]?.id || "");
  const [error, setError] = useState<string>();
  const [alreadyId, setAlreadyId] = useState<string>();

  const assignedIds = useMemo(() => {
    const set = new Set<string>();
    for (const product of products) {
      if (isCatalogProductAttachedToForm(product, audience)) set.add(product.id);
    }
    return set;
  }, [audience, products]);

  const selectable = useMemo(() => {
    return products
      .filter((product) => {
        if (product.archived || !product.active) return false;
        if (lockedCategoryId && product.category_id !== lockedCategoryId) return false;
        return true;
      })
      .filter((product) => {
        if (!query.trim()) return true;
        const hay = `${product.name_ar} ${product.category?.name_ar ?? ""}`;
        return hay.includes(query.trim());
      })
      .sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar"));
  }, [lockedCategoryId, products, query]);

  const selectedProduct = selectable.find((product) => product.id === selectedId);
  const selectedAlreadyAttached = Boolean(selectedProduct && assignedIds.has(selectedProduct.id));
  const nextSortOrder = (definition.outfitConfig?.catalogAssignments
    ? Math.max(0, ...Object.values(definition.outfitConfig.catalogAssignments).map((entry) => entry?.sortOrder ?? 0))
    : 0) + 1;

  function attachExisting() {
    setError(undefined);
    setAlreadyId(undefined);
    if (!selectedId) {
      setError("يرجى اختيار منتج من الكتالوج.");
      return;
    }
    if (assignedIds.has(selectedId)) {
      setAlreadyId(selectedId);
      setError("هذا المنتج مضاف بالفعل إلى النموذج");
      return;
    }
    startTransition(async () => {
      const result = await saveFormCatalogProductAction({
        formId,
        productId: selectedId,
        rejectIfAttached: true,
        assignment: normalizeCatalogAssignment({
          sortOrder: nextSortOrder,
          hidden: false,
          bookingModes: ["full_set", "single_pieces"]
        })
      });
      if (result.alreadyAttached) {
        setAlreadyId(result.productId);
        setError(result.error ?? "هذا المنتج مضاف بالفعل إلى النموذج");
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function createAndAttach() {
    setError(undefined);
    setAlreadyId(undefined);
    if (!nameAr.trim()) {
      setError("اسم المنتج مطلوب.");
      return;
    }
    if (!categoryId) {
      setError("التصنيف مطلوب.");
      return;
    }
    startTransition(async () => {
      const result = await saveFormCatalogProductAction({
        formId,
        create: {
          category_id: categoryId,
          name_ar: nameAr.trim(),
          sort_order: nextSortOrder
        },
        assignment: normalizeCatalogAssignment({
          sortOrder: nextSortOrder,
          hidden: false,
          bookingModes: ["full_set", "single_pieces"]
        })
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attach-product-title"
    >
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-[1.6rem] bg-[var(--paper)] p-5 shadow-2xl sm:rounded-[1.6rem]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="attach-product-title" className="text-xl font-black text-[var(--olive-dark)]">
              إضافة منتج إلى النموذج
            </h3>
            <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
              اختر منتجًا من الكتالوج. هذا المنتج موجود في الكتالوج العام وسيتم ربطه بهذا النموذج. لن يتم إنشاء نسخة جديدة من
              المنتج.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant={mode === "attach" ? "primary" : "secondary"} onClick={() => setMode("attach")}>
            اختيار من الكتالوج
          </Button>
          <Button type="button" variant={mode === "create" ? "primary" : "secondary"} onClick={() => setMode("create")}>
            إنشاء منتج جديد في الكتالوج
          </Button>
        </div>

        {mode === "attach" ? (
          <div className="mt-4 grid gap-3">
            <div>
              <FieldLabel required>اختر منتجًا من الكتالوج</FieldLabel>
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث بالاسم أو التصنيف..."
                className="mb-2"
              />
              <div className="max-h-64 overflow-y-auto rounded-2xl border border-[var(--border)] bg-white/70">
                {selectable.map((product) => {
                  const attached = assignedIds.has(product.id);
                  const active = selectedId === product.id;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setSelectedId(product.id);
                        setError(undefined);
                        setAlreadyId(attached ? product.id : undefined);
                        if (attached) setError("هذا المنتج مضاف بالفعل إلى النموذج");
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-[var(--border)] px-3 py-2.5 text-right last:border-b-0",
                        active ? "bg-[#3f472d12]" : "hover:bg-white/90"
                      )}
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[#f3ead6]">
                        {product.image_url ? (
                          <OptimizedThumb src={product.image_url} alt={product.name_ar} sizes="56px" className="!aspect-square" />
                        ) : (
                          <div className="grid h-full place-items-center text-[10px] font-bold text-[var(--muted)]">بدون صورة</div>
                        )}
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block font-black text-[var(--olive-dark)]">{product.name_ar}</span>
                        <span className="mt-0.5 block text-xs font-bold text-[var(--muted)]">
                          المنتج الأساسي · {product.category?.name_ar ?? "بدون تصنيف"}
                          {attached ? " · مضاف بالفعل" : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {!selectable.length ? <p className="p-4 text-sm font-bold text-[var(--muted)]">لا توجد منتجات مطابقة في الكتالوج.</p> : null}
              </div>
            </div>

            {selectedProduct ? (
              <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-3">
                <p className="text-xs font-bold text-[var(--muted)]">معاينة المنتج الأساسي</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[#f3ead6]">
                    {selectedProduct.image_url ? (
                      <OptimizedThumb
                        src={selectedProduct.image_url}
                        alt={selectedProduct.name_ar}
                        sizes="64px"
                        className="!aspect-square"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-[10px] font-bold text-[var(--muted)]">صورة الكتالوج</div>
                    )}
                  </div>
                  <div>
                    <p className="font-black text-[var(--olive-dark)]">{selectedProduct.name_ar}</p>
                    <p className="text-xs font-bold text-[var(--muted)]">
                      {selectedAlreadyAttached
                        ? "مرتبط بهذا النموذج بالفعل — لن تُنشأ نسخة جديدة."
                        : "سيُربط بهذا النموذج دون إنشاء منتج جديد."}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <p className="rounded-2xl bg-[#3f472d0d] px-3 py-2 text-sm leading-7 text-[var(--olive)]">
              يُنشأ المنتج في <strong>الكتالوج العام</strong> ثم يُربط تلقائياً بهذا النموذج. يبقى منتجاً واحداً فقط.
            </p>
            <div>
              <FieldLabel required>اسم المنتج في الكتالوج</FieldLabel>
              <TextInput value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder="مثال: روب أمريكي" />
            </div>
            <div>
              <FieldLabel required>التصنيف</FieldLabel>
              <Select
                value={categoryId}
                disabled={Boolean(lockedCategoryId) || pending}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name_ar}
                  </option>
                ))}
              </Select>
            </div>
            <LinkButton href="/admin/products?new=1" variant="secondary" size="sm" className="justify-self-start">
              فتح محرر الكتالوج بالكامل
            </LinkButton>
          </div>
        )}

        {error ? (
          <div className="mt-4 rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">
            <p>{error}</p>
            {alreadyId && onOpenExisting ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => {
                  onOpenExisting(alreadyId);
                  onClose();
                }}
              >
                فتح إعدادات المنتج
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || (mode === "attach" && selectedAlreadyAttached)}
            onClick={mode === "attach" ? attachExisting : createAndAttach}
          >
            {pending ? "جاري الإضافة..." : mode === "attach" ? "إضافة إلى النموذج" : "إنشاء وربط بالنموذج"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  );
}
