import { findSelectedOption } from "@/lib/form-definition";
import type { FormDefinition, FormOption } from "@/lib/types";

export const UNIFORM_PRODUCT_KEYS = [
  "booking_type",
  "robe_model",
  "robe_addition",
  "sash_type",
  "cap_type"
] as const;

export type UniformProductKey = (typeof UNIFORM_PRODUCT_KEYS)[number];
export type UniformSelectionMap = Partial<Record<UniformProductKey, string>>;

export const UNIFORM_FIELD_LABELS: Record<UniformProductKey, string> = {
  booking_type: "نوع الحجز",
  robe_model: "روب الدفعة",
  robe_addition: "إضافات الروب",
  sash_type: "نوع الوشاح",
  cap_type: "نوع القبعة"
};

export const INDIVIDUAL_FORM_SLUG = "individual";

function narrowOptions(options: FormOption[], value: string): FormOption[] {
  const matched: FormOption[] = [];
  for (const option of options) {
    if (option.value === value) {
      matched.push({ ...option, children: undefined, enabled: true });
      continue;
    }
    const child = option.children?.find((entry) => entry.value === value);
    if (child) {
      matched.push({
        ...option,
        value: child.value,
        label: `${option.label} - ${child.label}`,
        description: child.description || option.description,
        imageUrl: child.imageUrl || option.imageUrl,
        imagePath: child.imagePath || option.imagePath,
        imageAlt: child.imageAlt || option.imageAlt,
        children: undefined,
        enabled: true
      });
    }
  }
  return matched;
}

export function applyUniformToDefinition(
  definition: FormDefinition,
  fixed: UniformSelectionMap
): FormDefinition {
  const entries = Object.entries(fixed).filter(([, value]) => value);
  if (!entries.length) return definition;

  return {
    ...definition,
    sections: definition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        const value = fixed[field.key as UniformProductKey];
        if (!value || !field.options?.length) return field;
        const options = narrowOptions(field.options, value);
        if (!options.length) return field;
        return {
          ...field,
          options,
          defaultValue: value,
          locked: true,
          required: true,
          description: field.description
        };
      })
    }))
  };
}

export function parseUniformFormData(formData: FormData): UniformSelectionMap {
  const next: UniformSelectionMap = {};
  for (const key of UNIFORM_PRODUCT_KEYS) {
    const value = String(formData.get(`uniform_${key}`) ?? "").trim();
    if (value) next[key] = value;
  }
  return next;
}

export function isUniformProductKey(key: string): key is UniformProductKey {
  return (UNIFORM_PRODUCT_KEYS as readonly string[]).includes(key);
}

export function enforceUniformAnswers(answers: Record<string, unknown>, fixed: UniformSelectionMap) {
  const next = { ...answers };
  for (const [key, value] of Object.entries(fixed)) {
    if (value) next[key] = value;
  }
  return next;
}

export function uniformLabel(definition: FormDefinition, key: string, value: string) {
  const field = definition.sections.flatMap((section) => section.fields).find((entry) => entry.key === key);
  return findSelectedOption(field?.options, value)?.label ?? value;
}
