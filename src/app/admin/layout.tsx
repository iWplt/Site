import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f6efe1]" />}>
      <AdminShell user={user}>{children}</AdminShell>
    </Suspense>
  );
}
