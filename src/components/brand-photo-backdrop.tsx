"use client";

import { useEffect, useState } from "react";
import { BrandPhoto } from "@/components/brand-photo";
import type { BrandAsset } from "@/lib/brand-assets";

type AmbientMode = "none" | "tablet" | "desktop";

export function BrandPhotoBackdrop({ assets }: { assets: BrandAsset[] }) {
  const [mode, setMode] = useState<AmbientMode>("none");

  useEffect(() => {
    const tablet = window.matchMedia("(min-width: 768px) and (max-width: 1279px)");
    const desktop = window.matchMedia("(min-width: 1280px)");
    const sync = () => {
      if (desktop.matches) setMode("desktop");
      else if (tablet.matches) setMode("tablet");
      else setMode("none");
    };
    sync();
    tablet.addEventListener("change", sync);
    desktop.addEventListener("change", sync);
    return () => {
      tablet.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
    };
  }, []);

  if (mode === "none" || !assets.length) return null;

  if (mode === "tablet") {
    const tiles = assets.slice(0, 2);
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {tiles[0] ? (
          <div className="absolute top-28 -right-6 w-[6.75rem] md:w-28 lg:right-1 lg:w-32">
            <BrandPhoto
              asset={tiles[0]}
              aspect="3/4"
              quality={75}
              sizes="128px"
              fetchPriority="low"
              className="warka-photo-tile mask-ambient"
            />
          </div>
        ) : null}
        {tiles[1] ? (
          <div className="absolute bottom-24 -left-6 w-[6.75rem] md:w-28 lg:left-1 lg:w-32">
            <BrandPhoto
              asset={tiles[1]}
              aspect="3/4"
              quality={75}
              sizes="128px"
              fetchPriority="low"
              className="warka-photo-tile mask-ambient"
            />
          </div>
        ) : null}
      </div>
    );
  }

  const tiles = assets.slice(0, 4);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute top-24 right-4 w-[9.5rem] space-y-3 2xl:right-8 2xl:w-44">
        {tiles.slice(0, 2).map((asset) => (
          <BrandPhoto
            key={asset.src}
            asset={asset}
            aspect="3/4"
            quality={75}
            sizes="176px"
            fetchPriority="low"
            className="warka-photo-tile"
          />
        ))}
      </div>
      <div className="absolute bottom-16 left-4 w-[9.5rem] space-y-3 2xl:left-8 2xl:w-44">
        {tiles.slice(2, 4).map((asset) => (
          <BrandPhoto
            key={asset.src}
            asset={asset}
            aspect="3/4"
            quality={75}
            sizes="176px"
            fetchPriority="low"
            className="warka-photo-tile"
          />
        ))}
      </div>
    </div>
  );
}
