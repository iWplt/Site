import { flattenFields } from "./form-definition.ts";
import {
  isFieldAllowedByPermissions,
  type StudentCustomizationPermissions
} from "./student-permissions.ts";
import type { FormDefinition, FormField, FormSection } from "./types.ts";

function lockField(field: FormField): FormField {
  return {
    ...field,
    locked: true,
    required: field.type === "image_upload" || field.type === "file_upload" ? false : field.required
  };
}

/**
 * Apply student customization permissions onto a form definition for booking UI/validation.
 * Disallowed customization fields become locked (and uploads non-required).
 * Does not alter product membership / outfit product sets.
 */
export function applyStudentPermissionsToDefinition(
  definition: FormDefinition,
  permissions: StudentCustomizationPermissions
): FormDefinition {
  const sections: FormSection[] = definition.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => {
      if (field.type === "info" || field.type === "section") return field;
      // Product membership / booking type / outfit picker are never gated by customization perms.
      if (
        field.key === "booking_type" ||
        field.key === "selected_products" ||
        field.key === "full_outfit_id" ||
        field.key === "student_name" ||
        field.key === "phone" ||
        field.key === "address"
      ) {
        return field;
      }
      if (!isFieldAllowedByPermissions(field.key, permissions)) {
        return lockField(field);
      }
      return field;
    })
  }));

  return { ...definition, sections };
}

export function unauthorizedPermissionErrors(
  definition: FormDefinition,
  permissions: StudentCustomizationPermissions,
  answers: Record<string, unknown>,
  files?: Record<string, unknown[]>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of flattenFields(definition.sections)) {
    if (field.type === "info" || field.type === "section") continue;
    if (
      field.key === "booking_type" ||
      field.key === "selected_products" ||
      field.key === "full_outfit_id" ||
      field.key === "student_name" ||
      field.key === "phone" ||
      field.key === "address"
    ) {
      continue;
    }
    if (isFieldAllowedByPermissions(field.key, permissions)) continue;

    if (["image_upload", "file_upload"].includes(field.type)) {
      const uploaded = files?.[field.key];
      if (Array.isArray(uploaded) && uploaded.length > 0) {
        errors[field.key] = "رفع الملفات غير مسموح حسب صلاحيات التخصيص.";
      }
      continue;
    }

    const value = answers[field.key];
    const hasValue =
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0);
    if (hasValue && field.defaultValue !== undefined && value !== field.defaultValue) {
      errors[field.key] = "هذا التخصيص مقفل حسب صلاحيات الطالب.";
    } else if (hasValue && field.defaultValue === undefined) {
      // Reject non-empty answers when permission is off and there is no fixed default.
      errors[field.key] = "هذا التخصيص مقفل حسب صلاحيات الطالب.";
    }
  }
  return errors;
}
