import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listSubmissions } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";
import { formatArabicDate } from "@/lib/utils";

export default async function OrdersPage() {
  const user = await requireUser();
  const submissions = await listSubmissions(user);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">Order Management</p>
        <h1 className="text-4xl font-black text-[var(--olive-dark)]">الطلبات والحجوزات</h1>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-3 text-sm">
            <thead>
              <tr className="text-right text-[var(--muted)]">
                <th className="px-3">رقم الحجز</th>
                <th className="px-3">الطالب</th>
                <th className="px-3">النموذج</th>
                <th className="px-3">الدفعة</th>
                <th className="px-3">الحالة</th>
                <th className="px-3">تاريخ الإرسال</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.id} className="bg-white/65">
                  <td className="rounded-r-2xl px-3 py-4 font-black ltr">{submission.booking_number}</td>
                  <td className="px-3 py-4 font-bold">{submission.student_name}</td>
                  <td className="px-3 py-4">{submission.form_name}</td>
                  <td className="px-3 py-4">{submission.batch_name}</td>
                  <td className="px-3 py-4"><Badge tone="green">{statusLabels[submission.status]}</Badge></td>
                  <td className="rounded-l-2xl px-3 py-4">{formatArabicDate(submission.submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
