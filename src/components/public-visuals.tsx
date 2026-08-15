import Link from "next/link";
import type { ReactNode } from "react";
import { BrandPhoto } from "@/components/brand-photo";
import { BrandPhotoBackdrop } from "@/components/brand-photo-backdrop";
import { cn } from "@/lib/utils";
import { PUBLIC_VISUALS, type BrandAsset, type PublicVisualVariant } from "@/lib/brand-assets";

export function PublicVisualHero({
  asset,
  highPriority = false,
  priority = false,
  aspect = "1/1",
  sizes,
  className
}: {
  asset: BrandAsset;
  highPriority?: boolean;
  priority?: boolean;
  aspect?: "1/1" | "4/5" | "16/7" | "3/4";
  sizes: string;
  className?: string;
}) {
  const important = highPriority || priority;
  return (
    <BrandPhoto
      asset={asset}
      aspect={aspect}
      priority={important}
      quality={important ? 95 : 90}
      sizes={sizes}
      className={cn("w-full", "border border-[var(--border)] shadow-[var(--shadow)]", className)}
    />
  );
}

export function PhotoMosaic({
  assets,
  className
}: {
  assets: BrandAsset[];
  className?: string;
}) {
  const tiles = assets.slice(0, 6);
  if (!tiles.length) return null;
  const three = tiles.length === 3;

  return (
    <section className={cn("grid gap-2 sm:gap-3", className)} aria-label="معرض صور التخرج">
      <div
        className={cn(
          "grid gap-2 sm:gap-3",
          three ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"
        )}
      >
        {tiles.map((asset, index) => (
          <BrandPhoto
            key={asset.src}
            asset={asset}
            aspect={three && index === 2 ? "4/5" : "1/1"}
            quality={86}
            sizes={
              three && index === 2
                ? "(max-width: 640px) 100vw, 420px"
                : "(max-width: 640px) 48vw, (max-width: 1024px) 24vw, 280px"
            }
            className={cn(
              "warka-photo-tile",
              three && index === 2 && "col-span-2 sm:col-span-1"
            )}
          />
        ))}
      </div>
    </section>
  );
}

export function StudentGalleryStrip({
  items,
  title = "من جلسات WARKA",
  className
}: {
  items: Array<{ asset: BrandAsset; label: string }>;
  title?: string;
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <section className={cn("grid gap-3", className)} aria-label={title}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">هوية التخرج</p>
          <h2 className="mt-1 text-xl font-black text-[var(--olive-dark)] sm:text-2xl">{title}</h2>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {items.map((item) => (
          <figure key={item.asset.src} className="min-w-0">
            <BrandPhoto
              asset={item.asset}
              aspect="1/1"
              quality={86}
              sizes="(max-width: 640px) 48vw, (max-width: 1024px) 22vw, 240px"
              className="warka-photo-tile"
            />
            <figcaption className="mt-2 truncate text-xs font-bold text-[var(--muted)]">{item.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function EditorialPhotoSection({
  items,
  className
}: {
  items: Array<{ asset: BrandAsset; label: string }>;
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <section className={cn("grid gap-3", className)} aria-label="مجموعة التخرج">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">مجموعة التخرج</p>
        <h2 className="mt-1 text-xl font-black text-[var(--olive-dark)] sm:text-2xl">إلهام من أزياء WARKA</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, index) => (
          <figure key={item.asset.src} className={cn(index === 2 && "col-span-2 sm:col-span-1")}>
            <BrandPhoto
              asset={item.asset}
              aspect={index === 2 ? "4/5" : "1/1"}
              quality={86}
              sizes={
                index === 2
                  ? "(max-width: 640px) 100vw, (max-width: 1024px) 34vw, 400px"
                  : "(max-width: 640px) 50vw, (max-width: 1024px) 34vw, 400px"
              }
              className="warka-photo-tile"
            />
            <figcaption className="mt-2 text-xs font-bold text-[var(--muted)]">{item.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function PublicVisualShell({
  variant,
  children,
  className
}: {
  variant: PublicVisualVariant;
  children: ReactNode;
  className?: string;
}) {
  const layout = PUBLIC_VISUALS[variant];
  const maxWidth = variant === "access" ? "max-w-6xl" : "max-w-3xl";

  return (
    <main className={cn("warka-public relative min-h-screen overflow-x-hidden", className)}>
      <BrandPhotoBackdrop assets={layout.ambient} />
      <div className={cn("relative z-10 mx-auto w-full px-3 py-4 sm:px-4 sm:py-6", maxWidth)}>
        {children}
        <p className="relative z-10 mt-8 text-center text-sm">
          <Link href="/privacy" className="font-bold text-[var(--olive)]">
            إشعار الخصوصية
          </Link>
        </p>
      </div>
    </main>
  );
}
