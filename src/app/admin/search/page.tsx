import { AdminSearchBox } from "@/components/admin-search-box";
import { EmptyState } from "@/components/empty-state";
import { Badge, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sbAdminSearch } from "@/lib/store/supabase-db";
import { assertPersistenceAllowed } from "@/lib/persistence";

export default async function AdminSearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query.length >= 2 && assertPersistenceAllowed() === "supabase" ? await sbAdminSearch(user, query) : [];

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">بحث سريع</p>
        <h1 className="text-3xl font-black text-[var(--olive-dark)]">البحث في النظام</h1>
      </div>
      <Card>
        <AdminSearchBox defaultValue={query} />
      </Card>
      {query.length >= 2 && !results.length ? (
        <EmptyState title="لا توجد نتائج" description="جرّب الاسم، رقم الهاتف، رقم الحجز، أو اسم الدفعة." />
      ) : null}
      <div className="grid gap-2">
        {results.map((hit) => (
          <LinkButton key={`${hit.type}-${hit.id}`} href={hit.href} variant="ghost" className="grid gap-1 border border-[var(--border)] bg-white/70 p-4 text-right">
            <span className="flex items-center justify-between gap-2">
              <span className="font-black text-[var(--olive-dark)]">{hit.title}</span>
              <Badge>{hit.type}</Badge>
            </span>
            <span className="text-sm text-[var(--muted)]">{hit.subtitle}</span>
          </LinkButton>
        ))}
      </div>
    </div>
  );
}
