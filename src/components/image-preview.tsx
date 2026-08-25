"use client";

import { Minus, Plus, X, ZoomIn } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { OptimizedThumb } from "@/components/optimized-thumb";
import { cn } from "@/lib/utils";

export type PreviewableImage = {
  src: string;
  alt?: string;
  caption?: string;
};

/**
 * Compact thumbnail that opens a zoomable lightbox. Keeps object-contain proportions.
 * Does not navigate away; Escape / backdrop / close button dismiss.
 */
export function ImagePreviewThumb({
  src,
  alt = "",
  caption,
  sizes = "(max-width: 640px) 45vw, 200px",
  className,
  thumbClassName,
  aspectClassName = "aspect-[4/3]"
}: {
  src: string;
  alt?: string;
  caption?: string;
  sizes?: string;
  className?: string;
  thumbClassName?: string;
  aspectClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-white text-right",
          className
        )}
        aria-label={alt ? `معاينة: ${alt}` : "معاينة الصورة"}
      >
        <OptimizedThumb
          src={src}
          alt={alt}
          sizes={sizes}
          className={cn(aspectClassName, "bg-[#3f472d08]", thumbClassName)}
        />
        <span className="pointer-events-none absolute bottom-2 left-2 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white opacity-90 group-hover:opacity-100">
          <ZoomIn size={16} aria-hidden />
        </span>
        {caption ? (
          <span className="block truncate px-2 py-1.5 text-[11px] font-bold text-[var(--muted)]">{caption}</span>
        ) : null}
      </button>
      {open ? (
        <ImageLightbox
          images={[{ src, alt, caption }]}
          index={0}
          onClose={() => setOpen(false)}
          onIndexChange={() => undefined}
        />
      ) : null}
    </>
  );
}

export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange
}: {
  images: PreviewableImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const current = images[index];
  if (!current || typeof document === "undefined") return null;

  return createPortal(
    <LightboxFrame
      key={`${index}:${current.src}`}
      images={images}
      index={index}
      current={current}
      onClose={onClose}
      onIndexChange={onIndexChange}
    />,
    document.body
  );
}

function LightboxFrame({
  images,
  index,
  current,
  onClose,
  onIndexChange
}: {
  images: PreviewableImage[];
  index: number;
  current: PreviewableImage;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const titleId = useId();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && images.length > 1) {
        onIndexChange((index - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight" && images.length > 1) {
        onIndexChange((index + 1) % images.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [images.length, index, onClose, onIndexChange]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.getElementById("warka-image-lightbox-close")?.focus();
    return () => previous?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex h-[100dvh] w-screen items-center justify-center bg-black/60 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[100dvh] w-full max-w-[min(96vw,56rem)] flex-col items-center"
        onClick={(event) => event.stopPropagation()}
      >
        <p id={titleId} className="sr-only">
          معاينة الصورة
        </p>
        <div className="mb-2 flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--olive-dark)] shadow-md"
              onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
              aria-label="تصغير"
            >
              <Minus size={18} />
            </button>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--olive-dark)] shadow-md"
              onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
              aria-label="تكبير"
            >
              <Plus size={18} />
            </button>
          </div>
          <button
            id="warka-image-lightbox-close"
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--olive-dark)] shadow-md"
            onClick={onClose}
            aria-label="إغلاق المعاينة"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[78dvh] w-full overflow-auto overscroll-contain rounded-2xl bg-black/20 touch-pan-x touch-pan-y">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.src}
            alt={current.alt || "معاينة"}
            decoding="async"
            className="mx-auto block h-auto max-h-[78dvh] w-auto max-w-full origin-center object-contain transition-transform duration-150"
            style={{ transform: `scale(${zoom})` }}
            draggable={false}
          />
        </div>
        {current.caption || current.alt ? (
          <p className="mt-2 max-w-full truncate text-center text-sm font-bold text-white">
            {current.caption || current.alt}
          </p>
        ) : null}
      </div>
    </div>
  );
}
