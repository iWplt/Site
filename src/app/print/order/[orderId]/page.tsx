import { notFound } from "next/navigation";
import { BookingPrintCard } from "@/components/booking-print-card";
import { requireUser } from "@/lib/auth";
import { getSubmissionDetail } from "@/lib/data";

export default async function AdminOrderPrintPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser();
  const { orderId } = await params;
  const detail = await getSubmissionDetail(user, orderId);
  if (!detail) notFound();
  return (
    <main className="print-page min-h-screen bg-[var(--paper)] px-3 py-6">
      <BookingPrintCard detail={detail} referenceImageUrls={detail.referenceImageUrls} showActions />
    </main>
  );
}
