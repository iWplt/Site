"use client";

import { Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import type { FormStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BookingLinkCard({
  publicUrl,
  status,
  className
}: {
  /** Absolute public booking URL when the form can accept bookings. */
  publicUrl: string;
  status: FormStatus;
  className?: string;
}) {
  const [message, setMessage] = useState<string>();
  const published = status === "published";
  const closed = status === "closed" || status === "archived";
  const draft = status === "draft";

  const statusLabel = published
    ? "النموذج منشور — الرابط نشط للطلاب"
    : draft
      ? "النموذج مسودة — الحجز غير متاح"
      : "الحجز مغلق لهذا النموذج";

  return (
    <section
      className={cn(
        "warka-card rounded-[1.5rem] border border-[var(--border)] bg-white/80 p-4 sm:p-5",
        className
      )}
    >
      <h3 className="text-base font-black text-[var(--olive-dark)]">رابط الحجز للطلاب</h3>
      <p
        className={cn(
          "mt-2 text-sm font-bold leading-7",
          published ? "text-[var(--olive)]" : "text-[var(--danger)]"
        )}
      >
        {statusLabel}
      </p>
      {published ? (
        <>
          <p
            className="mt-3 break-all rounded-2xl border border-[var(--border)] bg-[#f7f1e4] px-3 py-3 text-sm font-bold text-[var(--olive-dark)] dir-ltr text-left"
            dir="ltr"
          >
            {publicUrl}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(publicUrl);
                  setMessage("تم نسخ الرابط");
                } catch {
                  setMessage("تعذر النسخ");
                }
              }}
            >
              <LinkIcon size={15} aria-hidden />
              نسخ الرابط
            </Button>
            {message ? <span className="text-xs font-bold text-[var(--olive)]">{message}</span> : null}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          {closed
            ? "لا يُعرض رابط حجز نشط للنماذج المغلقة أو المؤرشفة."
            : "انشر النموذج أولاً لإظهار رابط الحجز النشط للطلاب."}
        </p>
      )}
    </section>
  );
}
