import assert from "node:assert/strict";
import test from "node:test";
import { applyCopiedFormConfig, formConfigurationWarnings } from "./form-config.ts";
import { defaultWarkaFormDefinition } from "./form-definition.ts";
import type { FormDefinition } from "./types.ts";

test("warns when a visible core product has no enabled models", () => {
  const definition: FormDefinition = {
    ...defaultWarkaFormDefinition,
    sections: defaultWarkaFormDefinition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => (field.key === "robe_model" ? { ...field, options: [] } : field))
    }))
  };
  const warnings = formConfigurationWarnings(definition);
  assert.ok(warnings.some((warning) => warning.id === "no-models-robe"));
});

test("warns when an outfit includes a product disabled on the form", () => {
  const definition: FormDefinition = {
    ...defaultWarkaFormDefinition,
    sections: defaultWarkaFormDefinition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) =>
        field.key === "cap_type" ? { ...field, options: field.options?.map((option) => ({ ...option, enabled: false })) } : field
      )
    })),
    outfitConfig: {
      fullOutfits: [{ id: "royal", name: "زي ملكي", enabled: true, productOrder: ["robe", "sash", "cap"] }],
      singleItemEnabled: true,
      singleItemProducts: ["robe", "sash", "cap"],
      productOrder: ["robe", "sash", "cap"]
    }
  };
  const warnings = formConfigurationWarnings(definition);
  assert.ok(warnings.some((warning) => warning.id === "outfit-disabled-royal"));
  assert.equal(warnings.some((warning) => warning.id === "outfit-incomplete-royal"), false);
});

test("copy form config copies outfits and single-item settings without touching unrelated name", () => {
  const source: FormDefinition = {
    ...defaultWarkaFormDefinition,
    name: "مصدر",
    outfitConfig: {
      fullOutfits: [{ id: "royal", name: "زي ملكي", enabled: true, productOrder: ["robe", "sash", "cap"] }],
      singleItemEnabled: false,
      singleItemProducts: ["robe"],
      productOrder: ["cap", "sash", "robe"]
    }
  };
  const target: FormDefinition = { ...defaultWarkaFormDefinition, name: "هدف" };
  const next = applyCopiedFormConfig(target, source, { outfits: true, singleItem: true, ordering: true });
  assert.equal(next.name, "هدف");
  assert.equal(next.outfitConfig?.fullOutfits[0]?.name, "زي ملكي");
  assert.equal(next.outfitConfig?.singleItemEnabled, false);
  assert.deepEqual(next.outfitConfig?.productOrder, ["cap", "sash", "robe"]);
});
