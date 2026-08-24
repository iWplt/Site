import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export { BrandIcon, LogoMark } from "@/components/brand-logo";

export type ButtonSize = "sm" | "md" | "lg" | "icon";
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 min-h-9 rounded-xl px-3 text-xs",
  md: "h-10 min-h-10 rounded-2xl px-4 text-sm",
  lg: "h-12 min-h-12 rounded-2xl px-5 text-sm",
  icon: "size-9 min-h-9 min-w-9 rounded-xl p-0"
};

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-[var(--olive)] text-[var(--paper)] shadow-md shadow-[#252b1c18] hover:bg-[var(--olive-dark)]",
  secondary: "border border-[var(--border)] bg-[var(--paper)] text-[var(--olive)] hover:bg-white",
  ghost: "text-[var(--olive)] hover:bg-[#3f472d0d]",
  danger: "bg-[var(--danger)] text-white shadow-md shadow-[#9d2f2f18] hover:bg-[#7d2424]"
};

const buttonBase =
  "box-border inline-flex items-center justify-center gap-2 text-center font-bold leading-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-[1.05em] [&_svg]:shrink-0 [&_svg]:max-h-none [&_svg]:max-w-none";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={cn(buttonBase, buttonSizes[size], buttonVariants[variant], className)} {...props} />;
}

export function LinkButton({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ComponentPropsWithoutRef<typeof Link> & { variant?: Exclude<ButtonVariant, "danger">; size?: ButtonSize }) {
  return <Link className={cn(buttonBase, buttonSizes[size], buttonVariants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return <section className={cn("warka-card rounded-[1.5rem] p-4 sm:p-5", className)} {...props} />;
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-bold text-[var(--olive-dark)]">
      {children}
      {required ? <span className="mx-1 text-[var(--danger)]">*</span> : null}
    </label>
  );
}

export function TextInput(props: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "box-border h-11 min-h-11 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 leading-normal text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--olive)] focus:ring-4 focus:ring-[#3f472d1a]",
        props.className
      )}
    />
  );
}

export function Select(props: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "box-border h-11 min-h-11 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 leading-normal text-[var(--foreground)] outline-none transition focus:border-[var(--olive)] focus:ring-4 focus:ring-[#3f472d1a]",
        props.className
      )}
    />
  );
}

export function TextArea(props: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-24 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--olive)] focus:ring-4 focus:ring-[#3f472d1a]",
        props.className
      )}
    />
  );
}

export function Badge({
  children,
  tone = "olive",
  className
}: {
  children: ReactNode;
  tone?: "olive" | "gold" | "red" | "green";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold leading-none",
        tone === "olive" && "bg-[#3f472d16] text-[var(--olive)]",
        tone === "gold" && "bg-[#b59a631f] text-[#836528]",
        tone === "red" && "bg-[#9d2f2f14] text-[var(--danger)]",
        tone === "green" && "bg-[#386a3d16] text-[var(--success)]",
        className
      )}
    >
      {children}
    </span>
  );
}

export function VisibilityBadge({ visible }: { visible: boolean }) {
  return (
    <Badge tone={visible ? "green" : "olive"} className="gap-1.5">
      <span aria-hidden>{visible ? "🟢" : "⚪"}</span>
      {visible ? "ظاهر للطالب" : "مخفي عن الطالب"}
    </Badge>
  );
}
