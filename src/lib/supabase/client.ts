"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/env";

export function createClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error("Supabase browser environment variables are not configured.");
  }
  return createBrowserClient(url, anonKey);
}
