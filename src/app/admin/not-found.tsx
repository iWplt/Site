import Link from "next/link";

export default function AdminNotFound() {
  return (
    <section className="warka-card max-w-lg rounded-[1.5rem] p-6">
      <h1 className="text-2xl font-black text-[var(--olive-dark)]">العنصر غير موجود</h1>
      <p className="mt-3 text-[var(--muted)]">قد يكون الطلب أو الطالب أو الدفعة محذوفاً أو غير مصرح لك بعرضه.</p>
      <Link href="/admin" className="mt-5 inline-flex min-h-12 items-center font-bold text-[var(--olive)]">
        العودة للوحة التحكم
      </Link>
    </section>
  );
}
