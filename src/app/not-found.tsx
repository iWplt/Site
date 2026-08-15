import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="warka-card max-w-md rounded-[1.5rem] p-6 text-center">
        <h1 className="text-2xl font-black text-[var(--olive-dark)]">الصفحة غير موجودة</h1>
        <p className="mt-3 text-[var(--muted)]">الرابط غير صحيح أو لم يعد متاحاً.</p>
        <Link href="/" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--olive)] px-5 font-bold text-[var(--paper)]">
          الصفحة الرئيسية
        </Link>
      </section>
    </main>
  );
}
