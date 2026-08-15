import { defaultWarkaFormDefinition } from "@/lib/form-definition";
import type { FormDefinition, FormSummary, FormField } from "@/lib/types";

export const FIELD_TYPE_LABELS: Record<string, string> = {
  short_text: "نص قصير",
  long_text: "نص طويل",
  phone: "هاتف",
  number: "رقم",
  radio: "اختيار واحد",
  checkbox: "اختيار متعدد",
  select: "قائمة",
  image_choice: "اختيار بصورة",
  image_upload: "رفع صورة",
  file_upload: "رفع ملف",
  info: "ملاحظة",
  section: "قسم"
};

export function definitionStats(definition?: FormDefinition | null) {
  const sections = definition?.sections ?? defaultWarkaFormDefinition.sections;
  const fields = sections.flatMap((section) => section.fields);
  return {
    sectionCount: sections.length,
    fieldCount: fields.length,
    uploadCount: fields.filter((field) => ["image_upload", "file_upload"].includes(field.type)).length,
    productOptionCount: fields.filter((field) => ["radio", "select", "image_choice"].includes(field.type)).length
  };
}

export function toFormSummary(
  form: {
    id: string;
    name: string;
    slug: string;
    type: FormSummary["type"];
    status: FormSummary["status"];
    batch_id?: string | null;
    internal_description?: string | null;
    opening_date?: string | null;
    closing_date?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    definition?: FormDefinition | null;
  },
  batchName?: string
): FormSummary {
  const stats = definitionStats(form.definition);
  return {
    id: form.id,
    name: form.name,
    slug: form.slug,
    type: form.type,
    status: form.status,
    batch_id: form.batch_id ?? undefined,
    batch_name: batchName,
    internal_description: form.internal_description ?? undefined,
    opening_date: form.opening_date ?? undefined,
    closing_date: form.closing_date ?? undefined,
    created_at: form.created_at ?? undefined,
    updated_at: form.updated_at ?? undefined,
    ...stats
  };
}

export function uploadFieldsFromDefinition(definition: FormDefinition): Array<{
  key: string;
  label: string;
  type: string;
  uploadMode?: "single" | "multiple";
  maxFiles?: number;
  required?: boolean;
}> {
  return definition.sections
    .flatMap((section) => section.fields)
    .filter((field) => ["image_upload", "file_upload"].includes(field.type))
    .map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      uploadMode: field.uploadMode,
      maxFiles: field.maxFiles,
      required: field.required
    }));
}

export function choiceFieldsFromDefinition(definition: FormDefinition): FormField[] {
  return definition.sections
    .flatMap((section) => section.fields)
    .filter((field) => ["radio", "select", "image_choice"].includes(field.type));
}
