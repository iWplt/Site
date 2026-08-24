"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { GripVertical } from "lucide-react";
import { reorderFormOptionsAction, updateFormFieldMetaAction, updateFormOptionAction, updateFormOutfitConfigAction } from "@/app/actions";
import { Button, Card, FieldLabel, TextArea, TextInput } from "@/components/ui";
import {
  CORE_PRODUCT_IDS,
  CORE_PRODUCT_LABELS,
  sanitizeOutfitConfig
} from "@/lib/outfit-architecture";
import type { CoreProductId, FormDefinition, FormField, FormOption, FullOutfit, OutfitConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRODUCT_MODEL_KEYS: Record<CoreProductId, string> = {
  robe: "robe_model",
  sash: "sash_type",
  cap: "cap_type"
};

export function FormOutfitWorkspace({
  formId,
  definition,
  canManage
}: {
  formId: string;
  definition: FormDefinition;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [config, setConfig] = useState<OutfitConfig>(() => sanitizeOutfitConfig(definition.outfitConfig));
  const [message, setMessage] = useState<string>();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const fieldsByKey = useMemo(() => {
    const map = new Map<string, FormField>();
    for (const section of definition.sections) {
      for (const field of section.fields) map.set(field.key, field);
    }
    return map;
  }, [definition.sections]);

  function saveConfig(next: OutfitConfig) {
    const sanitized = sanitizeOutfitConfig(next);
    setConfig(sanitized);
    if (!canManage) return;
    startTransition(async () => {
      await updateFormOutfitConfigAction(formId, sanitized);
      setMessage("تم حفظ إعدادات الزي والمنتجات.");
      router.refresh();
    });
  }

  function moveProduct(index: number, target: number) {
    if (target < 0 || target >= config.productOrder.length) return;
    const next = [...config.productOrder];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    saveConfig({ ...config, productOrder: next });
  }

  return (
    <div className="grid gap-4">
      {message ? <p className="rounded-2xl bg-[#386a3d12] px-4 py-3 text-sm font-bold text-[var(--success)]">{message}</p> : null}

      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">ترتيب المنتجات في نموذج الطالب</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          اسحب أو استخدم الأسهم. قياسات الروب وكل تخصيص الروب تنتقل معه.
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
                "flex items-center gap-3 rounded-[1.15rem] border border-[var(--border)] bg-white/70 px-3 py-3",
                dragIndex === index && "ring-2 ring-[var(--olive)]"
              )}
            >
              <GripVertical className="text-[var(--muted)]" size={18} />
              <span className="flex-1 font-black text-[var(--olive-dark)]">
                {index + 1}. {CORE_PRODUCT_LABELS[product]}
              </span>
              {canManage ? (
                <div className="flex gap-1">
                  <Button type="button" variant="secondary" className="min-h-9 px-3 py-1" disabled={pending || index === 0} onClick={() => moveProduct(index, index - 1)}>
                    ↑
                  </Button>
                  <Button type="button" variant="secondary" className="min-h-9 px-3 py-1" disabled={pending || index === config.productOrder.length - 1} onClick={() => moveProduct(index, index + 1)}>
                    ↓
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">الأزياء الكاملة</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          كل زي كامل يتضمن دائماً الروب والوشاح والقبعة. عطّل الزي بدلاً من حذفه حتى تبقى الحجوزات القديمة مقروءة.
        </p>
        <div className="mt-4 grid gap-4">
          {config.fullOutfits.map((outfit, index) => (
            <OutfitEditor
              key={outfit.id}
              outfit={outfit}
              disabled={!canManage || pending}
              onChange={(patch) => {
                const fullOutfits = config.fullOutfits.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry));
                saveConfig({ ...config, fullOutfits });
              }}
              onArchive={() => {
                const enabledCount = config.fullOutfits.filter((entry) => entry.enabled !== false).length;
                if (outfit.enabled !== false && enabledCount <= 1) {
                  setMessage("يجب الإبقاء على زي كامل واحد على الأقل.");
                  return;
                }
                const fullOutfits = config.fullOutfits.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, enabled: false } : entry
                );
                saveConfig({ ...config, fullOutfits });
              }}
            />
          ))}
        </div>
        {canManage ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            disabled={pending}
            onClick={() =>
              saveConfig({
                ...config,
                fullOutfits: [
                  ...config.fullOutfits,
                  {
                    id: `outfit-${Date.now().toString(36)}`,
                    name: "زي جديد",
                    description: "روب + وشاح + قبعة",
                    enabled: true,
                    productOrder: [...config.productOrder]
                  }
                ]
              })
            }
          >
            إضافة زي كامل
          </Button>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">الحجز المفرد</h2>
        <label className="mt-4 flex items-center gap-3 font-bold text-[var(--olive-dark)]">
          <input
            type="checkbox"
            checked={config.singleItemEnabled}
            disabled={!canManage || pending}
            onChange={(event) => saveConfig({ ...config, singleItemEnabled: event.target.checked })}
          />
          السماح للطلاب بحجز قطع منفردة
        </label>
        <p className="mt-3 text-sm text-[var(--muted)]">المنتجات المسموح اختيارها عند الحجز المفرد:</p>
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
                    saveConfig({ ...config, singleItemProducts: next.length ? next : [product] });
                  }}
                />
                {CORE_PRODUCT_LABELS[product]}
              </label>
            );
          })}
        </div>
      </Card>

      {CORE_PRODUCT_IDS.map((product) => (
        <ProductConfigCard
          key={product}
          product={product}
          field={fieldsByKey.get(PRODUCT_MODEL_KEYS[product])}
          extraFields={definition.sections.find((section) => section.id === product)?.fields ?? []}
          canManage={canManage}
          pending={pending}
          formId={formId}
          onRefresh={() => router.refresh()}
        />
      ))}
    </div>
  );
}

