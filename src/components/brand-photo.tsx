import Image from "next/image";
import { cn } from "@/lib/utils";
import type { BrandAsset } from "@/lib/brand-assets";

const aspectClass = {
  "4/5": "aspect-[4/5]",
  "1/1": "aspect-square",
  "21/9": "aspect-[21/9]",
  "16/7": "aspect-[16/7]",
  "3/4": "aspect-[3/4]"
} as const;

export function BrandPhoto({
  asset,
  alt,
  aspect = "1/1",
  priority = false,
  eager = false,
  sizes,
  overlay = false,
  quality,
  className,
  rounded = true,
  fetchPriority
}: {
  asset: BrandAsset;
  alt?: string;
  aspect?: keyof typeof aspectClass;
  priority?: boolean;
  eager?: boolean;
  sizes: string;
  overlay?: boolean;
  quality?: number;
  className?: string;
  rounded?: boolean;
  fetchPriority?: "high" | "low" | "auto";
}) {
  const highPriority = priority;
  const renderQuality = quality ?? (highPriority ? 92 : 86);
  const resolvedFetch = fetchPriority ?? (highPriority ? "high" : "auto");

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-[#d7c4a4]",
        rounded && "rounded-[1.35rem] sm:rounded-[1.6rem]",
        aspectClass[aspect],
        className
      )}
    >
      <Image
        src={asset.src}
        alt={alt ?? asset.alt}
        fill
        sizes={sizes}
        quality={renderQuality}
        priority={highPriority}
        fetchPriority={resolvedFetch}
        loading={highPriority || eager ? "eager" : "lazy"}
        placeholder="empty"
        unoptimized={asset.src.startsWith("blob:") || asset.src.startsWith("data:")}
        className="object-cover object-center"
        style={{ objectPosition: asset.focalPoint }}
      />
      {overlay ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-[linear-gradient(180deg,transparent_0%,rgba(37,43,28,0.12)_100%)]"
        />
      ) : null}
    </div>
  );
}

export function BrandInspiration({
  items
}: {
  items: Array<{ asset: BrandAsset; label: string; className?: string }>;
}) {
  return (
    <section className="grid gap-3" aria-label="مجموعة التخرج">
      <div>
        <p className="text-sm font-bold text-[var(--gold)]">مجموعة التخرج</p>
        <h2 className="mt-1 text-xl font-black text-[var(--olive-dark)] sm:text-2xl">إلهام من أزياء WARKA</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, index) => (
          <figure key={item.asset.src} className={cn(index === 2 && "col-span-2 sm:col-span-1", item.className)}>
            <BrandPhoto
              asset={item.asset}
              alt={item.asset.alt}
              aspect={index === 2 ? "4/5" : "1/1"}
              quality={86}
              sizes={
                index === 2
                  ? "(max-width: 640px) 100vw, (max-width: 1024px) 34vw, 400px"
                  : "(max-width: 640px) 50vw, (max-width: 1024px) 34vw, 400px"
              }
            />
            <figcaption className="mt-2 text-xs font-bold text-[var(--muted)]">{item.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
