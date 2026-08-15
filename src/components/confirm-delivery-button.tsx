"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmPickupDeliveryAction } from "@/app/actions";
import { Button } from "@/components/ui";

export function ConfirmDeliveryButton({ token, alreadyDelivered }: { token: string; alreadyDelivered: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  if (alreadyDelivered) return null;

  return (
    <div className="grid gap-2">
      <Button
        className="min-h-12 w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await confirmPickupDeliveryAction(token);
            if ("error" in result && result.error) setMessage(result.error);
            else setMessage("message" in result ? result.message : "تم تأكيد التسليم");
            router.refresh();
          })
        }
      >
        تأكيد التسليم
      </Button>
      {message ? <p className="text-sm font-bold text-[var(--olive)]">{message}</p> : null}
    </div>
  );
}
