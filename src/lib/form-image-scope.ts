import { CORE_PRODUCT_IDS, PRODUCT_MODEL_KEYS, sanitizeOutfitConfig } from "./outfit-architecture.ts";
import type {
  CoreProductId,
  FormDefinition,
  FullOutfit,
  OutfitConfig,
  OutfitProductImage
} from "./types.ts";

export type ImageRef = {
  imagePath?: string;
  imageUrl?: string;
};

function imageDisplayUrl(image?: ImageRef | null) {
  const url = image?.imageUrl?.trim();
  if (url) return url;
  const path = image?.imagePath?.trim();
  return path || undefined;
}

export function resolveScopedProductImage(layers: {
  outfitProduct?: ImageRef | null;
  formProduct?: ImageRef | null;
  catalogProduct?: ImageRef | null;
}) {
  return imageDisplayUrl(layers.outfitProduct) || imageDisplayUrl(layers.formProduct) || imageDisplayUrl(layers.catalogProduct);
}

export function catalogFallbackImageForProduct(definition: FormDefinition, productId: CoreProductId): ImageRef | undefined {
  const fieldKey = PRODUCT_MODEL_KEYS[productId];
  const field = definition.sections.flatMap((section) => section.fields).find((entry) => entry.key === fieldKey);
  const catalogOption = field?.options?.find((option) => option.catalogProductId && (option.imageUrl || option.imagePath));
  if (catalogOption) return { imagePath: catalogOption.imagePath, imageUrl: catalogOption.imageUrl };
  const anyOption = field?.options?.find((option) => option.imageUrl || option.imagePath);
  if (anyOption?.catalogProductId) return { imagePath: anyOption.imagePath, imageUrl: anyOption.imageUrl };
  return undefined;
}

export function formProductDisplayImage(definition: FormDefinition, productId: string) {
  if (!CORE_PRODUCT_IDS.includes(productId as CoreProductId)) return undefined;
  const coreId = productId as CoreProductId;
  return resolveScopedProductImage({
    formProduct: definition.outfitConfig?.formProductImages?.[coreId],
    catalogProduct: catalogFallbackImageForProduct(definition, coreId)
  });
}

export function scopedProductImageForOutfit(
  definition: FormDefinition,
  outfit: FullOutfit | undefined,
  productId: string
) {
  if (!CORE_PRODUCT_IDS.includes(productId as CoreProductId)) return undefined;
  const coreId = productId as CoreProductId;
  return resolveScopedProductImage({
    outfitProduct: outfit?.productImages?.[coreId],
    formProduct: definition.outfitConfig?.formProductImages?.[coreId],
    catalogProduct: catalogFallbackImageForProduct(definition, coreId)
  });
}

function sanitizeImageRef(image: OutfitProductImage | null | undefined): OutfitProductImage | undefined {
  if (!image) return undefined;
  const imagePath = image.imagePath?.trim() || undefined;
  const imageUrl = image.imageUrl?.trim() || undefined;
  if (!imagePath && !imageUrl) return undefined;
  return { imagePath, imageUrl };
}

export function patchFormProductImage(
  config: OutfitConfig,
  productId: CoreProductId,
  image: OutfitProductImage | null
): OutfitConfig {
  const formProductImages = { ...(config.formProductImages ?? {}) };
  const next = sanitizeImageRef(image);
  if (!next) delete formProductImages[productId];
  else formProductImages[productId] = next;
  return sanitizeOutfitConfig({
    ...config,
    formProductImages: Object.keys(formProductImages).length ? formProductImages : undefined
  });
}

export function patchOutfitScopedImage(
  config: OutfitConfig,
  outfitId: string,
  productId: CoreProductId | undefined,
  image: OutfitProductImage | null
): OutfitConfig {
  const nextImage = sanitizeImageRef(image);
  return sanitizeOutfitConfig({
    ...config,
    fullOutfits: config.fullOutfits.map((outfit) => {
      if (outfit.id !== outfitId) return outfit;
      if (!productId) return { ...outfit, imagePath: nextImage?.imagePath, imageUrl: nextImage?.imageUrl };
      const productImages = { ...(outfit.productImages ?? {}) };
      if (!nextImage) delete productImages[productId];
      else productImages[productId] = nextImage;
      return { ...outfit, productImages: Object.keys(productImages).length ? productImages : undefined };
    })
  });
}

/** Config saves (name/order/settings) must never clobber independently stored image scopes. */
export function preserveImageScopesOnConfigSave(existing: OutfitConfig, incoming: OutfitConfig): OutfitConfig {
  const previous = sanitizeOutfitConfig(existing);
  const next = sanitizeOutfitConfig(incoming);
  const previousById = new Map(previous.fullOutfits.map((outfit) => [outfit.id, outfit]));
  return sanitizeOutfitConfig({
    ...next,
    formProductImages: previous.formProductImages,
    fullOutfits: next.fullOutfits.map((outfit) => {
      const prior = previousById.get(outfit.id);
      if (!prior) return outfit;
      return {
        ...outfit,
        imagePath: prior.imagePath,
        imageUrl: prior.imageUrl,
        productImages: prior.productImages
      };
    })
  });
}
