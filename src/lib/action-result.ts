export type ActionFailureCode =
  | "validation"
  | "unauthorized"
  | "not_found"
  | "storage"
  | "database"
  | "conflict"
  | "unexpected";

export type ActionFailure = { success: false; error: string; code: ActionFailureCode };

export type ActionResult<T = undefined> = { success: true; data?: T } | ActionFailure;

export function actionOk<T = undefined>(data?: T): ActionResult<T> {
  return data === undefined ? { success: true } : { success: true, data };
}

export function actionFail(error: string, code: ActionFailureCode = "unexpected"): ActionFailure {
  return { success: false, error, code };
}

export function actionFailFromUnknown(error: unknown, fallback = "تعذر إتمام العملية."): ActionFailure {
  const message = error instanceof Error && error.message.trim() ? error.message : fallback;
  const code = classifyActionError(message);
  return actionFail(message, code);
}

export function classifyActionError(message: string): ActionFailureCode {
  const text = message.toLowerCase();
  if (/غير موجود|not found|missing/i.test(message)) return "not_found";
  if (/غير مصرح|unauthorized|forbidden|صلاح/i.test(message)) return "unauthorized";
  if (/مسار|storage|رفع|bucket|mime|ميغابايت|نوع الصورة|نوع الملف/i.test(message)) return "storage";
  if (/تعذر حفظ|تعذر تحديث|postgres|duplicate|unique|database|json/i.test(text) || /تعذر/.test(message) && /حفظ|تحديث/.test(message)) {
    return "database";
  }
  if (/مطلوب|غير مكتمل|غير صالح|غير مسموح|يرجى/i.test(message)) return "validation";
  return "unexpected";
}

/** Dev/test logging for Form/Outfit option operations — no student PII. */
export function logFormOptionOp(
  operation: string,
  context: {
    formId?: string;
    fieldKey?: string;
    optionId?: string;
    productId?: string;
    outfitId?: string;
    code?: string;
    error?: string;
  }
) {
  if (process.env.NODE_ENV === "production" && process.env.WARKA_DEBUG_FORM_OPTIONS !== "1") return;
  console.info("[form-option-op]", operation, {
    formId: context.formId,
    fieldKey: context.fieldKey,
    optionId: context.optionId,
    productId: context.productId,
    outfitId: context.outfitId,
    code: context.code,
    error: context.error
  });
}
