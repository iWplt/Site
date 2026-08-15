export const STUDENT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const STUDENT_UPLOAD_MAX_FILES = 5;
export const STUDENT_IMAGE_MAX_EDGE = 1920;
export const STUDENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const STUDENT_UPLOAD_TYPES = [...STUDENT_IMAGE_TYPES, "application/pdf"] as const;
