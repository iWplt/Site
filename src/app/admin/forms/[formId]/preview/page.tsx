import { notFound } from "next/navigation";
import { BookingWizard } from "@/components/booking-wizard";
import { LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getAdminForm } from "@/lib/data";

export default async function FormStudentPreviewPage({ params }: { params: Promise<{ formId: string }> }) {
  const user = await requireUser();
  const { formId } = await params;
  const form = await getAdminForm(user, formId, { resolveImages: true });
  if (!form) notFound();

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--gold)]">معاينة كطالب</p>
          <h1 className="text-2xl font-black text-[var(--olive-dark)]">{form.name}</h1>
        </div>
        <LinkButton href={`/admin/forms/${form.id}?tab=preview`} variant="secondary" size="sm">
          العودة للمحرر
        </LinkButton>
      </div>
      <BookingWizard form={form} studentName="طالب تجريبي" previewMode />
    </div>
  );
}
