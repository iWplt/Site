import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogFieldKey,
  filterAvailableProducts,
  formatProductPrice,
  isProductAvailable,
  mergeCatalogIntoDefinition
} from "./product-catalog.ts";
import type { CatalogProduct, FormDefinition, ProductCategory } from "./types.ts";

const categories: ProductCategory[] = [
  { id: "cat-robe", slug: "robe", name_ar: "روب", sort_order: 10 },
  { id: "cat-bouquet", slug: "bouquet", name_ar: "بوكيه", sort_order: 80 }
];

const definition: FormDefinition = {
  id: "form",
  version: 2,
  name: "WARKA",
  type: "BATCH",
  sections: [
    { id: "student", title: "بيانات الطالب", fields: [{ id: "student_name", key: "student_name", label: "اسم الطالب", type: "read_only" }] },
    {
      id: "robe",
      title: "الروب",
      fields: [
        {
          id: "robe_model",
          key: "robe_model",
          label: "موديل الروب",
          type: "image_choice",
          options: [{ id: "robe-gulf", label: "الروب الخليجي", value: "gulf" }]
        }
      ]
    },
    { id: "uploads", title: "تصاميم الطالب", fields: [{ id: "cap_top_image", key: "cap_top_image", label: "تطريز", type: "image_upload" }] }
  ]
};

function product(partial: Partial<CatalogProduct> & Pick<CatalogProduct, "id" | "category_id" | "name_ar">): CatalogProduct {
  return {
    active: true,
    archived: false,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    availability: [],
    ...partial
  };
}

test("formatProductPrice hides empty and zero", () => {
  assert.equal(formatProductPrice(null), null);
  assert.equal(formatProductPrice(0), null);
  assert.equal(formatProductPrice(25000), "25000 دينار");
});

test("availability all / individual / batch / form", () => {
  const audience = { formId: "form-1", formType: "BATCH" as const, batchId: "batch-1" };
  assert.equal(isProductAvailable([], audience), true);
  assert.equal(isProductAvailable([{ id: "a", product_id: "p", scope: "all" }], audience), true);
  assert.equal(
    isProductAvailable([{ id: "a", product_id: "p", scope: "individual" }], audience),
    false
  );
  assert.equal(
    isProductAvailable([{ id: "a", product_id: "p", scope: "individual" }], { ...audience, formType: "INDIVIDUAL", batchId: null }),
    true
  );
  assert.equal(
    isProductAvailable([{ id: "a", product_id: "p", scope: "batches", batch_id: "batch-1" }], audience),
    true
  );
  assert.equal(
    isProductAvailable([{ id: "a", product_id: "p", scope: "forms", form_id: "form-1" }], audience),
    true
  );
});

test("inactive products are excluded from live merge", () => {
  const live = filterAvailableProducts(
    [
      product({ id: "on", category_id: "cat-bouquet", name_ar: "بوكيه أبيض" }),
      product({ id: "off", category_id: "cat-bouquet", name_ar: "مخفي", active: false })
    ],
    { formId: "form-1", formType: "BATCH", batchId: "batch-1" }
  );
  assert.deepEqual(live.map((item) => item.id), ["on"]);
});

test("catalog products append to existing robe options and add new category steps", () => {
  const merged = mergeCatalogIntoDefinition(
    definition,
    [
      product({ id: "prod-robe", category_id: "cat-robe", name_ar: "روب جديد" }),
      product({ id: "prod-bouquet", category_id: "cat-bouquet", name_ar: "بوكيه أبيض", price_iqd: 15000 })
    ],
    categories
  );
  const robe = merged.sections.find((section) => section.id === "robe")?.fields[0];
  assert.equal(robe?.options?.some((option) => option.value === "gulf"), true);
  assert.equal(robe?.options?.some((option) => option.value === "prod-robe"), true);
  const bouquet = merged.sections.find((section) => section.id === catalogFieldKey("bouquet"));
  assert.ok(bouquet);
  assert.equal(bouquet?.fields[0]?.options?.[0]?.label, "بوكيه أبيض");
  assert.equal(bouquet?.fields[0]?.options?.[0]?.priceIqd, 15000);
  const uploadsIndex = merged.sections.findIndex((section) => section.id === "uploads");
  const bouquetIndex = merged.sections.findIndex((section) => section.id === catalogFieldKey("bouquet"));
  assert.ok(bouquetIndex >= 0 && bouquetIndex < uploadsIndex);
});

test("empty catalog categories do not create wizard steps", () => {
  const merged = mergeCatalogIntoDefinition(definition, [], categories);
  assert.equal(merged.sections.some((section) => section.id.startsWith("catalog_")), false);
  assert.equal(merged.sections.find((section) => section.id === "robe")?.fields[0]?.options?.[0]?.value, "gulf");
});
