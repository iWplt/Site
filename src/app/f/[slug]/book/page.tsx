import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BookingWizard } from "@/components/booking-wizard";
import {
  PhotoMosaic,
  PublicVisualHero,
  PublicVisualShell,
  StudentGalleryStrip
} from "@/components/public-visuals";
import { LogoMark } from "@/components/ui";
import { PUBLIC_VISUALS } from "@/lib/brand-assets";
import { getBookingStudentPrefill, getEffectivePublicForm } from "@/lib/data";
import { verifyBookingSession } from "@/lib/security";

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const session = verifyBookingSession(cookieStore.get("warka_booking_session")?.value);
  if (!session || session.slug !== slug) redirect(`/f/${slug}`);

  const [form, prefill] = await Promise.all([
    getEffectivePublicForm(slug, session.studentId),
    session.studentId ? getBookingStudentPrefill(session.studentId) : Promise.resolve(null)
  ]);
  if (!form) redirect(`/f/${slug}`);
  const visuals = PUBLIC_VISUALS.booking;

  return (
    <PublicVisualShell variant="booking">
      <header className="mb-3 sm:mb-5">
        <LogoMark priority />
        <PublicVisualHero
          asset={visuals.hero}
          aspect="16/7"
          highPriority
          sizes="(max-width: 430px) 100vw, (max-width: 768px) 100vw, 768px"
          className="mt-3 max-h-44 sm:max-h-52"
        />
      </header>
      <BookingWizard
        form={form}
        studentName={session.studentName ?? prefill?.full_name}
        studentPhone={prefill?.phone ?? undefined}
        studentAddress={prefill?.address ?? undefined}
      />
      <PhotoMosaic assets={visuals.mosaic} className="mt-6" />
      <StudentGalleryStrip items={visuals.gallery} title="تفاصيل الأزياء" className="mt-6" />
    </PublicVisualShell>
  );
}
