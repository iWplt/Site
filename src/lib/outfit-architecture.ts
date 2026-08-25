import { fieldIsVisible } from "./form-definition.ts";
import { isMultiSelectField } from "./form-selection.ts";
import { optionVisibleForBooking } from "./product-catalog.ts";
import { reconcileAllowedOptionValues } from "./form-option-identity.ts";
import type {
  BookingMode,
  CatalogFormAssignment,
  ConditionalRule,
  CoreProductId,
  FormDefinition,
  FormField,
  FormOption,
  FormSection,
  FullOutfit,
  OutfitConfig,
  OutfitProductSettings
} from "./types";

export const CORE_PRODUCT_IDS: CoreProductId[] = ["robe", "sash", "cap"];

export const CORE_PRODUCT_LABELS: Record<CoreProductId, string> = {
  robe: "الروب",
  sash: "الوشاح",
  cap: "القبعة"
};

export const PRODUCT_MODEL_KEYS: Record<CoreProductId, string> = {
  robe: "robe_model",
  sash: "sash_type",
  cap: "cap_type"
};

export const CHILD_SECTION_PARENTS: Record<string, CoreProductId> = {
  robe_additions: "robe",
  sash_embroidery: "sash"
};

export const PRODUCT_SECTION_IDS: Record<CoreProductId, string[]> = {
  robe: ["robe", "robe_additions"],
  sash: ["sash", "sash_embroidery"],
  cap: ["cap"]
};

export const ROBE_CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;

const imageUploadDefaults: Pick<FormField, "accept" | "maxSizeMb"> = {
  accept: ["image/jpeg", "image/png", "image/webp"],
  maxSizeMb: 8
};

const productSelected = (product: CoreProductId): ConditionalRule => ({
  fieldKey: "selected_products",
  operator: "includes",
  value: product
});

export function defaultOutfitConfig(): OutfitConfig {
  return {
    fullOutfits: [
      {
        id: "mix",
        name: "زي مكس",
        description: "روب + وشاح + قبعة مع كامل خيارات التخصيص.",
        enabled: true,
        productOrder: [...CORE_PRODUCT_IDS]
      }
    ],
    singleItemEnabled: true,
    singleItemProducts: [...CORE_PRODUCT_IDS],
    productOrder: [...CORE_PRODUCT_IDS]
  };
}

export function ensureCoreProductOrder(order?: string[] | null): CoreProductId[] {
  const requested = (order ?? []).filter((id): id is CoreProductId => CORE_PRODUCT_IDS.includes(id as CoreProductId));
  return [...requested, ...CORE_PRODUCT_IDS.filter((id) => !requested.includes(id))];
}

export function formEnabledCoreProducts(definition: FormDefinition): CoreProductId[] {
  const fields = definition.sections.flatMap((section) => section.fields);
  return CORE_PRODUCT_IDS.filter((product) => {
    const field = fields.find((entry) => entry.key === PRODUCT_MODEL_KEYS[product]);
    if (!field) return true;
    const options = field.options ?? [];
    if (!options.length) return true;
    return options.some((option) => option.enabled !== false);
  });
}

export function constrainToEnabledProducts(order: string[] | null | undefined, enabled: CoreProductId[]): CoreProductId[] {
  return (order ?? []).filter((id): id is CoreProductId => enabled.includes(id as CoreProductId));
}

function membershipFromFormProducts(order: string[] | null | undefined, enabled: CoreProductId[]): CoreProductId[] {
  const constrained = constrainToEnabledProducts(order, enabled);
  if (constrained.length) return constrained;
  if (order?.length) return [];
  return [...enabled];
}

export function liveOutfitConfig(definition: FormDefinition): OutfitConfig {
  return sanitizeOutfitConfig(definition.outfitConfig, formEnabledCoreProducts(definition));
}

