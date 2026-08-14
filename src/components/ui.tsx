import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LogoMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--olive)] text-lg font-black text-[var(--paper)] shadow-lg">
        W
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-[var(--gold)] ltr">WARKA</p>
        <p className="font-bold text-[var(--olive-dark)]">Graduation&apos;s clothing store</p>
      </div>
    </div>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      className={cn(
        "rounded-2xl px-5 py-3 text-sm font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-[var(--olive)] text-[var(--paper)] shadow-lg shadow-[#252b1c22] hover:bg-[var(--olive-dark)]",
        variant === "secondary" && "border border-[var(--border)] bg-[var(--paper)] text-[var(--olive)] hover:bg-white",
        variant === "ghost" && "text-[var(--olive)] hover:bg-[rgba(63,71,45,0.08)]",
        className
      )}
      {...props}
    />
  );
}

export function LinkButton({
  className,
  variant = "primary",
  ...props
}: ComponentPropsWithoutRef<typeof Link> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <Link
      className={cn(
        "inline-flex rounded-2xl px-5 py-3 text-sm font-bold transition active:scale-[0.99]",
        variant === "primary" && "bg-[var(--olive)] text-[var(--paper)] shadow-lg shadow-[#252b1c22] hover:bg-[var(--olive-dark)]",
        variant === "secondary" && "border border-[var(--border)] bg-[var(--paper)] text-[var(--olive)] hover:bg-white",
        variant === "ghost" && "text-[var(--olive)] hover:bg-[rgba(63,71,45,0.08)]",
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return <section className={cn("warka-card rounded-[2rem] p-5 sm:p-7", className)} {...props} />;
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-bold text-[var(--olive-dark)]">
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
        "w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-[var(--foreground)] outline-none transition focus:border-[var(--olive)] focus:ring-4 focus:ring-[#3f472d1a]",
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
        "min-h-28 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-[var(--foreground)] outline-none transition focus:border-[var(--olive)] focus:ring-4 focus:ring-[#3f472d1a]",
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
        "inline-flex rounded-full px-3 py-1 text-xs font-bold",
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
