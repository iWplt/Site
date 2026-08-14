"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import { LogoMark } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="mt-6 grid gap-3">
      <input name="email" className="min-h-12 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-base" placeholder="البريد الإلكتروني" defaultValue="owner@warka.local" />
      <input name="password" className="min-h-12 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-base" placeholder="كلمة المرور" type="password" defaultValue="owner123" />
      {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
      <button disabled={pending} className="min-h-12 rounded-2xl bg-[var(--olive)] px-5 py-3 font-black text-[var(--paper)] disabled:opacity-60">
        {pending ? "جاري الدخول..." : "دخول"}
      </button>
      <div className="rounded-2xl bg-[#3f472d0d] p-3 text-xs leading-6 text-[var(--muted)]">
        تجريبي: owner@warka.local / owner123
        <br />
        ممثل السيبراني: rep.cyber@warka.local / rep123
        <br />
        ممثل طب الأسنان: rep.dental@warka.local / rep123
      </div>
    </form>
  );
}

export function LoginPageClient() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="warka-card w-full max-w-md rounded-[2rem] p-7">
        <LogoMark />
        <h1 className="mt-8 text-3xl font-black text-[var(--olive-dark)]">تسجيل دخول الإدارة</h1>
        <p className="mt-3 leading-8 text-[var(--muted)]">لا يوجد تسجيل عام. المالك ينشئ حسابات الممثلين ويمنحهم الدفعات.</p>
        <LoginForm />
      </section>
    </main>
  );
}
