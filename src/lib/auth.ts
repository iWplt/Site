import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { readDb } from "@/lib/store/local-db";
import type { Role } from "@/lib/types";

export type AppUser = {
  id: string;
  email?: string;
  role: Role;
  fullName: string;
  batchIds?: string[];
};

const AUTH_COOKIE = "warka_admin_session";

export async function getCurrentUser(): Promise<AppUser | null> {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    if (!supabase) return null;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, full_name, disabled")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || profile.disabled) return null;
    return {
      id: profile.id,
      email: user.email ?? undefined,
      role: profile.role,
      fullName: profile.full_name
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) {
    // Dev convenience: auto owner session if none exists yet for local demos.
    // Explicit login still preferred for representative isolation tests.
    return null;
  }

  const db = readDb();
  const session = db.sessions.find((entry) => entry.token === token && entry.expires_at > Date.now());
  if (!session) return null;
  const profile = db.profiles.find((entry) => entry.id === session.user_id && !entry.disabled);
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    fullName: profile.full_name,
    batchIds: profile.batch_ids
  };
}

export async function requireUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/admin");
  return user;
}

export async function canAccessBatch(user: AppUser, batchId: string) {
  if (user.role === "OWNER") return true;
  if (user.batchIds?.includes(batchId)) return true;
  const db = readDb();
  const profile = db.profiles.find((entry) => entry.id === user.id);
  return Boolean(profile?.batch_ids.includes(batchId));
}

export { AUTH_COOKIE };
