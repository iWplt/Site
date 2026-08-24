import { LinkButton } from "@/components/ui";

type Item = {
  href: string;
  label: string;
  current?: boolean;
};

export function BookingWorkspaceNav({
  items,
  title = "النماذج والمنتجات"
}: {
  items: Item[];
  title?: string;
}) {
  return (
    <nav className="rounded-[1.4rem] border border-[var(--border)] bg-white/70 p-3" aria-label={title}>
      <p className="mb-2 px-1 text-xs font-bold text-[var(--gold)]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <LinkButton
            key={`${item.href}-${item.label}`}
            href={item.href}
            prefetch
            variant={item.current ? "primary" : "secondary"}
            size="sm"
          >
            {item.label}
          </LinkButton>
        ))}
      </div>
    </nav>
  );
}

export function batchWorkspaceItems(input: { batchId: string; formId?: string; current: "batch" | "form" | "outfits" | "products" | "orders" }) {
  const formHref = input.formId ? `/admin/forms/${input.formId}` : "/admin/forms";
  return [
    { href: `/admin/batches/${input.batchId}`, label: "الدفعة", current: input.current === "batch" },
    { href: formHref, label: "النموذج", current: input.current === "form" },
    { href: input.formId ? `${formHref}?tab=outfits` : "/admin/forms", label: "الأزياء", current: input.current === "outfits" },
    { href: input.formId ? `${formHref}?tab=products` : "/admin/forms", label: "المنتجات", current: input.current === "products" },
    { href: `/admin/batches/${input.batchId}/orders`, label: "الطلبات", current: input.current === "orders" }
  ];
}

export function formWorkspaceItems(input: { formId: string; batchId?: string; current: "batch" | "form" | "outfits" | "products" }) {
  return [
    { href: input.batchId ? `/admin/batches/${input.batchId}` : "/admin/batches", label: "الدفعة", current: input.current === "batch" },
    { href: `/admin/forms/${input.formId}`, label: "النموذج", current: input.current === "form" },
    { href: `/admin/forms/${input.formId}?tab=outfits`, label: "الأزياء", current: input.current === "outfits" },
    { href: `/admin/forms/${input.formId}?tab=products`, label: "المنتجات", current: input.current === "products" }
  ];
}
