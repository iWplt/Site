import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getActivePersistenceMode } from "@/lib/data";
import { persistenceLabel } from "@/lib/persistence";

export default async function SettingsPage() {
  await requireUser(["OWNER"]);
  const mode = getActivePersistenceMode();

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">System Settings</p>
        <h1 className="text-4xl font-black text-[var(--olive-dark)]">الإعدادات</h1>
      </div>
      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">مصدر البيانات</h2>
        <p className="mt-3 rounded-2xl bg-white/60 p-4 font-bold text-[var(--olive)]">{persistenceLabel(mode)}</p>
        <p className="mt-3 leading-8 text-[var(--muted)]">
          في الإنتاج يجب ضبط متغيرات Supabase. التخزين المحلي (`.data/warka-db.json`) ممنوع تماماً في الإنتاج حتى لو تم تعيين
          `WARKA_ALLOW_LOCAL_DEMO=true`.
        </p>
      </Card>
      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">جاهزية الإنتاج</h2>
        <div className="mt-5 grid gap-3">
          {[
            "Supabase Auth لتسجيل دخول المالك والممثلين بدون تسجيل عام",
            "PostgreSQL + RLS لعزل الدفعات",
            "Supabase Storage الخاص: booking-uploads + form-options",
            "صور خيارات المنتجات (Owner) منفصلة عن مرفقات تصميم الطالب",
            "تشفير رموز الحجز القابلة للاسترجاع Server-side",
            "RPC للمعاملة الذرية عند إرسال الطلب + submission_files",
            "متغيرات البيئة بدون كشف مفتاح الخدمة للمتصفح"
          ].map((item) => (
            <p key={item} className="rounded-2xl bg-white/60 p-3 font-bold text-[var(--olive)]">
              {item}
            </p>
          ))}
        </div>
      </Card>
    </div>
  );
}
