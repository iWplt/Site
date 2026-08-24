/**
 * `required` means at least one file. `maxFiles` is an upper bound only — never a minimum.
 */
export function requiredUploadError(
  files: unknown[] | undefined,
  required: boolean | undefined,
  maxFiles?: number
): string | undefined {
  const count = files?.length ?? 0;
  if (required && count === 0) {
    return "يرجى إرفاق صورة واحدة على الأقل.";
  }
  const max = Number.isFinite(maxFiles) ? Math.max(1, Number(maxFiles)) : undefined;
  if (max !== undefined && count > max) {
    return `الحد الأقصى للصور هو ${max}.`;
  }
  return undefined;
}
