import assert from "node:assert/strict";
import test from "node:test";
import { defaultWarkaFormDefinition, fieldIsVisible } from "./form-definition.ts";
import { normalizeFormCustomizationGrouping } from "./form-customization.ts";
import type { FormDefinition } from "./types.ts";

test("default definition places customizations under parent product sections", () => {
  const def = defaultWarkaFormDefinition;
  const bySection = Object.fromEntries(def.sections.map((section) => [section.id, section.fields.map((field) => field.key)]));
  assert.ok(bySection.robe.includes("robe_addition_image"));
  assert.ok(bySection.sash.includes("sash_back_image"));
  assert.ok(bySection.sash.includes("year_side_image"));
  assert.ok(bySection.cap.includes("cap_side_image"));
  assert.ok(bySection.cap.includes("cap_top_image"));
  assert.equal(bySection.uploads, undefined);
  assert.equal(bySection.robe_additions, undefined);
  assert.equal(bySection.sash_embroidery, undefined);
});

test("normalize relocates legacy global uploads into parent sections", () => {
  const legacy: FormDefinition = {
    id: "legacy",
    version: 2,
    name: "legacy",
    type: "BATCH",
    sections: [
      {
        id: "robe_additions",
        title: "إضافات الروب",
        fields: [{ id: "robe_addition", key: "robe_addition", label: "إضافات", type: "image_choice", defaultValue: "none" }]
      },
      {
        id: "sash_embroidery",
        title: "تطريز",
        fields: [{ id: "name_embroidery", key: "name_embroidery", label: "اسم", type: "short_text", required: true }]
      },
      {
        id: "cap",
        title: "قبعة",
        fields: [{ id: "cap_type", key: "cap_type", label: "قبعة", type: "image_choice" }]
      },
      {
        id: "uploads",
        title: "تصاميم الطالب",
        fields: [
          { id: "robe_addition_image", key: "robe_addition_image", label: "تصميم إضافة", type: "image_upload" },
          { id: "sash_back_image", key: "sash_back_image", label: "ظهر", type: "image_upload" },
          { id: "year_side_image", key: "year_side_image", label: "سنة", type: "image_upload" },
          { id: "cap_side_image", key: "cap_side_image", label: "جانب", type: "image_upload" },
          { id: "cap_top_image", key: "cap_top_image", label: "أعلى", type: "image_upload" }
        ]
      }
    ]
  };

  const normalized = normalizeFormCustomizationGrouping(legacy);
  const keys = (id: string) => normalized.sections.find((section) => section.id === id)?.fields.map((field) => field.key) ?? [];
  assert.ok(keys("robe_additions").includes("robe_addition_image"));
  assert.ok(keys("sash_embroidery").includes("sash_back_image"));
  assert.ok(keys("sash_embroidery").includes("year_side_image"));
  assert.ok(keys("cap").includes("cap_side_image"));
  assert.ok(keys("cap").includes("cap_top_image"));
  assert.equal(normalized.sections.some((section) => section.id === "uploads"), false);

  const robeImage = normalized.sections
    .flatMap((section) => section.fields)
    .find((field) => field.key === "robe_addition_image");
  assert.ok(robeImage?.conditional?.some((rule) => rule.fieldKey === "robe_addition" && rule.operator === "not_equals"));
});

test("robe addition image hides when addition is none", () => {
  const field = defaultWarkaFormDefinition.sections
    .flatMap((section) => section.fields)
    .find((entry) => entry.key === "robe_addition_image");
  assert.ok(field);
  assert.equal(fieldIsVisible(field!, { robe_addition: "none" }), false);
  assert.equal(fieldIsVisible(field!, { robe_addition: "one_sleeve" }), true);
});

test("sash back design hides unless embroidered sash", () => {
  const field = defaultWarkaFormDefinition.sections
    .flatMap((section) => section.fields)
    .find((entry) => entry.key === "sash_back_image");
  assert.ok(field);
  assert.equal(fieldIsVisible(field!, { sash_type: "normal_no_back" }), false);
  assert.equal(fieldIsVisible(field!, { sash_type: "royal_ribbed_embroidered" }), true);
});
