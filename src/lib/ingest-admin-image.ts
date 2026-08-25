import { actionFail, actionOk, type ActionResult } from "./action-result.ts";
import { ADMIN_IMAGE_MAX_BYTES, uploadSizeError } from "./upload-limits.ts";
import { OPTION_IMAGE_MIMES, sniffAllowedMime } from "./upload-mime.ts";

export type IngestedAdminImage = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

export async function ingestAdminImageFile(file: unknown): Promise<ActionResult<IngestedAdminImage>> {
  if (!(file instanceof File)) return actionFail("بيانات الصورة غير مكتملة.", "validation");
  const sizeError = uploadSizeError(file.size, ADMIN_IMAGE_MAX_BYTES);
  if (sizeError) return actionFail(sizeError, "validation");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.byteLength) return actionFail("ملف الصورة فارغ أو لم يصل إلى الخادم.", "storage");
  const mimeType = sniffAllowedMime(buffer, OPTION_IMAGE_MIMES);
  if (!mimeType) {
    return actionFail("نوع الصورة غير مسموح، يرجى استخدام jpg أو png أو webp.", "validation");
  }
  return actionOk({ buffer, mimeType, originalName: file.name });
}
