import { notFound } from "next/navigation";
import { AccessCodeForm } from "@/components/access-code-form";
import { Card, LogoMark } from "@/components/ui";
import { getPublicForm } from "@/lib/data";

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await getPublicForm(slug);
  if (!form) notFound();

  return (
    <main className="warka-pattern min-h-screen px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:min-h-[calc(100vh-4rem)] lg:flex-row lg:items-center">
        <section className="flex-1">
          <LogoMark />
          <p className="mt-10 text-sm font-bold text-[var(--gold)]">بطاقة الحجز الرسمية</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[1.35] text-[var(--olive-dark)] sm:text-6xl">
            {form.name}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-9 text-[var(--muted)]">
            تجربة رقمية مستوحاة من بطاقة WARKA الأصلية، مصممة للطلاب على الهاتف مع حفظ الرمز والطلب بشكل آمن.
          </p>
        </section>
        <Card className="flex-1">
          <p className="text-sm font-bold text-[var(--gold)]">الدخول الآمن للطلاب</p>
          <h2 className="mt-2 text-3xl font-black text-[var(--olive-dark)]">أدخل رمز الحجز الخاص بك</h2>
          <p className="mt-3 leading-8 text-[var(--muted)]">للحصول على رمز الحجز يرجى التواصل مع ممثل الدفعة.</p>
          <AccessCodeForm slug={slug} />
        </Card>
      </div>
    </main>
  );
}
