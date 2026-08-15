"use client";

import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { OptimizedThumb } from "@/components/optimized-thumb";
import { cn } from "@/lib/utils";
import type { GalleryImage } from "@/lib/order-view";

export function ImageGallery({
  images,
  compact = false
}: {
  images: GalleryImage[];
  compact?: boolean;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? null : images[index];

  useEffect(() => {
    if (index === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIndex(null);
      if (event.key === "ArrowLeft") setIndex((value) => (value === null ? value : (value - 1 + images.length) % images.length));
      if (event.key === "ArrowRight") setIndex((value) => (value === null ? value : (value + 1) % images.length));
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, images.length]);

  useEffect(() => {
    if (index === null) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.getElementById("warka-lightbox-close")?.focus();
    return () => previous?.focus();
  }, [index]);

  if (!images.length) return null;

  return (
    <>
      <div className={cn("grid gap-3", compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
        {images.map((image, imageIndex) => (
          <button
            key={`${image.src}-${imageIndex}`}
            type="button"
            onClick={() => setIndex(imageIndex)}
            className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white text-right"
          >
            <OptimizedThumb
              src={image.src}
              alt={image.alt}
              sizes={compact ? "(max-width: 640px) 30vw, 160px" : "(max-width: 640px) 50vw, 240px"}
              className="bg-[#3f472d08]"
            />
            <span className="block px-2 py-2 text-[11px] font-bold text-[var(--muted)]">{image.caption}</span>
          </button>
        ))}
      </div>
      {current
        ? createPortal(
        <div
          className="fixed inset-0 z-[200] flex h-[100dvh] w-screen items-center justify-center bg-black/55 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="معاينة الصورة"
          onClick={() => setIndex(null)}
        >
          <div
            className="relative w-fit max-w-[90vw]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              id="warka-lightbox-close"
              type="button"
              className="absolute top-2 right-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--olive-dark)] shadow-md"
              onClick={() => setIndex(null)}
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute top-1/2 right-2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[var(--olive-dark)] shadow-md"
                  onClick={() => setIndex((value) => (value === null ? 0 : (value - 1 + images.length) % images.length))}
                  aria-label="السابق"
                >
                  <ChevronRight size={20} />
                </button>
                <button
                  type="button"
                  className="absolute top-1/2 left-2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[var(--olive-dark)] shadow-md"
                  onClick={() => setIndex((value) => (value === null ? 0 : (value + 1) % images.length))}
                  aria-label="التالي"
                >
                  <ChevronLeft size={20} />
                </button>
              </>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.src}
              alt={current.alt}
              decoding="async"
              className="block h-auto max-h-[85dvh] w-auto max-w-[90vw] rounded-2xl object-contain"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 rounded-b-2xl bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 text-white">
              <p className="pointer-events-auto min-w-0 truncate text-xs font-bold sm:text-sm">
                {current.caption}
                {current.alt ? ` · ${current.alt}` : ""}
              </p>
              {current.downloadUrl ? (
                <a
                  href={current.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1.5 text-xs"
                >
                  <Download size={14} /> فتح الأصل
                </a>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      )
      : null}
    </>
  );
}