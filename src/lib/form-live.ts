import { normalizeFormCustomizationGrouping } from "@/lib/form-customization";
import { applyOutfitArchitecture } from "@/lib/outfit-architecture";
import type { FormDefinition } from "@/lib/types";

/** Group customizations, then apply outfit/product architecture. Idempotent. */
export function normalizeLiveFormDefinition(definition: FormDefinition): FormDefinition {
  return applyOutfitArchitecture(normalizeFormCustomizationGrouping(definition));
}
