import { notFound } from "next/navigation";
import { EditStudentForm } from "@/components/edit-student-form";
import { StudentPermissionOverridePanel } from "@/components/permission-policy-panels";
import { requireUser } from "@/lib/auth";
import {
  getAdminForm,
  getBatch,
  getFixedOptions,
  getPublicForm,
  getStudentCard,
  getUniformTemplateDefinition
} from "@/lib/data";
import { INDIVIDUAL_FORM_SLUG } from "@/lib/form-uniform";
import {
  normalizeStudentPermissionPolicy,
  representativeMayConfigurePermissions
} from "@/lib/student-permissions";

export default async function EditStudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const user = await requireUser();
  const { studentId } = await params;
  const student = await getStudentCard(user, studentId);
  if (!student) notFound();

  const definition = await getUniformTemplateDefinition();
  const individualForm = !student.batch_id ? await getPublicForm(INDIVIDUAL_FORM_SLUG) : null;
  const uniform =
    individualForm && !student.batch_id ? await getFixedOptions(user, individualForm.id, student.id) : {};

  let policy = normalizeStudentPermissionPolicy(undefined);
  if (student.batch_id) {
    const batch = await getBatch(user, student.batch_id);
    if (!batch) notFound();
    policy = normalizeStudentPermissionPolicy(batch.student_permission_policy);
  } else {
    if (user.role !== "OWNER") notFound();
    if (individualForm?.id) {
      const adminForm = await getAdminForm(user, individualForm.id, { resolveImages: false });
      policy = normalizeStudentPermissionPolicy(adminForm?.student_permission_policy);
    }
  }

  const canEditPermissions =
    user.role === "OWNER" ||
    (user.role === "REPRESENTATIVE" && representativeMayConfigurePermissions(policy));

  return (
    <div className="mx-auto grid max-w-3xl gap-4 sm:gap-6">
      <div>
        <h1 className="text-3xl font-black text-[var(--olive-dark)]">تعديل الطالب</h1>
        <p className="mt-1 text-[var(--muted)]">{student.batch_id ? "طالب دفعة" : "طالب فردي"}</p>
      </div>
      {user.role === "OWNER" ? (
        <EditStudentForm student={student} definition={definition} uniform={uniform} />
      ) : null}
      {(canEditPermissions || student.customization_permissions) && (
        <StudentPermissionOverridePanel
          studentId={student.id}
          policy={policy}
          initialOverride={student.customization_permissions}
          canEdit={canEditPermissions}
          allowAboveCeiling={user.role === "OWNER"}
        />
      )}
    </div>
  );
}
