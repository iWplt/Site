export const STUDENT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const STUDENT_UPLOAD_MAX_FILES = 5;
export const STUDENT_IMAGE_MAX_EDGE = 1920;
export const STUDENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const STUDENT_UPLOAD_TYPES = [...STUDENT_IMAGE_TYPES, "application/pdf"] as const;

/** Owner-managed catalog / form / option / outfit reference images. */
export const ADMIN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const ADMIN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Next.js request body cap for Server Actions and upload Route Handlers.
 * Must stay strictly above the largest allowed file so multipart overhead still fits.
 * App file-size rules (ADMIN_IMAGE_MAX_BYTES / STUDENT_UPLOAD_MAX_BYTES) remain the real limit.
 */
export const UPLOAD_REQUEST_BODY_LIMIT = "12mb" as const;
export const UPLOAD_REQUEST_BODY_LIMIT_BYTES = 12 * 1024 * 1024;

export const ADMIN_UPLOAD_KINDS = ["option", "outfit", "form-product", "catalog"] as const;
export type AdminUploadKind = (typeof ADMIN_UPLOAD_KINDS)[number];

export function parseAdminUploadKind(value: unknown): AdminUploadKind | undefined {
  const kind = String(value ?? "").trim();
  return (ADMIN_UPLOAD_KINDS as readonly string[]).includes(kind) ? (kind as AdminUploadKind) : undefined;
}

export function uploadSizeError(byteLength: number, maxBytes: number): string | undefined {
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    return "ملف الصورة فارغ أو لم يصل إلى الخادم.";
  }
  if (byteLength > maxBytes) {
    if (maxBytes === ADMIN_IMAGE_MAX_BYTES) return "حجم الصورة يتجاوز 5 ميغابايت.";
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `الملف أكبر من الحد المسموح (${mb} ميجابايت).`;
  }
  return undefined;
}
