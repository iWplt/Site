"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import {
  addFormOptionAction,
  deleteOutfitImageAction,
  reorderFormOptionsAction,
  updateFormFieldMetaAction,
  updateFormOptionAction,
  updateFormOutfitConfigAction,
  uploadOutfitImageAction
} from "@/app/actions";
import { Button, Card, FieldLabel, TextArea, TextInput, VisibilityBadge } from "@/components/ui";
import { FormProductAssignModal } from "@/components/form-product-assign-modal";
import { CORE_PRODUCT_IDS, CORE_PRODUCT_LABELS, sanitizeOutfitConfig } from "@/lib/outfit-architecture";
import { OUTFIT_PRESETS, PRODUCT_MODEL_KEYS } from "@/lib/form-config";
import { CATALOG_LEGACY_FIELD_MAP, type CatalogAudience } from "@/lib/product-catalog";
import type {
  CatalogProduct,
  CoreProductId,
  FormDefinition,
  FormField,
  FormOption,
  FullOutfit,
  OutfitConfig,
  OutfitProductImage,
  ProductCategory
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function FormOutfitWorkspace({
  formId,
  definition,
  canManage,
  products = [],
  categories = [],
  audience,
  focus = "outfits"
}: {
  formId: string;
  definition: FormDefinition;
  canManage: boolean;
  products?: CatalogProduct[];
  categories?: ProductCategory[];
  audience?: CatalogAudience;
  focus?: "outfits" | "customizations";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [config, setConfig] = useState<OutfitConfig>(() => sanitizeOutfitConfig(definition.outfitConfig));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string>();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | CoreProductId>("all");

  const fieldsByKey = useMemo(() => {
    const map = new Map<string, FormField>();
    for (const section of definition.sections) {
      for (const field of section.fields) map.set(field.key, field);
    }
    return map;
  }, [definition.sections]);

  function markConfig(next: OutfitConfig) {
    setConfig(
      sanitizeOutfitConfig({
        ...next,
        catalogAssignments: sanitizeOutfitConfig(definition.outfitConfig).catalogAssignments
      })
    );
    setDirty(true);
    setSaved(false);
  }

  function saveConfig() {
    if (!canManage) return;
    startTransition(async () => {
      await updateFormOutfitConfigAction(
        formId,
        sanitizeOutfitConfig({
          ...config,
          catalogAssignments: sanitizeOutfitConfig(definition.outfitConfig).catalogAssignments
        })
      );
      setDirty(false);
      setSaved(true);
      setMessage("✓ تم الحفظ");
      router.refresh();
    });
  }

  function moveProduct(index: number, target: number) {
    if (target < 0 || target >= config.productOrder.length) return;
    const next = [...config.productOrder];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    markConfig({ ...config, productOrder: next });
  }

  const visibleProducts = CORE_PRODUCT_IDS.filter((product) => filter === "all" || filter === product).filter((product) => {
    if (!query.trim()) return true;
    const field = fieldsByKey.get(PRODUCT_MODEL_KEYS[product]);
    const hay = `${CORE_PRODUCT_LABELS[product]} ${(field?.options ?? []).map((option) => option.label).join(" ")}`;
    return hay.includes(query.trim());
  });

  useEffect(() => {
    if (!dirty) return;
    function onLeave(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  return (
    <div className="grid gap-4">
      <div className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-[1.2rem] border border-[var(--border)] bg-[var(--paper)]/95 px-3 py-2 shadow-sm">
        <p className="text-sm font-bold text-[var(--olive-dark)]">
          {dirty ? "● توجد تغييرات غير محفوظة" : saved ? "✓ تم الحفظ" : "إعدادات الزي والمنتجات"}
        </p>
        {canManage ? (
          <Button type="button" size="sm" disabled={pending || !dirty} onClick={saveConfig}>
            حفظ التغييرات
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-sm font-bold text-[var(--success)]">{message}</p> : null}

      {focus === "outfits" ? (
        <>
          <Card>
            <h2 className="text-xl font-black text-[var(--olive-dark)]">ترتيب المنتجات في نموذج الطالب</h2>
            <p className="mt-1 text-sm leading-7 text-[var(--muted)]">اسحب أو استخدم الأسهم. قياسات الروب تنتقل معه.</p>
            <ol className="mt-4 grid gap-2">
              {config.productOrder.map((product, index) => (
                <li
                  key={product}
                  draggable={canManage}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex == null) return;
                    moveProduct(dragIndex, index);
                    setDragIndex(null);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-[1.1rem] border border-[var(--border)] bg-white/70 px-3 py-2.5",
                    dragIndex === index && "ring-2 ring-[var(--olive)]"
                  )}
                >
                  <GripVertical className="text-[var(--muted)]" size={16} />
                  <span className="flex-1 font-black text-[var(--olive-dark)]">
                    {index + 1}. {CORE_PRODUCT_LABELS[product]}
                  </span>
                  {canManage ? (
                    <div className="flex gap-1">
                      <Button type="button" variant="secondary" size="icon" aria-label="أعلى" disabled={pending || index === 0} onClick={() => moveProduct(index, index - 1)}>
                        ↑
                      </Button>
                      <Button type="button" variant="secondary" size="icon" aria-label="أسفل" disabled={pending || index === config.productOrder.length - 1} onClick={() => moveProduct(index, index + 1)}>
                        ↓
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <h2 className="text-xl font-black text-[var(--olive-dark)]">الأزياء الكاملة</h2>
            <p className="mt-1 text-sm leading-7 text-[var(--muted)]">كل زي كامل يتضمن دائماً الروب والوشاح والقبعة.</p>
            <div className="mt-4 grid gap-3">
              {config.fullOutfits.map((outfit, index) => (
                <OutfitEditor
                  key={outfit.id}
                  formId={formId}
                  outfit={outfit}
                  disabled={!canManage || pending}
                  onChange={(patch) => {
                    const fullOutfits = config.fullOutfits.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry));
                    markConfig({ ...config, fullOutfits });
                  }}
                  onImagesChange={(patch) => {
                    setConfig((current) =>
                      sanitizeOutfitConfig({
                        ...current,
                        fullOutfits: current.fullOutfits.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)),
                        catalogAssignments: sanitizeOutfitConfig(definition.outfitConfig).catalogAssignments
                      })
                    );
                    router.refresh();
                  }}
                  onArchive={() => {
                    const enabledCount = config.fullOutfits.filter((entry) => entry.enabled !== false).length;
                    if (outfit.enabled !== false && enabledCount <= 1) {
                      setMessage("يجب الإبقاء على زي كامل واحد على الأقل.");
                      return;
                    }
                    markConfig({
                      ...config,
                      fullOutfits: config.fullOutfits.map((entry, entryIndex) => (entryIndex === index ? { ...entry, enabled: false } : entry))
                    });
                  }}
                />
              ))}
            </div>
            {canManage ? (
              <div className="mt-4 grid gap-2">
                <p className="text-sm font-bold text-[var(--olive-dark)]">+ إضافة زي</p>
                <div className="flex flex-wrap gap-2">
                  {OUTFIT_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        markConfig({
                          ...config,
                          fullOutfits: [
                            ...config.fullOutfits,
                            {
                              id: `${preset.id}-${Date.now().toString(36)}`,
                              name: preset.name,
                              description: preset.description,
                              enabled: true,
                              productOrder: [...CORE_PRODUCT_IDS]
                            }
                          ]
                        })
                      }
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="text-xl font-black text-[var(--olive-dark)]">الحجز المفرد</h2>
            <label className="mt-3 inline-flex items-center gap-2 font-bold text-[var(--olive-dark)]">
              <input
                type="checkbox"
                checked={config.singleItemEnabled}
                disabled={!canManage || pending}
                onChange={(event) => markConfig({ ...config, singleItemEnabled: event.target.checked })}
              />
              السماح للطلاب بحجز قطع منفردة
            </label>
            <p className="mt-2 text-sm text-[var(--muted)]">المنتجات المسموح اختيارها عند الحجز المفرد:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CORE_PRODUCT_IDS.map((product) => {
                const checked = config.singleItemProducts.includes(product);
                return (
                  <label key={product} className="inline-flex items-center gap-2 rounded-full bg-[#3f472d0d] px-4 py-2 text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canManage || pending || !config.singleItemEnabled}
                      onChange={() => {
                        const next = checked
                          ? config.singleItemProducts.filter((id) => id !== product)
                          : [...config.singleItemProducts, product];
                        markConfig({ ...config, singleItemProducts: next.length ? next : [product] });
                      }}
                    />
                    {CORE_PRODUCT_LABELS[product]}
                  </label>
                );
              })}
            </div>
          </Card>
        </>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن منتج..." />
        <div className="flex flex-wrap gap-1">
          {(["all", ...CORE_PRODUCT_IDS] as const).map((entry) => (
            <Button key={entry} type="button" size="sm" variant={filter === entry ? "primary" : "secondary"} onClick={() => setFilter(entry)}>
              {entry === "all" ? "الكل" : CORE_PRODUCT_LABELS[entry]}
            </Button>
          ))}
        </div>
      </div>

      {visibleProducts.map((product) => (
        <ProductConfigCard
          key={product}
          product={product}
          field={fieldsByKey.get(PRODUCT_MODEL_KEYS[product])}
          extraFields={definition.sections.find((section) => section.id === product)?.fields ?? []}
          canManage={canManage}
          pending={pending}
          formId={formId}
          definition={definition}
          products={products}
          categories={categories}
          audience={audience}
          expandCustomizations={focus === "customizations"}
          singleItemVisible={config.singleItemProducts.includes(product)}
          onRefresh={() => router.refresh()}
        />
      ))}
    </div>
  );
}

function OutfitImageSlot({
  formId,
  outfitId,
  productId,
  label,
  image,
  disabled,
  onSaved
}: {
  formId: string;
  outfitId: string;
  productId?: CoreProductId;
  label: string;
  image?: OutfitProductImage;
  disabled: boolean;
  onSaved: (next?: OutfitProductImage) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = image?.imageUrl;
  const hasImage = Boolean(preview);

  function upload(file: File | undefined) {
    if (!file) return;
    startTransition(async () => {
      const body = new FormData();
      body.set("formId", formId);
      body.set("outfitId", outfitId);
      if (productId) body.set("productId", productId);
      body.set("file", file);
      const result = await uploadOutfitImageAction(body);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      onSaved({ imagePath: result.imagePath, imageUrl: result.imageUrl });
      setMessage("تم رفع الصورة.");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteOutfitImageAction(formId, outfitId, productId);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      onSaved(undefined);
      setMessage("تم حذف الصورة.");
    });
  }

  return (
    <div className="grid gap-2 rounded-xl border border-[var(--border)] bg-white/80 p-2 sm:grid-cols-[4.5rem_1fr] sm:items-center">
      <div className="overflow-hidden rounded-lg border border-dashed border-[var(--border)] bg-[#3f472d08]">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="aspect-square w-full object-cover" />
        ) : (
          <div className="grid aspect-square place-items-center px-1 text-center text-[10px] font-bold leading-4 text-[var(--muted)]">
            بدون صورة
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-black text-[var(--olive-dark)]">{label}</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            upload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {!disabled ? (
          <div className="mt-1 flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => fileRef.current?.click()}>
              {hasImage ? "تغيير الصورة" : "رفع صورة"}
            </Button>
            {hasImage ? (
              <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={remove}>
                حذف الصورة
              </Button>
            ) : null}
          </div>
        ) : null}
        {message ? <p className="mt-1 text-[11px] font-bold text-[var(--olive)]">{message}</p> : null}
      </div>
    </div>
  );
}

function OutfitEditor({
  formId,
  outfit,
  disabled,
  onChange,
  onImagesChange,
  onArchive
}: {
  formId: string;
  outfit: FullOutfit;
  disabled: boolean;
  onChange: (patch: Partial<FullOutfit>) => void;
  onImagesChange: (patch: Partial<FullOutfit>) => void;
  onArchive: () => void;
}) {
  return (
    <div className={cn("rounded-[1.2rem] border border-[var(--border)] bg-white/60 p-4", outfit.enabled === false && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <VisibilityBadge visible={outfit.enabled !== false} />
        <label className="inline-flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={outfit.enabled !== false} disabled={disabled} onChange={(event) => onChange({ enabled: event.target.checked })} />
          تفعيل الزي
        </label>
      </div>
      <FieldLabel>اسم الزي</FieldLabel>
      <TextInput defaultValue={outfit.name} disabled={disabled} onBlur={(event) => onChange({ name: event.target.value })} />
      <div className="mt-3">
        <FieldLabel>الوصف</FieldLabel>
        <TextArea defaultValue={outfit.description ?? ""} disabled={disabled} onBlur={(event) => onChange({ description: event.target.value })} />
      </div>
      <div className="mt-3">
        <FieldLabel>صورة الزي الكاملة</FieldLabel>
        <OutfitImageSlot
          formId={formId}
          outfitId={outfit.id}
          label={outfit.name}
          image={{ imagePath: outfit.imagePath, imageUrl: outfit.imageUrl }}
          disabled={disabled}
          onSaved={(next) => onImagesChange({ imagePath: next?.imagePath, imageUrl: next?.imageUrl })}
        />
      </div>
      <p className="mt-3 text-sm font-bold text-[var(--olive)]">المنتجات المشمولة دائماً: روب + وشاح + قبعة</p>
      <ol className="mt-2 grid gap-2">
        {(outfit.productOrder?.length ? outfit.productOrder : [...CORE_PRODUCT_IDS]).map((productId, index, list) => (
          <li key={productId} className="grid gap-2 rounded-xl bg-white/80 p-2">
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="flex-1 text-[var(--olive-dark)]">{CORE_PRODUCT_LABELS[productId]}</span>
              {!disabled ? (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="أعلى"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...list];
                      const [item] = next.splice(index, 1);
                      next.splice(index - 1, 0, item);
                      onChange({ productOrder: next });
                    }}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="أسفل"
                    disabled={index === list.length - 1}
                    onClick={() => {
                      const next = [...list];
                      const [item] = next.splice(index, 1);
                      next.splice(index + 1, 0, item);
                      onChange({ productOrder: next });
                    }}
                  >
                    ↓
                  </Button>
                </div>
              ) : null}
            </div>
            <OutfitImageSlot
              formId={formId}
              outfitId={outfit.id}
              productId={productId}
              label={`صورة ${CORE_PRODUCT_LABELS[productId]}`}
              image={outfit.productImages?.[productId]}
              disabled={disabled}
              onSaved={(next) => {
                const productImages = { ...(outfit.productImages ?? {}) };
                if (!next) delete productImages[productId];
                else productImages[productId] = next;
                onImagesChange({ productImages: Object.keys(productImages).length ? productImages : undefined });
              }}
            />
          </li>
        ))}
      </ol>
      {!disabled ? (
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={onArchive}>
          إخفاء هذا الزي
        </Button>
      ) : null}
    </div>
  );
}

function ProductConfigCard({
  product,
  field,
  extraFields,
  canManage,
  pending,
  formId,
  definition,
  products,
  categories,
  audience,
  expandCustomizations,
  singleItemVisible,
  onRefresh
}: {
  product: CoreProductId;
  field?: FormField;
  extraFields: FormField[];
  canManage: boolean;
  pending: boolean;
  formId: string;
  definition: FormDefinition;
  products: CatalogProduct[];
  categories: ProductCategory[];
  audience?: CatalogAudience;
  expandCustomizations: boolean;
  singleItemVisible: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(expandCustomizations);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [modelName, setModelName] = useState("");
  const [modelMessage, setModelMessage] = useState<string>();
  const [dragId, setDragId] = useState<string | null>(null);
  const options = field?.options ?? [];
  const visibleModels = options.filter((option) => option.enabled !== false);
  const customizations = extraFields.filter((entry) => entry.key !== PRODUCT_MODEL_KEYS[product] && entry.type !== "info");
  const category = categories.find((entry) => CATALOG_LEGACY_FIELD_MAP[entry.slug]?.fieldKey === PRODUCT_MODEL_KEYS[product]);
  const visible = visibleModels.length > 0;

  function startSafe(fn: () => Promise<void>) {
    void fn();
  }

  function persistOrder(next: FormOption[]) {
    if (!field || !canManage) return;
    startSafe(async () => {
      await reorderFormOptionsAction(
        formId,
        field.key,
        next.map((option) => option.id)
      );
      onRefresh();
    });
  }

  function moveOption(index: number, target: number) {
    if (!field || target < 0 || target >= options.length) return;
    const next = [...options];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    persistOrder(next);
  }

  async function setAllModels(enabled: boolean) {
    if (!field || !canManage) return;
    for (const option of options) {
      await updateFormOptionAction(formId, field.key, option.id, { enabled });
    }
    onRefresh();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[var(--olive-dark)]">{CORE_PRODUCT_LABELS[product]}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <VisibilityBadge visible={visible} />
            {singleItemVisible ? <span className="text-xs font-bold text-[var(--muted)]">مسموح في الحجز المفرد</span> : <span className="text-xs font-bold text-[var(--muted)]">غير مسموح في الحجز المفرد</span>}
          </div>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen((current) => !current)}>
              تعديل
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={pending || !options.length} onClick={() => startSafe(() => setAllModels(!visible))}>
              {visible ? "إخفاء" : "إظهار"}
            </Button>
          </div>
        ) : null}
      </div>

      {product === "robe" ? (
        <p className="mt-3 rounded-2xl bg-[#3f472d0d] px-4 py-2.5 text-sm font-bold text-[var(--olive)]">
          قياسات الروب عامة: الطول (سم) ومقاس اللبس تظهر تلقائياً كلما اختير الروب.
        </p>
      ) : null}

      <div className="mt-4">
        <h3 className="text-sm font-black text-[var(--olive-dark)]">الموديلات</h3>
        <ul className="mt-2 grid gap-1 text-sm font-bold text-[var(--olive)]">
          {visibleModels.map((option) => (
            <li key={option.id}>- {option.label}</li>
          ))}
          {!visibleModels.length ? <li className="text-[var(--muted)]">لا توجد موديلات ظاهرة</li> : null}
        </ul>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-black text-[var(--olive-dark)]">التخصيصات</h3>
        <ul className="mt-2 grid gap-1 text-sm font-bold text-[var(--olive-dark)]">
          {customizations.map((entry) => (
            <li key={entry.key}>
              {entry.required ? "✓" : "○"} {entry.label}
            </li>
          ))}
        </ul>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4">
          <h3 className="font-black text-[var(--olive-dark)]">الموديلات</h3>
          <div className="grid gap-2">
            {options.map((option, index) => (
              <div
                key={option.id}
                draggable={canManage}
                onDragStart={() => setDragId(option.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  const from = options.findIndex((entry) => entry.id === dragId);
                  if (from < 0) return;
                  moveOption(from, index);
                  setDragId(null);
                }}
                className="flex flex-wrap items-center gap-2 rounded-[1.1rem] border border-[var(--border)] bg-white/70 px-3 py-2.5"
              >
                <GripVertical size={16} className="text-[var(--muted)]" />
                <span className="min-w-0 flex-1 font-bold text-[var(--olive-dark)]">{option.label}</span>
                <VisibilityBadge visible={option.enabled !== false} />
                {canManage ? (
                  <>
                    <label className="inline-flex items-center gap-2 text-xs font-bold">
                      <input
                        type="checkbox"
                        defaultChecked={option.enabled !== false}
                        disabled={pending}
                        onChange={(event) => {
                          startSafe(async () => {
                            await updateFormOptionAction(formId, field!.key, option.id, { enabled: event.target.checked });
                            onRefresh();
                          });
                        }}
                      />
                      ظاهر
                    </label>
                    <Button type="button" variant="secondary" size="icon" aria-label="أعلى" disabled={index === 0} onClick={() => moveOption(index, index - 1)}>
                      ↑
                    </Button>
                    <Button type="button" variant="secondary" size="icon" aria-label="أسفل" disabled={index === options.length - 1} onClick={() => moveOption(index, index + 1)}>
                      ↓
                    </Button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
          {canManage && field ? (
            <div className="grid gap-2 rounded-2xl border border-dashed border-[var(--border)] p-3">
              {audience && category ? (
                <Button type="button" size="sm" onClick={() => setCatalogOpen(true)}>
                  + إضافة منتج من الكتالوج
                </Button>
              ) : null}
              <form
                className="grid gap-2 sm:grid-cols-[1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const label = modelName.trim();
                  if (!label) return;
                  startSafe(async () => {
                    const result = await addFormOptionAction(formId, field.key, label);
                    setModelMessage(result.error ?? "تمت إضافة الموديل.");
                    if (!result.error) {
                      setModelName("");
                      onRefresh();
                    }
                  });
                }}
              >
                <TextInput value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="اسم موديل جديد" />
                <Button type="submit" variant="secondary" disabled={pending || !modelName.trim()}>
                  + إضافة موديل
                </Button>
              </form>
              {modelMessage ? <p className="text-sm font-bold text-[var(--olive)]">{modelMessage}</p> : null}
            </div>
          ) : null}

          <h3 className="font-black text-[var(--olive-dark)]">التخصيص المرتبط بهذا المنتج</h3>
          <ul className="grid gap-2">
            {customizations.map((entry) => (
              <li key={entry.key} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/60 px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-[var(--gold)]">{entry.key}</p>
                  <p className="font-bold text-[var(--olive-dark)]">{entry.label}</p>
                </div>
                {canManage ? (
                  <label className="inline-flex items-center gap-2 text-sm font-bold">
                    <input
                      type="checkbox"
                      defaultChecked={Boolean(entry.required)}
                      disabled={pending}
                      onChange={(event) => {
                        startSafe(async () => {
                          await updateFormFieldMetaAction(formId, entry.key, { required: event.target.checked });
                          onRefresh();
                        });
                      }}
                    />
                    مطلوب
                  </label>
                ) : (
                  <span className="text-xs font-bold text-[var(--muted)]">{entry.required ? "مطلوب" : "اختياري"}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {catalogOpen && audience && category ? (
        <FormProductAssignModal
          formId={formId}
          products={products}
          categories={categories}
          definition={definition}
          audience={audience}
          lockedCategoryId={category.id}
          onClose={() => {
            setCatalogOpen(false);
            onRefresh();
          }}
        />
      ) : null}
    </Card>
  );
}
