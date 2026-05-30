import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "bzh"],
  defaultLocale: "fr",
});

export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  bzh: "Brezhoneg",
};

export const localeLabels: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
  bzh: "BZH",
};
