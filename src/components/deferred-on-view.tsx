"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DeferredOnView({
  children,
  className,
  minHeight = "12rem"
}: {
  children: ReactNode;
  className?: string;
  minHeight?: string;
}) {
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

  return (
    <div ref={ref} className={cn(className)} style={visible ? undefined : { minHeight }}>
      {visible ? children : <div className="h-full min-h-[12rem] rounded-[1.35rem] bg-[#d7c4a4]/70" aria-hidden />}
    </div>
  );
}
