import assert from "node:assert/strict";
import test from "node:test";
import { requiredUploadError } from "./required-upload.ts";

const one = [{}];
const two = [{}, {}];
const three = [{}, {}, {}];

test("required upload with 0 files is invalid", () => {
  assert.equal(requiredUploadError([], true), "يرجى إرفاق صورة واحدة على الأقل.");
  assert.equal(requiredUploadError(undefined, true), "يرجى إرفاق صورة واحدة على الأقل.");
});

test("required upload with 1 of max 3 files is valid", () => {
  assert.equal(requiredUploadError(one, true), undefined);
});

test("required upload with 2 of max 3 files is valid", () => {
  assert.equal(requiredUploadError(two, true), undefined);
});

test("required upload with 3 of max 3 files is valid", () => {
  assert.equal(requiredUploadError(three, true), undefined);
});

test("required=false allows zero files", () => {
  assert.equal(requiredUploadError([], false), undefined);
});
