import { notFound } from "next/navigation";
import { BookingPrintCard } from "@/components/booking-print-card";
import { getPublicSubmissionByReceipt } from "@/lib/data";

export default async function BookingPrintPage({ params }: { params: Promise<{ receipt: string }> }) {
  const { receipt } = await params;
  const token = decodeURIComponent(receipt);
  const detail = await getPublicSubmissionByReceipt(token);
  if (!detail) notFound();
  return (
    <main className="print-page min-h-screen bg-[var(--paper)] px-3 py-6">
      <BookingPrintCard detail={detail} referenceImageUrls={detail.referenceImageUrls} showActions receiptToken={token} />
    </main>
  );
}
