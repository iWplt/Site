"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { regenerateStudentCodeAction, setAccessCodeStatusAction } from "@/app/actions";
import { Button, LinkButton } from "@/components/ui";
import { publicFormPath, publicFormUrl, studentPublicFormSlug } from "@/lib/booking-url";
import { cn } from "@/lib/utils";
import type { StudentWithState } from "@/lib/types";

const actionClass =
  "h-12 w-full min-h-12 items-center justify-center rounded-2xl px-3 text-center leading-tight focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#3f472d22]";

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "true");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export function IndividualStudentActions({
  student,
  origin
}: {
  student: StudentWithState;
  origin: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const slug = studentPublicFormSlug(student);
  const path = slug ? publicFormPath(slug) : null;
  const bookingUrl = path ? publicFormUrl(origin, slug!) : null;

  return (
    <div className="mt-3 grid gap-2">
      {!path ? (
        <div className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">
          <p>لا يوجد نموذج حجز مرتبط بهذا الطالب.</p>
          <LinkButton href="/admin/forms" variant="secondary" className={`${actionClass} mt-2`}>
            إنشاء أو نشر نموذج الحجز الفردي
          </LinkButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
          <LinkButton href={path} variant="primary" className={actionClass}>
            فتح النموذج
          </LinkButton>
          <Button
            className={actionClass}
            variant="secondary"
            onClick={async () => {
              if (!bookingUrl) return;
              const ok = await copyText(bookingUrl);
              setMessage(ok ? "تم نسخ رابط الحجز" : "تعذر نسخ الرابط. انسخه يدوياً من شريط العنوان بعد فتح النموذج.");
            }}
          >
            نسخ رابط الحجز
          </Button>
          <Button
            className={actionClass}
            variant="secondary"
            onClick={async () => {
              if (!student.code) {
                setMessage("لا يوجد رمز حجز حالياً.");
                return;
              }
              await copyText(student.code);
              setMessage(`الرمز: ${student.code}`);
            }}
          >
            عرض الكود
          </Button>
          <LinkButton href={`/admin/students/${student.id}`} variant="secondary" className={actionClass}>
            تعديل الطالب
          </LinkButton>
          <Button
            className={cn(actionClass, "border-[#b59a63] bg-[#b59a6314] text-[#6f5720] hover:bg-[#b59a6324]")}
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await regenerateStudentCodeAction(student.id);
                setMessage("تم إنشاء رمز جديد وهو نشط الآن.");
                router.refresh();
              })
            }
          >
            إعادة توليد الكود
          </Button>
          <Button
            className={cn(
              actionClass,
              student.code_status === "DISABLED"
                ? ""
                : "border-[var(--danger)] text-[var(--danger)] hover:bg-[#9d2f2f12]"
            )}
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await setAccessCodeStatusAction(
                  student.id,
                  student.code_status === "DISABLED" ? "ACTIVE" : "DISABLED"
                );
                setMessage(student.code_status === "DISABLED" ? "تم تفعيل الرمز" : "تم تعطيل الرمز");
                router.refresh();
              })
            }
          >
            {student.code_status === "DISABLED" ? "تفعيل الرمز" : "تعطيل الكود"}
          </Button>
        </div>
      )}
      {student.booking_number ? (
        <LinkButton href={`/admin/orders?q=${student.booking_number}`} variant="ghost" className={`${actionClass} h-10 min-h-10`}>
          فتح الطلب {student.booking_number}
        </LinkButton>
      ) : null}
      {message ? <p className="text-sm font-bold text-[var(--olive)]">{message}</p> : null}
    </div>
  );
}
