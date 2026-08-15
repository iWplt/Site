/** Approved raster logos. SVG tracing was skipped to avoid changing emblem geometry. */

export const WARKA_LOGOS = {
  primary: {
    src: "/brand/warka-logo-primary-transparent.png",
    width: 635,
    height: 731
  },
  primaryOpaque: {
    src: "/brand/warka-logo-primary.png",
    width: 637,
    height: 736
  },
  icon: {
    src: "/brand/warka-logo-icon-transparent.png",
    width: 512,
    height: 508
  },
  black: {
    src: "/brand/warka-logo-black.png",
    width: 783,
    height: 782
  },
  reverse: {
    src: "/brand/warka-logo-reverse.png",
    width: 716,
    height: 751
  }
} as const;

export type WarkaLogoVariant = keyof typeof WARKA_LOGOS;
