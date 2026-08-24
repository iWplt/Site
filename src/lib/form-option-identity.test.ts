import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogProductIdFromOptionRef,
  findOptionInTree,
  isArchitectureOptionFieldKey,
  optionMatchesRef,
  reconcileAllowedOptionValues
} from "./form-option-identity.ts";
import type { FormDefinition, FormOption } from "./types.ts";

test("architecture option fields are detected", () => {
  assert.equal(isArchitectureOptionFieldKey("full_outfit_id"), true);
  assert.equal(isArchitectureOptionFieldKey("selected_products"), true);
  assert.equal(isArchitectureOptionFieldKey("robe_model"), false);
});

test("catalog option refs resolve across id / value / catalogProductId", () => {
  const option: FormOption = {
    id: "catalog-prod-1",
    value: "prod-1",
    label: "روب أمريكي",
    catalogProductId: "prod-1"
  };
  assert.equal(catalogProductIdFromOptionRef("catalog-prod-1"), "prod-1");
  assert.equal(optionMatchesRef(option, "catalog-prod-1"), true);
  assert.equal(optionMatchesRef(option, "prod-1"), true);
  assert.equal(optionMatchesRef(option, "other"), false);
  assert.equal(findOptionInTree([option], "prod-1")?.label, "روب أمريكي");
});

test("reconcile drops removed Form Product option values only", () => {
  const definition: FormDefinition = {
    id: "form",
    version: 2,
    name: "WARKA",
    type: "BATCH",
    sections: [
      {
        id: "robe",
        title: "الروب",
        fields: [
          {
            id: "robe_model",
            key: "robe_model",
            label: "موديل",
            type: "image_choice",
            options: [
              { id: "a", label: "A", value: "american", enabled: true },
              { id: "b", label: "B", value: "gone", enabled: false }
            ]
          }
        ]
      }
    ]
  };
  assert.deepEqual(reconcileAllowedOptionValues(definition, { robe_model: ["american", "gone", "stale"] })?.robe_model, [
    "american"
  ]);
});