export function sanitizeOutfitConfig(raw?: OutfitConfig | null, enabledProducts?: CoreProductId[] | null): OutfitConfig {
  const fallback = defaultOutfitConfig();
  const enabled = enabledProducts == null ? [...CORE_PRODUCT_IDS] : enabledProducts.filter((id) => CORE_PRODUCT_IDS.includes(id));
  const productOrder = ensureCoreProductOrder(raw?.productOrder);
  const requestedSingle = raw?.singleItemProducts?.length ? raw.singleItemProducts : enabled;
  const singleItemProducts = constrainToEnabledProducts(requestedSingle, enabled);
  const outfits = (raw?.fullOutfits?.length ? raw.fullOutfits : fallback.fullOutfits)
    .map((outfit, index) => sanitizeFullOutfit(outfit, index, productOrder, enabled))
    .filter((outfit): outfit is FullOutfit => Boolean(outfit));

  return {
    fullOutfits: outfits.length ? outfits : fallback.fullOutfits.map((outfit) => sanitizeFullOutfit(outfit, 0, productOrder, enabled)!),
    singleItemEnabled: raw?.singleItemEnabled !== false,
    singleItemProducts: singleItemProducts.length ? singleItemProducts : [...enabled],
    productOrder,
    catalogAssignments: sanitizeCatalogAssignments(raw?.catalogAssignments),
    // Keep Form Product images even when a core product is temporarily disabled.
    formProductImages: sanitizeProductImages(raw?.formProductImages)
  };
}

export function normalizeCatalogAssignment(raw?: Partial<CatalogFormAssignment> | null): CatalogFormAssignment {
  const modes = (raw?.bookingModes ?? ["full_set", "single_pieces"]).filter(
    (mode): mode is BookingMode => mode === "full_set" || mode === "single_pieces"
  );
  return {
    bookingModes: modes.length ? modes : ["full_set", "single_pieces"],
    sortOrder: Number.isFinite(raw?.sortOrder) ? Number(raw?.sortOrder) : undefined,
    hidden: Boolean(raw?.hidden)
  };
}

function sanitizeCatalogAssignments(raw?: Record<string, CatalogFormAssignment | undefined>) {
  if (!raw) return undefined;
  const next: NonNullable<OutfitConfig["catalogAssignments"]> = {};
  for (const [productId, assignment] of Object.entries(raw)) {
    if (!productId.trim() || !assignment) continue;
    next[productId] = normalizeCatalogAssignment(assignment);
  }
  return Object.keys(next).length ? next : undefined;
}

function sanitizeProductImages(raw?: FullOutfit["productImages"]): FullOutfit["productImages"] {
  if (!raw) return undefined;
  const next: NonNullable<FullOutfit["productImages"]> = {};
  for (const id of CORE_PRODUCT_IDS) {
    const entry = raw[id];
    if (!entry) continue;
    const imagePath = entry.imagePath?.trim() || undefined;
    const imageUrl = entry.imageUrl?.trim() || undefined;
    if (!imagePath && !imageUrl) continue;
    next[id] = { imagePath, imageUrl };
  }
  return Object.keys(next).length ? next : undefined;
}

function sanitizeProductSettings(
  raw: FullOutfit["productSettings"],
  activeOrder: CoreProductId[]
): FullOutfit["productSettings"] {
  if (!raw) return undefined;
  // Preserve settings for active membership and for valid core keys that may be
  // temporarily reconciled out of productOrder when a Form Product is disabled.
  const keepKeys = new Set<CoreProductId>([
    ...activeOrder,
    ...CORE_PRODUCT_IDS.filter((id) => Boolean(raw[id]))
  ]);
  const next: NonNullable<FullOutfit["productSettings"]> = {};
  for (const productId of keepKeys) {
    const entry = raw[productId];
    if (!entry) continue;
    const allowedOptions: NonNullable<OutfitProductSettings["allowedOptions"]> = {};
    for (const [fieldKey, values] of Object.entries(entry.allowedOptions ?? {})) {
      const cleaned = [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))];
      if (cleaned.length) allowedOptions[fieldKey] = cleaned;
    }
    const hiddenFields = [...new Set((entry.hiddenFields ?? []).map((value) => String(value).trim()).filter(Boolean))];
    if (Object.keys(allowedOptions).length || hiddenFields.length) {
      next[productId] = {
        allowedOptions: Object.keys(allowedOptions).length ? allowedOptions : undefined,
        hiddenFields: hiddenFields.length ? hiddenFields : undefined
      };
    }
  }
  return Object.keys(next).length ? next : undefined;
}

