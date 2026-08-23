/**
 * `required` means at least one file. `maxFiles` is an upper bound only — never a minimum.
 */
export function requiredUploadError(
  files: unknown[] | undefined,
  required: boolean | undefined
): string | undefined {
  if (required && !(files?.length)) {
    return "يرجى إرفاق صورة واحدة على الأقل.";
  }
  return undefined;
}
