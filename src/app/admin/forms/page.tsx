import { Badge, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listBatches, listForms } from "@/lib/data";
import { statusLabels } from "@/lib/demo-data";

export default async function FormsPage() {
  const user = await requireUser();
  const [forms, batches] = await Promise.all([listForms(user), listBatches(user)]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">Dynamic Form Builder</p>
          <h1 className="text-4xl font-black text-[var(--olive-dark)]">النماذج الديناميكية</h1>
        </div>
        {user.role === "OWNER" ? <LinkButton href="/admin/forms/new">إنشاء نموذج</LinkButton> : null}
      </div>
      <div className="grid gap-4">
        {forms.map((form) => {
          const batch = batches.find((entry) => entry.id === form.batch_id);
          const fields = form.definition.sections.reduce((count, section) => count + section.fields.length, 0);
          return (
            <Card key={form.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-[var(--olive-dark)]">{form.name}</h2>
                    <Badge tone={form.status === "published" ? "green" : "gold"}>{statusLabels[form.status]}</Badge>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">{form.internal_description}</p>
                </div>
                <LinkButton href={`/f/${form.slug}`} variant="secondary">فتح الرابط العام</LinkButton>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                <Info label="النوع" value={form.type === "BATCH" ? "نموذج دفعة" : "طلب فردي"} />
                <Info label="الرابط" value={`/f/${form.slug}`} ltr />
                <Info label="الدفعة" value={batch?.name ?? "غير مرتبط"} />
                <Info label="الأقسام / الحقول" value={`${form.definition.sections.length} / ${fields}`} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-3xl bg-white/60 p-4">
      <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
      <p className={ltr ? "ltr mt-1 text-left font-black text-[var(--olive-dark)]" : "mt-1 font-black text-[var(--olive-dark)]"}>{value}</p>
    </div>
  );
}
