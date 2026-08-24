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
import { Button, Card, FieldLabel, LinkButton, TextArea, TextInput, VisibilityBadge } from "@/components/ui";
import { CORE_PRODUCT_IDS, CORE_PRODUCT_LABELS, constrainToEnabledProducts, formEnabledCoreProducts, sanitizeOutfitConfig } from "@/lib/outfit-architecture";
import { OUTFIT_PRESETS, PRODUCT_MODEL_KEYS } from "@/lib/form-config";
import type {
  CoreProductId,
  FormDefinition,
  FormField,
  FormOption,
  FullOutfit,
  OutfitConfig,
  OutfitProductImage
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function FormOutfitWorkspace({
  formId,
  definition,
  canManage,
  focus = "outfits"
}: {
  formId: string;
  definition: FormDefinition;
  canManage: boolean;
  focus?: "outfits" | "customizations" | "products";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [config, setConfig] = useState<OutfitConfig>(() => sanitizeOutfitConfig(definition.outfitConfig, formEnabledCoreProducts(definition)));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string>();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | CoreProductId>("all");
  const enabledProducts = useMemo(() => formEnabledCoreProducts(definition), [definition]);

  const fieldsByKey = useMemo(() => {
    const map = new Map<string, FormField>();
    for (const section of definition.sections) {
      for (const field of section.fields) map.set(field.key, field);
    }
    return map;
  }, [definition.sections]);

  function liveConfig(next: OutfitConfig) {
    return sanitizeOutfitConfig(
      {
        ...next,
        catalogAssignments: sanitizeOutfitConfig(definition.outfitConfig).catalogAssignments
      },
      enabledProducts
    );
  }

  function markConfig(next: OutfitConfig) {
    setConfig(liveConfig(next));
    setDirty(true);
    setSaved(false);
  }

  function saveConfig() {
    if (!canManage) return;
    startTransition(async () => {
      await updateFormOutfitConfigAction(formId, liveConfig(config));
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
      {(focus === "outfits" || focus === "products") ? (
        <div className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-[1.2rem] border border-[var(--border)] bg-[var(--paper)]/95 px-3 py-2 shadow-sm">
          <p className="text-sm font-bold text-[var(--olive-dark)]">
            {dirty
              ? "● توجد تغييرات غير محفوظة"
              : saved
                ? "✓ تم الحفظ"
                : focus === "outfits"
                  ? "إعدادات الأزياء"
                  : "ترتيب منتجات الطالب"}
          </p>
          {canManage ? (
            <Button type="button" size="sm" disabled={pending || !dirty} onClick={saveConfig}>
              حفظ التغييرات
            </Button>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="text-sm font-bold text-[var(--success)]">{message}</p> : null}

      {focus === "outfits" ? (
        <>
          <Card>
            <h2 className="text-xl font-black text-[var(--olive-dark)]">منتجات النموذج</h2>
            <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
              الأزياء تختار من منتجات هذا النموذج المفعّلة فقط. إنشاء المنتجات وتفعيلها وموديلاتها وتخصيصاتها من تبويب المنتجات.
            </p>
            <ul className="mt-3 grid gap-1 text-sm font-bold text-[var(--olive-dark)]">
              {enabledProducts.map((product) => (
                <li key={product}>- {CORE_PRODUCT_LABELS[product]}</li>
              ))}
            </ul>
            <LinkButton href={`/admin/forms/${formId}?tab=products`} variant="secondary" size="sm" className="mt-3">
              إدارة منتجات النموذج
            </LinkButton>
          </Card>

          <Card>
            <h2 className="text-xl font-black text-[var(--olive-dark)]">الأزياء الكاملة</h2>
            <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
              كل زي يحدد أي منتجات النموذج تنتمي إليه وترتيبها. الطالب يخصص كل قطعة مشمولة، ولا يمكنه إضافة أو حذف أو استبدال المنتجات.
            </p>
            <div className="mt-4 grid gap-3">
              {config.fullOutfits.map((outfit, index) => (
                <OutfitEditor
                  key={outfit.id}
                  formId={formId}
                  outfit={outfit}
                  enabledProducts={enabledProducts}
                  fieldsByKey={fieldsByKey}
                  definition={definition}
                  disabled={!canManage || pending}
                  onChange={(patch) => {
                    const fullOutfits = config.fullOutfits.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry));
                    markConfig({ ...config, fullOutfits });
                  }}
                  onImagesChange={(patch) => {
                    setConfig((current) =>
                      liveConfig({
                        ...current,
                        fullOutfits: current.fullOutfits.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry))
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
                              productOrder: [...enabledProducts]
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
            <p className="mt-2 text-sm text-[var(--muted)]">
              الحجز المفرد يستخدم منتجات النموذج المفعّلة نفسها. حدّد القطع المسموح حجزها منفردة دون إنشاء منتجات جديدة.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {enabledProducts.map((product) => {
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

      {focus === "products" || focus === "customizations" ? (
        <>
          {focus === "products" ? (
            <Card>
              <h2 className="text-xl font-black text-[var(--olive-dark)]">ترتيب المنتجات في نموذج الطالب</h2>
              <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
                هذا الترتيب عام لنموذج الطالب. قياسات الروب تنتقل مع الروب. الزي الكامل يستخدم فقط المنتجات التي اخترتها داخل ذلك الزي.
              </p>
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
          ) : (
            <Card>
              <h2 className="text-xl font-black text-[var(--olive-dark)]">تخصيصات منتجات النموذج</h2>
              <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
                التطريز والتصاميم والألوان والملاحظات والرفع وقياسات الروب تُدار هنا على منتجات النموذج. الزي الكامل لا يحذف هذه القطع، والحجز المفرد يبقي سلوكه كما هو.
              </p>
              <LinkButton href={`/admin/forms/${formId}?tab=products`} variant="secondary" size="sm" className="mt-3">
                منتجات النموذج
              </LinkButton>
            </Card>
          )}

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
              expandCustomizations={focus === "customizations"}
              showModelEditor={focus === "products"}
              singleItemVisible={config.singleItemProducts.includes(product)}
              onRefresh={() => router.refresh()}
            />
          ))}
        </>
      ) : null}
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
  enabledProducts,
  fieldsByKey,
  definition,
  disabled,
  onChange,
  onImagesChange,
  onArchive
}: {
  formId: string;
  outfit: FullOutfit;
  enabledProducts: CoreProductId[];
  fieldsByKey: Map<string, FormField>;
  definition: FormDefinition;
  disabled: boolean;
  onChange: (patch: Partial<FullOutfit>) => void;
  onImagesChange: (patch: Partial<FullOutfit>) => void;
  onArchive: () => void;
}) {
  const selectedProducts = constrainToEnabledProducts(outfit.productOrder, enabledProducts);

  function patchProductSettings(productId: CoreProductId, patch: Partial<NonNullable<FullOutfit["productSettings"]>[CoreProductId]>) {
    const current = outfit.productSettings?.[productId] ?? {};
    const nextEntry = { ...current, ...patch };
    const productSettings = { ...(outfit.productSettings ?? {}) };
    if (!nextEntry.allowedOptions && !nextEntry.hiddenFields?.length) delete productSettings[productId];
    else productSettings[productId] = nextEntry;
    onChange({ productSettings: Object.keys(productSettings).length ? productSettings : undefined });
  }

  function toggleAllowedOption(productId: CoreProductId, fieldKey: string, value: string, checked: boolean) {
    const field = fieldsByKey.get(fieldKey);
    const allValues = (field?.options ?? [])
      .flatMap((option) => [option.value, ...(option.children?.map((child) => child.value) ?? [])])
      .filter(Boolean);
    const current = outfit.productSettings?.[productId]?.allowedOptions?.[fieldKey];
    const effective = current?.length ? current : allValues;
    let next = checked ? [...new Set([...effective, value])] : effective.filter((entry) => entry !== value);
    if (!checked && !next.length) return;
    if (next.length >= allValues.length) next = [];
    const allowedOptions = { ...(outfit.productSettings?.[productId]?.allowedOptions ?? {}) };
    if (next.length) allowedOptions[fieldKey] = next;
    else delete allowedOptions[fieldKey];
    patchProductSettings(productId, {
      allowedOptions: Object.keys(allowedOptions).length ? allowedOptions : undefined,
      hiddenFields: outfit.productSettings?.[productId]?.hiddenFields
    });
  }

  function toggleHiddenField(productId: CoreProductId, fieldKey: string, hidden: boolean) {
    const current = outfit.productSettings?.[productId]?.hiddenFields ?? [];
    const next = hidden ? [...new Set([...current, fieldKey])] : current.filter((entry) => entry !== fieldKey);
    patchProductSettings(productId, {
      allowedOptions: outfit.productSettings?.[productId]?.allowedOptions,
      hiddenFields: next.length ? next : undefined
    });
  }

  function customizationFields(productId: CoreProductId) {
    const section = definition.sections.find((entry) => entry.id === productId);
    if (!section) return [];
    return section.fields.filter(
      (field) =>
        field.key !== PRODUCT_MODEL_KEYS[productId] &&
        field.type !== "info" &&
        !["booking_type", "full_outfit_id", "selected_products"].includes(field.key)
    );
  }

  function optionFieldKeys(productId: CoreProductId) {
    const keys = [PRODUCT_MODEL_KEYS[productId]];
    if (productId === "robe") keys.push("robe_addition");
    return keys.filter((key) => fieldsByKey.has(key));
  }
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
      <p className="mt-3 text-sm font-bold text-[var(--olive)]">منتجات النموذج المشمولة في هذا الزي</p>
      <p className="mt-1 text-xs leading-6 text-[var(--muted)]">اختر من المنتجات المفعّلة في هذا النموذج فقط. لا يُنشئ الزي منتجات جديدة.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {enabledProducts.map((product) => {
          const checked = selectedProducts.includes(product);
          return (
            <label key={product} className="inline-flex items-center gap-2 rounded-full bg-[#3f472d0d] px-4 py-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled || (checked && selectedProducts.length <= 1)}
                onChange={() => {
                  const next = checked ? selectedProducts.filter((id) => id !== product) : [...selectedProducts, product];
                  if (!next.length) return;
                  onChange({ productOrder: next });
                }}
              />
              {CORE_PRODUCT_LABELS[product]}
            </label>
          );
        })}
      </div>
      <ol className="mt-2 grid gap-2">
        {selectedProducts.map((productId, index, list) => (
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
            {!disabled ? (
              <div className="grid gap-3 rounded-xl border border-dashed border-[var(--border)] p-3">
                <p className="text-xs font-bold text-[var(--olive-dark)]">إعدادات منتج النموذج داخل هذا الزي</p>
                {optionFieldKeys(productId).map((fieldKey) => {
                  const field = fieldsByKey.get(fieldKey);
                  if (!field?.options?.length) return null;
                  const options = field.options.filter((option) => option.enabled !== false);
                  return (
                    <div key={fieldKey}>
                      <p className="mb-2 text-xs font-bold text-[var(--muted)]">{field.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {options.flatMap((option) =>
                          option.children?.length
                            ? option.children.filter((child) => child.enabled !== false).map((child) => ({
                                value: child.value,
                                label: `${option.label} - ${child.label}`
                              }))
                            : [{ value: option.value, label: option.label }]
                        ).map((option) => {
                          const allowed = outfit.productSettings?.[productId]?.allowedOptions?.[fieldKey];
                          const allValues = options.flatMap((entry) =>
                            entry.children?.length
                              ? entry.children.filter((child) => child.enabled !== false).map((child) => child.value)
                              : [entry.value]
                          );
                          const checked = !allowed?.length || allowed.includes(option.value);
                          const effectiveCount = allowed?.length || allValues.length;
                          return (
                            <label key={option.value} className="inline-flex items-center gap-2 rounded-full bg-[#3f472d0d] px-3 py-1.5 text-xs font-bold">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled || (checked && effectiveCount <= 1)}
                                onChange={() => toggleAllowedOption(productId, fieldKey, option.value, !checked)}
                              />
                              {option.label}
                            </label>
                          );
                        })}
                      </div>
                      {!outfit.productSettings?.[productId]?.allowedOptions?.[fieldKey]?.length ? (
                        <p className="mt-1 text-[11px] text-[var(--muted)]">كل الخيارات المفعّلة في النموذج متاحة لهذا الزي.</p>
                      ) : null}
                    </div>
                  );
                })}
                {customizationFields(productId).length ? (
                  <div>
                    <p className="mb-2 text-xs font-bold text-[var(--muted)]">التخصيصات الظاهرة للطالب</p>
                    <div className="flex flex-wrap gap-2">
                      {customizationFields(productId).map((field) => {
                        const hidden = outfit.productSettings?.[productId]?.hiddenFields?.includes(field.key) ?? false;
                        return (
                          <label key={field.key} className="inline-flex items-center gap-2 rounded-full bg-[#3f472d0d] px-3 py-1.5 text-xs font-bold">
                            <input
                              type="checkbox"
                              checked={!hidden}
                              onChange={(event) => toggleHiddenField(productId, field.key, !event.target.checked)}
                            />
                            {field.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
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
  expandCustomizations,
  showModelEditor,
  singleItemVisible,
  onRefresh
}: {
  product: CoreProductId;
  field?: FormField;
  extraFields: FormField[];
  canManage: boolean;
  pending: boolean;
  formId: string;
  expandCustomizations: boolean;
  showModelEditor: boolean;
  singleItemVisible: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(expandCustomizations);
  const [modelName, setModelName] = useState("");
  const [modelMessage, setModelMessage] = useState<string>();
  const [dragId, setDragId] = useState<string | null>(null);
  const options = field?.options ?? [];
  const visibleModels = options.filter((option) => option.enabled !== false);
  const customizations = extraFields.filter((entry) => entry.key !== PRODUCT_MODEL_KEYS[product] && entry.type !== "info");
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
          {canManage && field && showModelEditor ? (
            <div className="grid gap-2 rounded-2xl border border-dashed border-[var(--border)] p-3">
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
    </Card>
  );
}
