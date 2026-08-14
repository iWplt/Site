import { Copy, RotateCw, ShieldOff } from "lucide-react";
import { Badge, Button, Card, TextInput } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listStudents } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const students = await listStudents(user, q);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">Student Access Codes</p>
        <h1 className="text-4xl font-black text-[var(--olive-dark)]">الطلاب والرموز</h1>
      </div>
      <Card>
        <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <TextInput name="q" defaultValue={q ?? ""} placeholder="ابحث بالاسم، الهاتف، الرمز، أو رقم الحجز" />
          <Button>بحث</Button>
        </form>
      </Card>
      <div className="grid gap-4">
        {students.map((student) => (
          <Card key={student.id} className="rounded-3xl">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black text-[var(--olive-dark)]">{student.full_name}</h2>
                  <Badge tone={student.code_status === "ACTIVE" ? "green" : student.code_status === "DISABLED" ? "red" : "gold"}>
                    {statusLabels[student.code_status ?? "pending"]}
                  </Badge>
                  <Badge>{statusLabels[student.submission_status ?? "pending"]}</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{student.batch?.name} · {student.phone ?? "لا يوجد هاتف"}</p>
                <div className="mt-4 inline-flex rounded-2xl bg-[#3f472d0d] px-5 py-3 text-2xl font-black tracking-[0.2em] text-[var(--olive-dark)] ltr">
                  {student.code ?? "------"}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                <Button variant="secondary"><Copy size={16} /> نسخ الرمز</Button>
                <Button variant="secondary"><RotateCw size={16} /> تغيير الرمز</Button>
                <Button variant="secondary"><ShieldOff size={16} /> تعطيل</Button>
                <Button variant="ghost">عرض الطالب</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