function sanitizeFullOutfit(
  outfit: FullOutfit,
  index: number,
  fallbackOrder: CoreProductId[],
  enabled: CoreProductId[]
): FullOutfit | null {
  const name = outfit.name?.trim();
  if (!name) return null;
  const requested = (outfit.productOrder ?? fallbackOrder).filter((id): id is CoreProductId =>
    CORE_PRODUCT_IDS.includes(id as CoreProductId)
  );
  const productOrder = membershipFromFormProducts(requested.length ? requested : fallbackOrder, enabled);
  return {
    id: outfit.id?.trim() || `outfit-${index + 1}`,
    name,
    description: outfit.description?.trim() || undefined,
    imageUrl: outfit.imageUrl?.trim() || undefined,
    imagePath: outfit.imagePath?.trim() || undefined,
    enabled: outfit.enabled !== false,
    productOrder,
    productImages: sanitizeProductImages(outfit.productImages),
    productSettings: sanitizeProductSettings(outfit.productSettings, productOrder)
  };
}

/** Reconcile outfit allowed options against the current Form Product option lists (merged definition). */
export function reconcileOutfitConfigAgainstForm(definition: FormDefinition, config: OutfitConfig): OutfitConfig {
  const enabled = formEnabledCoreProducts(definition);
  const base = sanitizeOutfitConfig(config, enabled);
  return {
    ...base,
    fullOutfits: base.fullOutfits.map((outfit) => ({
      ...outfit,
      productSettings: (() => {
        if (!outfit.productSettings) return undefined;
        const next: NonNullable<FullOutfit["productSettings"]> = {};
        for (const [productId, entry] of Object.entries(outfit.productSettings) as Array<
          [CoreProductId, NonNullable<FullOutfit["productSettings"]>[CoreProductId]]
        >) {
          if (!entry) continue;
          const allowedOptions = reconcileAllowedOptionValues(definition, entry.allowedOptions);
          const hiddenFields = (entry.hiddenFields ?? []).filter((key) =>
            definition.sections.some((section) => section.fields.some((field) => field.key === key))
          );
          if (allowedOptions || hiddenFields.length) {
            next[productId] = {
              allowedOptions,
              hiddenFields: hiddenFields.length ? hiddenFields : undefined
            };
          }
        }
        return Object.keys(next).length ? next : undefined;
      })()
    }))
  };
}

export function enabledFullOutfits(config: OutfitConfig) {
  const live = config.fullOutfits.filter((outfit) => outfit.enabled !== false);
  return live.length ? live : config.fullOutfits.slice(0, 1);
}

export function resolveSelectedOutfit(definition: FormDefinition, answers: Record<string, unknown>) {
  const config = liveOutfitConfig(definition);
  const outfits = enabledFullOutfits(config);
  if (String(answers.booking_type) === "single_pieces" && config.singleItemEnabled) return undefined;
  return outfits.find((outfit) => outfit.id === answers.full_outfit_id) ?? outfits[0];
}

export function outfitProductDisplayImage(outfit: FullOutfit | undefined, productId: string) {
  if (!outfit || !CORE_PRODUCT_IDS.includes(productId as CoreProductId)) return undefined;
  return outfit.productImages?.[productId as CoreProductId]?.imageUrl;
}

export function coreProductForFieldKey(fieldKey: string): CoreProductId | undefined {
  if (Object.values(PRODUCT_MODEL_KEYS).includes(fieldKey)) {
    return (Object.entries(PRODUCT_MODEL_KEYS).find(([, key]) => key === fieldKey)?.[0] ?? undefined) as CoreProductId | undefined;
  }
  if (fieldKey.startsWith("robe_")) return "robe";
  if (fieldKey.startsWith("sash_") || fieldKey.includes("embroidery")) return "sash";
  if (fieldKey.startsWith("cap_")) return "cap";
  return undefined;
}

