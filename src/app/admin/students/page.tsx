import { CreateIndividualStudentForm } from "@/components/create-individual-student-form";
import { IndividualStudentsPanel } from "@/components/individual-students-panel";
import { Badge, Button, Card, LinkButton, TextInput } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { listBatches, listStudents, getUniformTemplateDefinition } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";
import { configuredAppUrl, requestOrigin } from "@/lib/public-url";

export default async function StudentsIndexPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const needle = q?.trim();
  const origin = configuredAppUrl() || (await requestOrigin()) || "";
  const [batches, students, definition] = await Promise.all([
    listBatches(user),
    listStudents(user, { search: needle }),
    user.role === "OWNER" ? getUniformTemplateDefinition() : Promise.resolve(null)
  ]);

  const individuals = students.filter((student) => !student.batch_id);
  const batchStudents = students.filter((student) => student.batch_id);

  return (
    <div className="grid gap-4 sm:gap-6">
      <div>
        <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">الطلاب</h1>
        <p className="mt-1 text-sm text-[var(--muted)] sm:text-base">إدارة طلاب الدفعات والطلاب الفرديين</p>
      </div>

      {user.role === "OWNER" && definition ? (
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <CreateIndividualStudentForm definition={definition} />
          <LinkButton href="/admin/import" variant="secondary" className="min-h-12 items-center justify-center">
            استيراد طلاب
          </LinkButton>
        </div>
      ) : null}

      <Card className="!rounded-[1.35rem] !p-3 sm:!p-5">
        <form className="grid gap-2 sm:grid-cols-[1fr_auto]" method="get">
          <TextInput name="q" defaultValue={q} placeholder="بحث بالاسم / الهاتف / الرمز / رقم الحجز" className="min-h-12" />
          <Button className="min-h-12">بحث</Button>
        </form>
      </Card>

      {needle ? (
        <p className="text-sm font-bold text-[var(--olive)]">نتائج البحث في الدفعات والطلاب الفرديين</p>
      ) : null}

      <section className="grid gap-3">
        <h2 className="text-xl font-black text-[var(--olive-dark)]">طلاب الدفعات</h2>
        {batches.map((batch) => (
          <Card key={batch.id} className="!rounded-[1.35rem]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-[var(--olive-dark)] sm:text-2xl">{batch.name}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {batch.stats.total} طالب · {batch.stats.submitted} مكتمل · {batch.stats.pending} غير مكتمل
                </p>
                <Badge className="mt-2">{statusLabels[batch.status]}</Badge>
              </div>
              <LinkButton href={`/admin/batches/${batch.id}/students`} variant="secondary" className="min-h-11">
                عرض الطلاب
              </LinkButton>
            </div>
            {needle
              ? batchStudents
                  .filter((student) => student.batch_id === batch.id)
                  .map((student) => (
                    <div key={student.id} className="mt-3 rounded-2xl bg-white/70 p-3">
                      <p className="font-black">{student.full_name}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {student.code} · {statusLabels[student.submission_status ?? "pending"]}
                      </p>
                    </div>
                  ))
              : null}
          </Card>
        ))}
        {!batches.length ? (
          <EmptyState title="لا توجد دفعات بعد" description="أنشئ دفعة ثم أضف الطلاب من صفحة الدفعة." actionHref="/admin/batches/new" actionLabel="إنشاء دفعة" />
        ) : null}
      </section>

      {user.role === "OWNER" ? (
        <section className="grid gap-3">
          <h2 className="text-xl font-black text-[var(--olive-dark)]">الطلاب الفرديين</h2>
          {individuals.length ? (
            <IndividualStudentsPanel students={individuals} origin={origin} />
          ) : (
            <Card>لا يوجد طلاب فرديون بعد.</Card>
          )}
        </section>
      ) : null}
    </div>
  );
}
