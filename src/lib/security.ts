import "server-only";

import crypto from "node:crypto";
import type { VerifiedBookingSession } from "@/lib/types";

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function secret(name: string, fallback: string) {
  return process.env[name] || fallback;
}

function encryptionKey() {
  const configured = process.env.ACCESS_CODE_ENCRYPTION_KEY;
  if (configured) {
    const decoded = Buffer.from(configured, configured.length === 64 ? "hex" : "base64");
    if (decoded.length === 32) return decoded;
  }
  return crypto.createHash("sha256").update("warka-local-development-encryption-key").digest();
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
  return crypto
    .createHmac("sha256", secret("ACCESS_CODE_HMAC_SECRET", "warka-local-hmac-secret"))
    .update(`${formIdOrBatchId}:${code}`)
    .digest("hex");
}

export function signBookingSession(session: VerifiedBookingSession) {
  const payload = base64Url(JSON.stringify(session));
  const signature = crypto
    .createHmac("sha256", secret("BOOKING_SESSION_SECRET", "warka-local-session-secret"))
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyBookingSession(token: string | undefined): VerifiedBookingSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = crypto
    .createHmac("sha256", secret("BOOKING_SESSION_SECRET", "warka-local-session-secret"))
    .update(payload)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as VerifiedBookingSession;
  if (parsed.expiresAt < Date.now()) return null;
  return parsed;
}
