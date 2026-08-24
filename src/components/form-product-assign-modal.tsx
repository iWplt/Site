"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProductCategoryAction,
  saveFormCatalogProductAction,
  updateFormFieldMetaAction,
  uploadProductImageAction
} from "@/app/actions";
import { Button, FieldLabel, Select, TextArea, TextInput } from "@/components/ui";
import { normalizeCatalogAssignment } from "@/lib/outfit-architecture";
import { customizationFieldsForCategory, isProductAvailable, type CatalogAudience } from "@/lib/product-catalog";
import type { BookingMode, CatalogFormAssignment, CatalogProduct, FormDefinition, ProductCategory } from "@/lib/types";

const BOTH_MODES: BookingMode[] = ["full_set", "single_pieces"];

type Mode = "existing" | "create";

export function FormProductAssignModal({
  formId,
  products,
  categories,
  definition,
  audience,
  lockedCategoryId,
  existingProduct,
  onClose
}: {
  formId: string;
  products: CatalogProduct[];
  categories: ProductCategory[];
  definition: FormDefinition;
  audience: CatalogAudience;
  lockedCategoryId?: string;
  existingProduct?: CatalogProduct;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialAssignment = normalizeCatalogAssignment(definition.outfitConfig?.catalogAssignments?.[existingProduct?.id ?? ""]);
  const [mode, setMode] = useState<Mode>(existingProduct ? "existing" : "existing");
  const [selectedId, setSelectedId] = useState(existingProduct?.id ?? "");
  const [nameAr, setNameAr] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(lockedCategoryId || existingProduct?.category_id || categories[0]?.id || "");
  const [price, setPrice] = useState("");
  const [sortOrder, setSortOrder] = useState(String(initialAssignment.sortOrder ?? existingProduct?.sort_order ?? products.length));
  const [visible, setVisible] = useState(!initialAssignment.hidden);
  const [fullOutfit, setFullOutfit] = useState(initialAssignment.bookingModes?.includes("full_set") !== false);
  const [singleItem, setSingleItem] = useState(initialAssignment.bookingModes?.includes("single_pieces") !== false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [savedProductId, setSavedProductId] = useState<string | undefined>(existingProduct?.id);
  const [newCategoryName, setNewCategoryName] = useState("");

  const selectable = useMemo(() => {
    return products.filter((product) => {
      if (product.archived) return false;
      if (lockedCategoryId && product.category_id !== lockedCategoryId) return false;
      if (existingProduct) return product.id === existingProduct.id;
      return true;
    });
  }, [existingProduct, lockedCategoryId, products]);

  const selectedProduct = selectable.find((product) => product.id === selectedId);
  const selectedCategoryId = mode === "create" ? categoryId : selectedProduct?.category_id || categoryId;
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const customizationFields = selectedCategory ? customizationFieldsForCategory(definition, selectedCategory.slug) : [];

  function assignment(): CatalogFormAssignment {
    const bookingModes: BookingMode[] = [
      ...(fullOutfit ? (["full_set"] as const) : []),
      ...(singleItem ? (["single_pieces"] as const) : [])
    ];
    return normalizeCatalogAssignment({
      bookingModes: bookingModes.length ? bookingModes : BOTH_MODES,
      sortOrder: Number(sortOrder) || 0,
      hidden: !visible
    });
  }

  function save() {
    setError(undefined);
    if ((mode === "existing" || existingProduct) && !(selectedId || existingProduct?.id)) {
      setError("يرجى اختيار منتج من الكتالوج.");
      return;
    }
    if (mode === "create" && !existingProduct && !nameAr.trim()) {
      setError("اسم المنتج مطلوب.");
      return;
    }
    if (!fullOutfit && !singleItem) {
      setError("اختر الزي الكامل أو الحجز المفرد أو كليهما.");
      return;
    }
    startTransition(async () => {
      const result = await saveFormCatalogProductAction({
        formId,
        productId: mode === "existing" || existingProduct ? selectedId || existingProduct?.id : undefined,
        create:
          mode === "create" && !existingProduct
            ? {
                category_id: categoryId,
                name_ar: nameAr,
                description,
                price_iqd: price.trim() ? Number(price) : null,
                sort_order: Number(sortOrder) || 0
              }
            : undefined,
        assignment: assignment()
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedProductId(result.productId);
      setMessage("تم حفظ المنتج في هذا النموذج.");
      router.refresh();
      if (existingProduct || mode === "existing") onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="assign-product-title">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[1.6rem] bg-[var(--paper)] p-5 shadow-2xl sm:rounded-[1.6rem]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="assign-product-title" className="text-xl font-black text-[var(--olive-dark)]">
              {existingProduct ? "إعداد المنتج في هذا النموذج" : "إضافة منتج"}
            </h3>
            <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
              الكتالوج العام يبقى المصدر. هنا تربط المنتج بهذا النموذج وتضبط ظهوره للطلاب.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>

        {!existingProduct ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant={mode === "existing" ? "primary" : "secondary"} onClick={() => setMode("existing")}>
              منتج موجود
            </Button>
            <Button type="button" variant={mode === "create" ? "primary" : "secondary"} onClick={() => setMode("create")}>
              منتج جديد
            </Button>
          </div>
        ) : null}

        {mode === "existing" || existingProduct ? (
          <div className="mt-4">
            <FieldLabel required>اختر من الكتالوج</FieldLabel>
            <Select
              value={selectedId}
              disabled={Boolean(existingProduct) || pending}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">اختر منتجاً</option>
              {selectable.map((product) => {
                const already = isProductAvailable(product.availability, audience);
                return (
                  <option key={product.id} value={product.id}>
                    {product.name_ar}
                    {product.category?.name_ar ? ` · ${product.category.name_ar}` : ""}
                    {already ? " · مرتبط" : ""}
                  </option>
                );
              })}
            </Select>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <div>
              <FieldLabel required>اسم المنتج</FieldLabel>
              <TextInput value={nameAr} onChange={(event) => setNameAr(event.target.value)} />
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
            <div>
              <FieldLabel>الوصف</FieldLabel>
              <TextArea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24" />
            </div>
            <div>
              <FieldLabel>السعر</FieldLabel>
              <TextInput type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} className="ltr" placeholder="اختياري" />
            </div>
            <form
              className="grid gap-2 rounded-2xl border border-dashed border-[var(--border)] p-3"
              action={async (formData) => {
                const name = String(formData.get("name_ar") ?? "").trim();
                if (!name) return;
                await createProductCategoryAction(formData);
                setNewCategoryName("");
                router.refresh();
              }}
            >
              <p className="text-sm font-black text-[var(--olive-dark)]">تصنيف جديد في الكتالوج</p>
              <TextInput name="name_ar" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="اسم التصنيف" />
              <Button type="submit" variant="secondary" size="sm">
                إضافة تصنيف
              </Button>
            </form>
          </div>
        )}

        <div className="mt-4 grid gap-3">
          <label className="inline-flex items-center gap-2 font-bold text-[var(--olive-dark)]">
            <input type="checkbox" checked={visible} disabled={pending} onChange={(event) => setVisible(event.target.checked)} />
            ظاهر للطلاب في هذا النموذج
          </label>
          <div>
            <FieldLabel>الترتيب داخل النموذج</FieldLabel>
            <TextInput type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="ltr" />
          </div>
          <div>
            <FieldLabel>نوع الحجز</FieldLabel>
            <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-white/60 p-3 text-sm font-bold">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={fullOutfit} disabled={pending} onChange={(event) => setFullOutfit(event.target.checked)} />
                الزي الكامل
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={singleItem} disabled={pending} onChange={(event) => setSingleItem(event.target.checked)} />
                الحجز المفرد
              </label>
            </div>
          </div>
        </div>

        {customizationFields.length ? (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white/60 p-3">
            <p className="font-black text-[var(--olive-dark)]">خيارات التخصيص الحالية</p>
            <p className="mt-1 text-xs leading-6 text-[var(--muted)]">هذه الحقول موجودة أصلاً في النموذج ولا تُنشأ نسخة جديدة منها.</p>
            <ul className="mt-3 grid gap-2">
              {customizationFields.map((field) => (
                <li key={field.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2">
                  <span className="text-sm font-bold text-[var(--olive-dark)]">{field.label}</span>
                  {field.type !== "info" ? (
                    <label className="inline-flex items-center gap-2 text-xs font-bold">
                      <input
                        type="checkbox"
                        defaultChecked={Boolean(field.required)}
                        disabled={pending}
                        onChange={(event) => {
                          startTransition(async () => {
                            await updateFormFieldMetaAction(formId, field.key, { required: event.target.checked });
                            router.refresh();
                          });
                        }}
                      />
                      مطلوب
                    </label>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? <p className="mt-4 rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="mt-4 rounded-2xl bg-[#386a3d12] p-3 text-sm font-bold text-[var(--success)]">{message}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? "جاري الحفظ..." : "حفظ في هذا النموذج"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </div>

        {savedProductId ? (
          <form
            className="mt-5 grid gap-2 rounded-2xl border border-[var(--border)] bg-white/60 p-3"
            action={async (formData) => {
              formData.set("product_id", savedProductId);
              const result = await uploadProductImageAction(formData);
              setMessage(result.error ?? "تم رفع الصورة المرجعية.");
              router.refresh();
            }}
          >
            <FieldLabel>صورة المنتج المرجعية</FieldLabel>
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" className="w-full text-sm" />
            <Button type="submit" variant="secondary" size="sm">
              رفع الصورة
            </Button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">احفظ المنتج أولاً ثم ارفع صورته المرجعية إن لزم.</p>
        )}
      </div>
    </div>
  );
}
