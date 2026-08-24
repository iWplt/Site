import type { FormField } from "@/lib/types";

const CHOICE_TYPES = new Set(["radio", "select", "image_choice", "checkbox"]);

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function isChoiceField(field: FormField) {
  return CHOICE_TYPES.has(field.type) && Boolean(field.options?.length);
}

/** Resolve effective selection mode without renaming field keys or changing stored types. */
export function fieldSelectionMode(field: FormField): "single" | "multiple" {
  if (field.selectionMode === "single" || field.selectionMode === "multiple") return field.selectionMode;
  return field.type === "checkbox" ? "multiple" : "single";
}

export function isMultiSelectField(field: FormField) {
  return isChoiceField(field) && fieldSelectionMode(field) === "multiple";
}

export function selectionBounds(field: FormField) {
  const multi = isMultiSelectField(field);
  if (!multi) {
    return { min: field.required ? 1 : 0, max: 1 };
  }
  const minRaw = Number.isFinite(field.minSelections) ? Math.max(0, Number(field.minSelections)) : field.required ? 1 : 0;
  const maxRaw = Number.isFinite(field.maxSelections) ? Math.max(0, Number(field.maxSelections)) : undefined;
  const max = maxRaw === undefined ? undefined : Math.max(minRaw, maxRaw);
  return { min: minRaw, max };
}

export function normalizeChoiceAnswer(field: FormField, value: unknown): string | string[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const list = asStringList(value);
  if (!list.length) return undefined;
  if (isMultiSelectField(field)) return list;
  return list[0];
}

export function choiceSelectionError(field: FormField, value: unknown): string | undefined {
  if (!isChoiceField(field)) return undefined;
  const selected = asStringList(normalizeChoiceAnswer(field, value) ?? []);
  const { min, max } = selectionBounds(field);
  if (selected.length < min) {
    if (min <= 1) return field.required || min === 1 ? "يرجى اختيار خيار واحد على الأقل." : `يرجى اختيار ${min} خيارات على الأقل.`;
    return `يرجى اختيار ${min} خيارات على الأقل.`;
  }
  if (max !== undefined && selected.length > max) {
    return max === 1 ? "يرجى اختيار خيار واحد فقط." : `الحد الأقصى للاختيار هو ${max}.`;
  }
  return undefined;
}

export type ChoiceToggleResult = {
  /** Next answer value: string for single, string[] for multiple, undefined when cleared. */
  value: string | string[] | undefined;
  /** True when an add was blocked because maxSelections was reached. */
  blockedByMax: boolean;
};

/**
 * Pure toggle used by the student wizard.
 * Single: replaces selection (radio).
 * Multiple: add/remove without wiping other selected IDs (checkbox).
 * Option value "none" is exclusive when present among multi selections.
 */
export function toggleChoiceSelection(field: FormField, current: unknown, optionValue: string): ChoiceToggleResult {
  const option = String(optionValue);
  if (!option) return { value: normalizeChoiceAnswer(field, current), blockedByMax: false };

  if (!isMultiSelectField(field)) {
    return { value: option, blockedByMax: false };
  }

  const { max } = selectionBounds(field);
  let selected = asStringList(current);
  const already = selected.includes(option);

  if (already) {
    selected = selected.filter((entry) => entry !== option);
    return { value: selected.length ? selected : undefined, blockedByMax: false };
  }

  if (max !== undefined && selected.length >= max) {
    return { value: selected.length ? selected : undefined, blockedByMax: true };
  }

  if (option === "none") {
    selected = ["none"];
  } else {
    selected = [...selected.filter((entry) => entry !== "none"), option];
  }

  return { value: selected, blockedByMax: false };
}
