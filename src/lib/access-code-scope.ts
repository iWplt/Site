import { hasSupabaseConfig, isProductionRuntime } from "@/lib/env";

export function getAccessCodeFingerprintScope(form: { id: string; batch_id?: string | null }) {
  const batchId = typeof form.batch_id === "string" ? form.batch_id.trim() : "";
  return batchId || form.id;
}

export function normalizeAccessCodeInput(raw: string) {
  return raw
    .trim()
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[^\d]/g, "");
}

export function requireAccessCodeHmacSecret() {
  const value = process.env.ACCESS_CODE_HMAC_SECRET?.trim();
  if (value) return value;
  if (isProductionRuntime() || hasSupabaseConfig()) {
    throw new Error("Missing required environment variable: ACCESS_CODE_HMAC_SECRET");
  }
  return "warka-local-hmac-secret";
}
