import type {
  CatalogProduct,
  FormDefinition,
  FormOption,
  FormSection,
  FormType,
  ProductAvailability,
  ProductCategory
} from "./types";

export const CORE_WIZARD_SECTION_IDS = ["student", "booking", "sash_embroidery", "uploads"] as const;

/** Existing wizard fields that catalog products in these slugs can extend. */
export const CATALOG_LEGACY_FIELD_MAP: Record<string, { fieldKey: string; sectionId: string }> = {
  robe: { fieldKey: "robe_model", sectionId: "robe" },
  robe_additions: { fieldKey: "robe_addition", sectionId: "robe_additions" },
  sash: { fieldKey: "sash_type", sectionId: "sash" },
  cap: { fieldKey: "cap_type", sectionId: "cap" }
};

export const DEFAULT_PRODUCT_CATEGORIES: Array<Pick<ProductCategory, "slug" | "name_ar" | "name_en" | "sort_order">> = [
  { slug: "robe", name_ar: "روب", name_en: "Robe", sort_order: 10 },
  { slug: "robe_additions", name_ar: "إضافات الروب", name_en: "Robe additions", sort_order: 20 },
  { slug: "sash", name_ar: "وشاح", name_en: "Sash", sort_order: 30 },
  { slug: "embroidery", name_ar: "تطريز", name_en: "Embroidery", sort_order: 40 },
  { slug: "cap", name_ar: "قبعة", name_en: "Cap", sort_order: 50 },
  { slug: "photography", name_ar: "باقة تصوير", name_en: "Photography", sort_order: 60 },
  { slug: "medal", name_ar: "ميدالية", name_en: "Medal", sort_order: 70 },
  { slug: "bouquet", name_ar: "بوكيه", name_en: "Bouquet", sort_order: 80 },
  { slug: "certificate_cover", name_ar: "كفر شهادة", name_en: "Certificate cover", sort_order: 90 },
  { slug: "shield", name_ar: "درع", name_en: "Shield", sort_order: 100 },
  { slug: "extras", name_ar: "إضافات أخرى", name_en: "Other extras", sort_order: 110 }
];

export type CatalogAudience = {
  formId: string;
  formType: FormType;
  batchId?: string | null;
};

export function formatProductPrice(price: number | string | null | undefined): string | null {
  if (price === null || price === undefined || price === "") return null;
  const amount = typeof price === "number" ? price : Number(String(price).replace(/,/g, "").trim());
  if (!Number.isFinite(amount) || amount === 0) return null;
  return `${amount} دينار`;
}

export function catalogFieldKey(categorySlug: string) {
  return `catalog_${categorySlug}`;
}

export function isCatalogFieldKey(key: string) {
  return key.startsWith("catalog_");
}

export function isProductAvailable(availability: ProductAvailability[] | undefined, audience: CatalogAudience): boolean {
  const rows = availability ?? [];
  if (!rows.length) return true;
  if (rows.some((row) => row.scope === "all")) return true;
  if (audience.formType === "INDIVIDUAL" && rows.some((row) => row.scope === "individual")) return true;
  if (
    audience.batchId &&
    rows.some((row) => row.scope === "batches" && row.batch_id === audience.batchId)
  ) {
    return true;
  }
  return rows.some((row) => row.scope === "forms" && row.form_id === audience.formId);
}

export function productToFormOption(product: CatalogProduct, category: ProductCategory): FormOption {
  return {
    id: `catalog-${product.id}`,
    value: product.id,
    label: product.name_ar,
    description: product.description ?? undefined,
    imagePath: product.image_path ?? undefined,
    imageUrl: product.image_url ?? undefined,
    imageAlt: product.name_ar,
    catalogProductId: product.id,
    priceIqd: product.price_iqd ?? null,
    categorySlug: category.slug,
    categoryName: category.name_ar
  };
}

function optionValues(options: FormOption[] | undefined) {
  const values = new Set<string>();
  for (const option of options ?? []) {
    values.add(option.value);
    for (const child of option.children ?? []) values.add(child.value);
  }
  return values;
}

export function mergeCatalogIntoDefinition(
  definition: FormDefinition,
  products: CatalogProduct[],
  categories: ProductCategory[]
): FormDefinition {
  const liveCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order || a.name_ar.localeCompare(b.name_ar, "ar"));
  const byCategory = new Map<string, CatalogProduct[]>();
  for (const product of products) {
    if (!product.active || product.archived) continue;
    const list = byCategory.get(product.category_id) ?? [];
    list.push(product);
    byCategory.set(product.category_id, list);
  }

  const sections = definition.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => ({ ...field, options: field.options ? [...field.options] : field.options }))
  }));

  const extraSections: FormSection[] = [];

  for (const category of liveCategories) {
    const grouped = (byCategory.get(category.id) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order || a.name_ar.localeCompare(b.name_ar, "ar")
    );
    if (!grouped.length) continue;
    if (category.slug === "embroidery") continue;

    const options = grouped.map((product) => productToFormOption(product, category));
    const mapped = CATALOG_LEGACY_FIELD_MAP[category.slug];
    if (mapped) {
      const section = sections.find((entry) => entry.id === mapped.sectionId);
      const field = section?.fields.find((entry) => entry.key === mapped.fieldKey);
      if (field) {
        const existing = optionValues(field.options);
        const appended = options.filter((option) => !existing.has(option.value));
        field.options = [...(field.options ?? []), ...appended];
        field.showOptionImages = true;
        continue;
      }
    }

    extraSections.push({
      id: catalogFieldKey(category.slug),
      title: category.name_ar,
      description: "خيارات من كتالوج المالك.",
      fields: [
        {
          id: catalogFieldKey(category.slug),
          key: catalogFieldKey(category.slug),
          label: category.name_ar,
          type: "image_choice",
          required: false,
          showOptionImages: true,
          options
        }
      ]
    });
  }

  const uploadsIndex = sections.findIndex((section) => section.id === "uploads");
  const nextSections =
    uploadsIndex >= 0
      ? [...sections.slice(0, uploadsIndex), ...extraSections, ...sections.slice(uploadsIndex)]
      : [...sections, ...extraSections];

  return { ...definition, sections: nextSections };
}

export function filterAvailableProducts(products: CatalogProduct[], audience: CatalogAudience) {
  return products.filter((product) => product.active && !product.archived && isProductAvailable(product.availability, audience));
}
