import { ImportWorkspace } from "@/components/import-workspace";
import { requireUser } from "@/lib/auth";

export default async function ImportPage() {
  await requireUser();
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">Student Import</p>
        <h1 className="text-4xl font-black text-[var(--olive-dark)]">استيراد الطلاب</h1>
      </div>
      <ImportWorkspace />
    </div>
  );
}
