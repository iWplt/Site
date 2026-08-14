import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Batch, Role } from "@/lib/types";

export type AppUser = {
  id: string;
  email?: string;
  role: Role;
  fullName: string;
};

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  if (!supabase) {
    return {
      id: "demo-owner",
      email: "owner@warka.local",
      role: "OWNER",
      fullName: "مالك WARKA"
    };
  }

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

export async function requireUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/admin");
  return user;
}

export async function canAccessBatch(user: AppUser, batch: Pick<Batch, "id" | "representative_id">) {
  if (user.role === "OWNER") return true;
  return batch.representative_id === user.id;
}
