import "server-only";

import { hasSupabaseConfig, isProductionRuntime, validateRuntimeEnvironment } from "@/lib/env";

/**
 * Production source of truth is Supabase PostgreSQL + Auth + Storage.
 * Local JSON DB (.data/warka-db.json) is allowed ONLY in development / explicit automated tests.
 * In production, local/demo persistence is impossible — even if WARKA_ALLOW_LOCAL_DEMO=true.
 */
export type PersistenceMode = "supabase" | "local-demo";

export function getPersistenceMode(): PersistenceMode {
  if (hasSupabaseConfig()) return "supabase";
  return "local-demo";
}

export function assertPersistenceAllowed(): PersistenceMode {
  const validation = validateRuntimeEnvironment();
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const mode = getPersistenceMode();

  if (isProductionRuntime()) {
    if (mode !== "supabase") {
      throw new Error(
        "WARKA production forbids local/demo persistence. Configure Supabase or the deployment will not start."
      );
    }
    // Explicitly ignore WARKA_ALLOW_LOCAL_DEMO in production.
    if (process.env.WARKA_ALLOW_LOCAL_DEMO === "true") {
      console.warn(
        "[WARKA] WARKA_ALLOW_LOCAL_DEMO=true is ignored in production. Supabase remains mandatory."
      );
    }
    return "supabase";
  }

  return mode;
}

export function assertLocalDemoAllowed() {
  const mode = assertPersistenceAllowed();
  if (mode !== "local-demo") {
    throw new Error("Local demo persistence is not available while Supabase is configured.");
  }
  if (isProductionRuntime()) {
    throw new Error("Local demo persistence is forbidden in production.");
  }
}

export function persistenceLabel(mode: PersistenceMode = getPersistenceMode()) {
  return mode === "supabase"
    ? "Supabase (production source of truth)"
    : "Local demo fallback (.data/warka-db.json) — development only";
}
