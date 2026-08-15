import { fieldIsVisible, findSelectedOption, optionLabel } from "@/lib/form-definition";
import { publicAnswers, type OrderSnapshot, type SnapshotField } from "@/lib/order-snapshot";
import type { FormDefinition } from "@/lib/types";

export type GalleryImage = {
  src: string;
  alt: string;
  kind: "option" | "student";
  caption: string;
  downloadUrl?: string;
};

export type OrderLine = {
  key: string;
  label: string;
  value: string;
  description?: string;
  referenceImages: GalleryImage[];
  studentImages: GalleryImage[];
  fixed?: boolean;
};

export type OrderSectionView = {
  id: string;
  title: string;
  lines: OrderLine[];
};

export type StudentFileLike = {
  field_key?: string;
  fieldKey?: string;
  preview_url?: string;
  previewUrl?: string;
  storage_path?: string;
  path?: string;
  original_filename?: string;
  originalName?: string;
};

function resolveReferenceSrc(
  field: SnapshotField,
  urlMap: Record<string, string>
) {
  const path = field.referenceImage?.path;
  if (path && urlMap[path]) return urlMap[path];
  if (path && (path.startsWith("/") || /^https?:\/\//.test(path))) return path;
  return field.referenceImage?.publicUrl;
}

export function filesForKey(files: StudentFileLike[], key: string) {
  return files.filter((file) => (file.field_key ?? file.fieldKey) === key);
}

export function toStudentImages(files: StudentFileLike[]): GalleryImage[] {
  const images: GalleryImage[] = [];
  for (const file of files) {
    const src = file.preview_url ?? file.previewUrl ?? file.storage_path ?? file.path;
    if (!src) continue;
    images.push({
      src,
      alt: file.original_filename ?? file.originalName ?? "الصورة المرفقة من الطالب",
      kind: "student",
      caption: "الصورة المرفقة من الطالب",
      downloadUrl: src
    });
  }
  return images;
}

export function buildOrderSectionsFromSnapshot(
  snapshot: OrderSnapshot,
  files: StudentFileLike[],
  urlMap: Record<string, string> = {}
): OrderSectionView[] {
  const grouped = new Map<string, OrderSectionView>();
  for (const field of snapshot.fields) {
    if (["info", "section"].includes(field.type)) continue;
    const studentImages = toStudentImages(filesForKey(files, field.key));
    const isUpload = ["image_upload", "file_upload"].includes(field.type);
    if (isUpload && !studentImages.length) continue;
    const value = isUpload ? `${studentImages.length} ملف` : field.displayValue || "غير محدد";
    if (!isUpload && (field.value === undefined || field.value === null || field.value === "") && !studentImages.length) {
      continue;
    }
    const refSrc = resolveReferenceSrc(field, urlMap);
    const referenceImages: GalleryImage[] = refSrc
      ? [
          {
            src: refSrc,
            alt: field.referenceImage?.alt || field.optionLabel || field.label,
            kind: "option",
            caption: "صورة الخيار",
            downloadUrl: refSrc
          }
        ]
      : [];

    const section = grouped.get(field.sectionId) ?? { id: field.sectionId, title: field.sectionTitle, lines: [] };
    section.lines.push({
      key: field.key,
      label: field.label,
      value,
      description: field.optionDescription,
      referenceImages,
      studentImages,
      fixed: field.fixed
    });
    grouped.set(field.sectionId, section);
  }
  return [...grouped.values()].filter((section) => section.lines.length);
}

export function buildLiveOrderSections(
  definition: FormDefinition,
  answers: Record<string, unknown>,
  files: StudentFileLike[]
): OrderSectionView[] {
  const visibleAnswers = publicAnswers(answers);
  return definition.sections
    .map((section) => ({
      id: section.id,
      title: section.title,
      lines: section.fields
        .filter((field) => fieldIsVisible(field, visibleAnswers))
        .map((field) => {
          const isUpload = ["image_upload", "file_upload"].includes(field.type);
          const selected = findSelectedOption(field.options, visibleAnswers[field.key]);
          const studentImages = toStudentImages(filesForKey(files, field.key));
          const refSrc = selected?.imageUrl || (selected?.imagePath?.startsWith("/") ? selected.imagePath : undefined);
          const referenceImages: GalleryImage[] = refSrc
            ? [{ src: refSrc, alt: selected?.imageAlt || selected?.label || field.label, kind: "option", caption: "صورة الخيار", downloadUrl: refSrc }]
            : [];
          return {
            key: field.key,
            label: field.label,
            value: isUpload
              ? studentImages.length
                ? `${studentImages.length} ملف`
                : "لا توجد صور"
              : optionLabel(field.options, visibleAnswers[field.key]) || "غير محدد",
            description: selected?.description,
            referenceImages,
            studentImages,
            fixed: Boolean(field.locked)
          };
        })
        .filter((line) => line.value !== "غير محدد" || line.referenceImages.length || line.studentImages.length)
    }))
    .filter((section) => section.lines.length);
}
