import type { ConditionalRule, FormDefinition, FormField, FormSection } from "@/lib/types";

/**
 * Canonical parent for each known customization / student-design field.
 * Derived from the existing WARKA form definition labels and conditionals —
 * not invented product taxonomy.
 */
export const CUSTOMIZATION_FIELD_PARENTS: Record<
  string,
  {
    sectionId: string;
    /** Minimum visibility rules that must remain attached to the field. */
    conditional?: ConditionalRule[];
  }
> = {
  robe_addition_image: {
    sectionId: "robe_additions",
    conditional: [{ fieldKey: "robe_addition", operator: "not_equals", value: "none" }]
  },
  sash_back_text: {
    sectionId: "sash_embroidery",
    conditional: [{ fieldKey: "sash_type", operator: "includes", value: "embroidered" }]
  },
  sash_back_image: {
    sectionId: "sash_embroidery",
    conditional: [{ fieldKey: "sash_type", operator: "includes", value: "embroidered" }]
  },
  sash_edge_embroidery: { sectionId: "sash_embroidery" },
  name_embroidery: { sectionId: "sash_embroidery" },
  year_side_embroidery: { sectionId: "sash_embroidery" },
  year_side_image: { sectionId: "sash_embroidery" },
  cap_side_image: { sectionId: "cap" },
  cap_top_image: { sectionId: "cap" }
};

function sameConditional(a: ConditionalRule | undefined, b: ConditionalRule) {
  return a?.fieldKey === b.fieldKey && a?.operator === b.operator && a?.value === b.value;
}

function ensureConditionals(field: FormField, required?: ConditionalRule[]): FormField {
  if (!required?.length) return field;
  const existing = field.conditional ?? [];
  const merged = [...existing];
  for (const rule of required) {
    if (!merged.some((entry) => sameConditional(entry, rule))) {
      merged.push(rule);
    }
  }
  return { ...field, conditional: merged };
}

/**
 * Relocate known customization fields under their parent product sections and
 * ensure parent-based visibility rules exist. Field keys are preserved so
 * existing answers, uploads, and snapshots remain readable.
 *
 * Idempotent — safe to run on every form load.
 */
export function normalizeFormCustomizationGrouping(definition: FormDefinition): FormDefinition {
  const sections = definition.sections.map((section) => ({
    ...section,
    fields: [...section.fields]
  }));

  const byId = new Map(sections.map((section) => [section.id, section]));
  const movedKeys = new Set<string>();

  for (const [key, parent] of Object.entries(CUSTOMIZATION_FIELD_PARENTS)) {
    const target = byId.get(parent.sectionId);
    if (!target) continue;

    let sourceSection: FormSection | undefined;
    let fieldIndex = -1;
    for (const section of sections) {
      const index = section.fields.findIndex((field) => field.key === key);
      if (index >= 0) {
        sourceSection = section;
        fieldIndex = index;
        break;
      }
    }
    if (!sourceSection || fieldIndex < 0) continue;

    const raw = sourceSection.fields[fieldIndex];
    const field = ensureConditionals(raw, parent.conditional);

    if (sourceSection.id === parent.sectionId) {
      sourceSection.fields[fieldIndex] = field;
      continue;
    }

    sourceSection.fields.splice(fieldIndex, 1);
    if (!target.fields.some((entry) => entry.key === key)) {
      target.fields.push(field);
    }
    movedKeys.add(key);
  }

  const nextSections = sections
    .map((section) => {
      if (section.id !== "uploads") return section;
      // Keep only non-mapped leftover upload fields; drop empty global dump.
      const leftovers = section.fields.filter((field) => !CUSTOMIZATION_FIELD_PARENTS[field.key]);
      return leftovers.length ? { ...section, fields: leftovers } : null;
    })
    .filter((section): section is FormSection => Boolean(section));

  if (!movedKeys.size && nextSections.length === definition.sections.length) {
    // Still return a copy with ensured conditionals applied above via mutation of clones.
    return { ...definition, sections: nextSections };
  }

  return { ...definition, sections: nextSections };
}
