import "server-only";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getPersistenceMode } from "@/lib/persistence";
import { extensionForMime, sanitizeStorageSegment } from "@/lib/upload-security";
import {
  sbDeleteOptionImage,
  sbResolveOptionImageUrl,
  sbUploadOptionImage,
  sbUploadStudentDesign,
  type UploadedFile,
  type UploadFileInput
} from "@/lib/store/supabase-db";
import type { VerifiedBookingSession } from "@/lib/types";

/**
 * Persistence-mode-aware upload helpers. Server actions/routes should call these instead of
 * writing directly to the filesystem or Supabase Storage, so the same call site works whether
 * WARKA is running against the local JSON demo store or a real Supabase project.
 *
 * - local-demo mode: files are written under `public/uploads/...` and served as static assets.
 * - supabase mode: files are written to the appropriate private Storage bucket and the caller
 *   receives a signed preview URL (booking uploads) or a durable Storage path (option images).
 */

export type UploadInputFile = UploadFileInput;

export type StoredStudentUpload = UploadedFile;

export type StoredOptionImage = {
  optionId: string;
  imagePath: string;
  imageUrl?: string;
};

const PUBLIC_DIR = join(process.cwd(), "public");

function writePublicFile(relativeDir: string, fileName: string, buffer: Buffer) {
  const absoluteDir = join(PUBLIC_DIR, relativeDir);
  mkdirSync(absoluteDir, { recursive: true });
  writeFileSync(join(absoluteDir, fileName), buffer);
  return `/${relativeDir}/${fileName}`.replaceAll("\\", "/");
}

/**
 * Stores a student's design/attachment upload for the given booking session + field.
 * Local demo path mirrors `src/app/api/uploads/sign/route.ts`
 * (`uploads/batch/{batchId}/student/{studentId}/field/{fieldKey}/{uuid}.ext`).
 * Supabase path is `{batchId}/{studentId}/{fieldKey}/{uuid}.ext` inside `booking-uploads`.
 */
export async function storeStudentUpload(
  session: VerifiedBookingSession,
  fieldKey: string,
  file: UploadInputFile
): Promise<StoredStudentUpload> {
  if (!session.studentId) throw new Error("جلسة الحجز غير مكتملة.");
  if (getPersistenceMode() === "supabase") {
    return sbUploadStudentDesign(session, fieldKey, file);
  }

  const extension = extensionForMime(file.mimeType);
  const safeName = `${randomUUID()}.${extension}`;
  const relativeDir = join(
    "uploads",
    "batch",
    sanitizeStorageSegment(session.batchId ?? "individual"),
    "student",
    sanitizeStorageSegment(session.studentId),
    "field",
    sanitizeStorageSegment(fieldKey)
  );
  const path = writePublicFile(relativeDir, safeName, file.buffer);

  return {
    path,
    previewUrl: path,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.buffer.byteLength
  };
}

/**
 * Stores an Owner-managed option reference image (product photo), distinct from student
 * uploads. In Supabase mode the definition is updated and persisted directly by
 * `sbUploadOptionImage`; in local-demo mode only the file is written and the caller
 * (local-db mutation) is responsible for persisting `imagePath`/`imageUrl` on the option.
 */
export async function storeOptionImage(
  formId: string,
  fieldKey: string,
  optionId: string,
  file: UploadInputFile
): Promise<StoredOptionImage> {
  if (getPersistenceMode() === "supabase") {
    const option = await sbUploadOptionImage(formId, fieldKey, optionId, file);
    return { optionId, imagePath: option.imagePath ?? "", imageUrl: option.imageUrl };
  }

  const extension = extensionForMime(file.mimeType);
  const relativeDir = join(
    "uploads",
    "form-options",
    sanitizeStorageSegment(formId),
    sanitizeStorageSegment(fieldKey),
    sanitizeStorageSegment(optionId)
  );
  const fileName = `reference.${extension}`;
  const imagePath = writePublicFile(relativeDir, fileName, file.buffer);

  return { optionId, imagePath, imageUrl: imagePath };
}

export type StoredOutfitAsset = {
  imagePath: string;
  imageUrl?: string;
};

/**
 * Stores an Owner-managed outfit or outfit-product image in the same form-options
 * bucket as option reference photos. The caller persists paths onto `outfitConfig`.
 */
export async function storeOutfitAsset(
  formId: string,
  outfitId: string,
  productId: string | undefined,
  file: UploadInputFile
): Promise<StoredOutfitAsset> {
  const relativeKey = productId
    ? `outfits/${sanitizeStorageSegment(outfitId)}/products/${sanitizeStorageSegment(productId)}`
    : `outfits/${sanitizeStorageSegment(outfitId)}/cover`;

  if (getPersistenceMode() === "supabase") {
    const { sbUploadOutfitAssetFile } = await import("@/lib/store/supabase-db");
    return sbUploadOutfitAssetFile(formId, relativeKey, file);
  }

  const extension = extensionForMime(file.mimeType);
  const fileName = `reference.${extension}`;
  const relativeDir = join("uploads", "form-options", sanitizeStorageSegment(formId), ...relativeKey.split("/"));
  const imagePath = writePublicFile(relativeDir, fileName, file.buffer);
  return { imagePath, imageUrl: imagePath };
}

export async function deleteOutfitAssetFile(imagePath: string | undefined) {
  if (!imagePath) return;
  if (getPersistenceMode() === "supabase") {
    const { sbDeleteOutfitAssetFile } = await import("@/lib/store/supabase-db");
    await sbDeleteOutfitAssetFile(imagePath);
  }
}

/**
 * Deletes an Owner-managed option reference image. In Supabase mode this also clears
 * `imagePath`/`imageUrl` on the persisted form definition. In local-demo mode the caller is
 * responsible for clearing those fields on the local-db record (leftover files on disk are
 * harmless for the demo and are not deleted).
 */
export async function deleteOptionImage(formId: string, fieldKey: string, optionId: string) {
  if (getPersistenceMode() === "supabase") {
    await sbDeleteOptionImage(formId, fieldKey, optionId);
  }
}

/**
 * Resolves a durable `imagePath` (Supabase Storage path or local `/uploads/...` path) into a
 * displayable URL. Local paths are already public and returned as-is; Supabase paths are
 * exchanged for a short-lived signed URL.
 */
export async function resolveOptionImageUrl(imagePath: string | undefined | null): Promise<string | undefined> {
  if (getPersistenceMode() === "supabase") {
    return sbResolveOptionImageUrl(imagePath);
  }
  return imagePath ?? undefined;
}
