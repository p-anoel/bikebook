import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { Bike } from "lucide-react";

export async function Header() {
  const t = await getTranslations("common");

  return (
    <header className="sticky top-0 z-[1000] border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-semibold text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        >
          <Bike className="h-5 w-5" aria-hidden="true" />
          <span>{t("appName")}</span>
        </Link>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
