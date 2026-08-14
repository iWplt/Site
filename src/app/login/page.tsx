import { redirect } from "next/navigation";
import { LoginPageClient } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/admin");
  return <LoginPageClient />;
}
