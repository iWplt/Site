"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function AdminSearchBox({ defaultValue = "", compact = false }: { defaultValue?: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={compact ? "flex min-w-0 gap-2" : "grid gap-2 sm:grid-cols-[1fr_auto]"}
      action={(formData) => {
        const q = String(formData.get("q") ?? "").trim();
        startTransition(() => router.push(q ? `/admin/search?q=${encodeURIComponent(q)}` : "/admin/search"));
      }}
    >
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder="بحث: اسم، هاتف، رقم حجز، دفعة..."
        className="min-h-12 w-full min-w-0 rounded-2xl border border-[var(--border)] bg-white px-4 text-base"
      />
      <button type="submit" className="min-h-12 shrink-0 rounded-2xl bg-[var(--olive)] px-4 font-bold text-[var(--paper)] sm:px-5" disabled={pending}>
        بحث
      </button>
    </form>
  );
}
