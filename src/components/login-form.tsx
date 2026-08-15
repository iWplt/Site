"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import { BrandPhoto } from "@/components/brand-photo";
import { LogoMark } from "@/components/ui";
import { BRAND } from "@/lib/brand-assets";

type Props = {
  demoMode?: boolean;
};

export function LoginForm({ demoMode = true }: Props) {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="mt-6 grid gap-3">
      <label className="text-sm font-bold text-[var(--olive-dark)]" htmlFor="email">البريد الإلكتروني</label>
      <input
        id="email"
        name="email"
        className="min-h-12 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-base"
        placeholder="البريد الإلكتروني"
        defaultValue={demoMode ? "owner@warka.local" : undefined}
        autoComplete="username"
      />
      <label className="text-sm font-bold text-[var(--olive-dark)]" htmlFor="password">كلمة المرور</label>
      <input
        id="password"
        name="password"
        className="min-h-12 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-base"
        placeholder="كلمة المرور"
        type="password"
        defaultValue={demoMode ? "owner123" : undefined}
        autoComplete="current-password"
      />
      {state?.error ? <p className="rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
      <button disabled={pending} className="min-h-12 rounded-2xl bg-[var(--olive)] px-5 py-3 font-black text-[var(--paper)] disabled:opacity-60">
        {pending ? "جاري الدخول..." : "دخول"}
      </button>
      {demoMode ? (
        <div className="rounded-2xl bg-[#3f472d0d] p-3 text-xs leading-6 text-[var(--muted)]">
          وضع العرض المحلي فقط — ليس إنتاجاً.
          <br />
          تجريبي: owner@warka.local / owner123
          <br />
          ممثل السيبراني: rep.cyber@warka.local / rep123
          <br />
          ممثل طب الأسنان: rep.dental@warka.local / rep123
        </div>
      ) : (
        <div className="rounded-2xl bg-[#3f472d0d] p-3 text-xs leading-6 text-[var(--muted)]">
          تسجيل الدخول عبر Supabase Auth. لا يوجد تسجيل عام للموظفين — المالك ينشئ حسابات الممثلين.
        </div>
      )}
    </form>
  );
}

export function LoginPageClient({ demoMode = true }: Props) {
  return (
    <main className="grid min-h-screen place-items-center overflow-x-hidden px-3 py-6 sm:px-4">
      <section className="warka-card w-full max-w-md rounded-[1.5rem] p-5 sm:rounded-[2rem] sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <LogoMark compact priority />
          <BrandPhoto
            asset={BRAND.loginAccent}
            aspect="1/1"
            sizes="64px"
            className="h-16 w-16 shrink-0 !rounded-2xl"
            rounded={false}
          />
        </div>
        <h1 className="mt-8 text-3xl font-black text-[var(--olive-dark)]">تسجيل دخول الإدارة</h1>
        <p className="mt-3 leading-8 text-[var(--muted)]">لا يوجد تسجيل عام. المالك ينشئ حسابات الممثلين ويمنحهم الدفعات.</p>
        <LoginForm demoMode={demoMode} />
      </section>
    </main>
  );
}
