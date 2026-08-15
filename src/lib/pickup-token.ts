import "server-only";

import crypto from "node:crypto";
import { encryptAccessCode, decryptAccessCode } from "@/lib/security";
import { requireEnv } from "@/lib/env";

const TOKEN_BYTES = 32;

function pickupHmacSecret() {
  return requireEnv("BOOKING_SESSION_SECRET");
}

export function hashPickupToken(token: string) {
  return crypto.createHmac("sha256", pickupHmacSecret()).update(`pickup:${token}`).digest("hex");
}

export function generatePickupToken() {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  return {
    token,
    hash: hashPickupToken(token),
    ciphertext: encryptAccessCode(token)
  };
}

export function readStoredPickupToken(ciphertext: string) {
  return decryptAccessCode(ciphertext);
}

export function parsePickupTokenInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((part) => part === "pickup");
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
  } catch {
    /* not a URL */
  }
  const match = trimmed.match(/pickup\/([^/?#]+)/i);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return trimmed;
}
