import { PublicVisualShell } from "@/components/public-visuals";
import { Card, LogoMark } from "@/components/ui";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <PublicVisualShell variant="access" className="!min-h-screen">
      <header className="mb-4">
        <LogoMark priority />
      </header>
      <Card className="relative z-10 mx-auto max-w-2xl">
        <h1 className="text-3xl font-black text-[var(--olive-dark)]">إشعار الخصوصية</h1>
        <p className="mt-4 leading-8 text-[var(--muted)]">
          تستخدم WARKA المعلومات والتصاميم والصور التي يرسلها الطالب لتجهيز طلب ملابس التخرج، والتواصل بشأن الطلب،
          وإعداد أو طباعة التصاميم المطلوبة، ومتابعة تنفيذ الطلب حتى التسليم.
        </p>
        <p className="mt-4 leading-8 text-[var(--muted)]">
          لا نعرض تفاصيل الطلب للعامة. يصل إلى بيانات الطلب فريق المتجر المخوّل (المالك وممثل الدفعة المعيّن عند الحاجة).
        </p>
        <p className="mt-4 text-sm text-[var(--muted)]">هذا الإشعار توضيحي لآلية العمل داخل المتجر، وليس استشارة قانونية.</p>
        <Link href="/" className="mt-6 inline-flex min-h-12 items-center font-bold text-[var(--olive)]">
          العودة
        </Link>
      </Card>
    </PublicVisualShell>
  );
}
