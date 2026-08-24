import { Card } from "@/components/ui";
import { BookingWorkspaceNav } from "@/components/booking-workspace-nav";
import { CreateOwnerForm } from "@/components/create-owner-form";
import { requireUser } from "@/lib/auth";
import { getActivePersistenceMode } from "@/lib/data";
import { persistenceLabel } from "@/lib/persistence";
import { sbListOwners } from "@/lib/store/supabase-db";

export default async function SettingsPage() {
  await requireUser(["OWNER"]);
  const mode = getActivePersistenceMode();
  const owners = mode === "supabase" ? await sbListOwners() : [];

  return (
    <div className="grid gap-4 sm:gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">إدارة الحجوزات والمنتجات</p>
        <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">الصلاحيات والإعدادات</h1>
      </div>
      <BookingWorkspaceNav
        items={[
          { href: "/admin/batches", label: "الدفعات" },
          { href: "/admin/forms", label: "النماذج والزي" },
          { href: "/admin/products", label: "المنتجات المتاحة" },
          { href: "/admin/settings", label: "الصلاحيات", current: true }
        ]}
      />
      <Card>
        <h2 className="text-2xl font-black text-[var(--olive-dark)]">مصدر البيانات</h2>
        <p className="mt-3 rounded-2xl bg-white/60 p-4 font-bold text-[var(--olive)]">{persistenceLabel(mode)}</p>
        <p className="mt-3 leading-8 text-[var(--muted)]">
          في الإنتاج يجب ضبط متغيرات Supabase. التخزين المحلي (`.data/warka-db.json`) ممنوع تماماً في الإنتاج حتى لو تم تعيين
          `WARKA_ALLOW_LOCAL_DEMO=true`.
        </p>
      </Card>
      {mode === "supabase" ? (
        <>
          <Card>
            <h2 className="text-2xl font-black text-[var(--olive-dark)]">المالكون</h2>
            <div className="mt-4 grid gap-3">
              {owners.map((owner) => (
                <p key={owner.id} className="rounded-2xl bg-white/60 p-3 font-bold text-[var(--olive)]">
                  {owner.full_name}
                  {owner.email ? ` · ${owner.email}` : ""}
                  {owner.disabled ? " · معطّل" : ""}
                </p>
              ))}
            </div>
          </Card>
          <CreateOwnerForm />
        </>
      ) : null}
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
