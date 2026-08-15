"use client";

import { Eye, Printer } from "lucide-react";

export function PrintToolbar({ confirmationHref }: { confirmationHref?: string }) {
  return (
    <div className="print:hidden mx-auto mb-5 flex w-full max-w-[920px] flex-col items-stretch justify-center gap-2 px-1 sm:flex-row sm:items-center">
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--olive)] px-5 text-sm font-bold text-[var(--paper)]"
        onClick={() => window.print()}
      >
        <Printer size={16} strokeWidth={2.2} />
        طباعة / حفظ PDF
      </button>
      {confirmationHref ? (
        <a
          href={confirmationHref}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--olive)] bg-[var(--paper)] px-5 text-sm font-bold text-[var(--olive)]"
        >
          <Eye size={16} strokeWidth={2.2} />
          عرض التأكيد
        </a>
      ) : null}
    </div>
  );
}
