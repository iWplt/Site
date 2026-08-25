const IMAGE_AND_PDF = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const IMAGES_ONLY = new Set(["image/jpeg", "image/png", "image/webp"]);

export const STUDENT_UPLOAD_MIMES = IMAGE_AND_PDF;
export const OPTION_IMAGE_MIMES = IMAGES_ONLY;

export function sniffAllowedMime(buffer: Buffer, allowed: Set<string>): string | null {
  let mime: string | null = null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) mime = "image/jpeg";
  else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    mime = "image/png";
  } else if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    mime = "image/webp";
  } else if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") mime = "application/pdf";

  return mime && allowed.has(mime) ? mime : null;
}

export function extensionForMime(mimeType: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf"
  };
  const extension = map[mimeType];
  if (!extension) throw new Error("نوع الملف غير مسموح.");
  return extension;
}
