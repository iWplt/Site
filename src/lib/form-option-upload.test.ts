import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { actionFail, actionFailFromUnknown, actionOk, classifyActionError } from "./action-result.ts";
import { sanitizeStorageSegment, stableStorageSegment } from "./storage-path.ts";
import { reconcileOutfitConfigAgainstForm, resolveOutfitAnswers, sanitizeOutfitConfig } from "./outfit-architecture.ts";
import { defaultWarkaFormDefinition } from "./form-definition.ts";
import type { FormDefinition } from "./types.ts";

test("A: working option id stays unchanged for storage paths", () => {
  assert.equal(stableStorageSegment("robe-gulf"), "robe-gulf");
  assert.equal(stableStorageSegment("sash-royal-ribbed-embroidered"), "sash-royal-ribbed-embroidered");
});

test("B: previously failing option ids (unicode/spaces/dots) get stable safe paths", () => {
  const unicode = "روب-أمريكي";
  const spaced = "robe american";
  const dotted = "robe.model.v2";
  const long = `opt-${"x".repeat(100)}`;
  for (const id of [unicode, spaced, dotted, long, ""]) {
    const segment = stableStorageSegment(id);
    assert.match(segment, /^[a-zA-Z0-9_-]{1,80}$/);
    assert.equal(stableStorageSegment(id), segment);
  }
  assert.notEqual(stableStorageSegment(unicode), unicode);
});

test("C: Arabic/Unicode filenames do not break storage segment generation", () => {
  const segment = stableStorageSegment("صورة_الخيار_الجديد.png");
  assert.match(segment, /^[a-zA-Z0-9_-]{1,80}$/);
  assert.ok(segment.includes(createHash("sha256").update("صورة_الخيار_الجديد.png").digest("hex").slice(0, 8)));
});

test("D: invalid option path no longer throws (strict sanitize still throws for trusted IDs)", () => {
  assert.throws(() => sanitizeStorageSegment("robe american"), /مسار الملف غير صالح/);
  assert.doesNotThrow(() => stableStorageSegment("robe american"));
});

test("E/F: action result contract for not-found / validation failures", () => {
  const missing = actionFail("الخيار غير موجود.", "not_found");
  assert.equal(missing.success, false);
  if (!missing.success) {
    assert.equal(missing.code, "not_found");
    assert.match(missing.error, /غير موجود/);
  }
  const formProduct = actionFail("المنتج غير موجود في منتجات النموذج.", "not_found");
  assert.equal(formProduct.success, false);
  assert.equal(classifyActionError("الحقل غير موجود."), "not_found");
  assert.equal(classifyActionError("مسار الملف غير صالح."), "storage");
});

test("G/H: storage and database failures map to controlled codes", () => {
  assert.equal(classifyActionError("تعذر رفع الصورة."), "storage");
  assert.equal(classifyActionError("تعذر حفظ الصورة."), "database");
  const unexpected = actionFailFromUnknown(new Error("boom"), "تعذر إتمام العملية.");
  assert.equal(unexpected.success, false);
  if (!unexpected.success) assert.equal(unexpected.error, "boom");
});

test("I: success payload is serializable plain data", () => {
  const ok = actionOk({ imagePath: "a/b/c/reference.jpg", imageUrl: "https://example.com/x" });
  assert.equal(ok.success, true);
  assert.deepEqual(JSON.parse(JSON.stringify(ok)), ok);
});

test("J: empty / unicode option ids are deterministic across calls", () => {
  assert.equal(stableStorageSegment(""), stableStorageSegment(""));
  assert.equal(stableStorageSegment("خيار ١"), stableStorageSegment("خيار ١"));
});

test("K/L: multi allowed options and outfit settings still reconcile", () => {
  const definition: FormDefinition = {
    ...defaultWarkaFormDefinition,
    outfitConfig: {
      fullOutfits: [
        {
          id: "american",
          name: "زي أمريكي",
          enabled: true,
          productOrder: ["robe", "sash", "cap"],
          productSettings: {
            robe: { allowedOptions: { robe_model: ["american", "gulf", "missing"] } }
          }
        }
      ],
      singleItemEnabled: true,
      singleItemProducts: ["robe", "sash", "cap"],
      productOrder: ["robe", "sash", "cap"]
    }
  };
  const live = reconcileOutfitConfigAgainstForm(definition, sanitizeOutfitConfig(definition.outfitConfig));
  assert.deepEqual(live.fullOutfits[0]?.productSettings?.robe?.allowedOptions?.robe_model?.sort(), ["american", "gulf"]);
});

test("M: Full Outfit still locks product membership", () => {
  const definition: FormDefinition = {
    ...defaultWarkaFormDefinition,
    outfitConfig: {
      fullOutfits: [{ id: "robe-only", name: "روب", enabled: true, productOrder: ["robe"] }],
      singleItemEnabled: true,
      singleItemProducts: ["robe", "sash", "cap"],
      productOrder: ["robe", "sash", "cap"]
    }
  };
  const answers = resolveOutfitAnswers(definition, {
    booking_type: "full_set",
    full_outfit_id: "robe-only",
    selected_products: ["robe", "sash", "cap"]
  });
  assert.deepEqual(answers.selected_products, ["robe"]);
});

test("N: Single Item remains independent from Outfit settings", () => {
  const definition: FormDefinition = {
    ...defaultWarkaFormDefinition,
    outfitConfig: {
      fullOutfits: [
        {
          id: "royal",
          name: "ملكي",
          enabled: true,
          productOrder: ["robe"],
          productSettings: { robe: { allowedOptions: { robe_model: ["american"] } } }
        }
      ],
      singleItemEnabled: true,
      singleItemProducts: ["robe", "sash"],
      productOrder: ["robe", "sash", "cap"]
    }
  };
  const answers = resolveOutfitAnswers(definition, { booking_type: "single_pieces", selected_products: ["robe", "sash"] });
  assert.deepEqual(answers.selected_products, ["robe", "sash"]);
});

test("O: known failures never rely on generic unexpected-response wording", () => {
  const cases = [
    actionFail("الخيار غير موجود.", "not_found"),
    actionFail("مسار الملف غير صالح.", "storage"),
    actionFail("بيانات الصورة غير مكتملة.", "validation"),
    actionFailFromUnknown(new Error("تعذر حفظ الصورة."))
  ];
    for (const result of cases) {
      assert.equal(result.success, false);
      assert.equal(/unexpected response was received from the server/i.test(result.error), false);
      assert.ok(result.code);
    }
});
