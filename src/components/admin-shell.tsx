import Link from "next/link";
import { ClipboardList, FileText, GraduationCap, History, Home, Settings, Upload, Users } from "lucide-react";
import { LogoMark } from "@/components/ui";
import type { AppUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "لوحة التحكم", icon: Home },
  { href: "/admin/batches", label: "الدفعات", icon: GraduationCap },
  { href: "/admin/students", label: "الطلاب والرموز", icon: Users },
  { href: "/admin/import", label: "الاستيراد", icon: Upload },
  { href: "/admin/forms", label: "النماذج", icon: FileText },
  { href: "/admin/orders", label: "الطلبات", icon: ClipboardList },
  { href: "/admin/audit", label: "سجل التدقيق", icon: History },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings }
];

export function AdminShell({ children, user }: { children: React.ReactNode; user: AppUser }) {
  return (
    <main className="min-h-screen bg-[#f6efe1]">
      <div className="grid min-h-screen lg:grid-cols-[290px_1fr]">
        <aside className="border-l border-[var(--border)] bg-[var(--paper)]/90 p-5 lg:sticky lg:top-0 lg:h-screen">
          <LogoMark />
          <div className="mt-8 rounded-3xl bg-[#3f472d0d] p-4">
            <p className="text-sm font-bold text-[var(--muted)]">المستخدم الحالي</p>
            <p className="mt-1 font-black text-[var(--olive-dark)]">{user.fullName}</p>
            <p className="text-xs font-bold text-[var(--gold)]">{user.role === "OWNER" ? "مالك النظام" : "ممثل دفعة"}</p>
          </div>
          <nav className="mt-8 grid gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-[var(--olive)] hover:bg-[#3f472d0d]")}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="p-4 sm:p-8">{children}</section>
      </div>
    </main>
  );
}
