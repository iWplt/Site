import "server-only";

import type { VerifiedBookingSession } from "@/lib/types";

export { sanitizeStorageSegment, stableStorageSegment } from "@/lib/storage-path";
export { extensionForMime, OPTION_IMAGE_MIMES, sniffAllowedMime, STUDENT_UPLOAD_MIMES } from "@/lib/upload-mime";

export function assertOwnedBookingPath(session: VerifiedBookingSession, path: string) {
  if (!session.studentId) throw new Error("جلسة الحجز غير مكتملة.");
  const prefix = `${session.batchId ?? "individual"}/${session.studentId}/`;
  if (
    !path ||
    path.includes("..") ||
    path.includes("\\") ||
    path.startsWith("/") ||
    !path.startsWith(prefix) ||
    path.split("/").length < 4
  ) {
    throw new Error("ملف غير صالح.");
  }
}
