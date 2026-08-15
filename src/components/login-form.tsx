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
    <form action={action} className="mt-6 grid w-full min-w-0 gap-3">
      <label className="min-w-0 text-sm font-bold text-[var(--olive-dark)]" htmlFor="email">البريد الإلكتروني</label>
      <input
        id="email"
        name="email"
        className="box-border min-h-12 w-full min-w-0 max-w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-base"
        placeholder="البريد الإلكتروني"
        defaultValue={demoMode ? "owner@warka.local" : undefined}
        autoComplete="username"
      />
      <label className="min-w-0 text-sm font-bold text-[var(--olive-dark)]" htmlFor="password">كلمة المرور</label>
      <input
        id="password"
        name="password"
        className="box-border min-h-12 w-full min-w-0 max-w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-base"
        placeholder="كلمة المرور"
        type="password"
        defaultValue={demoMode ? "owner123" : undefined}
        autoComplete="current-password"
      />
      {state?.error ? <p className="min-w-0 max-w-full break-words rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{state.error}</p> : null}
      <button disabled={pending} className="box-border min-h-12 w-full min-w-0 max-w-full rounded-2xl bg-[var(--olive)] px-5 py-3 font-black text-[var(--paper)] disabled:opacity-60">
        {pending ? "جاري الدخول..." : "دخول"}
      </button>
      {demoMode ? (
        <div className="min-w-0 max-w-full break-words rounded-2xl bg-[#3f472d0d] p-3 text-xs leading-6 text-[var(--muted)]">
          وضع العرض المحلي فقط — ليس إنتاجاً.
          <br />
          تجريبي: owner@warka.local / owner123
          <br />
          ممثل السيبراني: rep.cyber@warka.local / rep123
          <br />
          ممثل طب الأسنان: rep.dental@warka.local / rep123
        </div>
      ) : (
        <div className="min-w-0 max-w-full break-words rounded-2xl bg-[#3f472d0d] p-3 text-xs leading-6 text-[var(--muted)]">
          تسجيل الدخول عبر Supabase Auth. لا يوجد تسجيل عام للموظفين — المالك ينشئ حسابات الممثلين.
        </div>
      )}
    </form>
  );
}

export function LoginPageClient({ demoMode = true }: Props) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-full px-4 py-4 sm:grid sm:min-h-dvh sm:place-items-center sm:px-6 sm:py-8">
      <section className="warka-card warka-login mx-auto w-full min-w-0 max-w-md break-words rounded-[1.5rem] p-5 sm:rounded-[2rem] sm:p-7">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <LogoMark compact priority className="h-10 w-10 shrink-0" />
          <BrandPhoto
            asset={BRAND.loginAccent}
            aspect="1/1"
            sizes="64px"
            className="h-16 w-16 shrink-0 !rounded-2xl"
            rounded={false}
          />
        </div>
        <h1 className="mt-6 min-w-0 max-w-full text-pretty text-3xl font-black text-[var(--olive-dark)] sm:mt-8">
          تسجيل دخول الإدارة
        </h1>
        <p className="mt-3 min-w-0 max-w-full break-words text-pretty leading-8 text-[var(--muted)]">
          لا يوجد تسجيل عام. المالك ينشئ حسابات الممثلين ويمنحهم الدفعات.
        </p>
        <LoginForm demoMode={demoMode} />
      </section>
    </main>
  );
}
