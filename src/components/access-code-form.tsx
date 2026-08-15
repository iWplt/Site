"use client";

import { useActionState } from "react";
import { verifyAccessCodeAction } from "@/app/actions";

export function AccessCodeForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(verifyAccessCodeAction, undefined);

  return (
    <form action={action} className="mt-8 grid gap-4">
      <input type="hidden" name="slug" value={slug} />
      <label className="text-sm font-bold text-[var(--olive-dark)]" htmlFor="code">أدخل رمز الحجز الخاص بك</label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={10}
        className="ltr w-full rounded-3xl border border-[var(--border)] bg-white/85 px-4 py-4 text-center text-2xl font-black tracking-[0.18em] text-[var(--olive-dark)] outline-none focus:border-[var(--olive)] focus:ring-4 focus:ring-[#3f472d18] sm:text-3xl sm:tracking-[0.3em]"
        placeholder="000000"
      />
      {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
      <button disabled={pending} className="rounded-3xl bg-[var(--olive)] px-6 py-4 font-black text-[var(--paper)] shadow-xl shadow-[#252b1c22] disabled:opacity-60">
        {pending ? "جاري التحقق..." : "متابعة"}
      </button>
    </form>
  );
}