function flattenOptionValues(options: FormOption[]): Set<string> {
  const values = new Set<string>();
  for (const option of options) {
    if (option.enabled === false) continue;
    values.add(option.value);
    for (const child of option.children ?? []) {
      if (child.enabled !== false) values.add(child.value);
    }
  }
  return values;
}

function filterOptionsByAllowed(options: FormOption[], allowed: string[]): FormOption[] {
  const allowedSet = new Set(allowed);
  return options
    .map((option) => {
      if (option.enabled === false) return null;
      const children = (option.children ?? []).filter((child) => child.enabled !== false && allowedSet.has(child.value));
      if (children.length) return { ...option, children };
      if (allowedSet.has(option.value)) return { ...option, children: undefined };
      return null;
    })
    .filter((option): option is FormOption => Boolean(option));
}

/** Booking-context option list: form options filtered by booking mode and, for full outfits, outfit membership settings. */
export function optionsForBookingContext(
  field: FormField,
  definition: FormDefinition,
  answers: Record<string, unknown>
): FormOption[] {
  const base = (field.options ?? []).filter((option) => option.enabled !== false);
  const options = base.filter((option) => optionVisibleForBooking(option, answers.booking_type));
  if (String(answers.booking_type) === "single_pieces") return options;

  const outfit = resolveSelectedOutfit(definition, answers);
  if (!outfit?.productSettings) return options;

  const productId = coreProductForFieldKey(field.key);
  if (!productId) return options;

  const allowed = outfit.productSettings[productId]?.allowedOptions?.[field.key];
  if (!allowed?.length) return options;
  return filterOptionsByAllowed(options, allowed);
}

export function optionValuesForBookingContext(
  field: FormField,
  definition: FormDefinition,
  answers: Record<string, unknown>
): Set<string> {
  return flattenOptionValues(optionsForBookingContext(field, definition, answers));
}

/** Full-outfit field visibility includes outfit-specific customization hiding. Single Item uses form config only. */
export function fieldVisibleForBookingContext(
  field: FormField,
  definition: FormDefinition,
  answers: Record<string, unknown>
): boolean {
  if (!fieldIsVisible(field, answers)) return false;
  if (String(answers.booking_type) === "single_pieces") return true;

  const outfit = resolveSelectedOutfit(definition, answers);
  if (!outfit?.productSettings) return true;

  const productId = coreProductForFieldKey(field.key);
  if (!productId) return true;

  const hidden = outfit.productSettings[productId]?.hiddenFields ?? [];
  return !hidden.includes(field.key);
}

const ARCHITECTURE_ANSWER_KEYS = new Set([
  "booking_type",
  "full_outfit_id",
  "selected_products",
  "student_name",
  "phone",
  "address"
]);

