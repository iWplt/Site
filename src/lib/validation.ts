import { z } from "zod";
import { fieldIsVisible, flattenFields } from "@/lib/form-definition";
import { normalizeAccessCodeInput } from "@/lib/access-code-scope";
import { asStringList, isBlankValue, resolveOutfitAnswers } from "@/lib/outfit-architecture";
import { optionVisibleForBooking } from "@/lib/product-catalog";
import { requiredUploadError } from "@/lib/required-upload";
import type { FormDefinition } from "@/lib/types";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?964|0)?7[0-9\s-]{8,12}$/, "يرجى إدخال رقم هاتف عراقي صحيح.");

export const accessCodeSchema = z.object({
  slug: z.string().min(2),
  code: z.preprocess(
    (value) => (typeof value === "string" ? normalizeAccessCodeInput(value) : value),
    z.string().regex(/^\d{4,10}$/, "رمز الحجز يجب أن يتكون من أرقام فقط.")
  )
});

export const uploadedFileSchema = z.object({
  path: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().positive()
});

export const submissionSchema = z.object({
  slug: z.string().min(2),
  answers: z.record(z.string(), z.unknown()),
  files: z.record(z.string(), z.array(uploadedFileSchema)).default({})
});

export function validateDynamicAnswers(
  definition: FormDefinition,
  answers: Record<string, unknown>,
  files?: Record<string, unknown[]>
) {
  const resolved = resolveOutfitAnswers(definition, answers);
  const errors: Record<string, string> = {};

  for (const field of flattenFields(definition.sections)) {
    if (field.type === "info" || field.type === "section") continue;
    if (!fieldIsVisible(field, resolved)) continue;

    if (["image_upload", "file_upload"].includes(field.type)) {
      const uploadError = requiredUploadError(files?.[field.key], field.required);
      if (uploadError) errors[field.key] = uploadError;
      continue;
    }

    const value = resolved[field.key] ?? field.defaultValue;

    if (field.locked && field.defaultValue !== undefined && value !== field.defaultValue) {
      errors[field.key] = "هذا الخيار مقفل من إدارة الدفعة ولا يمكن تغييره.";
      continue;
    }

    if (field.type === "checkbox") {
      const selected = asStringList(value);
      if (field.required && !selected.length) {
        errors[field.key] = "يرجى اختيار عنصر واحد على الأقل.";
      }
      continue;
    }

    if (field.required && isBlankValue(value)) {
      errors[field.key] = "هذا الحقل مطلوب.";
      continue;
    }

    if (field.type === "number" && !isBlankValue(value)) {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) {
        errors[field.key] = "يرجى إدخال رقم صحيح.";
      }
    }

    if (field.type === "phone" && value) {
      const result = phoneSchema.safeParse(String(value));
      if (!result.success) errors[field.key] = result.error.issues[0]?.message ?? "رقم الهاتف غير صحيح.";
    }

    if (["radio", "select", "image_choice"].includes(field.type) && value && field.options?.length) {
      const allowed = new Set(
        field.options
          .filter((option) => optionVisibleForBooking(option, resolved.booking_type))
          .flatMap((option) => [
            option.value,
            ...(option.children?.filter((child) => child.enabled !== false).map((child) => child.value) ?? [])
          ])
      );
      if (!allowed.has(String(value))) errors[field.key] = "الخيار المحدد غير متاح.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}
