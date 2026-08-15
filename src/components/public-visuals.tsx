import Link from "next/link";
import type { ReactNode } from "react";
import { BrandPhoto } from "@/components/brand-photo";
import { BrandPhotoBackdrop } from "@/components/brand-photo-backdrop";
import { cn } from "@/lib/utils";
import { PUBLIC_VISUALS, type BrandAsset, type PublicVisualVariant } from "@/lib/brand-assets";

export { EditorialPhotoSection, PhotoMosaic, StudentGalleryStrip } from "@/components/deferred-photo-sections";

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
      quality={important ? 82 : 75}
      sizes={sizes}
      className={cn("w-full", "border border-[var(--border)] shadow-[var(--shadow)]", className)}
    />
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
