import assert from "node:assert/strict";
import test from "node:test";
import { defaultWarkaFormDefinition } from "./form-definition.ts";
import {
  catalogProductImageStorageKey,
  formOptionImageStorageKey,
  formProductImageStorageKey,
  outfitCoverImageStorageKey,
  outfitProductImageStorageKey
} from "./form-image-storage-keys.ts";
import {
  patchFormProductImage,
  patchOutfitScopedImage,
  preserveImageScopesOnConfigSave,
  scopedProductImageForOutfit
} from "./form-image-scope.ts";
import { applyOutfitArchitecture, sanitizeOutfitConfig } from "./outfit-architecture.ts";
import type { FormDefinition, OutfitConfig } from "./types.ts";

const FORM_ID = "form-audit-1";

function robeDefinition(config: OutfitConfig): FormDefinition {
  return {
    ...defaultWarkaFormDefinition,
    outfitConfig: config
  };
}

function isolationConfig(): OutfitConfig {
  return {
    fullOutfits: [
      { id: "royal", name: "زي ملكي", enabled: true, productOrder: ["robe", "sash", "cap"] },
      { id: "american", name: "زي أمريكي", enabled: true, productOrder: ["robe", "sash", "cap"] }
    ],
    singleItemEnabled: true,
    singleItemProducts: ["robe", "sash", "cap"],
    productOrder: ["robe", "sash", "cap"],
    formProductImages: {
      robe: { imagePath: "form-products/robe/a.webp", imageUrl: "/images/form-robe-A.webp" }
    }
  };
}

test("catalog, form product, outfit cover, outfit product, and option images use distinct storage keys", () => {
  const catalog = catalogProductImageStorageKey("catalog-robe-1");
  const formProduct = formProductImageStorageKey(FORM_ID, "robe");
  const royalCover = outfitCoverImageStorageKey(FORM_ID, "royal");
  const royalRobe = outfitProductImageStorageKey(FORM_ID, "royal", "robe");
  const americanRobe = outfitProductImageStorageKey(FORM_ID, "american", "robe");
  const option = formOptionImageStorageKey(FORM_ID, "robe_model", "robe-gulf");
  const keys = [catalog, formProduct, royalCover, royalRobe, americanRobe, option];
  assert.equal(new Set(keys).size, keys.length);
  assert.match(catalog, /^catalog\//);
  assert.match(formProduct, /\/form-products\/robe$/);
  assert.match(royalCover, /\/outfits\/royal\/cover$/);
  assert.match(royalRobe, /\/outfits\/royal\/products\/robe$/);
  assert.match(americanRobe, /\/outfits\/american\/products\/robe$/);
  assert.match(option, /\/robe_model\/robe-gulf$/);
  assert.ok(!formProduct.includes("/outfits/"));
  assert.ok(!royalRobe.startsWith("catalog/"));
});

test("Royal/American robe images stay isolated from Form Product image A", () => {
  let config = isolationConfig();
  config = patchOutfitScopedImage(config, "royal", "robe", {
    imagePath: "outfits/royal/robe/b.webp",
    imageUrl: "/images/royal-robe-B.webp"
  });
  config = patchOutfitScopedImage(config, "american", "robe", {
    imagePath: "outfits/american/robe/c.webp",
    imageUrl: "/images/american-robe-C.webp"
  });

  const live = applyOutfitArchitecture(robeDefinition(config));
  assert.equal(live.outfitConfig?.formProductImages?.robe?.imageUrl, "/images/form-robe-A.webp");
  assert.equal(live.outfitConfig?.fullOutfits.find((outfit) => outfit.id === "royal")?.productImages?.robe?.imageUrl, "/images/royal-robe-B.webp");
  assert.equal(live.outfitConfig?.fullOutfits.find((outfit) => outfit.id === "american")?.productImages?.robe?.imageUrl, "/images/american-robe-C.webp");
  const royal = live.outfitConfig?.fullOutfits.find((outfit) => outfit.id === "royal");
  const american = live.outfitConfig?.fullOutfits.find((outfit) => outfit.id === "american");
  assert.equal(scopedProductImageForOutfit(live, royal, "robe"), "/images/royal-robe-B.webp");
  assert.equal(scopedProductImageForOutfit(live, american, "robe"), "/images/american-robe-C.webp");
});

test("changing Royal robe image to D does not change Form Product A or American C", () => {
  let config = isolationConfig();
  config = patchOutfitScopedImage(config, "royal", "robe", { imageUrl: "/images/royal-robe-B.webp" });
  config = patchOutfitScopedImage(config, "american", "robe", { imageUrl: "/images/american-robe-C.webp" });
  config = patchOutfitScopedImage(config, "royal", "robe", { imageUrl: "/images/royal-robe-D.webp" });

  const live = applyOutfitArchitecture(robeDefinition(config));
  assert.equal(live.outfitConfig?.formProductImages?.robe?.imageUrl, "/images/form-robe-A.webp");
  assert.equal(scopedProductImageForOutfit(live, live.outfitConfig?.fullOutfits.find((outfit) => outfit.id === "royal"), "robe"), "/images/royal-robe-D.webp");
  assert.equal(scopedProductImageForOutfit(live, live.outfitConfig?.fullOutfits.find((outfit) => outfit.id === "american"), "robe"), "/images/american-robe-C.webp");
});

test("deleting Royal robe image falls back to Form Product A and leaves American C", () => {
  let config = isolationConfig();
  config = patchOutfitScopedImage(config, "royal", "robe", { imageUrl: "/images/royal-robe-D.webp" });
  config = patchOutfitScopedImage(config, "american", "robe", { imageUrl: "/images/american-robe-C.webp" });
  config = patchOutfitScopedImage(config, "royal", "robe", null);

  const live = applyOutfitArchitecture(robeDefinition(config));
  assert.equal(live.outfitConfig?.formProductImages?.robe?.imageUrl, "/images/form-robe-A.webp");
  assert.equal(live.outfitConfig?.fullOutfits.find((outfit) => outfit.id === "royal")?.productImages?.robe, undefined);
  assert.equal(scopedProductImageForOutfit(live, live.outfitConfig?.fullOutfits.find((outfit) => outfit.id === "royal"), "robe"), "/images/form-robe-A.webp");
  assert.equal(scopedProductImageForOutfit(live, live.outfitConfig?.fullOutfits.find((outfit) => outfit.id === "american"), "robe"), "/images/american-robe-C.webp");
});

test("changing Form Product image does not overwrite existing Outfit Product images", () => {
  let config = isolationConfig();
  config = patchOutfitScopedImage(config, "royal", "robe", { imageUrl: "/images/royal-robe-B.webp" });
  config = patchOutfitScopedImage(config, "american", "robe", { imageUrl: "/images/american-robe-C.webp" });
  config = patchFormProductImage(config, "robe", { imageUrl: "/images/form-robe-A2.webp" });

  const live = applyOutfitArchitecture(robeDefinition(config));
  assert.equal(live.outfitConfig?.formProductImages?.robe?.imageUrl, "/images/form-robe-A2.webp");
  assert.equal(live.outfitConfig?.fullOutfits.find((outfit) => outfit.id === "royal")?.productImages?.robe?.imageUrl, "/images/royal-robe-B.webp");
  assert.equal(live.outfitConfig?.fullOutfits.find((outfit) => outfit.id === "american")?.productImages?.robe?.imageUrl, "/images/american-robe-C.webp");
});

test("missing Form Product image falls back to Catalog Product image", () => {
  const definition: FormDefinition = {
    ...defaultWarkaFormDefinition,
    outfitConfig: {
      fullOutfits: [{ id: "royal", name: "زي ملكي", enabled: true, productOrder: ["robe"] }],
      singleItemEnabled: true,
      singleItemProducts: ["robe"],
      productOrder: ["robe", "sash", "cap"]
    },
    sections: defaultWarkaFormDefinition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) =>
        field.key === "robe_model"
          ? {
              ...field,
              options: [
                {
                  id: "catalog-robe-1",
                  label: "روب كتالوج",
                  value: "catalog-robe-1",
                  catalogProductId: "catalog-robe-1",
                  imageUrl: "/images/catalog-robe.webp",
                  imagePath: "catalog/catalog-robe-1/reference.webp"
                },
                ...(field.options ?? [])
              ]
            }
          : field
      )
    }))
  };
  const live = applyOutfitArchitecture(definition);
  const royal = live.outfitConfig?.fullOutfits[0];
  assert.equal(scopedProductImageForOutfit(live, royal, "robe"), "/images/catalog-robe.webp");
});

