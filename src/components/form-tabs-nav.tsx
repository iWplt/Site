"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { FORM_TABS, type FormTabId } from "@/lib/form-tabs";

export function FormTabsNav({
  formId,
  active,
  tabs
}: {
  formId: string;
  active: FormTabId;
  tabs: Array<(typeof FORM_TABS)[number]>;
}) {
  const router = useRouter();
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-bold text-[var(--olive-dark)] sm:hidden">قسم الإدارة</label>
      <select
        className="h-11 min-h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--paper)] px-4 font-bold text-[var(--olive-dark)] sm:hidden"
        value={active}
        onChange={(event) => router.push(`/admin/forms/${formId}?tab=${event.target.value}`)}
      >
        {tabs.map((tab) => (
          <option key={tab.id} value={tab.id}>
            {tab.label}
          </option>
        ))}
      </select>
      <nav className="-mx-1 hidden overflow-x-auto px-1 sm:block" aria-label="أقسام إدارة النموذج">
        <div className="flex w-max min-w-full gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={`/admin/forms/${formId}?tab=${tab.id}`}
              prefetch
              className={cn(
                "inline-flex h-10 min-h-10 shrink-0 items-center justify-center rounded-full px-4 text-sm font-bold",
                tab.id === active
                  ? "bg-[var(--olive)] text-[var(--paper)]"
                  : "border border-[var(--border)] bg-[var(--paper)] text-[var(--olive)]"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
