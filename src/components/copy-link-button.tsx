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
        className="min-h-11 px-4 py-2"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage("تم النسخ");
          } catch {
            setMessage("تعذر النسخ");
          }
        }}
      >
        <span className="inline-flex items-center gap-2">
          <LinkIcon size={15} />
          {label}
        </span>
      </Button>
      {message ? <span className="text-xs font-bold text-[var(--olive)]">{message}</span> : null}
    </div>
  );
}
