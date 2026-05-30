import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistance(km: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(km);
}

export function formatElevation(m: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(m);
}
