import { headers } from "next/headers";
import { isProductionRuntime } from "@/lib/env";

/**
 * Canonical public origin for booking links, QR, receipts, and copy-link UI.
 * Single source of truth: NEXT_PUBLIC_APP_URL (no trailing slash).
 * Production must be https://graduation.warka.workers.dev
 */
export function configuredAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "";
}

export async function requestOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  if (!host) return undefined;
  const proto = headerList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/$/, "");
}

/** Canonical public origin for QR, copy-link, and receipts. */
export function getPublicAppUrl(fallbackOrigin?: string) {
  const configured = configuredAppUrl();
  if (isProductionRuntime()) {
    if (!configured) {
      throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
    }
    return configured;
  }
  return configured || fallbackOrigin?.replace(/\/$/, "") || "";
}

export function absoluteAppUrl(path: string, fallbackOrigin?: string) {
  const origin = getPublicAppUrl(fallbackOrigin);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!origin) return normalized;
  return `${origin}${normalized}`;
}
