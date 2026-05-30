"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabels, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const t = useTranslations("a11y");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1"
      role="group"
      aria-label={t("languageSwitcher")}
    >
      {(Object.keys(localeLabels) as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => router.replace(pathname, { locale: code })}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
            locale === code
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-100",
          )}
          aria-current={locale === code ? "true" : undefined}
        >
          {localeLabels[code]}
        </button>
      ))}
    </div>
  );
}
