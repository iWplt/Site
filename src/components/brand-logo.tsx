import Image from "next/image";
import { cn } from "@/lib/utils";
import { WARKA_LOGOS, type WarkaLogoVariant } from "@/lib/brand-logo";

type LogoMarkProps = {
  className?: string;
  variant?: WarkaLogoVariant;
  compact?: boolean;
  priority?: boolean;
  decorative?: boolean;
  printFallback?: boolean;
};

export function LogoMark({
  className,
  variant = "primary",
  compact = false,
  priority = false,
  decorative = false,
  printFallback = false
}: LogoMarkProps) {
  const alt = decorative ? "" : "WARKA";
  const asset = WARKA_LOGOS[compact ? "icon" : variant];

  return (
    <div className={cn("warka-brand-lockup min-w-0", className)} dir="ltr">
      <Image
        src={asset.src}
        alt={alt}
        width={asset.width}
        height={asset.height}
        priority={priority}
        quality={95}
        sizes={compact ? "40px" : "(max-width: 639px) 70px, 88px"}
        className={cn(
          "max-w-full object-contain",
          compact ? "h-10 w-auto" : "h-16 w-auto sm:h-[4.5rem]",
          printFallback && "print:hidden"
        )}
      />
      {printFallback ? (
        // Native img so print/PDF does not depend on the optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={WARKA_LOGOS.black.src}
          alt={alt}
          width={WARKA_LOGOS.black.width}
          height={WARKA_LOGOS.black.height}
          className="hidden h-20 w-auto max-w-[9rem] object-contain print:block"
        />
      ) : null}
    </div>
  );
}

export function BrandIcon({
  className,
  size = 40,
  decorative = false
}: {
  className?: string;
  size?: number;
  decorative?: boolean;
}) {
  const asset = WARKA_LOGOS.icon;
  return (
    <Image
      src={asset.src}
      alt={decorative ? "" : "WARKA"}
      width={asset.width}
      height={asset.height}
      sizes={`${size}px`}
      quality={95}
      className={cn("object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
