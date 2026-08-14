"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importStudentsAction, regenerateStudentCodeAction, setAccessCodeStatusAction } from "@/app/actions";
import { Badge, Button, Card, TextArea, TextInput } from "@/components/ui";
import { statusLabels } from "@/lib/demo-data";
import type { StudentWithState } from "@/lib/types";

export function BatchStudentsPanel({
  batchId,
  students,
  showImport
}: {
  batchId: string;
  students: StudentWithState[];
  showImport?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [paste, setPaste] = useState("");
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const filtered = students.filter((student) => {
    if (!query.trim()) return true;
    return [student.full_name, student.phone, student.code].filter(Boolean).some((value) => String(value).includes(query.trim()));
  });

  return (
    <div className="grid gap-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث داخل هذه الدفعة فقط" className="min-h-12" />
          <Button className="min-h-12" variant="secondary" onClick={() => router.refresh()}>
            تحديث
          </Button>
        </div>
      </Card>

      {(showImport || true) && (
        <Card>
          <h2 className="text-xl font-black text-[var(--olive-dark)]">إضافة طلاب بأسماء ملصقة</h2>
          <TextArea className="mt-3 min-h-40" value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={"علي أحمد حسن\nمصطفى سامر محمد"} />
          <Button
            className="mt-3 min-h-12"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const names = paste.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
                const result = await importStudentsAction(batchId, names);
                setMessage(result.error ?? `تم استيراد ${names.length} اسم.`);
                setPaste("");
                router.refresh();
              })
            }
          >
            استيراد الأسماء إلى هذه الدفعة
          </Button>
          {message ? <p className="mt-3 text-sm font-bold text-[var(--olive)]">{message}</p> : null}
        </Card>
      )}

      <div className="grid gap-3">
        {filtered.map((student) => (
          <Card key={student.id} className="!rounded-[1.5rem]">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-black text-[var(--olive-dark)]">{student.full_name}</h3>
              <Badge>{statusLabels[student.code_status ?? "ACTIVE"]}</Badge>
              <Badge tone={student.submission_status === "submitted" ? "green" : "gold"}>
                {statusLabels[student.submission_status ?? "pending"]}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{student.phone ?? "لا يوجد هاتف"}</p>
            <div className="mt-3 inline-flex rounded-2xl bg-[#3f472d0d] px-4 py-2 text-xl font-black tracking-[0.18em] ltr">
              {student.code ?? "------"}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                className="min-h-11"
                variant="secondary"
                onClick={async () => {
                  if (student.code) {
                    await navigator.clipboard.writeText(student.code);
                    setMessage(`تم نسخ ${student.code}`);
                  }
                }}
              >
                نسخ الرمز
              </Button>
              <Button
                className="min-h-11"
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await regenerateStudentCodeAction(student.id);
                    setMessage(`رمز جديد: ${result.code}`);
                    router.refresh();
                  })
                }
              >
                تغيير الرمز
              </Button>
              <Button
                className="min-h-11"
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await setAccessCodeStatusAction(student.id, student.code_status === "DISABLED" ? "ACTIVE" : "DISABLED");
                    router.refresh();
                  })
                }
              >
                {student.code_status === "DISABLED" ? "تفعيل" : "تعطيل"}
              </Button>
              {student.booking_number ? (
                <Button className="min-h-11" variant="ghost" onClick={() => router.push(`/admin/orders?q=${student.booking_number}`)}>
                  عرض الحجز
                </Button>
              ) : (
                <div />
              )}
            </div>
          </Card>
        ))}
        {!filtered.length ? <Card>لم تتم إضافة طلاب لهذه الدفعة حتى الآن.</Card> : null}
      </div>
    </div>
  );
}
