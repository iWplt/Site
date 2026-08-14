import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export function createAdminClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
