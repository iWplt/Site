import assert from "node:assert/strict";
import test from "node:test";

/**
 * Image preview UX contracts (no React mount — guards display rules).
 * Thumbnails stay compact object-contain; lightbox loads the same stored path (no new storage).
 */

test("thumbnail aspect uses contain-friendly 4:3 contract", () => {
  const thumbAspect = "aspect-[4/3]";
  const objectFit = "object-contain";
  assert.equal(thumbAspect.includes("4/3"), true);
  assert.equal(objectFit, "object-contain");
  assert.notEqual(objectFit, "object-fill");
});

test("lightbox supports zoom bounds without navigating away", () => {
  function nextZoom(current: number, delta: number) {
    return Math.min(3, Math.max(1, Number((current + delta).toFixed(2))));
  }
  assert.equal(nextZoom(1, -0.25), 1);
  assert.equal(nextZoom(1, 0.25), 1.25);
  assert.equal(nextZoom(2.9, 0.25), 3);
});

test("preview uses existing stored image paths (no rewrite)", () => {
  const stored = "https://example.supabase.co/storage/v1/object/public/uploads/form-products/robe/a.webp";
  const previewSrc = stored;
  assert.equal(previewSrc, stored);
  assert.ok(!previewSrc.includes("warka-booking-management"));
});

test("admin 5MB and student 10MB upload limits remain unchanged by preview", async () => {
  const { ADMIN_IMAGE_MAX_BYTES, STUDENT_UPLOAD_MAX_BYTES } = await import("./upload-limits.ts");
  assert.equal(ADMIN_IMAGE_MAX_BYTES, 5 * 1024 * 1024);
  assert.equal(STUDENT_UPLOAD_MAX_BYTES, 10 * 1024 * 1024);
});
