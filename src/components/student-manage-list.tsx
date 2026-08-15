"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { deleteStudentsAction } from "@/app/actions";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { StudentWithState } from "@/lib/types";

function selectedCountLabel(count: number) {
  if (count === 1) return "طالب واحد محدد";
  return `${count} طلاب محددين`;
}

function confirmTitle(count: number) {
  if (count === 1) return "هل أنت متأكد من حذف هذا الطالب؟";
  return `هل أنت متأكد من حذف ${count} طلاب؟`;
}

export function StudentManageList({
  students,
  renderDetails,
  empty
}: {
  students: StudentWithState[];
  renderDetails: (student: StudentWithState) => ReactNode;
  empty?: ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);

  const visible = useMemo(
    () => students.filter((student) => !hiddenIds.has(student.id)),
    [students, hiddenIds]
  );
  const visibleIds = useMemo(() => visible.map((student) => student.id), [visible]);
  const selectedVisible = visible.filter((student) => selected.has(student.id));
  const allVisibleSelected = visible.length > 0 && selectedVisible.length === visible.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected(() => {
      if (allVisibleSelected) return new Set();
      return new Set(visibleIds);
    });
  }

  function runDelete(ids: string[]) {
    startTransition(async () => {
      const result = await deleteStudentsAction(ids);
      if ("error" in result && result.error && !result.deleted) {
        setMessage(result.error);
        setConfirmIds(null);
        return;
      }
      if (result.deletedIds?.length) {
        setHiddenIds((current) => {
          const next = new Set(current);
          for (const id of result.deletedIds) next.add(id);
          return next;
        });
        setSelected(new Set());
      }
      setMessage(result.message);
      setConfirmIds(null);
      router.refresh();
    });
  }

  const confirmStudents = confirmIds
    ? visible.filter((student) => confirmIds.includes(student.id)).concat(
        students.filter((student) => confirmIds.includes(student.id) && hiddenIds.has(student.id))
      )
    : [];
  const uniqueConfirm = Array.from(new Map(confirmStudents.map((student) => [student.id, student])).values());
  const extraNames = Math.max((confirmIds?.length ?? 0) - uniqueConfirm.length, 0);

  return (
    <div className={cn("grid gap-3", selectedVisible.length ? "pb-28" : "")}>
      {visible.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[1.35rem] border border-[var(--border)] bg-[var(--paper)] px-3 py-2">
          <button
            type="button"
            className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl px-1 text-start"
            onClick={toggleAllVisible}
            aria-pressed={allVisibleSelected}
          >
            <span
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 text-lg font-black",
                allVisibleSelected
                  ? "border-[var(--olive)] bg-[var(--olive)] text-[var(--paper)]"
                  : "border-[var(--olive)] bg-white text-transparent"
              )}
              aria-hidden
            >
              ✓
            </span>
            <span className="min-w-0">
              <span className="block font-black text-[var(--olive-dark)]">تحديد جميع الظاهرين</span>
              <span className="block text-sm text-[var(--muted)]">
                {visible.length} طالب ظاهر · لا يشمل النتائج المخفية أو غير المحمّلة
              </span>
            </span>
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="rounded-2xl bg-[#3f472d12] p-3 text-sm font-bold text-[var(--olive)]">{message}</p>
      ) : null}

      {visible.map((student) => {
        const isSelected = selected.has(student.id);
        return (
          <Card key={student.id} className="!rounded-[1.5rem] !p-3 sm:!p-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 border-[var(--olive)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#3f472d22]"
                aria-label={`تحديد ${student.full_name}`}
                aria-pressed={isSelected}
                onClick={() => toggle(student.id)}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-xl text-base font-black",
                    isSelected ? "bg-[var(--olive)] text-[var(--paper)]" : "bg-white text-transparent"
                  )}
                >
                  ✓
                </span>
              </button>
              <div className="min-w-0 flex-1 overflow-hidden">
                {renderDetails(student)}
                <Button
                  variant="danger"
                  className="mt-3 min-h-12 w-full sm:w-auto"
                  disabled={pending}
                  onClick={() => setConfirmIds([student.id])}
                >
                  حذف الطالب
                </Button>
              </div>
            </div>
          </Card>
        );
      })}

      {!visible.length ? empty ?? <Card>لا يوجد طلاب في هذه القائمة.</Card> : null}

      {selectedVisible.length ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--paper)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(37,43,28,0.12)]">
          <div className="mx-auto grid w-full max-w-3xl gap-2">
            <p className="font-black text-[var(--olive-dark)]">{selectedCountLabel(selectedVisible.length)}</p>
            <p className="text-sm text-[var(--muted)]">الإجراء يشمل الطلاب المحددين الظاهرين فقط</p>
            <Button
              variant="danger"
              className="min-h-12 w-full"
              disabled={pending}
              onClick={() => setConfirmIds(selectedVisible.map((student) => student.id))}
            >
              حذف الطلاب المحددين
            </Button>
          </div>
        </div>
      ) : null}

      {confirmIds ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-[#252b1c88] p-3 sm:place-items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-[1.6rem] bg-[var(--paper)] p-4 shadow-2xl">
            <h2 className="text-xl font-black text-[var(--olive-dark)]">{confirmTitle(confirmIds.length)}</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              سيتم حذف الطلاب الذين لا يملكون طلباً مسجلاً، مع رموز الحجز غير المستخدمة والملفات المؤقتة الخاصة بهم.
              الطلاب الذين لديهم طلب مسجل لن يُحذفوا حتى تبقى سجلاتهم التاريخية سليمة.
            </p>
            <p className="mt-3 text-sm font-bold text-[var(--olive-dark)]">عدد الطلاب المحددين: {confirmIds.length}</p>
            <ul className="mt-2 max-h-40 overflow-auto rounded-2xl bg-white/70 p-3 text-sm font-bold">
              {uniqueConfirm.slice(0, 10).map((student) => (
                <li key={student.id} className="truncate py-1">
                  {student.full_name}
                </li>
              ))}
              {uniqueConfirm.length > 10 || extraNames ? (
                <li className="py-1 text-[var(--muted)]">و {Math.max(uniqueConfirm.length - 10, 0) + extraNames} آخرين</li>
              ) : null}
            </ul>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="secondary" className="min-h-12" disabled={pending} onClick={() => setConfirmIds(null)}>
                إلغاء
              </Button>
              <Button variant="danger" className="min-h-12" disabled={pending} onClick={() => runDelete(confirmIds)}>
                تأكيد الحذف
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
