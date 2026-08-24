import type {
  ConditionalRule,
  CoreProductId,
  FormDefinition,
  FormField,
  FormSection,
  FullOutfit,
  OutfitConfig
} from "./types";

export const CORE_PRODUCT_IDS: CoreProductId[] = ["robe", "sash", "cap"];

export const CORE_PRODUCT_LABELS: Record<CoreProductId, string> = {
  robe: "الروب",
  sash: "الوشاح",
  cap: "القبعة"
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

export function sanitizeOutfitConfig(raw?: OutfitConfig | null): OutfitConfig {
  const fallback = defaultOutfitConfig();
  const productOrder = ensureCoreProductOrder(raw?.productOrder);
  const singleItemProducts = ensureCoreProductOrder(raw?.singleItemProducts ?? productOrder).filter((id) =>
    (raw?.singleItemProducts?.length ? raw.singleItemProducts : CORE_PRODUCT_IDS).includes(id)
  );
  const outfits = (raw?.fullOutfits?.length ? raw.fullOutfits : fallback.fullOutfits)
    .map((outfit, index) => sanitizeFullOutfit(outfit, index, productOrder))
    .filter((outfit): outfit is FullOutfit => Boolean(outfit));

  return {
    fullOutfits: outfits.length ? outfits : fallback.fullOutfits,
    singleItemEnabled: raw?.singleItemEnabled !== false,
    singleItemProducts: singleItemProducts.length ? singleItemProducts : [...CORE_PRODUCT_IDS],
    productOrder
  };
}

function sanitizeFullOutfit(outfit: FullOutfit, index: number, fallbackOrder: CoreProductId[]): FullOutfit | null {
  const name = outfit.name?.trim();
  if (!name) return null;
  return {
    id: outfit.id?.trim() || `outfit-${index + 1}`,
    name,
    description: outfit.description?.trim() || undefined,
    imageUrl: outfit.imageUrl?.trim() || undefined,
    enabled: outfit.enabled !== false,
    productOrder: ensureCoreProductOrder(outfit.productOrder ?? fallbackOrder)
  };
}

export function enabledFullOutfits(config: OutfitConfig) {
  const live = config.fullOutfits.filter((outfit) => outfit.enabled !== false);
  return live.length ? live : config.fullOutfits.slice(0, 1);
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
  const config = sanitizeOutfitConfig(definition.outfitConfig);
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
  }

  return next;
}

export function productIsSelected(answers: Record<string, unknown>, product: CoreProductId) {
  return asStringList(answers.selected_products).includes(product);
}

/**
 * Runtime upgrade for stored JSON definitions:
 * merge child product sections, inject global robe measurements and
 * per-product color/notes/reference fields, apply outfit visibility.
 * Field keys are never renamed.
 */
export function applyOutfitArchitecture(definition: FormDefinition): FormDefinition {
  const config = sanitizeOutfitConfig(definition.outfitConfig);
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
    description: "اختر قطعة أو أكثر. كل قطعة تحتفظ بخياراتها الكاملة.",
    options: config.singleItemProducts.map((id) => ({
      id: `product-${id}`,
      label: CORE_PRODUCT_LABELS[id],
      value: id
    })),
    conditional: [{ fieldKey: "booking_type", operator: "equals", value: "single_pieces" }]
  });

  upsertField(booking, {
    id: "full_outfit_id",
    key: "full_outfit_id",
    label: "الزي الكامل",
    type: outfits.length > 1 ? "radio" : "read_only",
    required: outfits.length > 1,
    defaultValue: outfits[0]?.id,
    description: "كل زي كامل يشمل الروب والوشاح والقبعة مع تخصيص كل منتج.",
    options: outfits.map((outfit) => ({
      id: outfit.id,
      label: outfit.name,
      value: outfit.id,
      description: outfit.description,
      imageUrl: outfit.imageUrl
    })),
    conditional: outfits.length > 1 ? [{ fieldKey: "booking_type", operator: "equals", value: "full_set" }] : [{ fieldKey: "booking_type", operator: "equals", value: "__hidden__" }]
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
