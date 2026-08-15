"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="warka-card max-w-lg rounded-[1.5rem] p-6">
      <h1 className="text-2xl font-black text-[var(--olive-dark)]">تعذر إكمال العملية</h1>
      <p className="mt-3 text-[var(--muted)]">حدث خطأ مؤقت في لوحة التحكم. لن يتم عرض تفاصيل تقنية.</p>
      <button type="button" className="mt-5 min-h-12 rounded-2xl bg-[var(--olive)] px-5 font-bold text-[var(--paper)]" onClick={reset}>
        إعادة المحاولة
      </button>
    </section>
  );
}
