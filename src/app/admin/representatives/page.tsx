import { toggleRepresentativeAction } from "@/app/actions";
import { AssignBatchesForm } from "@/components/assign-batches-form";
import { CreateRepresentativeForm } from "@/components/create-representative-form";
import { Badge, Button, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listBatches, listRepresentatives } from "@/lib/data";

export default async function RepresentativesPage() {
  const user = await requireUser(["OWNER"]);
  const [reps, batches] = await Promise.all([listRepresentatives(), listBatches(user)]);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">Representatives</p>
        <h1 className="text-4xl font-black text-[var(--olive-dark)]">الممثلون</h1>
        <p className="mt-2 text-[var(--muted)]">لا يوجد تسجيل عام. المالك ينشئ الحساب ويعين الدفعات فقط.</p>
      </div>
      <CreateRepresentativeForm batches={batches.map((batch) => ({ id: batch.id, name: batch.name }))} />
      <div className="grid gap-4">
        {reps.map((rep) => (
          <Card key={rep.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black text-[var(--olive-dark)]">{rep.full_name}</h2>
                  <Badge tone={rep.disabled ? "red" : "green"}>{rep.disabled ? "معطل" : "فعال"}</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {rep.email} · {rep.phone}
                </p>
                <p className="mt-2 text-sm font-bold text-[var(--olive)]">
                  الدفعات:{" "}
                  {rep.batch_ids
                    .map((id) => batches.find((batch) => batch.id === id)?.name)
                    .filter(Boolean)
                    .join("، ") || "لا توجد"}
                </p>
                <AssignBatchesForm
                  representativeId={rep.id}
                  selected={rep.batch_ids}
                  batches={batches.map((batch) => ({ id: batch.id, name: batch.name }))}
                />
              </div>
              <form
                action={async () => {
                  "use server";
                  await toggleRepresentativeAction(rep.id, !rep.disabled);
                }}
              >
                <Button type="submit" variant="secondary" className="min-h-12">
                  {rep.disabled ? "تفعيل الحساب" : "تعطيل الحساب"}
                </Button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
