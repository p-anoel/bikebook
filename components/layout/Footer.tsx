import { getTranslations } from "next-intl/server";
import { BrittanyFlag } from "@/components/layout/BrittanyFlag";
import { SITE_AUTHOR } from "@/lib/site";

export async function Footer() {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-sm text-zinc-500 sm:flex-row sm:px-6">
        <p className="text-zinc-600">
          © {year} {SITE_AUTHOR}
        </p>
        <p className="flex items-center gap-2.5 font-medium text-zinc-700">
          <span className="inline-block h-6 w-9 shrink-0 overflow-hidden border border-zinc-300 bg-white shadow-sm">
            <BrittanyFlag className="block h-full w-full" />
          </span>
          <span>{t("madeIn")}</span>
        </p>
      </div>
    </footer>
  );
}
