import { AccessCodeForm } from "@/components/access-code-form";
import {
  EditorialPhotoSection,
  PhotoMosaic,
  PublicVisualHero,
  PublicVisualShell,
  StudentGalleryStrip
} from "@/components/public-visuals";
import { Card, LogoMark } from "@/components/ui";
import { PublicNotice } from "@/components/public-notice";
import { PUBLIC_VISUALS } from "@/lib/brand-assets";
import { getPublicForm } from "@/lib/data";
import { sbPublicFormAvailability } from "@/lib/store/supabase-db";

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await getPublicForm(slug, { resolveImages: false });
  if (!form) {
    const availability = await sbPublicFormAvailability(slug).catch(() => "missing" as const);
    if (availability === "unpublished") {
      return (
        <PublicNotice
          title="النموذج غير منشور حالياً"
          description="بطاقة الحجز غير متاحة في الوقت الحالي. يرجى التواصل مع ممثل الدفعة."
        />
      );
    }
    return (
      <PublicNotice title="النموذج غير موجود" description="رابط الحجز غير صحيح أو لم يعد متاحاً." actionHref="/" actionLabel="العودة" />
    );
  }
  const visuals = PUBLIC_VISUALS.access;

  return (
    <PublicVisualShell variant="access">
      <header className="mb-4">
        <LogoMark priority />
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-8">
        <section className="min-w-0">
          <PublicVisualHero
            asset={visuals.hero}
            aspect="1/1"
            highPriority
            sizes="(max-width: 430px) 100vw, (max-width: 1024px) 92vw, 560px"
          />
          <p className="mt-4 text-sm font-bold text-[var(--gold)]">بطاقة الحجز الرسمية</p>
          <h1 className="mt-2 max-w-2xl text-[1.75rem] font-black leading-[1.4] text-[var(--olive-dark)] sm:text-5xl">
            {form.name}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-[var(--muted)] sm:leading-8">
            أدخل رمز الحجز الخاص بك للمتابعة إلى اختيار الروب والوشاح والقبعة وإرفاق التصاميم المطلوبة.
          </p>
        </section>

        <Card className="relative z-10 flex-1 !rounded-[1.5rem] !bg-[var(--paper)] !p-4 sm:!rounded-[1.75rem] sm:!p-7">
          <p className="text-sm font-bold text-[var(--gold)]">الدخول الآمن للطلاب</p>
          <h2 className="mt-2 text-2xl font-black text-[var(--olive-dark)] sm:text-3xl">أدخل رمز الحجز الخاص بك</h2>
          <p className="mt-3 leading-8 text-[var(--muted)]">للحصول على رمز الحجز يرجى التواصل مع ممثل الدفعة.</p>
          <AccessCodeForm slug={slug} />
        </Card>
      </div>

      <PhotoMosaic assets={visuals.mosaic} className="mt-6" />
      <StudentGalleryStrip items={visuals.gallery} className="mt-6" />
      <EditorialPhotoSection items={visuals.editorial} className="mt-6" />
    </PublicVisualShell>
  );
}
