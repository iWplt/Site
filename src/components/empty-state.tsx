import { LinkButton } from "@/components/ui";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[var(--paper)] p-6">
      <h2 className="text-xl font-black text-[var(--olive-dark)]">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
      {actionHref && actionLabel ? (
        <LinkButton href={actionHref} className="mt-4" variant="secondary">
          {actionLabel}
        </LinkButton>
      ) : null}
    </div>
  );
}
