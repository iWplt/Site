"use client";

import { useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui";

export function CopyLinkButton({ value, label = "نسخ الرابط" }: { value: string; label?: string }) {
  const [message, setMessage] = useState<string>();

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage("تم النسخ");
          } catch {
            setMessage("تعذر النسخ");
          }
        }}
      >
        <LinkIcon size={15} aria-hidden />
        {label}
      </Button>
      {message ? <span className="text-xs font-bold text-[var(--olive)]">{message}</span> : null}
    </div>
  );
}
