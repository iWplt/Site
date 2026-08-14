import { notFound } from "next/navigation";
import { AccessCodeForm } from "@/components/access-code-form";
import { Card, LogoMark } from "@/components/ui";
import { getPublicForm } from "@/lib/data";

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await getPublicForm(slug);
  if (!form) notFound();

  return (
    <main className="warka-pattern min-h-screen overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 lg:min-h-[calc(100vh-3rem)] lg:flex-row lg:items-center lg:gap-8">
        <section className="flex-1">
          <LogoMark />
          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[var(--border)] shadow-[var(--shadow)] sm:rounded-[2rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/warka/brand-hero.webp" alt="WARKA" className="aspect-[16/10] w-full object-cover" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/warka/robe-gulf.webp" alt="" className="aspect-square rounded-2xl object-cover" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/warka/sash-royal-triangle.webp" alt="" className="aspect-square rounded-2xl object-cover" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/warka/cap-royal.webp" alt="" className="aspect-square rounded-2xl object-cover" />
          </div>
          <p className="mt-5 text-sm font-bold text-[var(--gold)]">بطاقة الحجز الرسمية</p>
          <h1 className="mt-2 max-w-2xl text-[1.85rem] font-black leading-[1.45] text-[var(--olive-dark)] sm:text-5xl">{form.name}</h1>
          <p className="mt-3 max-w-xl text-base leading-8 text-[var(--muted)]">
            تجربة رقمية مستوحاة من بطاقة WARKA الأصلية، مصممة أولاً للهاتف مع حفظ الرمز والطلب بشكل آمن.
          </p>
        </section>
        <Card className="flex-1 !rounded-[1.5rem] !p-4 sm:!rounded-[1.75rem] sm:!p-7">
          <p className="text-sm font-bold text-[var(--gold)]">الدخول الآمن للطلاب</p>
          <h2 className="mt-2 text-2xl font-black text-[var(--olive-dark)] sm:text-3xl">أدخل رمز الحجز الخاص بك</h2>
          <p className="mt-3 leading-8 text-[var(--muted)]">للحصول على رمز الحجز يرجى التواصل مع ممثل الدفعة.</p>
          <AccessCodeForm slug={slug} />
        </Card>
      </div>
    </main>
  );
}
