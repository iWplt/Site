/** Curated WARKA brand photos. Paths match files under public/warka-brand. */

const PACK = "/warka-brand";

export type BrandAssetCategory = "hero" | "section" | "men" | "group" | "editorial";

export type BrandAsset = {
  src: string;
  alt: string;
  focalPoint: string;
  width: number;
  height: number;
  category: BrandAssetCategory;
  mobile: boolean;
  desktop: boolean;
};

function asset(
  file: string,
  alt: string,
  focalPoint: string,
  width: number,
  height: number,
  category: BrandAssetCategory,
  usage: { mobile?: boolean; desktop?: boolean } = {}
): BrandAsset {
  return {
    src: `${PACK}/${file}`,
    alt,
    focalPoint,
    width,
    height,
    category,
    mobile: usage.mobile ?? true,
    desktop: usage.desktop ?? true
  };
}

const photos = {
  hero01: asset("mobile-hero-01-white-bouquet-eyes.png", "صورة مقربة لخريجة WARKA", "center 38%", 1080, 1080, "hero"),
  hero02: asset("mobile-hero-02-stone-wall-diploma.png", "خريجة WARKA أمام جدار حجري", "center 28%", 1080, 1080, "hero"),
  hero03: asset("mobile-hero-03-white-bouquet-cap.png", "خريجة WARKA بالقبعة وباقة بيضاء", "center 32%", 1080, 1080, "hero"),
  hero04: asset("mobile-hero-04-blue-sash-mirror.png", "خريجة WARKA بوشاح أزرق", "center 30%", 1080, 1080, "hero"),
  hero05: asset("mobile-hero-05-sunglasses-blue-sash.png", "إطلالة تخرج عصرية من WARKA", "center 28%", 1080, 1080, "hero"),
  hero06: asset("mobile-hero-06-blue-bib-closeup.png", "صورة هادئة لخريجة WARKA", "center 30%", 1080, 1080, "hero"),
  hero07: asset("mobile-hero-07-camera-green-sash.png", "خريجة WARKA بوشاح أخضر", "center 26%", 959, 1280, "hero"),
  hero08: asset("mobile-hero-08-rose-closeup-green-sash.png", "تفاصيل وردة ووشاح التخرج", "center 42%", 1080, 1080, "hero"),
  section01: asset("section-01-doorway-white-sash-bouquet.png", "زي تخرج WARKA كامل مع باقة", "center 34%", 1080, 1080, "section"),
  section02: asset("section-02-museum-blue-sash-fullbody.png", "إطلالة كاملة بوشاح أزرق", "center 22%", 1080, 1350, "section"),
  section03: asset("section-03-outdoor-white-sash-bouquet.png", "خريجة WARKA في الهواء الطلق", "center 28%", 1080, 1350, "section"),
  section04: asset("section-04-studio-blue-bib-fullbody.png", "عرض روب ووشاح WARKA", "center 25%", 1080, 1080, "section"),
  section05: asset("section-05-back-burgundy-sash-bouquet.png", "تفاصيل الوشاح والباقة من الخلف", "center 30%", 1080, 1350, "section"),
  section06: asset("section-06-newspaper-editorial.png", "صورة تحريرية من جلسة التخرج", "center 32%", 1080, 1350, "section"),
  section07: asset("section-07-seated-green-sash.png", "إطلالة تخرج أنيقة من WARKA", "center 26%", 961, 1280, "section"),
  section08: asset("section-08-seated-done-background.png", "جلسة تصوير تخرج هادئة", "center 28%", 1080, 1350, "section"),
  section09: asset("section-09-black-suit-lifestyle.png", "إطلالة رجالية أنيقة للتخريج", "center 24%", 1080, 1350, "section"),
  men01: asset("men-01-beige-sash.png", "مجموعة الرجال — وشاح بيج", "center 26%", 1080, 1080, "men"),
  men02: asset("men-02-green-sash.png", "مجموعة الرجال — وشاح أخضر", "center 28%", 1080, 1080, "men"),
  men03: asset("men-03-black-suit.png", "بدلة تخرج سوداء من WARKA", "center 22%", 1080, 1350, "men"),
  men04: asset("men-04-burgundy-sash.png", "مجموعة الرجال — وشاح عنابي", "center 26%", 1080, 1080, "men"),
  group01: asset("group-01-burgundy-sashes.png", "دفعة خريجين بوشاحات WARKA", "center 28%", 1080, 1080, "group"),
  editorial01: asset("editorial-01-two-graduates-blue-sash.png", "تفاصيل وشاح التخرج", "center 30%", 1027, 1280, "editorial"),
  editorial02: asset("editorial-02-red-white-flowers.png", "باقة تخرج بتفاصيل دقيقة", "center 40%", 1080, 1080, "editorial"),
  editorial03: asset("editorial-03-hello-kitty-blue-bib.png", "تخصيص إبداعي لزي التخرج", "center 32%", 1080, 1080, "editorial")
} as const;

