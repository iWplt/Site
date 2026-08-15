"use client";

import { useEffect, useState, type ReactNode } from "react";

export function ViewportGate({
  minWidth,
  maxWidth,
  children
}: {
  minWidth?: number;
  maxWidth?: number;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const query =
      minWidth != null && maxWidth != null
        ? `(min-width: ${minWidth}px) and (max-width: ${maxWidth}px)`
        : minWidth != null
          ? `(min-width: ${minWidth}px)`
          : `(max-width: ${maxWidth}px)`;
    const media = window.matchMedia(query);
    const sync = () => setShow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [minWidth, maxWidth]);

  if (!show) return null;
  return children;
}
