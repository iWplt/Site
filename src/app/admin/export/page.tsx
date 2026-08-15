import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listBatches } from "@/lib/data";

export default async function ExportPage() {
  const user = await requireUser(["OWNER"]);
  const batches = await listBatches(user);

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">النسخ الاحتياطي</p>
        <h1 className="text-3xl font-black text-[var(--olive-dark)]">تصدير الطلبات</h1>
      </div>
      <Card>
        <form className="grid gap-3" method="get" action="/api/admin/export">
          <label className="text-sm font-bold">النطاق</label>
          <select name="scope" className="min-h-12 rounded-2xl border border-[var(--border)] bg-white px-4">
            <option value="">كل الطلبات</option>
            <option value="individual">الحجوزات الفردية</option>
          </select>
          <label className="text-sm font-bold">دفعة</label>
          <select name="batch" className="min-h-12 rounded-2xl border border-[var(--border)] bg-white px-4">
            <option value="">كل الدفعات</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <label className="text-sm font-bold">الحالة</label>
          <select name="status" className="min-h-12 rounded-2xl border border-[var(--border)] bg-white px-4">
            <option value="">الكل</option>
            <option value="SUBMITTED">تم الاستلام</option>
            <option value="REVIEWED">قيد المراجعة</option>
            <option value="CONFIRMED">تم التأكيد</option>
            <option value="IN_PRODUCTION">قيد التجهيز</option>
            <option value="READY">جاهزة للاستلام</option>
            <option value="DELIVERED">تم التسليم</option>
          </select>
          <label className="text-sm font-bold">من تاريخ</label>
          <input type="date" name="from" className="min-h-12 rounded-2xl border border-[var(--border)] bg-white px-4" />
          <label className="text-sm font-bold">إلى تاريخ</label>
          <input type="date" name="to" className="min-h-12 rounded-2xl border border-[var(--border)] bg-white px-4" />
          <div className="grid gap-2 sm:grid-cols-2">
            <button name="format" value="xlsx" className="min-h-12 rounded-2xl bg-[var(--olive)] font-bold text-[var(--paper)]">
              تنزيل Excel
            </button>
            <button name="format" value="csv" className="min-h-12 rounded-2xl border border-[var(--border)] bg-white font-bold text-[var(--olive)]">
              تنزيل CSV
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
