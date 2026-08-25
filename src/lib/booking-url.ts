import { INDIVIDUAL_FORM_SLUG } from "./form-uniform.ts";

export function publicFormPath(slug: string) {
  const safe = slug.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(safe)) return null;
  return `/f/${safe}`;
}

export function publicFormUrl(origin: string, slug: string) {
  const path = publicFormPath(slug);
  if (!path) return null;
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function studentPublicFormSlug(student: {
  batch_id: string | null;
  form_slug?: string | null;
}) {
  if (typeof student.form_slug === "string" && student.form_slug.trim()) return student.form_slug.trim();
  if (student.form_slug === null) return null;
  if (!student.batch_id) return INDIVIDUAL_FORM_SLUG;
  return null;
}
