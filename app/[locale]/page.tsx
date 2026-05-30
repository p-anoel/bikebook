import { getTranslations, setRequestLocale } from "next-intl/server";
import { Map, Mountain, FileDown } from "lucide-react";
import { GpxDropzone } from "@/components/upload/GpxDropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadError } from "@/components/upload/UploadError";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });

  return {
    title: t("appName"),
    description: t("tagline"),
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");

  const features = [
    { icon: Map, label: t("features.map") },
    { icon: Mountain, label: t("features.elevation") },
    { icon: FileDown, label: t("features.pdf") },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-zinc-600 sm:text-lg">
          {t("subtitle")}
        </p>
      </div>

      <div className="mb-8 flex flex-wrap justify-center gap-3">
        {features.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("uploadTitle")}</CardTitle>
          <CardDescription>{t("supportedFormats")}</CardDescription>
        </CardHeader>
        <CardContent>
          <GpxDropzone />
          <UploadError />
        </CardContent>
      </Card>
    </div>
  );
}
