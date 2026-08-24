"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  ClipboardList,
  FileText,
  GraduationCap,
  History,
  Home,
  Layers,
  LogOut,
  Menu,
  Package,
  ScanLine,
  Search,
  Settings,
  Upload,
  UserRound,
  Users,
  X
} from "lucide-react";
import { LogoMark } from "@/components/ui";
import { ViewportGate } from "@/components/viewport-gate";
import { AdminSearchBox } from "@/components/admin-search-box";
import { logoutAction } from "@/app/actions";
import type { AppUser } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: typeof Home };
type NavGroup = { label: string; items: NavLink[] };

const ownerNav: Array<NavLink | NavGroup> = [
  { href: "/admin", label: "لوحة التحكم", icon: Home },
  {
    label: "النماذج والمنتجات",
    items: [
      { href: "/admin/batches", label: "الدفعات", icon: GraduationCap },
      { href: "/admin/forms", label: "النماذج", icon: FileText },
      { href: "/admin/products", label: "المنتجات", icon: Package },
      { href: "/admin/products?view=models", label: "الموديلات", icon: Layers },
      { href: "/admin/settings", label: "الصلاحيات", icon: Settings }
    ]
  },
  { href: "/admin/students", label: "الطلاب", icon: Users },
  { href: "/admin/representatives", label: "الممثلون", icon: UserRound },
  { href: "/admin/import", label: "الاستيراد", icon: Upload },
  { href: "/admin/orders", label: "الطلبات", icon: ClipboardList },
  { href: "/admin/pickup", label: "الاستلام", icon: ScanLine },
  { href: "/admin/search", label: "بحث", icon: Search },
  { href: "/admin/export", label: "تصدير", icon: Upload },
  { href: "/admin/audit", label: "سجل التدقيق", icon: History }
];

const repNav: Array<NavLink | NavGroup> = [
  { href: "/admin", label: "لوحة التحكم", icon: Home },
  { href: "/admin/search", label: "بحث", icon: Search },
  { href: "/admin/batches", label: "دفعاتي", icon: GraduationCap },
  { href: "/admin/orders", label: "طلبات دفعاتي", icon: ClipboardList },
  { href: "/admin/pickup", label: "الاستلام", icon: ScanLine }
];

function isActivePath(href: string, pathname: string, search: string) {
  const [path, query] = href.split("?");
  if (path === "/admin") return pathname === "/admin";
  if (query?.includes("view=models")) return pathname === "/admin/products" && search.includes("view=models");
  if (path === "/admin/products") return pathname === "/admin/products" && !search.includes("view=models");
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavLinks({
  items,
  pathname,
  search,
  onNavigate
}: {
  items: NavLink[];
  pathname: string;
  search: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <>
      {items.map((item) => {
        const active = isActivePath(item.href, pathname, search);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={() => onNavigate(item.href)}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold",
              active ? "bg-[var(--olive)] text-[var(--paper)]" : "text-[var(--olive)] hover:bg-[#3f472d0d]"
            )}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AdminShell({ children, user }: { children: React.ReactNode; user: AppUser }) {
  const nav = user.role === "OWNER" ? ownerNav : repNav;
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const navigating = Boolean(pendingHref && pendingHref !== pathname);

  return (
    <main className="min-h-screen bg-[#f6efe1]">
      {navigating ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 bg-[var(--olive)]" aria-hidden />
      ) : null}
      <ViewportGate maxWidth={1023}>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--paper)]/95 px-3 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <LogoMark compact priority />
            <button type="button" className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--border)]" onClick={() => setOpen(true)} aria-label="فتح القائمة" aria-expanded={open}>
              <Menu size={18} />
            </button>
          </div>
          <div className="mt-3">
            <AdminSearchBox compact />
          </div>
        </header>
      </ViewportGate>

        <div className="lg:grid lg:min-h-screen lg:grid-cols-[280px_1fr]">
        {open ? <button type="button" className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-label="إغلاق" /> : null}

        <aside
          className={cn(
            "z-50 border-[var(--border)] bg-[var(--paper)] p-4",
            "fixed inset-y-0 right-0 w-[min(20rem,88vw)] translate-x-full overflow-y-auto transition lg:static lg:h-screen lg:w-auto lg:translate-x-0 lg:border-b-0 lg:border-l",
            open ? "translate-x-0 pointer-events-auto" : "pointer-events-none lg:pointer-events-auto"
          )}
        >
          <div className="mb-4 flex items-center justify-between lg:block">
            <ViewportGate minWidth={1024}>
              <LogoMark />
            </ViewportGate>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] lg:hidden" onClick={() => setOpen(false)} aria-label="إغلاق القائمة">
              <X size={16} />
            </button>
          </div>
          <div className="rounded-3xl bg-[#3f472d0d] p-4">
            <p className="text-sm font-bold text-[var(--muted)]">المستخدم الحالي</p>
            <p className="mt-1 font-black text-[var(--olive-dark)]">{user.fullName}</p>
            <p className="text-xs font-bold text-[var(--gold)]">{user.role === "OWNER" ? "مالك النظام" : "ممثل دفعة"}</p>
          </div>
          <nav className="mt-6 grid grid-cols-1 gap-2">
            {nav.map((entry) => {
              if ("items" in entry) {
                const groupActive = entry.items.some((item) => isActivePath(item.href, pathname, search));
                return (
                  <div
                    key={entry.label}
                    className={cn("rounded-[1.35rem] p-2", groupActive ? "bg-[#3f472d14]" : "bg-[#3f472d08]")}
                  >
                    <p className="px-3 pb-2 pt-1 text-[11px] font-black tracking-wide text-[var(--gold)]">{entry.label}</p>
                    <div className="grid gap-1">
                      <NavLinks
                        items={entry.items}
                        pathname={pathname}
                        search={search}
                        onNavigate={(href) => {
                          setOpen(false);
                          if (href !== pathname) setPendingHref(href);
                        }}
                      />
                    </div>
                  </div>
                );
              }
              return (
                <NavLinks
                  key={entry.href}
                  items={[entry]}
                  pathname={pathname}
                  search={search}
                  onNavigate={(href) => {
                    setOpen(false);
                    if (href !== pathname) setPendingHref(href);
                  }}
                />
              );
            })}
          </nav>
          <form action={logoutAction} className="mt-4">
            <LogoutButton />
          </form>
        </aside>
        <section className="min-w-0 px-3 pb-6 pt-3 sm:p-8">{children}</section>
        </div>
    </main>
  );
}

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-[var(--danger)] hover:bg-[#9d2f2f12] disabled:opacity-60"
      disabled={pending}
    >
      <LogOut size={18} /> {pending ? "جاري الخروج..." : "تسجيل الخروج"}
    </button>
  );
}
