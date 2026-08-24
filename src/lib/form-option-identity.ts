import type { FormDefinition, FormField, FormOption } from "@/lib/types";

/** Fields injected by applyOutfitArchitecture — not persisted option rows. */
export const ARCHITECTURE_OPTION_FIELD_KEYS = new Set(["full_outfit_id", "selected_products"]);

export function isArchitectureOptionFieldKey(fieldKey: string) {
  return ARCHITECTURE_OPTION_FIELD_KEYS.has(fieldKey);
}

export function catalogProductIdFromOptionRef(optionId: string): string | undefined {
  const trimmed = optionId.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("catalog-")) return trimmed.slice("catalog-".length) || undefined;
  return undefined;
}

export function optionMatchesRef(option: FormOption, optionRef: string): boolean {
  if (option.id === optionRef) return true;
  if (option.catalogProductId && option.catalogProductId === optionRef) return true;
  if (option.value === optionRef) return true;
  const fromCatalogPrefix = catalogProductIdFromOptionRef(optionRef);
  if (fromCatalogPrefix && (option.catalogProductId === fromCatalogPrefix || option.value === fromCatalogPrefix)) return true;
  if (option.catalogProductId && optionRef === `catalog-${option.catalogProductId}`) return true;
  return false;
}

export function findOptionInTree(options: FormOption[] | undefined, optionRef: string): FormOption | undefined {
  for (const option of options ?? []) {
    if (optionMatchesRef(option, optionRef)) return option;
    const child = findOptionInTree(option.children, optionRef);
    if (child) return child;
  }
  return undefined;
}

export function findFieldOption(
  definition: FormDefinition,
  fieldKey: string,
  optionRef: string
): { field: FormField; option: FormOption } | undefined {
  for (const section of definition.sections) {
    for (const field of section.fields) {
      if (field.key !== fieldKey) continue;
      const option = findOptionInTree(field.options, optionRef);
      if (option) return { field, option };
    }
  }
  return undefined;
}

export function flattenOptionValuesDeep(options: FormOption[] | undefined): string[] {
  const values: string[] = [];
  for (const option of options ?? []) {
    if (option.children?.length) {
      for (const child of option.children) values.push(child.value);
    } else {
      values.push(option.value);
    }
  }
  return values;
}

/** Drop allowed option values that no longer exist on the Form Product field. */
export function reconcileAllowedOptionValues(
  definition: FormDefinition,
  allowedOptions: Partial<Record<string, string[]>> | undefined
): Partial<Record<string, string[]>> | undefined {
  if (!allowedOptions) return undefined;
  const next: Partial<Record<string, string[]>> = {};
  for (const [fieldKey, values] of Object.entries(allowedOptions)) {
    const field = definition.sections.flatMap((section) => section.fields).find((entry) => entry.key === fieldKey);
    if (!field?.options?.length) continue;
    const valid = new Set(flattenOptionValuesDeep(field.options.filter((option) => option.enabled !== false)));
    const cleaned = [...new Set((values ?? []).map((value) => String(value).trim()).filter((value) => valid.has(value)))];
    if (cleaned.length) next[fieldKey] = cleaned;
  }
  return Object.keys(next).length ? next : undefined;
}
