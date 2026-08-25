/**
 * Student customization permissions vs Representative configuration rights.
 *
 * - Student permissions: what a student may customize during booking.
 * - Representative rights: whether a rep may edit those student permissions.
 * Representatives must never grant a student more than the Owner ceiling allows.
 */

export const STUDENT_PERMISSION_KEYS = [
  "allowAdditions",
  "allowEmbroidery",
  "allowColors",
  "allowDesignUploads",
  "allowNotes"
] as const;

export type StudentPermissionKey = (typeof STUDENT_PERMISSION_KEYS)[number];

export type StudentCustomizationPermissions = Record<StudentPermissionKey, boolean>;

export type StudentPermissionPolicy = {
  /** When false, Representatives cannot see/edit student permission controls. */
  allowRepresentativesToConfigure: boolean;
  /** Owner defaults / ceiling for the batch (or individual form). */
  defaults: StudentCustomizationPermissions;
};

export type StudentPermissionOverride = Partial<StudentCustomizationPermissions>;

export const STUDENT_PERMISSION_LABELS: Record<StudentPermissionKey, string> = {
  allowAdditions: "السماح للطالب بتعديل الإضافات",
  allowEmbroidery: "السماح للطالب باختيار التطريزات",
  allowColors: "السماح للطالب باختيار الألوان",
  allowDesignUploads: "السماح للطالب برفع صور التصميم/المرجع",
  allowNotes: "السماح للطالب بإضافة ملاحظات"
};

export const DEFAULT_STUDENT_PERMISSIONS: StudentCustomizationPermissions = {
  allowAdditions: true,
  allowEmbroidery: true,
  allowColors: true,
  allowDesignUploads: true,
  allowNotes: true
};

export const DEFAULT_STUDENT_PERMISSION_POLICY: StudentPermissionPolicy = {
  allowRepresentativesToConfigure: false,
  defaults: { ...DEFAULT_STUDENT_PERMISSIONS }
};

export type StudentPermissionCategory =
  | "additions"
  | "embroidery"
  | "colors"
  | "design_uploads"
  | "notes"
  | "other";

/** Map a form field key to the permission category that gates it. */
export function permissionCategoryForFieldKey(fieldKey: string): StudentPermissionCategory {
  const key = fieldKey.trim().toLowerCase();
  if (!key) return "other";

  if (key === "robe_addition" || key.endsWith("_addition") || key.includes("addition")) {
    return "additions";
  }
  if (
    key.includes("embroidery") ||
    key.includes("embroider") ||
    key === "sash_back_text" ||
    key === "name_embroidery" ||
    key === "year_side_embroidery" ||
    key === "sash_edge_embroidery" ||
    key === "cap_side_image" ||
    key === "cap_top_image" ||
    key === "sash_back_image" ||
    key === "year_side_image" ||
    key === "robe_addition_image"
  ) {
    return "embroidery";
  }
  if (key.includes("color")) {
    return "colors";
  }
  if (
    key.includes("notes") ||
    key.endsWith("_note") ||
    key === "notes" ||
    key === "student_notes"
  ) {
    return "notes";
  }
  if (
    key.includes("upload") ||
    key.endsWith("_image") ||
    key.endsWith("_images") ||
    key.includes("design") ||
    key.includes("reference")
  ) {
    // Model/type image_choice fields are product selection, not design uploads.
    if (key.endsWith("_model") || key.endsWith("_type") || key === "robe_model" || key === "sash_type" || key === "cap_type") {
      return "other";
    }
    return "design_uploads";
  }
  return "other";
}

export function categoryToPermissionKey(
  category: StudentPermissionCategory
): StudentPermissionKey | null {
  switch (category) {
    case "additions":
      return "allowAdditions";
    case "embroidery":
      return "allowEmbroidery";
    case "colors":
      return "allowColors";
    case "design_uploads":
      return "allowDesignUploads";
    case "notes":
      return "allowNotes";
    default:
      return null;
  }
}

export function normalizeStudentPermissions(
  input?: Partial<StudentCustomizationPermissions> | null
): StudentCustomizationPermissions {
  const next = { ...DEFAULT_STUDENT_PERMISSIONS };
  if (!input || typeof input !== "object") return next;
  for (const key of STUDENT_PERMISSION_KEYS) {
    if (typeof input[key] === "boolean") next[key] = input[key]!;
  }
  return next;
}

export function normalizeStudentPermissionPolicy(
  input?: Partial<StudentPermissionPolicy> | null
): StudentPermissionPolicy {
  return {
    allowRepresentativesToConfigure: Boolean(input?.allowRepresentativesToConfigure),
    defaults: normalizeStudentPermissions(input?.defaults)
  };
}

/**
 * Effective permissions for a student.
 * Override can only *enable* a flag when the Owner ceiling (defaults) allows it,
 * unless `allowAboveCeiling` (Owner editing).
 */
export function resolveStudentPermissions(args: {
  policy: StudentPermissionPolicy;
  override?: StudentPermissionOverride | null;
  allowAboveCeiling?: boolean;
}): StudentCustomizationPermissions {
  const ceiling = normalizeStudentPermissions(args.policy.defaults);
  const override = args.override ?? {};
  const result = { ...ceiling };
  for (const key of STUDENT_PERMISSION_KEYS) {
    if (typeof override[key] !== "boolean") continue;
    if (args.allowAboveCeiling) {
      result[key] = override[key]!;
      continue;
    }
    // Rep / public: can only further restrict (or keep) within Owner ceiling.
    result[key] = ceiling[key] && override[key]!;
  }
  return result;
}

export function isFieldAllowedByPermissions(
  fieldKey: string,
  permissions: StudentCustomizationPermissions
): boolean {
  const category = permissionCategoryForFieldKey(fieldKey);
  const permKey = categoryToPermissionKey(category);
  if (!permKey) return true;
  return permissions[permKey];
}

export function clampOverrideToCeiling(
  ceiling: StudentCustomizationPermissions,
  override: StudentPermissionOverride
): StudentPermissionOverride {
  const next: StudentPermissionOverride = {};
  for (const key of STUDENT_PERMISSION_KEYS) {
    if (typeof override[key] !== "boolean") continue;
    next[key] = ceiling[key] ? override[key]! : false;
  }
  return next;
}

export function representativeMayConfigurePermissions(policy: StudentPermissionPolicy): boolean {
  return normalizeStudentPermissionPolicy(policy).allowRepresentativesToConfigure;
}
