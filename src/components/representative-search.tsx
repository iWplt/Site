"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { regenerateStudentCodeAction, setAccessCodeStatusAction } from "@/app/actions";
import { Badge, Button, Card, TextInput } from "@/components/ui";
import { StudentManageList } from "@/components/student-manage-list";
import { statusLabels } from "@/lib/demo-data";
import type { StudentWithState } from "@/lib/types";

export function RepresentativeSearch({
  initialQuery,
  students
}: {
  initialQuery: string;
  students: StudentWithState[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function search() {
    router.push(`/admin?q=${encodeURIComponent(query.trim())}`);
  }

  async function copyCode(code?: string) {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setMessage(`تم نسخ الرمز ${code}`);
  }

  return (
    <div className="grid gap-4">
      <Card className="!rounded-[1.5rem]">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث بالاسم مثل: علي أحمد"
            className="min-h-12 text-base"
            onKeyDown={(event) => event.key === "Enter" && search()}
          />
          <Button className="min-h-12" onClick={search}>
            بحث
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm font-bold text-[var(--success)]">{message}</p> : null}
      </Card>

      <StudentManageList
        students={students}
        empty={<Card>لا توجد نتائج مطابقة ضمن دفعاتك.</Card>}
        renderDetails={(student) => (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-[var(--olive-dark)]">{student.full_name}</h2>
              <Badge tone={student.submission_status === "submitted" ? "green" : "gold"}>
                {statusLabels[student.submission_status ?? "pending"]}
              </Badge>
              <Badge tone={student.code_status === "ACTIVE" ? "green" : student.code_status === "DISABLED" ? "red" : "gold"}>
                {statusLabels[student.code_status ?? "ACTIVE"]}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{student.batch?.name}</p>
            <div className="mt-4 inline-flex max-w-full rounded-2xl bg-[#3f472d0d] px-5 py-3 text-2xl font-black tracking-[0.2em] text-[var(--olive-dark)] ltr">
              {student.code ?? "------"}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button className="min-h-12" variant="secondary" onClick={() => copyCode(student.code)}>
                نسخ الرمز
              </Button>
              <Button
                className="min-h-12"
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await regenerateStudentCodeAction(student.id);
                    setMessage(`الرمز الجديد: ${result.code}`);
                    router.refresh();
                  })
                }
              >
                تغيير الرمز
              </Button>
              <Button
                className="min-h-12"
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await setAccessCodeStatusAction(student.id, student.code_status === "DISABLED" ? "ACTIVE" : "DISABLED");
                    router.refresh();
                  })
                }
              >
                {student.code_status === "DISABLED" ? "تفعيل الرمز" : "تعطيل الرمز"}
              </Button>
              <Button className="min-h-12" variant="ghost" onClick={() => router.push(`/admin/batches/${student.batch_id}/students`)}>
                عرض التفاصيل
              </Button>
            </div>
          </>
        )}
      />
    </div>
  );
}
