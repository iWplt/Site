"use client";

import { IndividualStudentActions } from "@/components/student-actions";
import { StudentManageList } from "@/components/student-manage-list";
import { Badge, Card } from "@/components/ui";
import type { StudentWithState } from "@/lib/types";

export function IndividualStudentsPanel({
  students,
  origin
}: {
  students: StudentWithState[];
  origin: string;
}) {
  return (
    <StudentManageList
      students={students}
      empty={<Card>لا يوجد طلاب فرديون بعد.</Card>}
      renderDetails={(student) => (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-lg font-black leading-7 text-[var(--olive-dark)]">{student.full_name}</h3>
              <p className="text-sm text-[var(--muted)]">{student.phone || "بدون هاتف"}</p>
            </div>
            <Badge tone={student.submission_status === "submitted" ? "green" : undefined}>
              {student.submission_status === "submitted" ? "تم الإرسال" : "لم يُرسل"}
            </Badge>
          </div>
          <p className="mt-2 text-sm font-bold text-[var(--olive)]">
            الرمز: <span className="ltr">{student.code ?? "—"}</span>
            {student.code_status ? ` · ${student.code_status}` : ""}
            {student.booking_number ? ` · ${student.booking_number}` : ""}
          </p>
          <IndividualStudentActions student={student} origin={origin} />
        </>
      )}
    />
  );
}