function OutfitEditor({
  outfit,
  disabled,
  onChange,
  onArchive
}: {
  outfit: FullOutfit;
  disabled: boolean;
  onChange: (patch: Partial<FullOutfit>) => void;
  onArchive: () => void;
}) {
  return (
    <div className={cn("rounded-[1.2rem] border border-[var(--border)] bg-white/60 p-4", outfit.enabled === false && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-[var(--gold)]">{outfit.enabled === false ? "معطّل" : "نشط"}</p>
        <label className="inline-flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={outfit.enabled !== false} disabled={disabled} onChange={(event) => onChange({ enabled: event.target.checked })} />
          ظاهر للطالب
        </label>
      </div>
      <FieldLabel>اسم الزي</FieldLabel>
      <TextInput defaultValue={outfit.name} disabled={disabled} onBlur={(event) => onChange({ name: event.target.value })} />
      <div className="mt-3">
        <FieldLabel>الوصف</FieldLabel>
        <TextArea defaultValue={outfit.description ?? ""} disabled={disabled} onBlur={(event) => onChange({ description: event.target.value })} />
      </div>
      <p className="mt-3 text-sm font-bold text-[var(--olive)]">المنتجات: روب + وشاح + قبعة</p>
      {!disabled ? (
        <Button type="button" variant="ghost" className="mt-2 px-0" onClick={onArchive}>
          أرشفة هذا الزي
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
  onRefresh
}: {
  product: CoreProductId;
  field?: FormField;
  extraFields: FormField[];
  canManage: boolean;
  pending: boolean;
  formId: string;
  onRefresh: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const options = field?.options ?? [];

  function persistOrder(next: FormOption[]) {
    if (!field || !canManage) return;
    startSafe(async () => {
      await reorderFormOptionsAction(formId, field.key, next.map((option) => option.id));
      onRefresh();
    });
  }

  function startSafe(fn: () => Promise<void>) {
    void fn();
  }

  function moveOption(index: number, target: number) {
    if (!field || target < 0 || target >= options.length) return;
    const next = [...options];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    persistOrder(next);
  }

  return (
    <Card>
      <h2 className="text-2xl font-black text-[var(--olive-dark)]">{CORE_PRODUCT_LABELS[product]}</h2>
      {product === "robe" ? (
        <p className="mt-2 rounded-2xl bg-[#3f472d0d] px-4 py-3 text-sm font-bold text-[var(--olive)]">
          قياسات الروب عامة: الطول (سم) ومقاس اللبس تظهر تلقائياً كلما اختير الروب، في كل الدفعات والنماذج.
        </p>
      ) : null}
      <h3 className="mt-5 font-black text-[var(--olive-dark)]">الموديلات</h3>
      <div className="mt-3 grid gap-2">
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
            className="flex flex-wrap items-center gap-3 rounded-[1.1rem] border border-[var(--border)] bg-white/70 px-3 py-3"
          >
            <GripVertical size={16} className="text-[var(--muted)]" />
            <span className="min-w-0 flex-1 font-bold text-[var(--olive-dark)]">{option.label}</span>
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
                <Button type="button" variant="secondary" className="min-h-9 px-3 py-1" disabled={index === 0} onClick={() => moveOption(index, index - 1)}>
                  ↑
                </Button>
                <Button type="button" variant="secondary" className="min-h-9 px-3 py-1" disabled={index === options.length - 1} onClick={() => moveOption(index, index + 1)}>
                  ↓
                </Button>
              </>
            ) : (
              <span className="text-xs font-bold text-[var(--muted)]">{option.enabled === false ? "مخفي" : "ظاهر"}</span>
            )}
          </div>
        ))}
        {!options.length ? <p className="text-sm font-bold text-[var(--muted)]">لا توجد موديلات مخزّنة في هذا النموذج بعد.</p> : null}
      </div>
      <h3 className="mt-5 font-black text-[var(--olive-dark)]">التخصيص المرتبط بهذا المنتج</h3>
      <ul className="mt-3 grid gap-2">
        {extraFields.map((entry) => (
          <li key={entry.key} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/60 px-4 py-3">
            <div>
              <p className="text-xs font-bold text-[var(--gold)]">{entry.key}</p>
              <p className="font-bold text-[var(--olive-dark)]">{entry.label}</p>
            </div>
            {canManage && entry.type !== "info" ? (
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
    </Card>
  );
}
