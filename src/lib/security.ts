import "server-only";

import crypto from "node:crypto";
import { requireAccessCodeHmacSecret } from "@/lib/access-code-scope";
import { hasSupabaseConfig, isProductionRuntime } from "@/lib/env";
import type { VerifiedBookingSession } from "@/lib/types";

export { getAccessCodeFingerprintScope, normalizeAccessCodeInput, requireAccessCodeHmacSecret } from "@/lib/access-code-scope";

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function requiredSecret(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (isProductionRuntime() || hasSupabaseConfig()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return fallback;
}

function encryptionKey() {
  const configured = process.env.ACCESS_CODE_ENCRYPTION_KEY?.trim();
  if (configured) {
    const decoded = Buffer.from(configured, configured.length === 64 ? "hex" : "base64");
    if (decoded.length === 32) return decoded;
  }
  if (isProductionRuntime() || hasSupabaseConfig()) {
    throw new Error("Missing required environment variable: ACCESS_CODE_ENCRYPTION_KEY");
  }
  return crypto.createHash("sha256").update("warka-local-development-encryption-key").digest();
}

function hmacEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function generateNumericCode(length = 6) {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return value.toString().padStart(length, "0");
}

export function encryptAccessCode(code: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${base64Url(iv)}.${base64Url(tag)}.${base64Url(ciphertext)}`;
}

export function decryptAccessCode(encrypted: string) {
  const [ivRaw, tagRaw, ciphertextRaw] = encrypted.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function accessCodeFingerprint(code: string, formIdOrBatchId: string) {
  const scope = formIdOrBatchId?.trim();
  if (!scope) {
    throw new Error("Access code fingerprint scope is required.");
  }
  return crypto
    .createHmac("sha256", requireAccessCodeHmacSecret())
    .update(`${scope}:${code}`)
    .digest("hex");
}

export function signBookingSession(session: VerifiedBookingSession) {
  const payload = base64Url(JSON.stringify(session));
  const signature = crypto
    .createHmac("sha256", requiredSecret("BOOKING_SESSION_SECRET", "warka-local-session-secret"))
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyBookingSession(token: string | undefined): VerifiedBookingSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = crypto
    .createHmac("sha256", requiredSecret("BOOKING_SESSION_SECRET", "warka-local-session-secret"))
    .update(payload)
    .digest("base64url");

  if (!hmacEqual(signature, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as VerifiedBookingSession;
    if (parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
