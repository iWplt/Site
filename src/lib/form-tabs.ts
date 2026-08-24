export const FORM_TABS = [
  { id: "booking", label: "إعداد الحجز" },
  { id: "products", label: "المنتجات" },
  { id: "outfits", label: "الأزياء" },
  { id: "customizations", label: "التخصيصات" },
  { id: "preview", label: "معاينة الطالب" },
  { id: "publish", label: "الحفظ والنشر" }
] as const;

export type FormTabId = (typeof FORM_TABS)[number]["id"];

const TAB_ALIASES: Record<string, FormTabId> = {
  general: "booking",
  fields: "booking",
  uploads: "customizations",
  batch: "booking"
};

export function resolveFormTab(raw?: string | null): FormTabId {
  if (raw && FORM_TABS.some((tab) => tab.id === raw)) return raw as FormTabId;
  if (raw && TAB_ALIASES[raw]) return TAB_ALIASES[raw];
  return "booking";
}
