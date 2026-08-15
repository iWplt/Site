import "server-only";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccessCodeHmacSecret } from "@/lib/access-code-scope";
import { hasServiceRole } from "@/lib/env";

export const ACCESS_CODE_RATE_LIMIT_MESSAGE =
  "تجاوزت عدد المحاولات المسموح. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.";

type RateEvent = "check" | "fail" | "success";

type MemoryBucket = {
  windowStartedAt: number;
  failedCount: number;
  cooldownUntil: number | null;
};

const memoryBuckets = new Map<string, MemoryBucket>();
const MEMORY_CAP = 4000;

function safeInt(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function limits() {
  return {
    maxFailures: safeInt(Number(process.env.ACCESS_CODE_RATE_LIMIT_MAX ?? "8"), 8, 3, 20),
    windowSeconds: safeInt(Number(process.env.ACCESS_CODE_RATE_LIMIT_WINDOW_SECONDS ?? "900"), 900, 60, 3600),
    cooldownSeconds: safeInt(Number(process.env.ACCESS_CODE_RATE_LIMIT_COOLDOWN_SECONDS ?? "600"), 600, 30, 3600)
  };
}

function hashBucket(ip: string, slug: string) {
  return crypto.createHmac("sha256", requireAccessCodeHmacSecret()).update(`access-code-rate:${slug}:${ip}`).digest("hex");
}

export async function clientRateBucket(slug: string) {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headerList.get("x-real-ip")?.trim() || headerList.get("cf-connecting-ip")?.trim() || "unknown";
  return hashBucket(ip, slug);
}

function memoryGuard(bucketHash: string, event: RateEvent) {
  const { maxFailures, windowSeconds, cooldownSeconds } = limits();
  const now = Date.now();
  if (memoryBuckets.size > MEMORY_CAP) {
    const oldest = memoryBuckets.keys().next().value;
    if (oldest) memoryBuckets.delete(oldest);
  }
  const current = memoryBuckets.get(bucketHash) ?? {
    windowStartedAt: now,
    failedCount: 0,
    cooldownUntil: null
  };

  if (current.cooldownUntil && current.cooldownUntil > now) {
    memoryBuckets.set(bucketHash, current);
    return { limited: true };
  }

  if (current.cooldownUntil && current.cooldownUntil <= now) {
    current.windowStartedAt = now;
    current.failedCount = 0;
    current.cooldownUntil = null;
  } else if (now - current.windowStartedAt > windowSeconds * 1000) {
    current.windowStartedAt = now;
    current.failedCount = 0;
    current.cooldownUntil = null;
  }

  if (event === "check") {
    memoryBuckets.set(bucketHash, current);
    return { limited: false };
  }

  if (event === "success") {
    memoryBuckets.delete(bucketHash);
    return { limited: false };
  }

  current.failedCount += 1;
  if (current.failedCount >= maxFailures) {
    current.cooldownUntil = now + cooldownSeconds * 1000;
  }
  memoryBuckets.set(bucketHash, current);
  return { limited: Boolean(current.cooldownUntil && current.cooldownUntil > now) };
}

export async function guardAccessCodeAttempt(bucketHash: string, event: RateEvent): Promise<{ limited: boolean }> {
  if (hasServiceRole()) {
    try {
      const admin = createAdminClient();
      const { maxFailures, windowSeconds, cooldownSeconds } = limits();
      const { data, error } = await admin.rpc("check_access_code_rate_limit", {
        p_bucket_hash: bucketHash,
        p_event: event,
        p_max_failures: maxFailures,
        p_window_seconds: windowSeconds,
        p_cooldown_seconds: cooldownSeconds
      });
      if (!error && data && typeof data === "object") {
        return { limited: Boolean((data as { limited?: boolean }).limited) };
      }
    } catch {
      // SQL guard not applied yet — keep a process-local fallback.
    }
  }
  return memoryGuard(bucketHash, event);
}
