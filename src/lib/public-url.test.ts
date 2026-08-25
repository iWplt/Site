import assert from "node:assert/strict";
import test from "node:test";

/**
 * Guards active booking-link origin selection.
 * Mirrors configuredAppUrl / getPublicAppUrl contracts without importing Next headers.
 */

function configuredAppUrl(env: Record<string, string | undefined>) {
  return env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "";
}

function getPublicAppUrl(
  env: Record<string, string | undefined>,
  opts: { production: boolean; fallbackOrigin?: string }
) {
  const configured = configuredAppUrl(env);
  if (opts.production) {
    if (!configured) throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
    return configured;
  }
  return configured || opts.fallbackOrigin?.replace(/\/$/, "") || "";
}

test("production booking links use NEXT_PUBLIC_APP_URL Cloudflare origin", () => {
  const origin = getPublicAppUrl(
    { NEXT_PUBLIC_APP_URL: "https://graduation.warka.workers.dev" },
    { production: true, fallbackOrigin: "https://warka-graduation.netlify.app" }
  );
  assert.equal(origin, "https://graduation.warka.workers.dev");
  assert.ok(!origin.includes("netlify.app"));
});

test("production ignores Netlify URL/DEPLOY_PRIME_URL style fallbacks", () => {
  const configured = configuredAppUrl({
    NEXT_PUBLIC_APP_URL: "https://graduation.warka.workers.dev",
    URL: "https://warka-graduation.netlify.app",
    DEPLOY_PRIME_URL: "https://deploy-preview--warka-graduation.netlify.app"
  });
  assert.equal(configured, "https://graduation.warka.workers.dev");
});

test("production requires NEXT_PUBLIC_APP_URL and does not invent Netlify origin", () => {
  assert.throws(
    () =>
      getPublicAppUrl(
        { URL: "https://warka-graduation.netlify.app" },
        { production: true }
      ),
    /NEXT_PUBLIC_APP_URL/
  );
  assert.equal(configuredAppUrl({ URL: "https://warka-graduation.netlify.app" }), "");
});

test("dev can fall back to request origin when APP_URL unset", () => {
  const origin = getPublicAppUrl(
    {},
    { production: false, fallbackOrigin: "http://127.0.0.1:8787" }
  );
  assert.equal(origin, "http://127.0.0.1:8787");
});
