import Link from "next/link";
import {
  ClipboardList,
  FileText,
  GraduationCap,
  History,
  Home,
  LogOut,
  Settings,
  Upload,
  UserRound,
  Users
} from "lucide-react";
import { LogoMark } from "@/components/ui";
import { logoutAction } from "@/app/actions";
import type { AppUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const ownerNav = [
  { href: "/admin", label: "لوحة التحكم", icon: Home },
  { href: "/admin/batches", label: "الدفعات", icon: GraduationCap },
  { href: "/admin/students", label: "الطلاب", icon: Users },
  { href: "/admin/representatives", label: "الممثلون", icon: UserRound },
  { href: "/admin/import", label: "الاستيراد", icon: Upload },
  { href: "/admin/forms", label: "النماذج", icon: FileText },
  { href: "/admin/orders", label: "الطلبات", icon: ClipboardList },
  { href: "/admin/audit", label: "سجل التدقيق", icon: History },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings }
];

const repNav = [
  { href: "/admin", label: "بحث سريع", icon: Home },
  { href: "/admin/batches", label: "دفعاتي", icon: GraduationCap },
  { href: "/admin/orders", label: "طلبات دفعاتي", icon: ClipboardList }
];

export function AdminShell({ children, user }: { children: React.ReactNode; user: AppUser }) {
  const nav = user.role === "OWNER" ? ownerNav : repNav;
  return (
    <main className="min-h-screen bg-[#f6efe1]">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-[var(--border)] bg-[var(--paper)]/95 p-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-l">
          <LogoMark />
          <div className="mt-6 rounded-3xl bg-[#3f472d0d] p-4">
            <p className="text-sm font-bold text-[var(--muted)]">المستخدم الحالي</p>
            <p className="mt-1 font-black text-[var(--olive-dark)]">{user.fullName}</p>
            <p className="text-xs font-bold text-[var(--gold)]">{user.role === "OWNER" ? "مالك النظام" : "ممثل دفعة"}</p>
          </div>
          <nav className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn("flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-[var(--olive)] hover:bg-[#3f472d0d]")}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction} className="mt-4">
            <button className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-[var(--danger)] hover:bg-[#9d2f2f12]">
              <LogOut size={18} /> تسجيل الخروج
            </button>
          </form>
        </aside>
        <section className="p-4 sm:p-8">{children}</section>
      </div>
    </main>
  );
}
