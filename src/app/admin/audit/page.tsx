import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listAuditLogs } from "@/lib/data";
import { formatArabicDate } from "@/lib/utils";

export default async function AuditPage() {
  await requireUser(["OWNER"]);
  const events = await listAuditLogs();
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">Security Audit Trail</p>
        <h1 className="text-4xl font-black text-[var(--olive-dark)]">سجل التدقيق</h1>
      </div>
      <Card>
        <div className="grid gap-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-3xl bg-white/60 p-4">
              <p className="font-black text-[var(--olive-dark)]">{event.action}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {event.actor_label ?? event.actor_id ?? "system"} · {event.entity_type}
                {event.entity_id ? ` · ${event.entity_id}` : ""} · {formatArabicDate(event.created_at)}
              </p>
            </div>
          ))}
          {!events.length ? <p className="text-[var(--muted)]">لا توجد أحداث بعد.</p> : null}
        </div>
      </Card>
    </div>
  );
}
