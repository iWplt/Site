import { Badge, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listBatches, listStudents, listSubmissions } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";

export default async function AdminDashboardPage() {
  const user = await requireUser();
  const [batches, students, submissions] = await Promise.all([listBatches(user), listStudents(user), listSubmissions(user)]);
  const pending = students.filter((student) => student.submission_status !== "submitted").length;
  const ready = submissions.filter((submission) => submission.status === "READY").length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">WARKA Booking Management</p>
          <h1 className="text-4xl font-black text-[var(--olive-dark)]">لوحة التحكم</h1>
        </div>
        <LinkButton href="/f/cybersecurity-2027" variant="secondary">معاينة النموذج العام</LinkButton>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Metric label="الدفعات النشطة" value={batches.filter((batch) => batch.status === "active").length} />
        <Metric label="إجمالي الطلاب" value={students.length} />
        <Metric label="الطلبات المستلمة" value={submissions.length} />
        <Metric label="طلاب غير مكتملين" value={pending} />
        <Metric label="قيد التجهيز" value={submissions.filter((entry) => entry.status === "IN_PRODUCTION").length} />
        <Metric label="جاهزة" value={ready} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[var(--gold)]">دفعة حالية</p>
              <h2 className="text-2xl font-black text-[var(--olive-dark)]">{batches[0]?.name}</h2>
            </div>
            <Badge>{statusLabels[batches[0]?.status ?? "active"]}</Badge>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <MiniStat label="الجامعة" value={batches[0]?.university ?? "-"} />
            <MiniStat label="الكلية" value={batches[0]?.college ?? "-"} />
            <MiniStat label="القسم" value={batches[0]?.department ?? "-"} />
            <MiniStat label="سنة التخرج" value={batches[0]?.graduation_year ?? "-"} />
          </div>
        </Card>
        <Card>
          <h2 className="text-2xl font-black text-[var(--olive-dark)]">أسرع مسار للممثل</h2>
          <p className="mt-2 leading-8 text-[var(--muted)]">ابحث عن الطالب، انسخ الرمز، أو أعد توليده من شاشة واحدة مهيأة للهاتف.</p>
          <LinkButton href="/admin/students" className="mt-5">فتح بحث الطلاب</LinkButton>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-3xl">
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-4xl font-black text-[var(--olive-dark)]">{value}</p>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white/60 p-4">
      <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-black text-[var(--olive-dark)]">{value}</p>
    </div>
  );
}
