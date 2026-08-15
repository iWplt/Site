"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="warka-card max-w-md rounded-[1.5rem] p-6">
        <h1 className="text-2xl font-black text-[var(--olive-dark)]">تعذر تحميل الصفحة</h1>
        <p className="mt-3 text-[var(--muted)]">حدث خطأ مؤقت. يمكنك المحاولة مرة أخرى دون فقدان بياناتك.</p>
        <button type="button" className="mt-5 min-h-12 rounded-2xl bg-[var(--olive)] px-5 font-bold text-[var(--paper)]" onClick={reset}>
          إعادة المحاولة
        </button>
      </section>
    </main>
  );
}
