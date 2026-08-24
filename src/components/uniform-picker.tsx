"use client";

import { useState } from "react";
import { OptimizedThumb } from "@/components/optimized-thumb";
import { UNIFORM_FIELD_LABELS, UNIFORM_FIELD_PRODUCT, UNIFORM_PRODUCT_KEYS, type UniformSelectionMap } from "@/lib/form-uniform";
import { findSelectedOption } from "@/lib/form-definition";
import { formEnabledCoreProducts } from "@/lib/outfit-architecture";
import type { FormDefinition } from "@/lib/types";
import { cn } from "@/lib/utils";

export function UniformPicker({
  definition,
  value = {},
  namePrefix = "uniform"
}: {
  definition: FormDefinition;
  value?: UniformSelectionMap;
  namePrefix?: string;
}) {
  const [current, setCurrent] = useState<UniformSelectionMap>(value);
  const fields = definition.sections.flatMap((section) => section.fields);
  const enabledProducts = formEnabledCoreProducts(definition);

  return (
    <div className="grid gap-5">
      {UNIFORM_PRODUCT_KEYS.map((key) => {
        const product = UNIFORM_FIELD_PRODUCT[key];
        if (product && !enabledProducts.includes(product)) return null;
        const field = fields.find((entry) => entry.key === key);
        if (!field?.options?.length) return null;
        const selected = current[key] ?? "";
        const flat = field.options.flatMap((option) => {
          if (option.enabled === false) return [];
          const children = (option.children ?? []).filter((child) => child.enabled !== false);
          if (children.length) {
            return children.map((child) => ({
              value: child.value,
              label: `${option.label} - ${child.label}`,
              image: child.imageUrl || option.imageUrl
            }));
          }
          return [{ value: option.value, label: option.label, image: option.imageUrl }];
        });
        if (!flat.length && key !== "booking_type") return null;
        return (
          <fieldset key={key} className="rounded-[1.35rem] border border-[var(--border)] bg-white/60 p-3 sm:p-4">
            <legend className="px-1 text-sm font-black text-[var(--olive-dark)]">{UNIFORM_FIELD_LABELS[key]}</legend>
            <p className="mb-3 text-xs text-[var(--muted)]">اتركه فارغاً إذا كان الطالب يختار بنفسه.</p>
            <input type="hidden" name={`${namePrefix}_${key}`} value={selected} />
            <div className={cn("grid gap-2", field.showOptionImages || field.type === "image_choice" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
              <button
                type="button"
                onClick={() => setCurrent((prev) => ({ ...prev, [key]: undefined }))}
                className={cn(
                  "rounded-2xl border p-3 text-sm font-bold",
                  selected === "" ? "border-[var(--olive)] ring-2 ring-[#3f472d22]" : "border-[var(--border)]"
                )}
              >
                يختار الطالب
              </button>
              {flat.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCurrent((prev) => ({ ...prev, [key]: option.value }))}
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-[var(--paper)] text-right",
                    selected === option.value ? "border-[var(--olive)] ring-2 ring-[#3f472d22]" : "border-[var(--border)]"
                  )}
                >
                  {option.image ? (
                    <OptimizedThumb src={option.image} alt="" sizes="(max-width: 640px) 45vw, 180px" />
                  ) : null}
                  <span className="block p-3 text-sm font-black leading-6">{option.label}</span>
                </button>
              ))}
            </div>
            {selected ? (
              <p className="mt-2 text-xs font-bold text-[var(--olive)]">
                اختيار موحد: {findSelectedOption(field.options, selected)?.label ?? selected}
              </p>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}
