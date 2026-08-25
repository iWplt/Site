export function getPublicSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined
  };
}

export function getServerSupabaseKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined;
}

export function hasSupabaseConfig() {
  const { url } = getPublicSupabaseEnv();
  return Boolean(url && getServerSupabaseKey());
}

export function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function hasAccessCodeSecrets() {
  return Boolean(
    process.env.ACCESS_CODE_ENCRYPTION_KEY?.trim() &&
      process.env.ACCESS_CODE_HMAC_SECRET?.trim() &&
      process.env.BOOKING_SESSION_SECRET?.trim()
  );
}

export function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function requireSupabaseSecretsForWrites() {
  if (!hasSupabaseConfig()) {
    throw new Error(
      "WARKA configuration error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."
    );
  }
  if (!hasServiceRole()) {
    throw new Error(
      "WARKA configuration error: SUPABASE_SERVICE_ROLE_KEY is required for privileged server writes."
    );
  }
}

/**
 * True when this process is serving a real production deployment.
 * Excludes Next.js build/export phases where NODE_ENV is also "production".
 *
 * Cloudflare Workers (OpenNext): set WARKA_RUNTIME_ENV=production via wrangler `vars`
 * or `.dev.vars` for preview. CF_PAGES is left as a secondary signal for Pages deploys.
 */
export function isProductionRuntime() {
  if (process.env.WARKA_RUNTIME_ENV === "production") return true;
  if (process.env.VERCEL_ENV === "production") return true;
  if (process.env.CONTEXT === "production" && process.env.NETLIFY === "true") return true;
  if (process.env.CF_PAGES === "1" && process.env.CF_PAGES_BRANCH === "main") return true;

  if (process.env.NODE_ENV === "production") {
    const phase = process.env.NEXT_PHASE;
    if (phase === "phase-production-build" || phase === "phase-export") {
      return false;
    }
    return true;
  }

  return false;
}

export type EnvValidationResult =
  | { ok: true; mode: "supabase" | "local-demo" }
  | { ok: false; error: string };

export function validateRuntimeEnvironment(): EnvValidationResult {
  const production = isProductionRuntime();
  const supabase = hasSupabaseConfig();

  if (production) {
    if (!supabase) {
      return {
        ok: false,
        error:
          "WARKA production requires Supabase. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Local demo persistence (.data/warka-db.json) is forbidden in production."
      };
    }
    if (!hasServiceRole()) {
      return {
        ok: false,
        error: "WARKA production requires SUPABASE_SERVICE_ROLE_KEY (server-only). Do not expose it to the browser."
      };
    }
    if (!hasAccessCodeSecrets()) {
      return {
        ok: false,
        error:
          "WARKA production requires ACCESS_CODE_ENCRYPTION_KEY, ACCESS_CODE_HMAC_SECRET, and BOOKING_SESSION_SECRET."
      };
    }
    if (!process.env.NEXT_PUBLIC_APP_URL?.trim() && !process.env.URL?.trim()) {
      return {
        ok: false,
        error: "WARKA production requires NEXT_PUBLIC_APP_URL (or Netlify URL) for booking, receipt, and QR links."
      };
    }
    return { ok: true, mode: "supabase" };
  }

  if (supabase) {
    return { ok: true, mode: "supabase" };
  }

  return { ok: true, mode: "local-demo" };
}
