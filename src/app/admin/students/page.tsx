import { Badge, Card, LinkButton, TextInput, Button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listBatches, listStudents } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";

export default async function StudentsIndexPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;

  if (q?.trim()) {
    const results = await listStudents(user, { search: q });
    return (
      <div className="grid gap-6">
        <Header />
        <Card>
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <TextInput name="q" defaultValue={q} placeholder="بحث عام بالاسم / الهاتف / الرمز / رقم الحجز" className="min-h-12" />
            <Button className="min-h-12">بحث</Button>
          </form>
        </Card>
        <div className="grid gap-3">
          {results.map((student) => (
            <Card key={student.id}>
              <h2 className="text-xl font-black text-[var(--olive-dark)]">{student.full_name}</h2>
              <p className="mt-1 text-sm font-bold text-[var(--olive)]">{student.batch?.name}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                الرمز: <span className="ltr font-black text-[var(--olive-dark)]">{student.code}</span> · {statusLabels[student.submission_status ?? "pending"]}
              </p>
              <LinkButton href={`/admin/batches/${student.batch_id}/students`} className="mt-3" variant="secondary">
                فتح دفعة الطالب
              </LinkButton>
            </Card>
          ))}
          {!results.length ? <Card>لا توجد نتائج.</Card> : null}
        </div>
      </div>
    );
  }

  const batches = await listBatches(user);
  return (
    <div className="grid gap-6">
      <Header />
      <Card>
        <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <TextInput name="q" placeholder="بحث عام اختياري عبر كل الدفعات المسموح بها" className="min-h-12" />
          <Button className="min-h-12">بحث عام</Button>
        </form>
      </Card>
      <div className="grid gap-4">
        {batches.map((batch) => (
          <Card key={batch.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-[var(--olive-dark)]">{batch.name}</h2>
                <p className="mt-2 text-[var(--muted)]">
                  {batch.stats.total} طالب · {batch.stats.submitted} مكتمل · {batch.stats.pending} غير مكتمل
                </p>
                <Badge className="mt-3">{statusLabels[batch.status]}</Badge>
              </div>
              <LinkButton href={`/admin/batches/${batch.id}/students`}>عرض الطلاب</LinkButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <p className="text-sm font-bold text-[var(--gold)]">Students by Batch</p>
      <h1 className="text-4xl font-black text-[var(--olive-dark)]">الطلاب</h1>
      <p className="mt-2 text-[var(--muted)]">الطلاب منظمون حسب الدفعة. اختر دفعة أولاً.</p>
    </div>
  );
}
