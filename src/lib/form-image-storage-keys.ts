import { stableStorageSegment } from "./storage-path.ts";

export function catalogProductImageStorageKey(productId: string) {
  return `catalog/${stableStorageSegment(productId)}`;
}

export function formProductImageStorageKey(formId: string, productId: string) {
  return `${stableStorageSegment(formId)}/form-products/${stableStorageSegment(productId)}`;
}

export function outfitCoverImageStorageKey(formId: string, outfitId: string) {
  return `${stableStorageSegment(formId)}/outfits/${stableStorageSegment(outfitId)}/cover`;
}

export function outfitProductImageStorageKey(formId: string, outfitId: string, productId: string) {
  return `${stableStorageSegment(formId)}/outfits/${stableStorageSegment(outfitId)}/products/${stableStorageSegment(productId)}`;
}

export function formOptionImageStorageKey(formId: string, fieldKey: string, optionId: string) {
  return `${stableStorageSegment(formId)}/${stableStorageSegment(fieldKey)}/${stableStorageSegment(optionId)}`;
}
