import { LogoMark } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="warka-card w-full max-w-md rounded-[2rem] p-7">
        <LogoMark />
        <h1 className="mt-10 text-3xl font-black text-[var(--olive-dark)]">تسجيل دخول الإدارة</h1>
        <p className="mt-3 leading-8 text-[var(--muted)]">
          اربط Supabase Auth لتفعيل تسجيل الدخول بالبريد وكلمة المرور. في بيئة التطوير بدون Supabase يتم تشغيل حساب مالك تجريبي.
        </p>
        <div className="mt-6 grid gap-3">
          <input className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3" placeholder="البريد الإلكتروني" />
          <input className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3" placeholder="كلمة المرور" type="password" />
          <button className="rounded-2xl bg-[var(--olive)] px-5 py-3 font-black text-[var(--paper)]">دخول</button>
        </div>
      </section>
    </main>
  );
}