export const PHOTOS = photos;

export const MOBILE_HERO = photos.hero03;

export const MOBILE_HERO_ALTERNATES = {
  bouquetEyes: photos.hero01,
  stoneDiploma: photos.hero02,
  blueSash: photos.hero04,
  sunglasses: photos.hero05,
  cameraGreen: photos.hero07
} as const;

export const BRAND = {
  hero: photos.hero03,
  bookingBanner: photos.hero02,
  confirmation: photos.hero06,
  loginAccent: photos.hero04,
  adminAccent: photos.hero05,
  collection: photos.section01,
  outfit: photos.section04,
  men: photos.men02,
  group: photos.group01,
  editorial: photos.editorial01,
  empty: photos.section07
} as const;

export type PublicVisualVariant = "access" | "booking" | "receipt";

export type PublicVisualLayout = {
  hero: BrandAsset;
  mosaic: BrandAsset[];
  gallery: Array<{ asset: BrandAsset; label: string }>;
  editorial: Array<{ asset: BrandAsset; label: string }>;
  ambient: BrandAsset[];
};

export const PUBLIC_VISUALS: Record<PublicVisualVariant, PublicVisualLayout> = {
  access: {
    hero: photos.hero03,
    mosaic: [photos.hero04, photos.hero01, photos.section02, photos.men02],
    gallery: [
      { asset: photos.editorial02, label: "الباقات" },
      { asset: photos.section03, label: "جلسات خارجية" },
      { asset: photos.men03, label: "الرجال" },
      { asset: photos.section09, label: "إطلالات أنيقة" }
    ],
    editorial: [
      { asset: photos.section01, label: "الزي الكامل" },
      { asset: photos.men01, label: "مجموعة الرجال" },
      { asset: photos.group01, label: "الدفعات" }
    ],
    ambient: [photos.section08, photos.editorial01, photos.section06, photos.hero08]
  },
  booking: {
    hero: photos.hero02,
    mosaic: [photos.section04, photos.hero07, photos.section07],
    gallery: [
      { asset: photos.section05, label: "تفاصيل الوشاح" },
      { asset: photos.editorial03, label: "تخصيص الزي" },
      { asset: photos.men04, label: "مجموعة الرجال" }
    ],
    editorial: [],
    ambient: [photos.hero05, photos.group01, photos.section09, photos.editorial02]
  },
  receipt: {
    hero: photos.hero06,
    mosaic: [photos.hero08, photos.section08, photos.editorial01],
    gallery: [
      { asset: photos.section06, label: "جلسات تحريرية" },
      { asset: photos.group01, label: "الدفعة" },
      { asset: photos.section01, label: "الزي الكامل" },
      { asset: photos.hero05, label: "إطلالة عصرية" }
    ],
    editorial: [
      { asset: photos.section03, label: "لحظات التخرج" },
      { asset: photos.men02, label: "مجموعة الرجال" }
    ],
    ambient: [photos.hero04, photos.section02, photos.men01, photos.section07]
  }
};
