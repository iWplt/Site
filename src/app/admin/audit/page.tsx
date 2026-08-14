import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";

const events = [
  { action: "ACCESS_CODE_GENERATED", actor: "مالك WARKA", target: "علي المرتضى يوسف", at: "2026-08-14T03:27:00Z" },
  { action: "FORM_PUBLISHED", actor: "مالك WARKA", target: "بطاقة حجز الأمن السيبراني 2027", at: "2026-08-14T03:27:00Z" },
  { action: "ORDER_SUBMITTED", actor: "رمز طالب", target: "WK-2027-00581", at: "2026-08-14T03:27:00Z" }
];

export default async function AuditPage() {
  await requireUser(["OWNER"]);
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">Security Audit Trail</p>
        <h1 className="text-4xl font-black text-[var(--olive-dark)]">سجل التدقيق</h1>
      </div>
      <Card>
        <div className="grid gap-3">
          {events.map((event) => (
            <div key={`${event.action}-${event.target}`} className="rounded-3xl bg-white/60 p-4">
              <p className="font-black text-[var(--olive-dark)]">{event.action}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{event.actor} · {event.target} · {new Date(event.at).toLocaleString("ar-IQ")}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