function pruneInvalidChoiceAnswers(definition: FormDefinition, answers: Record<string, unknown>) {
  const next = { ...answers };
  for (const section of definition.sections) {
    for (const field of section.fields) {
      if (ARCHITECTURE_ANSWER_KEYS.has(field.key)) {
        if (!["radio", "select", "image_choice", "checkbox"].includes(field.type)) continue;
        if (!fieldVisibleForBookingContext(field, definition, next)) continue;
      } else if (!fieldVisibleForBookingContext(field, definition, next)) {
        delete next[field.key];
        continue;
      }
      if (!["radio", "select", "image_choice", "checkbox"].includes(field.type)) continue;
      const value = next[field.key];
      if (isBlankValue(value)) continue;
      const allowed = optionValuesForBookingContext(field, definition, next);
      const selected = asStringList(value).filter((entry) => allowed.has(entry));
      if (!selected.length) {
        delete next[field.key];
        continue;
      }
      // Must use isMultiSelectField so selectionMode:"multiple" on image_choice/radio
      // is never collapsed back to a single string (that bug made the student UI look single-select).
      next[field.key] = isMultiSelectField(field) ? selected : selected[0];
    }
  }
  return next;
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function isBlankValue(value: unknown) {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

export function resolveOutfitAnswers(definition: FormDefinition, answers: Record<string, unknown>) {
  const config = liveOutfitConfig(definition);
  const next = { ...answers };
  const bookingType = String(next.booking_type ?? "full_set");
  const outfits = enabledFullOutfits(config);

  if (bookingType !== "single_pieces" || !config.singleItemEnabled) {
    next.booking_type = bookingType === "single_pieces" && !config.singleItemEnabled ? "full_set" : bookingType || "full_set";
    if (next.booking_type !== "single_pieces") {
      const outfit =
        outfits.find((entry) => entry.id === next.full_outfit_id) ?? outfits[0];
      if (outfit) {
        next.full_outfit_id = outfit.id;
        next.selected_products = outfit.productOrder ?? config.productOrder;
      } else {
        next.selected_products = config.productOrder;
      }
    }
  } else {
    const selected = asStringList(next.selected_products).filter((id) =>
      config.singleItemProducts.includes(id as CoreProductId)
    );
    next.selected_products = selected;
    delete next.full_outfit_id;
  }

  return pruneInvalidChoiceAnswers(definition, next);
}

export function productIsSelected(answers: Record<string, unknown>, product: CoreProductId) {
  return asStringList(answers.selected_products).includes(product);
}

export function isSingleItemBooking(definition: FormDefinition, answers: Record<string, unknown>) {
  const config = liveOutfitConfig(definition);
  return String(answers.booking_type) === "single_pieces" && config.singleItemEnabled;
}

/**
 * Runtime upgrade for stored JSON definitions:
 * merge child product sections, inject global robe measurements and
 * per-product color/notes/reference fields, apply outfit visibility.
 * Field keys are never renamed.
 */
export function applyOutfitArchitecture(definition: FormDefinition): FormDefinition {
  const config = liveOutfitConfig(definition);
  const sections = definition.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => ({ ...field, options: field.options ? field.options.map((option) => ({ ...option, children: option.children ? [...option.children] : option.children })) : field.options }))
  }));

  mergeChildSections(sections);
  ensureBookingFields(sections, config);
  ensureProductCustomFields(sections);
  applyProductConditionals(sections);
  const ordered = orderCoreSections(sections, config.productOrder);

  return {
    ...definition,
    outfitConfig: config,
    sections: ordered
  };
}

function mergeChildSections(sections: FormSection[]) {
  const byId = new Map(sections.map((section) => [section.id, section]));
  for (const [childId, parentId] of Object.entries(CHILD_SECTION_PARENTS)) {
    const child = byId.get(childId);
    const parent = byId.get(parentId);
    if (!child || !parent || child === parent) continue;
    for (const field of child.fields) {
      if (!parent.fields.some((entry) => entry.key === field.key)) {
        parent.fields.push(field);
      }
    }
    child.fields = [];
  }
}

