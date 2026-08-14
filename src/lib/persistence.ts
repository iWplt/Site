import "server-only";

import { hasSupabaseConfig } from "@/lib/env";

/**
 * Production source of truth is Supabase.
 * Local JSON DB is an explicit development/demo fallback ONLY when
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are absent.
 */
export type PersistenceMode = "supabase" | "local-demo";

export function getPersistenceMode(): PersistenceMode {
  if (hasSupabaseConfig()) return "supabase";
  return "local-demo";
}

export function assertPersistenceAllowed() {
  const mode = getPersistenceMode();
  // Use Vercel production signal, not NODE_ENV, so `next build` can still prerender
  // local-demo routes in CI without Supabase credentials.
  const isVercelProduction = process.env.VERCEL_ENV === "production";
  const forceDemo = process.env.WARKA_ALLOW_LOCAL_DEMO === "true";

  if (isVercelProduction && mode === "local-demo" && !forceDemo) {
    throw new Error(
      "WARKA production requires Supabase. Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return mode;
}

export function persistenceLabel(mode: PersistenceMode = getPersistenceMode()) {
  return mode === "supabase" ? "Supabase (production source of truth)" : "Local demo fallback (.data/warka-db.json)";
}
