import type { ActionResult } from "./action-result.ts";
import { actionFail } from "./action-result.ts";
import {
  ADMIN_IMAGE_MAX_BYTES,
  type AdminUploadKind,
  parseAdminUploadKind,
  uploadSizeError
} from "./upload-limits.ts";

export async function uploadAdminImage(
  kind: AdminUploadKind,
  fields: Record<string, string>,
  file: File
): Promise<ActionResult<{ imagePath?: string; imageUrl?: string }>> {
  if (!parseAdminUploadKind(kind)) {
    return actionFail("بيانات الصورة غير مكتملة.", "validation");
  }
  const sizeError = uploadSizeError(file.size, ADMIN_IMAGE_MAX_BYTES);
  if (sizeError) return actionFail(sizeError, "validation");

  const body = new FormData();
  body.set("kind", kind);
  for (const [key, value] of Object.entries(fields)) {
    if (value) body.set(key, value);
  }
  body.set("file", file);

  let response: Response;
  try {
    response = await fetch("/api/uploads/admin", { method: "POST", body });
  } catch {
    return actionFail("تعذر رفع الصورة.", "storage");
  }

  try {
    const payload = (await response.json()) as ActionResult<{ imagePath?: string; imageUrl?: string }>;
    if (!payload || typeof payload !== "object" || !("success" in payload)) {
      return actionFail("تعذر رفع الصورة.", "unexpected");
    }
    return payload;
  } catch {
    return actionFail("تعذر رفع الصورة.", "unexpected");
  }
}
