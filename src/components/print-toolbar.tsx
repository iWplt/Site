"use client";

export function PrintToolbar({ confirmationHref }: { confirmationHref?: string }) {
  return (
    <div className="print:hidden mx-auto mb-4 flex max-w-[210mm] flex-wrap gap-2">
      <button type="button" className="min-h-12 rounded-2xl bg-[var(--olive)] px-5 py-3 font-bold text-[var(--paper)]" onClick={() => window.print()}>
        طباعة / حفظ PDF
      </button>
      {confirmationHref ? (
        <a href={confirmationHref} className="min-h-12 rounded-2xl border border-[var(--border)] bg-white px-5 py-3 font-bold text-[var(--olive)]">
          عرض التأكيد
        </a>
      ) : null}
    </div>
  );
}
