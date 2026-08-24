import { findSelectedOption, flattenFields, optionLabel } from "@/lib/form-definition";
import { isMultiSelectField } from "@/lib/form-selection";
import { asStringList } from "@/lib/outfit-architecture";
import type { FormDefinition, FormField, FormOption } from "@/lib/types";

export const ORDER_SNAPSHOT_KEY = "_orderSnapshot";

export type SnapshotImageRef = {
  path?: string;
  publicUrl?: string;
  alt?: string;
};

export type SnapshotField = {
  sectionId: string;
  sectionTitle: string;
  key: string;
  label: string;
  type: string;
  value: unknown;
  displayValue: string;
  optionId?: string;
  optionIds?: string[];
  optionLabel?: string;
  optionDescription?: string;
  referenceImage?: SnapshotImageRef;
  childImages?: SnapshotImageRef[];
  fixed?: boolean;
  productId?: string;
  productName?: string;
  categorySlug?: string;
  categoryName?: string;
  priceIqd?: number | null;
};

export type OrderSnapshot = {
  version: 1;
  capturedAt: string;
  formId: string;
  formName: string;
  definitionId?: string;
  definitionVersion?: number;
  fields: SnapshotField[];
};

function referenceFromOption(option?: FormOption): SnapshotImageRef | undefined {
  if (!option) return undefined;
  if (!option.imagePath && !option.imageUrl) return undefined;
  return {
    path: option.imagePath,
    publicUrl: option.imageUrl?.startsWith("/") || option.imageUrl?.startsWith("http") ? option.imageUrl : undefined,
    alt: option.imageAlt || option.label
  };
}

function displayForField(field: FormField, value: unknown) {
  if (["image_upload", "file_upload", "info", "section"].includes(field.type)) return "";
  return optionLabel(field.options, value);
}

function selectedOptions(field: FormField, value: unknown): FormOption[] {
  return asStringList(value)
    .map((entry) => findSelectedOption(field.options, entry))
    .filter((option): option is FormOption => Boolean(option));
}

export function buildOrderSnapshot(input: {
  formId: string;
  formName: string;
  definition: FormDefinition;
  answers: Record<string, unknown>;
}): OrderSnapshot {
  const fields: SnapshotField[] = [];
  for (const section of input.definition.sections) {
    for (const field of section.fields) {
      const value = input.answers[field.key];
      const selected = selectedOptions(field, value);
      const primary = selected[0];
      const multi = isMultiSelectField(field) || selected.length > 1;
      fields.push({
        sectionId: section.id,
        sectionTitle: section.title,
        key: field.key,
        label: field.label,
        type: field.type,
        value,
        displayValue: displayForField(field, value),
        optionId: primary?.id,
        optionIds: multi ? selected.map((option) => option.id) : primary ? [primary.id] : undefined,
        optionLabel: multi ? selected.map((option) => option.label).join("، ") : primary?.label,
        optionDescription: primary?.description,
        referenceImage: referenceFromOption(primary),
        childImages: selected.length > 1 ? selected.map((option) => referenceFromOption(option)).filter((entry): entry is SnapshotImageRef => Boolean(entry)) : undefined,
        fixed: Boolean(field.locked),
        productId: primary?.catalogProductId,
        productName: primary?.catalogProductId ? primary.label : undefined,
        categorySlug: primary?.categorySlug,
        categoryName: primary?.categoryName,
        priceIqd: primary?.priceIqd ?? null
      });
    }
  }

  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    formId: input.formId,
    formName: input.formName,
    definitionId: input.definition.id,
    definitionVersion: input.definition.version,
    fields
  };
}

export function answersWithSnapshot(answers: Record<string, unknown>, snapshot: OrderSnapshot) {
  return { ...answers, [ORDER_SNAPSHOT_KEY]: snapshot };
}

export function readOrderSnapshot(answers: Record<string, unknown> | null | undefined): OrderSnapshot | null {
  const raw = answers?.[ORDER_SNAPSHOT_KEY];
  if (!raw || typeof raw !== "object") return null;
  const snapshot = raw as OrderSnapshot;
  if (snapshot.version !== 1 || !Array.isArray(snapshot.fields)) return null;
  return snapshot;
}

export function collectReferencePaths(snapshot: OrderSnapshot | null) {
  const paths = new Set<string>();
  if (!snapshot) return [];
  for (const field of snapshot.fields) {
    const path = field.referenceImage?.path;
    if (path && !path.startsWith("/") && !/^https?:\/\//.test(path)) paths.add(path);
    for (const image of field.childImages ?? []) {
      const childPath = image.path;
      if (childPath && !childPath.startsWith("/") && !/^https?:\/\//.test(childPath)) paths.add(childPath);
    }
  }
  return [...paths];
}

export function publicAnswers(answers: Record<string, unknown>) {
  const next = { ...answers };
  delete next[ORDER_SNAPSHOT_KEY];
  return next;
}

export function snapshotOrFallback(
  answers: Record<string, unknown>,
  definition: FormDefinition | null | undefined,
  formId: string,
  formName: string
): OrderSnapshot {
  return (
    readOrderSnapshot(answers) ??
    buildOrderSnapshot({
      formId,
      formName,
      definition: definition ?? { id: formId, version: 1, name: formName, type: "BATCH", sections: [] },
      answers: publicAnswers(answers)
    })
  );
}

export function fieldKeys(definition: FormDefinition) {
  return flattenFields(definition.sections).map((field) => field.key);
}
