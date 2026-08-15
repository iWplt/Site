"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function OptimizedThumb({
  src,
  alt,
  sizes,
  priority = false,
  eager = false,
  className
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  eager?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const remote = /^https?:\/\//.test(src);

  return (
    <div className={cn("relative aspect-[4/3] w-full overflow-hidden bg-[#f3ead6]", className)}>
      {failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-contain p-2" />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          quality={86}
          priority={priority}
          fetchPriority={priority ? "high" : "auto"}
          loading={priority || eager ? "eager" : "lazy"}
          unoptimized={src.startsWith("blob:") || src.startsWith("data:")}
          className="object-contain p-2"
          onError={() => {
            if (remote) setFailed(true);
          }}
        />
      )}
    </div>
  );
}
