import assert from "node:assert/strict";
import test from "node:test";
import { defaultWarkaFormDefinition } from "./form-definition.ts";
import {
  choiceSelectionError,
  isMultiSelectField,
  toggleChoiceSelection
} from "./form-selection.ts";
import {
  applyOutfitArchitecture,
  optionsForBookingContext,
  resolveOutfitAnswers
} from "./outfit-architecture.ts";
import type { FormDefinition, FormField } from "./types.ts";

function multiAdditionField(overrides: Partial<FormField> = {}): FormField {
  return {
    id: "robe_addition",
    key: "robe_addition",
    label: "إضافات الروب",
    type: "image_choice",
    selectionMode: "multiple",
    minSelections: 0,
    maxSelections: 3,
    showOptionImages: true,
    options: [
      { id: "none", label: "بدون إضافة", value: "none" },
      { id: "embroidery_1", label: "تطريز 1", value: "embroidery_1" },
      { id: "embroidery_2", label: "تطريز 2", value: "embroidery_2" },
      { id: "name_5_colors", label: "اسم + 5 ألوان", value: "name_5_colors" },
      { id: "opening", label: "اسم + فتحة", value: "opening" }
    ],
    ...overrides
  };
}

function formWithMultiAddition(allowed?: string[]): FormDefinition {
  const source = structuredClone(defaultWarkaFormDefinition);
  const robe = source.sections.find((section) => section.id === "robe");
  assert.ok(robe);
  const index = robe.fields.findIndex((field) => field.key === "robe_addition");
  assert.ok(index >= 0);
  const existing = robe.fields[index];
  robe.fields[index] = multiAdditionField({
    id: existing.id,
    key: existing.key,
    label: existing.label,
    type: existing.type,
    showOptionImages: true,
    defaultValue: undefined,
    conditional: existing.conditional
  });
  if (allowed?.length && source.outfitConfig?.fullOutfits?.[0]) {
    source.outfitConfig.fullOutfits[0].productSettings = {
      robe: { allowedOptions: { robe_addition: allowed } }
    };
  }
  return applyOutfitArchitecture(source);
}

/** Reproduce the screenshot bug: click A then B must keep both selected. */
test("student multi-select keeps prior options after each click (A then B then C)", () => {
  const live = formWithMultiAddition(["embroidery_1", "embroidery_2", "name_5_colors", "opening"]);
  const field = live.sections.flatMap((section) => section.fields).find((entry) => entry.key === "robe_addition");
  assert.ok(field);
  assert.equal(isMultiSelectField(field!), true);

  let answers = resolveOutfitAnswers(live, { booking_type: "full_set", student_name: "طالب" });
  const visible = optionsForBookingContext(field!, live, answers).map((option) => option.value);
  assert.deepEqual(visible, ["embroidery_1", "embroidery_2", "name_5_colors", "opening"]);

  function click(optionValue: string) {
    const result = toggleChoiceSelection(field!, answers.robe_addition, optionValue);
    assert.equal(result.blockedByMax, false);
    answers = resolveOutfitAnswers(live, { ...answers, robe_addition: result.value });
  }

  click("embroidery_2");
  assert.deepEqual(answers.robe_addition, ["embroidery_2"]);

  click("name_5_colors");
  assert.deepEqual(answers.robe_addition, ["embroidery_2", "name_5_colors"]);

  click("opening");
  assert.deepEqual(answers.robe_addition, ["embroidery_2", "name_5_colors", "opening"]);

  click("embroidery_2");
  assert.deepEqual(answers.robe_addition, ["name_5_colors", "opening"]);
});

test("single-select still replaces the previous option", () => {
  const live = formWithMultiAddition();
  const field = live.sections.flatMap((section) => section.fields).find((entry) => entry.key === "robe_addition");
  assert.ok(field);
  field!.selectionMode = "single";
  assert.equal(isMultiSelectField(field!), false);

  let answers = resolveOutfitAnswers(live, { booking_type: "full_set" });
  answers = resolveOutfitAnswers(live, {
    ...answers,
    robe_addition: toggleChoiceSelection(field!, answers.robe_addition, "embroidery_1").value
  });
  assert.equal(answers.robe_addition, "embroidery_1");
  answers = resolveOutfitAnswers(live, {
    ...answers,
    robe_addition: toggleChoiceSelection(field!, answers.robe_addition, "embroidery_2").value
  });
  assert.equal(answers.robe_addition, "embroidery_2");
});

