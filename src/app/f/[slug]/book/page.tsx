import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BookingWizard } from "@/components/booking-wizard";
import { LogoMark } from "@/components/ui";
import { getPublicForm } from "@/lib/data";
import { verifyBookingSession } from "@/lib/security";

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const session = verifyBookingSession(cookieStore.get("warka_booking_session")?.value);
  if (!session || session.slug !== slug) redirect(`/f/${slug}`);

  const form = await getPublicForm(slug);
  if (!form) redirect(`/f/${slug}`);

  return (
    <main className="warka-pattern min-h-screen px-4 py-6">
      <header className="mx-auto mb-6 max-w-5xl">
        <LogoMark />
      </header>
      <BookingWizard form={form} studentName={session.studentName} />
    </main>
  );
}
