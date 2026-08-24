import assert from "node:assert/strict";
import test from "node:test";
import { defaultWarkaFormDefinition, fieldIsVisible } from "./form-definition.ts";
import {
  applyOutfitArchitecture,
  outfitProductDisplayImage,
  productIsSelected,
  resolveOutfitAnswers,
  resolveSelectedOutfit,
  sanitizeOutfitConfig
} from "./outfit-architecture.ts";
import type { FormDefinition } from "./types.ts";

function keys(definition: FormDefinition, sectionId: string) {
  return definition.sections.find((section) => section.id === sectionId)?.fields.map((field) => field.key) ?? [];
}

test("architecture merges child product sections into robe and sash", () => {
  const legacy: FormDefinition = {
    id: "legacy",
    version: 2,
    name: "legacy",
    type: "BATCH",
    sections: [
      { id: "student", title: "بيانات", fields: [{ id: "student_name", key: "student_name", label: "اسم", type: "read_only" }] },
      {
        id: "booking",
        title: "حجز",
        fields: [{ id: "booking_type", key: "booking_type", label: "نوع", type: "radio", defaultValue: "full_set", options: [{ id: "full", label: "كامل", value: "full_set" }, { id: "single", label: "مفرد", value: "single_pieces" }] }]
      },
      { id: "robe", title: "روب", fields: [{ id: "robe_model", key: "robe_model", label: "موديل", type: "image_choice" }] },
      {
        id: "robe_additions",
        title: "إضافات",
        fields: [{ id: "robe_addition", key: "robe_addition", label: "إضافة", type: "image_choice", defaultValue: "none" }]
      },
      { id: "sash", title: "وشاح", fields: [{ id: "sash_type", key: "sash_type", label: "وشاح", type: "image_choice" }] },
      {
        id: "sash_embroidery",
        title: "تطريز",
        fields: [{ id: "name_embroidery", key: "name_embroidery", label: "اسم", type: "short_text", required: true }]
      },
      { id: "cap", title: "قبعة", fields: [{ id: "cap_type", key: "cap_type", label: "قبعة", type: "image_choice" }] }
    ]
  };

  const live = applyOutfitArchitecture(legacy);
  assert.ok(keys(live, "robe").includes("robe_addition"));
  assert.ok(keys(live, "robe").includes("robe_height"));
  assert.ok(keys(live, "robe").includes("robe_clothing_size"));
  assert.ok(keys(live, "sash").includes("name_embroidery"));
  assert.equal(live.sections.some((section) => section.id === "robe_additions"), false);
  assert.equal(live.sections.some((section) => section.id === "sash_embroidery"), false);
});

test("full outfit always selects robe sash and cap", () => {
  const live = applyOutfitArchitecture(defaultWarkaFormDefinition);
  const answers = resolveOutfitAnswers(live, { booking_type: "full_set" });
  assert.deepEqual(answers.selected_products, ["robe", "sash", "cap"]);
  assert.equal(productIsSelected(answers, "robe"), true);
});

test("single item hides unselected products and keeps selected product fields", () => {
  const live = applyOutfitArchitecture(defaultWarkaFormDefinition);
  const robeOnly = resolveOutfitAnswers(live, { booking_type: "single_pieces", selected_products: ["robe"] });
  const robeHeight = live.sections.flatMap((section) => section.fields).find((field) => field.key === "robe_height");
  const sashType = live.sections.flatMap((section) => section.fields).find((field) => field.key === "sash_type");
  const capType = live.sections.flatMap((section) => section.fields).find((field) => field.key === "cap_type");
  assert.ok(robeHeight);
  assert.equal(fieldIsVisible(robeHeight!, robeOnly), true);
  assert.equal(fieldIsVisible(sashType!, robeOnly), false);
  assert.equal(fieldIsVisible(capType!, robeOnly), false);

  const sashOnly = resolveOutfitAnswers(live, { booking_type: "single_pieces", selected_products: ["sash"] });
  assert.equal(fieldIsVisible(robeHeight!, sashOnly), false);
  assert.equal(fieldIsVisible(sashType!, sashOnly), true);
});

test("robe measurements never appear without robe", () => {
  const live = applyOutfitArchitecture(defaultWarkaFormDefinition);
  const height = live.sections.flatMap((section) => section.fields).find((field) => field.key === "robe_height");
  const size = live.sections.flatMap((section) => section.fields).find((field) => field.key === "robe_clothing_size");
  const none = resolveOutfitAnswers(live, { booking_type: "single_pieces", selected_products: ["cap"] });
  assert.equal(fieldIsVisible(height!, none), false);
  assert.equal(fieldIsVisible(size!, none), false);
});

test("sash embroidery fields stay conditional on embroidered sash", () => {
  const live = applyOutfitArchitecture(defaultWarkaFormDefinition);
  const back = live.sections.flatMap((section) => section.fields).find((field) => field.key === "sash_back_image");
  const answers = resolveOutfitAnswers(live, {
    booking_type: "full_set",
    sash_type: "normal_no_back"
  });
  assert.equal(fieldIsVisible(back!, answers), false);
  answers.sash_type = "royal_ribbed_embroidered";
  assert.equal(fieldIsVisible(back!, answers), true);
});

