import assert from "node:assert/strict";
import test from "node:test";
import { choiceSelectionError, fieldSelectionMode, isMultiSelectField, normalizeChoiceAnswer } from "./form-selection.ts";
import type { FormField } from "./types.ts";

const multiField: FormField = {
  id: "robe_addition",
  key: "robe_addition",
  label: "إضافات",
  type: "image_choice",
  selectionMode: "multiple",
  minSelections: 0,
  maxSelections: 3,
  options: [
    { id: "a", label: "أ", value: "a" },
    { id: "b", label: "ب", value: "b" },
    { id: "c", label: "ج", value: "c" },
    { id: "d", label: "د", value: "d" }
  ]
};

const singleField: FormField = {
  id: "robe_model",
  key: "robe_model",
  label: "موديل",
  type: "image_choice",
  required: true,
  options: [
    { id: "gulf", label: "خليجي", value: "gulf" },
    { id: "american", label: "أمريكي", value: "american" }
  ]
};

test("selection mode defaults from field type and explicit override", () => {
  assert.equal(fieldSelectionMode(singleField), "single");
  assert.equal(isMultiSelectField(multiField), true);
  assert.equal(isMultiSelectField({ ...singleField, type: "checkbox" }), true);
});

test("multi-select keeps multiple values and respects max", () => {
  assert.deepEqual(normalizeChoiceAnswer(multiField, ["a", "b"]), ["a", "b"]);
  assert.equal(choiceSelectionError(multiField, ["a", "b", "c"]), undefined);
  assert.ok(choiceSelectionError(multiField, ["a", "b", "c", "d"]));
});

test("single-select normalizes arrays to one value", () => {
  assert.equal(normalizeChoiceAnswer(singleField, ["gulf", "american"]), "gulf");
  assert.ok(choiceSelectionError(singleField, undefined));
  assert.equal(choiceSelectionError(singleField, "gulf"), undefined);
});

test("required multi-select enforces minimum when configured", () => {
  const requiredMulti: FormField = { ...multiField, required: true, minSelections: 2 };
  assert.ok(choiceSelectionError(requiredMulti, ["a"]));
  assert.equal(choiceSelectionError(requiredMulti, ["a", "b"]), undefined);
});
