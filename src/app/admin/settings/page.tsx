import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function SettingsPage() {
  await requireUser(["OWNER"]);
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">System Settings</p>
        <h1 className="text-4xl font-black text-[var(--olive-dark)]">الإعدادات</h1>
      </div>
      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">جاهزية الإنتاج</h2>
        <div className="mt-5 grid gap-3">
          {[
            "Supabase Auth لتسجيل دخول المالك والممثلين",
            "PostgreSQL Row Level Security لعزل الدفعات",
            "Supabase Storage مع روابط رفع موقعة",
            "تشفير رموز الحجز القابلة للاسترجاع Server-side",
            "RPC للمعاملة الذرية عند إرسال الطلب",
            "Vercel environment variables بدون كشف مفاتيح الخدمة"
          ].map((item) => (
            <p key={item} className="rounded-2xl bg-white/60 p-3 font-bold text-[var(--olive)]">{item}</p>
          ))}
        </div>
      </Card>
    </div>
  );
}