function ensureBookingFields(sections: FormSection[], config: OutfitConfig) {
  const booking = sections.find((section) => section.id === "booking");
  if (!booking) return;

  const outfits = enabledFullOutfits(config);
  upsertField(booking, {
    id: "selected_products",
    key: "selected_products",
    label: "القطع المطلوبة",
    type: "checkbox",
    required: true,
    description: "للحجز المفرد فقط. اختر من المنتجات التي سمحت بها الإدارة. الزي الكامل لا يتيح إضافة أو حذف قطع.",
    options: config.singleItemProducts.map((id) => ({
      id: `product-${id}`,
      label: CORE_PRODUCT_LABELS[id],
      value: id
    })),
    conditional: [{ fieldKey: "booking_type", operator: "equals", value: "single_pieces" }]
  });

  const hasOutfitImages = outfits.some((outfit) => Boolean(outfit.imageUrl));
  upsertField(booking, {
    id: "full_outfit_id",
    key: "full_outfit_id",
    label: "اختيار الزي",
    type: outfits.length > 1 || hasOutfitImages ? (hasOutfitImages ? "image_choice" : "radio") : "read_only",
    required: outfits.length > 1,
    defaultValue: outfits[0]?.id,
    description:
      outfits.length > 1
        ? "اختر زياً واحداً. المنتجات مشمولة تلقائياً حسب هذا الزي ولا يمكن إضافة أو حذف أو استبدال القطع."
        : "المنتجات مشمولة تلقائياً حسب إعداد هذا الزي. خصّص كل قطعة في الخطوات التالية دون إضافة أو حذف أو استبدال منتجات.",
    showOptionImages: hasOutfitImages,
    options: outfits.map((outfit) => ({
      id: outfit.id,
      label: outfit.name,
      value: outfit.id,
      description: outfit.description,
      imageUrl: outfit.imageUrl,
      imagePath: outfit.imagePath
    })),
    conditional:
      outfits.length > 1 || hasOutfitImages
        ? [{ fieldKey: "booking_type", operator: "equals", value: "full_set" }]
        : [{ fieldKey: "booking_type", operator: "equals", value: "__hidden__" }]
  });

  const bookingType = booking.fields.find((field) => field.key === "booking_type");
  if (bookingType?.options) {
    bookingType.options = bookingType.options.filter((option) =>
      option.value === "full_set" || (option.value === "single_pieces" && config.singleItemEnabled)
    );
    if (!config.singleItemEnabled) {
      bookingType.defaultValue = "full_set";
    }
  }
}

function ensureProductCustomFields(sections: FormSection[]) {
  const robe = sections.find((section) => section.id === "robe");
  const sash = sections.find((section) => section.id === "sash");
  const cap = sections.find((section) => section.id === "cap");

  if (robe) {
    upsertField(robe, robeHeightField(), "robe_addition_image");
    upsertField(robe, robeSizeField(), "robe_height");
    upsertField(robe, colorField("robe", "اللون المطلوب للروب"), "robe_clothing_size");
    upsertField(robe, colorImageField("robe", "صور مرجعية للون الروب"), "robe_color");
    upsertField(robe, notesField("robe", "ملاحظات الطالب على الروب"), "robe_color_images");
  }
  if (sash) {
    upsertField(sash, colorField("sash", "اللون المطلوب للوشاح"), "year_side_image");
    upsertField(sash, colorImageField("sash", "صور مرجعية للون الوشاح"), "sash_color");
    upsertField(sash, notesField("sash", "ملاحظات الطالب على الوشاح"), "sash_color_images");
  }
  if (cap) {
    upsertField(cap, colorField("cap", "اللون المطلوب للقبعة"), "cap_top_image");
    upsertField(cap, colorImageField("cap", "صور مرجعية للون القبعة"), "cap_color");
    upsertField(cap, notesField("cap", "ملاحظات الطالب على القبعة"), "cap_color_images");
  }
}

function robeHeightField(): FormField {
  return {
    id: "robe_height",
    key: "robe_height",
    label: "الطول",
    type: "number",
    required: true,
    placeholder: "175",
    description: "أدخل الطول بالسنتيمتر. مثال: 175 سم.",
    conditional: [productSelected("robe")]
  };
}

function robeSizeField(): FormField {
  return {
    id: "robe_clothing_size",
    key: "robe_clothing_size",
    label: "مقاس اللبس",
    type: "select",
    required: true,
    description: "قياسات الروب عامة لكل الحجوزات التي تتضمن روب.",
    options: ROBE_CLOTHING_SIZES.map((size) => ({
      id: `robe-size-${size.toLowerCase()}`,
      label: size,
      value: size
    })),
    conditional: [productSelected("robe")]
  };
}

