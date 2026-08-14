export function getPublicSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
}

export function hasSupabaseConfig() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return Boolean(url && anonKey);
}

export function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function requireSupabaseSecretsForWrites() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase public env vars are not configured.");
  }
  if (!hasServiceRole()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for privileged writes.");
  }
}
