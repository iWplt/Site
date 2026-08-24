import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogFieldKey,
  filterAvailableProducts,
  formatProductPrice,
  isCatalogProductAttachedToForm,
  isProductAvailable,
  mergeCatalogIntoDefinition,
  optionVisibleForBooking
} from "./product-catalog.ts";
import type { CatalogAudience, CatalogProduct, FormDefinition, ProductCategory } from "./types.ts";

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
    { id: "cap", title: "القبعة", fields: [{ id: "cap_top_image", key: "cap_top_image", label: "تطريز", type: "image_upload" }] }
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
  const capIndex = merged.sections.findIndex((section) => section.id === "cap");
  const bouquetIndex = merged.sections.findIndex((section) => section.id === catalogFieldKey("bouquet"));
  assert.ok(bouquetIndex >= 0 && bouquetIndex > capIndex);
});

test("empty catalog categories do not create wizard steps", () => {
  const merged = mergeCatalogIntoDefinition(definition, [], categories);
  assert.equal(merged.sections.some((section) => section.id.startsWith("catalog_")), false);
  assert.equal(merged.sections.find((section) => section.id === "robe")?.fields[0]?.options?.[0]?.value, "gulf");
});

test("form assignments hide, sort, and tag booking modes without duplicating catalog rows", () => {
  const merged = mergeCatalogIntoDefinition(
    {
      ...definition,
      outfitConfig: {
        fullOutfits: [{ id: "mix", name: "زي مكس", enabled: true, productOrder: ["robe", "sash", "cap"] }],
        singleItemEnabled: true,
        singleItemProducts: ["robe", "sash", "cap"],
        productOrder: ["robe", "sash", "cap"],
        catalogAssignments: {
          "prod-hidden": { hidden: true, bookingModes: ["full_set", "single_pieces"] },
          "prod-single": { sortOrder: 1, bookingModes: ["single_pieces"] },
          "prod-full": { sortOrder: 5, bookingModes: ["full_set"] }
        }
      }
    },
    [
      product({ id: "prod-hidden", category_id: "cat-bouquet", name_ar: "مخفي عن الطلاب" }),
      product({ id: "prod-full", category_id: "cat-bouquet", name_ar: "بوكيه كامل", sort_order: 1 }),
      product({ id: "prod-single", category_id: "cat-bouquet", name_ar: "بوكيه مفرد", sort_order: 9 })
    ],
    categories
  );
  const options = merged.sections.find((section) => section.id === catalogFieldKey("bouquet"))?.fields[0]?.options ?? [];
  assert.deepEqual(
    options.map((option) => option.value),
    ["prod-single", "prod-full"]
  );
  assert.deepEqual(options[0]?.bookingModes, ["single_pieces"]);
  assert.deepEqual(options[1]?.bookingModes, ["full_set"]);
});

test("optionVisibleForBooking respects assignment modes and enabled flag", () => {
  assert.equal(optionVisibleForBooking({ id: "a", label: "a", value: "a" }, "full_set"), true);
  assert.equal(
    optionVisibleForBooking({ id: "a", label: "a", value: "a", bookingModes: ["single_pieces"] }, "full_set"),
    false
  );
  assert.equal(
    optionVisibleForBooking({ id: "a", label: "a", value: "a", bookingModes: ["single_pieces"] }, "single_pieces"),
    true
  );
  assert.equal(
    optionVisibleForBooking({ id: "a", label: "a", value: "a", enabled: false, bookingModes: ["full_set"] }, "full_set"),
    false
  );
});

test("isCatalogProductAttachedToForm detects existing form link without duplicating identity", () => {
  const audience: CatalogAudience = { formId: "form-1", formType: "BATCH", batchId: "batch-1" };
  const attached: CatalogProduct = {
    id: "prod-1",
    category_id: "cat-robe",
    name_ar: "روب",
    active: true,
    archived: false,
    sort_order: 1,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    availability: [{ id: "av-1", product_id: "prod-1", scope: "forms", form_id: "form-1" }]
  };
  const otherForm: CatalogProduct = {
    ...attached,
    id: "prod-2",
    availability: [{ id: "av-2", product_id: "prod-2", scope: "forms", form_id: "form-other" }]
  };
  assert.equal(isCatalogProductAttachedToForm(attached, audience), true);
  assert.equal(isCatalogProductAttachedToForm(otherForm, audience), false);
});