function colorField(product: CoreProductId, label: string): FormField {
  return {
    id: `${product}_color`,
    key: `${product}_color`,
    label,
    type: "short_text",
    placeholder: "مثال: أريد اللون قريب من هذه الصورة، ويكون أغمق بدرجة بسيطة.",
    description: "اكتب اللون أو الخامة أو الستايل المطلوب.",
    conditional: [productSelected(product)]
  };
}

function colorImageField(product: CoreProductId, label: string): FormField {
  return {
    ...imageUploadDefaults,
    id: `${product}_color_images`,
    key: `${product}_color_images`,
    label,
    type: "image_upload",
    uploadMode: "multiple",
    maxFiles: 3,
    description: "ارفع صوراً مرجعية للون أو الشكل المطلوب.",
    conditional: [productSelected(product)]
  };
}

function notesField(product: CoreProductId, label: string): FormField {
  return {
    id: `${product}_notes`,
    key: `${product}_notes`,
    label,
    type: "long_text",
    placeholder: "أي تفاصيل إضافية: موضع التطريز، الشكل، أو طلب خاص.",
    description: "ملاحظات هذا المنتج فقط، وليست ملاحظة عامة لكل الطلب.",
    conditional: [productSelected(product)]
  };
}

function applyProductConditionals(sections: FormSection[]) {
  for (const [product, sectionIds] of Object.entries(PRODUCT_SECTION_IDS) as Array<[CoreProductId, string[]]>) {
    const rule = productSelected(product);
    for (const section of sections) {
      if (!sectionIds.includes(section.id) && section.id !== product) continue;
      section.fields = section.fields.map((field) => {
        if (field.key === "selected_products" || field.key === "full_outfit_id" || field.key === "booking_type") {
          return field;
        }
        return ensureConditionals(field, [rule]);
      });
    }
  }
}

function orderCoreSections(sections: FormSection[], productOrder: CoreProductId[]) {
  const kept = sections.filter((section) => section.fields.length > 0);
  const byId = new Map(kept.map((section) => [section.id, section]));
  const used = new Set<string>(["student", "booking", ...CORE_PRODUCT_IDS]);
  const head = ["student", "booking"].map((id) => byId.get(id)).filter((section): section is FormSection => Boolean(section));
  const cores = productOrder.map((id) => byId.get(id)).filter((section): section is FormSection => Boolean(section));
  const rest = kept.filter((section) => !used.has(section.id));
  return [...head, ...cores, ...rest];
}

function upsertField(section: FormSection, field: FormField, afterKey?: string) {
  const index = section.fields.findIndex((entry) => entry.key === field.key);
  if (index >= 0) {
    const existing = section.fields[index];
    if (field.key === "selected_products" || field.key === "full_outfit_id") {
      section.fields[index] = {
        ...existing,
        type: field.type,
        required: field.required,
        options: field.options,
        defaultValue: field.defaultValue ?? existing.defaultValue,
        description: field.description,
        showOptionImages: field.showOptionImages,
        conditional: field.conditional
      };
      return;
    }
    section.fields[index] = ensureConditionals(
      {
        ...field,
        ...existing,
        key: existing.key,
        id: existing.id || field.id,
        type: existing.type || field.type,
        options: existing.options?.length ? existing.options : field.options,
        conditional: existing.conditional ?? field.conditional
      },
      field.conditional
    );
    return;
  }
  const after = afterKey ? section.fields.findIndex((entry) => entry.key === afterKey) : -1;
  if (after >= 0) section.fields.splice(after + 1, 0, field);
  else section.fields.push(field);
}

function sameConditional(a: ConditionalRule | undefined, b: ConditionalRule) {
  return a?.fieldKey === b.fieldKey && a?.operator === b.operator && a?.value === b.value;
}

function ensureConditionals(field: FormField, required?: ConditionalRule[]): FormField {
  if (!required?.length) return field;
  const existing = field.conditional ?? [];
  const merged = [...existing];
  for (const rule of required) {
    if (!merged.some((entry) => sameConditional(entry, rule))) merged.push(rule);
  }
  return { ...field, conditional: merged };
}