test("outfit cover image stays separate from outfit product and form product images", () => {
  let config = isolationConfig();
  config = patchOutfitScopedImage(config, "royal", undefined, { imageUrl: "/images/royal-cover.webp" });
  config = patchOutfitScopedImage(config, "royal", "robe", { imageUrl: "/images/royal-robe-B.webp" });
  const royal = sanitizeOutfitConfig(config).fullOutfits.find((outfit) => outfit.id === "royal");
  assert.equal(royal?.imageUrl, "/images/royal-cover.webp");
  assert.equal(royal?.productImages?.robe?.imageUrl, "/images/royal-robe-B.webp");
  assert.equal(config.formProductImages?.robe?.imageUrl, "/images/form-robe-A.webp");
});

test("saving outfit settings without images does not wipe Form or Outfit Product images", () => {
  const existing = sanitizeOutfitConfig(isolationConfig());
  const withOverrides = patchOutfitScopedImage(
    patchOutfitScopedImage(existing, "royal", "robe", { imageUrl: "/images/royal-robe-B.webp" }),
    "american",
    "robe",
    { imageUrl: "/images/american-robe-C.webp" }
  );
  const incoming: OutfitConfig = {
    ...withOverrides,
    formProductImages: undefined,
    fullOutfits: withOverrides.fullOutfits.map((outfit) => ({
      ...outfit,
      imagePath: undefined,
      imageUrl: undefined,
      productImages: undefined,
      name: outfit.id === "royal" ? "زي ملكي محدث" : outfit.name
    }))
  };
  const saved = preserveImageScopesOnConfigSave(withOverrides, incoming);
  assert.equal(saved.formProductImages?.robe?.imageUrl, "/images/form-robe-A.webp");
  assert.equal(saved.fullOutfits.find((outfit) => outfit.id === "royal")?.name, "زي ملكي محدث");
  assert.equal(saved.fullOutfits.find((outfit) => outfit.id === "royal")?.productImages?.robe?.imageUrl, "/images/royal-robe-B.webp");
  assert.equal(saved.fullOutfits.find((outfit) => outfit.id === "american")?.productImages?.robe?.imageUrl, "/images/american-robe-C.webp");
});

test("disabling a Form Product does not delete unrelated Outfit Product images", () => {
  const config = patchOutfitScopedImage(isolationConfig(), "royal", "robe", { imageUrl: "/images/royal-robe-B.webp" });
  const sanitized = sanitizeOutfitConfig(config, ["sash", "cap"]);
  assert.equal(sanitized.formProductImages?.robe?.imageUrl, "/images/form-robe-A.webp");
  assert.equal(sanitized.fullOutfits.find((outfit) => outfit.id === "royal")?.productImages?.robe?.imageUrl, "/images/royal-robe-B.webp");
});
