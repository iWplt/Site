import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeArabicText(value: string) {
  return value
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatArabicDate(value: string | Date) {
  return new Intl.DateTimeFormat("ar-IQ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatBookingCardDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    numberingSystem: "latn"
  })
    .format(date)
    .replace(/\s?am$/i, " ص")
    .replace(/\s?pm$/i, " م");
  return `${day} - ${time}`;
}

export function toArabicDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

export function safeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
