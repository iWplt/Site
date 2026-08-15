import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv, getServerSupabaseKey } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url } = getPublicSupabaseEnv();
  const key = getServerSupabaseKey();

  if (!url || !key) {
    return null;
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; middleware and actions handle writes.
        }
      }
    }
  });
}
