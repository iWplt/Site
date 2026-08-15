import { headers } from "next/headers";
import { isProductionRuntime } from "@/lib/env";

function netlifyHttpsOrigin() {
  const raw = process.env.URL?.trim() || process.env.DEPLOY_PRIME_URL?.trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return "";
    if (/localhost|127\.0\.0\.1/i.test(parsed.hostname)) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

export function configuredAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || netlifyHttpsOrigin();
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
