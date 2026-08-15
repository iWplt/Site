import { notFound } from "next/navigation";
import { EditStudentForm } from "@/components/edit-student-form";
import { requireUser } from "@/lib/auth";
import { getFixedOptions, getPublicForm, getStudentCard, getUniformTemplateDefinition } from "@/lib/data";
import { INDIVIDUAL_FORM_SLUG } from "@/lib/form-uniform";

export default async function EditStudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const user = await requireUser(["OWNER"]);
  const { studentId } = await params;
  const student = await getStudentCard(user, studentId);
  if (!student) notFound();

  const definition = await getUniformTemplateDefinition();
  const individualForm = !student.batch_id ? await getPublicForm(INDIVIDUAL_FORM_SLUG) : null;
  const uniform =
    individualForm && !student.batch_id ? await getFixedOptions(user, individualForm.id, student.id) : {};

  return (
    <div className="mx-auto grid max-w-3xl gap-4 sm:gap-6">
      <div>
        <h1 className="text-3xl font-black text-[var(--olive-dark)]">تعديل الطالب</h1>
        <p className="mt-1 text-[var(--muted)]">{student.batch_id ? "طالب دفعة" : "طالب فردي"}</p>
      </div>
      <EditStudentForm student={student} definition={definition} uniform={uniform} />
    </div>
  );
}
