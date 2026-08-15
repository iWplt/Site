export const FORM_TABS = [
  { id: "general", label: "الإعدادات العامة" },
  { id: "fields", label: "الحقول والأقسام" },
  { id: "uploads", label: "رفع الصور" },
  { id: "products", label: "المنتجات والخيارات" },
  { id: "batch", label: "إعدادات الدفعة" },
  { id: "preview", label: "المعاينة" }
] as const;

export type FormTabId = (typeof FORM_TABS)[number]["id"];