test("disabled single item forces full outfit products", () => {
  const live = applyOutfitArchitecture({
    ...defaultWarkaFormDefinition,
    outfitConfig: {
      fullOutfits: [{ id: "mix", name: "زي مكس", enabled: true, productOrder: ["robe", "sash", "cap"] }],
      singleItemEnabled: false,
      singleItemProducts: ["robe"],
      productOrder: ["cap", "sash", "robe"]
    }
  });
  const answers = resolveOutfitAnswers(live, { booking_type: "single_pieces", selected_products: ["robe"] });
  assert.equal(answers.booking_type, "full_set");
  assert.deepEqual(answers.selected_products, ["robe", "sash", "cap"]);
  assert.equal(live.sections.find((section) => section.id === "booking")?.fields.find((field) => field.key === "booking_type")?.options?.some((option) => option.value === "single_pieces"), false);
});

test("each product keeps independent color notes and reference uploads", () => {
  const live = applyOutfitArchitecture(defaultWarkaFormDefinition);
  for (const product of ["robe", "sash", "cap"] as const) {
    assert.ok(keys(live, product).includes(`${product}_color`));
    assert.ok(keys(live, product).includes(`${product}_color_images`));
    assert.ok(keys(live, product).includes(`${product}_notes`));
  }
});

test("product order moves robe measurements with robe", () => {
  const live = applyOutfitArchitecture({
    ...defaultWarkaFormDefinition,
    outfitConfig: {
      fullOutfits: [{ id: "mix", name: "زي مكس", enabled: true }],
      singleItemEnabled: true,
      singleItemProducts: ["robe", "sash", "cap"],
      productOrder: ["cap", "robe", "sash"]
    }
  });
  const ids = live.sections.map((section) => section.id);
  assert.ok(ids.indexOf("cap") < ids.indexOf("robe"));
  assert.ok(ids.indexOf("robe") < ids.indexOf("sash"));
  assert.ok(keys(live, "robe").includes("robe_height"));
});

test("sanitize preserves outfit cover and per-product assignment images", () => {
  const config = sanitizeOutfitConfig({
    fullOutfits: [
      {
        id: "royal",
        name: "زي ملكي",
        enabled: true,
        productOrder: ["robe", "sash", "cap"],
        imagePath: "form/outfits/royal/cover/reference.webp",
        imageUrl: "/uploads/royal.webp",
        productImages: {
          robe: { imagePath: "form/outfits/royal/products/robe/reference.webp", imageUrl: "/uploads/robe.webp" }
        }
      }
    ],
    singleItemEnabled: true,
    singleItemProducts: ["robe", "sash", "cap"],
    productOrder: ["robe", "sash", "cap"]
  });
  assert.equal(config.fullOutfits[0]?.imagePath, "form/outfits/royal/cover/reference.webp");
  assert.equal(config.fullOutfits[0]?.imageUrl, "/uploads/royal.webp");
  assert.equal(config.fullOutfits[0]?.productImages?.robe?.imageUrl, "/uploads/robe.webp");
});

test("architecture maps outfit images onto the student outfit field", () => {
  const live = applyOutfitArchitecture({
    ...defaultWarkaFormDefinition,
    outfitConfig: {
      fullOutfits: [
        { id: "mix", name: "زي مكس", enabled: true, productOrder: ["robe", "sash", "cap"], imageUrl: "/warka/mix.webp" },
        { id: "royal", name: "زي ملكي", enabled: true, productOrder: ["robe", "sash", "cap"], imageUrl: "/warka/royal.webp" }
      ],
      singleItemEnabled: true,
      singleItemProducts: ["robe", "sash", "cap"],
      productOrder: ["robe", "sash", "cap"]
    }
  });
  const field = live.sections.flatMap((section) => section.fields).find((entry) => entry.key === "full_outfit_id");
  assert.equal(field?.showOptionImages, true);
  assert.equal(field?.options?.find((option) => option.id === "royal")?.imageUrl, "/warka/royal.webp");
});

test("outfit product images appear only for the selected full outfit", () => {
  const definition: FormDefinition = {
    ...defaultWarkaFormDefinition,
    outfitConfig: {
      fullOutfits: [
        {
          id: "royal",
          name: "زي ملكي",
          enabled: true,
          productOrder: ["robe", "sash", "cap"],
          productImages: { sash: { imageUrl: "/uploads/royal-sash.webp" } }
        }
      ],
      singleItemEnabled: true,
      singleItemProducts: ["robe", "sash", "cap"],
      productOrder: ["robe", "sash", "cap"]
    }
  };
  const full = resolveOutfitAnswers(definition, { booking_type: "full_set", full_outfit_id: "royal" });
  const single = resolveOutfitAnswers(definition, { booking_type: "single_pieces", selected_products: ["sash"] });
  assert.equal(outfitProductDisplayImage(resolveSelectedOutfit(definition, full), "sash"), "/uploads/royal-sash.webp");
  assert.equal(outfitProductDisplayImage(resolveSelectedOutfit(definition, single), "sash"), undefined);
});
