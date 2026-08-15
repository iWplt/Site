import { PublicVisualShell } from "@/components/public-visuals";
import { Card, LinkButton, LogoMark } from "@/components/ui";

export function PublicNotice({
  title,
  description,
  actionHref = "/",
  actionLabel = "العودة"
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <PublicVisualShell variant="access">
      <header className="mb-4">
        <LogoMark priority />
      </header>
      <Card className="relative z-10 mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-black text-[var(--olive-dark)]">{title}</h1>
        <p className="mt-3 leading-8 text-[var(--muted)]">{description}</p>
        <LinkButton href={actionHref} className="mt-5 min-h-12">
          {actionLabel}
        </LinkButton>
      </Card>
    </PublicVisualShell>
  );
}
