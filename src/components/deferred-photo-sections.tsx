"use client";

import { useEffect, useRef, useState } from "react";
import { BrandPhoto } from "@/components/brand-photo";
import { cn } from "@/lib/utils";
import type { BrandAsset } from "@/lib/brand-assets";

function useNearViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

export function PhotoMosaic({
  assets,
  className
}: {
  assets: BrandAsset[];
  className?: string;
}) {
  const tiles = assets.slice(0, 6);
  const { ref, visible } = useNearViewport();
  if (!tiles.length) return null;
  const three = tiles.length === 3;

  return (
    <div ref={ref} className={className}>
      {!visible ? <div className="min-h-[18rem] rounded-[1.35rem] bg-[#d7c4a4]/70" aria-hidden /> : (
        <section className="grid gap-2 sm:gap-3" aria-label="معرض صور التخرج">
          <div className={cn("grid gap-2 sm:gap-3", three ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
            {tiles.map((asset, index) => (
              <BrandPhoto
                key={asset.src}
                asset={asset}
                aspect={three && index === 2 ? "4/5" : "1/1"}
                quality={75}
                sizes={
                  three && index === 2
                    ? "(max-width: 640px) 100vw, 420px"
                    : "(max-width: 640px) 48vw, (max-width: 1024px) 24vw, 280px"
                }
                className={cn("warka-photo-tile", three && index === 2 && "col-span-2 sm:col-span-1")}
              />
            ))}
          </div>
        </section>
      )}
    </div>
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
  const { ref, visible } = useNearViewport();
  if (!items.length) return null;

  return (
    <div ref={ref} className={className}>
      {!visible ? <div className="min-h-[16rem] rounded-[1.35rem] bg-[#d7c4a4]/70" aria-hidden /> : (
        <section className="grid gap-3" aria-label={title}>
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
                  quality={75}
                  sizes="(max-width: 640px) 48vw, (max-width: 1024px) 22vw, 240px"
                  className="warka-photo-tile"
                />
                <figcaption className="mt-2 truncate text-xs font-bold text-[var(--muted)]">{item.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function EditorialPhotoSection({
  items,
  className
}: {
  items: Array<{ asset: BrandAsset; label: string }>;
  className?: string;
}) {
  const { ref, visible } = useNearViewport();
  if (!items.length) return null;

  return (
    <div ref={ref} className={className}>
      {!visible ? <div className="min-h-[16rem] rounded-[1.35rem] bg-[#d7c4a4]/70" aria-hidden /> : (
        <section className="grid gap-3" aria-label="مجموعة التخرج">
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
                  quality={75}
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
      )}
    </div>
  );
}
