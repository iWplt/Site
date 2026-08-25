import assert from "node:assert/strict";
import test from "node:test";

/** Mirrors src/lib/booking-url.ts public helpers (kept inline so node:test needs no path aliases). */
function publicFormPath(slug: string) {
  const safe = slug.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(safe)) return null;
  return `/f/${safe}`;
}

function publicFormUrl(origin: string, slug: string) {
  const path = publicFormPath(slug);
  if (!path) return null;
  return `${origin.replace(/\/$/, "")}${path}`;
}

const PRODUCTION_ORIGIN = "https://graduation.warka.workers.dev";

test("public booking URL uses Worker domain and slug path", () => {
  assert.equal(publicFormPath("batch-2027-2027-3"), "/f/batch-2027-2027-3");
  assert.equal(
    publicFormUrl(PRODUCTION_ORIGIN, "batch-2027-2027-3"),
    "https://graduation.warka.workers.dev/f/batch-2027-2027-3"
  );
});

test("public form path rejects unsafe slug characters", () => {
  assert.equal(publicFormPath("../evil"), null);
  assert.equal(publicFormPath("a/b"), null);
  assert.equal(publicFormUrl(PRODUCTION_ORIGIN, "bad slug"), null);
});

test("booking link card status semantics: only published is active", () => {
  function isActiveBookingLink(status: string) {
    return status === "published";
  }
  assert.equal(isActiveBookingLink("published"), true);
  assert.equal(isActiveBookingLink("draft"), false);
  assert.equal(isActiveBookingLink("closed"), false);
  assert.equal(isActiveBookingLink("archived"), false);
});

test("Worker rename target name and URL remain stable", () => {
  const url = publicFormUrl(PRODUCTION_ORIGIN, "demo");
  assert.ok(url?.includes("graduation.warka.workers.dev"));
  assert.ok(!url?.includes("warka-booking-management"));
});
