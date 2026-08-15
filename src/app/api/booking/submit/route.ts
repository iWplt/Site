import { NextResponse } from "next/server";
import { submitBookingAction } from "@/app/actions";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await submitBookingAction(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    bookingNumber: result.bookingNumber,
    studentName: result.studentName,
    status: result.status,
    submittedAt: result.submittedAt,
    submissionId: result.submissionId,
    receiptToken: result.receiptToken,
    batchName: "batchName" in result ? result.batchName : undefined
  });
}