test("maxSelections blocks a third option while allowing deselect", () => {
  const live = formWithMultiAddition(["embroidery_1", "embroidery_2", "name_5_colors", "opening"]);
  const field = live.sections.flatMap((section) => section.fields).find((entry) => entry.key === "robe_addition");
  assert.ok(field);
  field!.maxSelections = 2;

  let value: unknown = [];
  let result = toggleChoiceSelection(field!, value, "embroidery_1");
  value = result.value;
  result = toggleChoiceSelection(field!, value, "embroidery_2");
  value = result.value;
  assert.deepEqual(value, ["embroidery_1", "embroidery_2"]);

  result = toggleChoiceSelection(field!, value, "name_5_colors");
  assert.equal(result.blockedByMax, true);
  assert.deepEqual(result.value, ["embroidery_1", "embroidery_2"]);

  result = toggleChoiceSelection(field!, value, "embroidery_1");
  assert.equal(result.blockedByMax, false);
  assert.deepEqual(result.value, ["embroidery_2"]);
});

test("minSelections blocks submit until enough options are chosen", () => {
  const field = multiAdditionField({ minSelections: 2, required: true, maxSelections: 3 });
  assert.ok(choiceSelectionError(field, ["embroidery_1"]));
  assert.equal(choiceSelectionError(field, ["embroidery_1", "embroidery_2"]), undefined);
});

test("outfit allowed options do not force single-select mode", () => {
  const live = formWithMultiAddition(["embroidery_1", "embroidery_2", "name_5_colors"]);
  const field = live.sections.flatMap((section) => section.fields).find((entry) => entry.key === "robe_addition");
  assert.ok(field);
  assert.equal(field!.selectionMode, "multiple");
  assert.equal(isMultiSelectField(field!), true);

  const answers = resolveOutfitAnswers(live, {
    booking_type: "full_set",
    robe_addition: ["embroidery_1", "embroidery_2", "name_5_colors"]
  });
  assert.deepEqual(answers.robe_addition, ["embroidery_1", "embroidery_2", "name_5_colors"]);
});

test("switching outfits clears options that are no longer allowed", () => {
  const source = structuredClone(defaultWarkaFormDefinition);
  const robe = source.sections.find((section) => section.id === "robe");
  assert.ok(robe);
  const index = robe.fields.findIndex((field) => field.key === "robe_addition");
  robe.fields[index] = multiAdditionField({ defaultValue: undefined });
  source.outfitConfig = {
    ...source.outfitConfig!,
    fullOutfits: [
      {
        id: "american",
        name: "زي أمريكي",
        enabled: true,
        productOrder: ["robe", "sash", "cap"],
        productSettings: {
          robe: { allowedOptions: { robe_addition: ["embroidery_1", "embroidery_2", "name_5_colors"] } }
        }
      },
      {
        id: "gulf",
        name: "زي خليجي",
        enabled: true,
        productOrder: ["robe", "sash", "cap"],
        productSettings: {
          robe: { allowedOptions: { robe_addition: ["embroidery_1"] } }
        }
      }
    ]
  };
  const live = applyOutfitArchitecture(source);

  let answers = resolveOutfitAnswers(live, {
    booking_type: "full_set",
    full_outfit_id: "american",
    robe_addition: ["embroidery_1", "embroidery_2", "name_5_colors"]
  });
  assert.deepEqual(answers.robe_addition, ["embroidery_1", "embroidery_2", "name_5_colors"]);

  answers = resolveOutfitAnswers(live, { ...answers, full_outfit_id: "gulf" });
  assert.deepEqual(answers.robe_addition, ["embroidery_1"]);
});

test("multi-select answer retains all option values for snapshot/order creation", () => {
  const live = formWithMultiAddition();
  const field = live.sections.flatMap((section) => section.fields).find((entry) => entry.key === "robe_addition");
  assert.ok(field);
  const answers = resolveOutfitAnswers(live, {
    booking_type: "full_set",
    robe_addition: ["embroidery_2", "name_5_colors", "opening"]
  });
  assert.deepEqual(answers.robe_addition, ["embroidery_2", "name_5_colors", "opening"]);
  const selectedIds = (field!.options ?? [])
    .filter((option) => (answers.robe_addition as string[]).includes(option.value))
    .map((option) => option.id);
  assert.deepEqual(selectedIds, ["embroidery_2", "name_5_colors", "opening"]);
});

test("toggleChoiceSelection treats none as exclusive in multi mode", () => {
  const field = multiAdditionField();
  let result = toggleChoiceSelection(field, ["none"], "embroidery_2");
  assert.deepEqual(result.value, ["embroidery_2"]);
  result = toggleChoiceSelection(field, ["embroidery_2", "opening"], "none");
  assert.deepEqual(result.value, ["none"]);
});
