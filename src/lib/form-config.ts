import {
  CORE_PRODUCT_IDS,
  CORE_PRODUCT_LABELS,
  PRODUCT_MODEL_KEYS,
  constrainToEnabledProducts,
  formEnabledCoreProducts,
  sanitizeOutfitConfig
} from "./outfit-architecture.ts";
import type { FormDefinition, FormField, FormOption, FormSection, OutfitConfig } from "./types";

export { PRODUCT_MODEL_KEYS };

export type FormConfigWarning = {
  id: string;
  message: string;
};

export const OUTFIT_PRESETS = [
  { id: "mix", name: "زي مكس", description: "روب + وشاح + قبعة مع كامل خيارات التخصيص." },
  { id: "royal", name: "زي ملكي", description: "روب + وشاح + قبعة بإطلالة ملكية." },
  { id: "american", name: "زي أمريكي", description: "روب + وشاح + قبعة بالنمط الأمريكي." },
  { id: "custom", name: "زي مخصص", description: "روب + وشاح + قبعة — عدّل الاسم والوصف بعد الإنشاء." }
] as const;

export type CopyFormSlices = {
  products?: boolean;
  models?: boolean;
  outfits?: boolean;
  singleItem?: boolean;
  customizations?: boolean;
  ordering?: boolean;
  visibility?: boolean;
};

const MODEL_FIELD_KEYS = ["robe_model", "sash_type", "cap_type", "robe_addition"];

export function flattenDefinitionFields(definition: FormDefinition): FormField[] {
  return definition.sections.flatMap((section) => section.fields);
}

export function fieldByKey(definition: FormDefinition, key: string) {
  return flattenDefinitionFields(definition).find((field) => field.key === key);
}

export function enabledModels(field?: FormField) {
  return (field?.options ?? []).filter((option) => option.enabled !== false);
}

export function formConfigurationWarnings(definition: FormDefinition): FormConfigWarning[] {
  const enabled = formEnabledCoreProducts(definition);
  const config = sanitizeOutfitConfig(definition.outfitConfig, enabled);
  const warnings: FormConfigWarning[] = [];

  for (const outfit of definition.outfitConfig?.fullOutfits ?? config.fullOutfits) {
    if (outfit.enabled === false) continue;
    const order = outfit.productOrder ?? [];
    const dropped = order.filter((id) => CORE_PRODUCT_IDS.includes(id as (typeof CORE_PRODUCT_IDS)[number]) && !enabled.includes(id as (typeof CORE_PRODUCT_IDS)[number]));
    if (dropped.length) {
      warnings.push({
        id: `outfit-disabled-${outfit.id}`,
        message: `⚠️ هذا الزي يشير إلى منتجات غير مفعّلة في النموذج وسيتم تجاهلها.`
      });
    }
    if (!constrainToEnabledProducts(order.length ? order : enabled, enabled).length) {
      warnings.push({
        id: `outfit-empty-${outfit.id}`,
        message: `⚠️ هذا الزي لا يحتوي على منتجات مفعّلة في النموذج.`
      });
    }
  }

  for (const product of CORE_PRODUCT_IDS) {
    const field = fieldByKey(definition, PRODUCT_MODEL_KEYS[product]);
    if (!field || !enabled.includes(product)) continue;
    const visibleInSingle = config.singleItemProducts.includes(product);
    const visibleInOutfit = config.fullOutfits.some(
      (outfit) => outfit.enabled !== false && (outfit.productOrder ?? []).includes(product)
    );
    if (!enabledModels(field).length && (visibleInSingle || visibleInOutfit)) {
      warnings.push({
        id: `no-models-${product}`,
        message: `⚠️ ${CORE_PRODUCT_LABELS[product]} ظاهر للطلاب ولكن لا توجد موديلات متاحة.`
      });
    }
  }

  return warnings;
}

export function applyCopiedFormConfig(target: FormDefinition, source: FormDefinition, slices: CopyFormSlices): FormDefinition {
  const sourceConfig = sanitizeOutfitConfig(source.outfitConfig);
  const targetConfig = sanitizeOutfitConfig(target.outfitConfig);
  let nextConfig: OutfitConfig = { ...targetConfig };
  let sections: FormSection[] = target.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => ({
      ...field,
      options: field.options?.map((option) => ({ ...option }))
    }))
  }));

  if (slices.outfits) {
    nextConfig = { ...nextConfig, fullOutfits: sourceConfig.fullOutfits.map((outfit) => ({ ...outfit })) };
  }
  if (slices.singleItem) {
    nextConfig = {
      ...nextConfig,
      singleItemEnabled: sourceConfig.singleItemEnabled,
      singleItemProducts: [...sourceConfig.singleItemProducts]
    };
  }
  if (slices.ordering) {
    nextConfig = { ...nextConfig, productOrder: [...sourceConfig.productOrder] };
  }
  if (slices.products || slices.visibility) {
    nextConfig = {
      ...nextConfig,
      catalogAssignments: { ...(slices.visibility || slices.products ? sourceConfig.catalogAssignments : nextConfig.catalogAssignments) }
    };
  }

  if (slices.models || slices.visibility || slices.ordering || slices.customizations) {
    sections = sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        const sourceField = fieldByKey(source, field.key);
        if (!sourceField) return field;
        let next: FormField = { ...field };
        if ((slices.models || slices.visibility || slices.ordering) && MODEL_FIELD_KEYS.includes(field.key) && sourceField.options) {
          const sourceOptions = sourceField.options.filter((option) => !option.catalogProductId);
          next = { ...next, options: copyOptions(sourceOptions.length ? sourceOptions : next.options ?? [], slices) };
        }
        if (slices.customizations) {
          next = {
            ...next,
            required: sourceField.required,
            uploadMode: sourceField.uploadMode,
            maxFiles: sourceField.maxFiles,
            showOptionImages: sourceField.showOptionImages
          };
        }
        return next;
      })
    }));
  }

  return {
    ...target,
    outfitConfig: sanitizeOutfitConfig(nextConfig),
    sections
  };
}

function copyOptions(options: FormOption[], slices: CopyFormSlices): FormOption[] {
  return options.map((option) => ({
    ...option,
    enabled: slices.visibility ? option.enabled : option.enabled,
    children: option.children ? copyOptions(option.children, slices) : option.children
  }));
}

export function catalogProductIdsFromDefinition(definition: FormDefinition) {
  const assigned = Object.keys(definition.outfitConfig?.catalogAssignments ?? {});
  const fromOptions = flattenDefinitionFields(definition).flatMap((field) =>
    (field.options ?? []).flatMap((option) => [option.catalogProductId, ...(option.children ?? []).map((child) => child.catalogProductId)])
  );
  return [...new Set([...assigned, ...fromOptions.filter((id): id is string => Boolean(id))])];
}
