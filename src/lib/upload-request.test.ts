import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADMIN_IMAGE_MAX_BYTES,
  ADMIN_IMAGE_TYPES,
  ADMIN_UPLOAD_KINDS,
  STUDENT_UPLOAD_MAX_BYTES,
  UPLOAD_REQUEST_BODY_LIMIT,
  UPLOAD_REQUEST_BODY_LIMIT_BYTES,
  parseAdminUploadKind,
  uploadSizeError
} from "./upload-limits.ts";

test("request body limit is above app file limits so multipart overhead still fits", () => {
  assert.equal(UPLOAD_REQUEST_BODY_LIMIT, "12mb");
  assert.equal(UPLOAD_REQUEST_BODY_LIMIT_BYTES, 12 * 1024 * 1024);
  assert.ok(UPLOAD_REQUEST_BODY_LIMIT_BYTES > STUDENT_UPLOAD_MAX_BYTES);
  assert.ok(UPLOAD_REQUEST_BODY_LIMIT_BYTES > ADMIN_IMAGE_MAX_BYTES);
  assert.equal(STUDENT_UPLOAD_MAX_BYTES, 10 * 1024 * 1024);
  assert.equal(ADMIN_IMAGE_MAX_BYTES, 5 * 1024 * 1024);
});

test("admin image over 5MB is rejected by app rules, not only by the request body cap", () => {
  const over = ADMIN_IMAGE_MAX_BYTES + 1;
  assert.ok(over < UPLOAD_REQUEST_BODY_LIMIT_BYTES);
  assert.equal(uploadSizeError(over, ADMIN_IMAGE_MAX_BYTES), "حجم الصورة يتجاوز 5 ميغابايت.");
  assert.equal(uploadSizeError(ADMIN_IMAGE_MAX_BYTES, ADMIN_IMAGE_MAX_BYTES), undefined);
});

test("student file over 10MB is rejected by app rules", () => {
  assert.equal(
    uploadSizeError(STUDENT_UPLOAD_MAX_BYTES + 1, STUDENT_UPLOAD_MAX_BYTES),
    "الملف أكبر من الحد المسموح (10 ميجابايت)."
  );
  assert.equal(uploadSizeError(STUDENT_UPLOAD_MAX_BYTES, STUDENT_UPLOAD_MAX_BYTES), undefined);
});

test("empty files are rejected", () => {
  assert.equal(uploadSizeError(0, ADMIN_IMAGE_MAX_BYTES), "ملف الصورة فارغ أو لم يصل إلى الخادم.");
  assert.equal(uploadSizeError(-1, STUDENT_UPLOAD_MAX_BYTES), "ملف الصورة فارغ أو لم يصل إلى الخادم.");
});

test("admin image uploads only allow jpeg png webp", () => {
  assert.deepEqual([...ADMIN_IMAGE_TYPES], ["image/jpeg", "image/png", "image/webp"]);
});

test("admin upload kinds cover option outfit form-product and catalog paths", () => {
  assert.deepEqual([...ADMIN_UPLOAD_KINDS], ["option", "outfit", "form-product", "catalog"]);
  assert.equal(parseAdminUploadKind("option"), "option");
  assert.equal(parseAdminUploadKind("outfit"), "outfit");
  assert.equal(parseAdminUploadKind("form-product"), "form-product");
  assert.equal(parseAdminUploadKind("catalog"), "catalog");
  assert.equal(parseAdminUploadKind("student"), undefined);
  assert.equal(parseAdminUploadKind(""), undefined);
});

test("next.config raises the Server Action body cap using the shared upload limit", () => {
  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /bodySizeLimit:\s*UPLOAD_REQUEST_BODY_LIMIT/);
  assert.match(config, /proxyClientMaxBodySize:\s*UPLOAD_REQUEST_BODY_LIMIT/);
});

test("admin image UIs send files through the upload route instead of Server Actions", () => {
  for (const name of ["form-outfit-workspace.tsx", "form-option-image-editor.tsx", "product-editor.tsx"]) {
    const source = readFileSync(new URL(`../components/${name}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /upload(Outfit|FormProduct|FormOption|Product)ImageAction/);
    assert.match(source, /uploadAdminImage/);
  }
});

test("admin ingest rejects empty files, PDFs, and oversize images before storage", async () => {
  const { ingestAdminImageFile } = await import("./ingest-admin-image.ts");

  const empty = await ingestAdminImageFile(new File([], "empty.jpg", { type: "image/jpeg" }));
  assert.equal(empty.success, false);
  if (!empty.success) assert.match(empty.error, /فارغ/);

  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const pdf = await ingestAdminImageFile(new File([pdfBytes], "x.pdf", { type: "application/pdf" }));
  assert.equal(pdf.success, false);
  if (!pdf.success) assert.match(pdf.error, /نوع الصورة غير مسموح/);

  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
  const jpeg = await ingestAdminImageFile(new File([jpegBytes], "ok.jpg", { type: "image/jpeg" }));
  assert.equal(jpeg.success, true);
  if (jpeg.success) {
    assert.equal(jpeg.data?.mimeType, "image/jpeg");
    assert.equal(jpeg.data?.originalName, "ok.jpg");
  }

  const oversize = new File([new Uint8Array(ADMIN_IMAGE_MAX_BYTES + 1)], "big.jpg", { type: "image/jpeg" });
  const tooBig = await ingestAdminImageFile(oversize);
  assert.equal(tooBig.success, false);
  if (!tooBig.success) assert.equal(tooBig.error, "حجم الصورة يتجاوز 5 ميغابايت.");
});
