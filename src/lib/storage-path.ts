import { createHash } from "node:crypto";

const STRICT_SEGMENT = /^[a-zA-Z0-9_-]{1,80}$/;

/**
 * Strict segment for IDs we fully control (student/batch UUIDs).
 * Throws when invalid — callers should only pass trusted identifiers.
 */
export function sanitizeStorageSegment(value: string) {
  if (!STRICT_SEGMENT.test(value)) {
    throw new Error("مسار الملف غير صالح.");
  }
  return value;
}

/**
 * Stable path segment for form option / outfit / catalog asset keys.
 * - Preserves already-valid IDs so existing Storage paths keep working.
 * - Maps Unicode, spaces, dots, long IDs, etc. to a deterministic safe segment
 *   instead of throwing (which surfaced as Next.js "unexpected response" for some options).
 */
export function stableStorageSegment(value: string, maxLen = 80): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return createHash("sha256").update("empty-segment").digest("hex").slice(0, 32);
  }
  if (STRICT_SEGMENT.test(trimmed)) {
    return trimmed.length <= maxLen ? trimmed : trimmed.slice(0, maxLen);
  }
  const hash = createHash("sha256").update(trimmed).digest("hex").slice(0, 24);
  const ascii = trimmed.replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 20);
  const combined = (ascii ? `${ascii}-${hash}` : `id-${hash}`).slice(0, maxLen);
  return combined || hash.slice(0, Math.min(32, maxLen));
}
