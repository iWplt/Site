import "server-only";

import crypto from "node:crypto";
import { isProductionRuntime } from "@/lib/env";

export type BookingReceipt = {
  submissionId: string;
  bookingNumber: string;
  expiresAt: number;
};

function secret() {
  const value = process.env.BOOKING_SESSION_SECRET?.trim();
  if (value) return value;
  if (isProductionRuntime()) {
    throw new Error("Missing required environment variable: BOOKING_SESSION_SECRET");
  }
  return "warka-local-session-secret";
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function hmacEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function receiptTtlMs() {
  const days = Number(process.env.RECEIPT_TTL_DAYS ?? "30");
  const safeDays = Number.isFinite(days) ? Math.min(120, Math.max(1, Math.trunc(days))) : 30;
  return safeDays * 24 * 60 * 60 * 1000;
}

export function signBookingReceipt(
  input: { submissionId: string; bookingNumber: string },
  ttlMs = receiptTtlMs()
) {
  const payload: BookingReceipt = {
    submissionId: input.submissionId,
    bookingNumber: input.bookingNumber,
    expiresAt: Date.now() + ttlMs
  };
  const encoded = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function inspectBookingReceipt(token: string | undefined): "invalid" | "expired" | BookingReceipt {
  if (!token) return "invalid";
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return "invalid";
  const expected = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  if (!hmacEqual(signature, expected)) return "invalid";
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as BookingReceipt;
    if (!parsed.submissionId || !parsed.bookingNumber) return "invalid";
    if (parsed.expiresAt < Date.now()) return "expired";
    return parsed;
  } catch {
    return "invalid";
  }
}

export function verifyBookingReceipt(token: string | undefined): BookingReceipt | null {
  const inspected = inspectBookingReceipt(token);
  if (inspected === "invalid" || inspected === "expired") return null;
  return inspected;
}

export function bookingQrPayload(bookingNumber: string) {
  return `WARKA:${bookingNumber}`;
}
