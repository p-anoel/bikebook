"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoadbookStore } from "@/lib/store/roadbook-store";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function GpxDropzone() {
  const t = useTranslations("landing");
  const tUpload = useTranslations("upload");
  const tA11y = useTranslations("a11y");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { setRoadbook, setError, setIsLoading, isLoading } = useRoadbookStore();

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".gpx")) {
        setError(tUpload("errors.invalidType"));
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(tUpload("errors.tooLarge"));
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/gpx/parse", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          const code = data.error?.code as string | undefined;
          const errorKey =
            code === "INVALID_XML"
              ? "errors.invalidXml"
              : code === "NO_TRACK"
                ? "errors.noTrack"
                : code === "EMPTY_TRACK"
                  ? "errors.emptyTrack"
                  : "errors.parseError";
          setError(tUpload(errorKey));
          return;
        }

        setRoadbook(data.roadbook);
        router.push("/roadbook");
      } catch {
        setError(tUpload("errors.network"));
      } finally {
        setIsLoading(false);
      }
    },
    [router, setError, setIsLoading, setRoadbook, tUpload],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) void uploadFile(file);
    },
    [uploadFile],
  );

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label={tA11y("dropzone")}
        aria-busy={isLoading}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
          isDragging
            ? "border-zinc-900 bg-zinc-50"
            : "border-zinc-300 bg-zinc-50/50 hover:border-zinc-400 hover:bg-zinc-50",
          isLoading && "pointer-events-none opacity-70",
        )}
        onClick={() => inputRef.current?.click()}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-zinc-200">
          {isLoading ? (
            <FileText className="h-6 w-6 animate-pulse text-zinc-500" />
          ) : (
            <Upload className="h-6 w-6 text-zinc-700" aria-hidden="true" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-900">
            {isLoading ? tUpload("parsing") : t("uploadHint")}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{t("supportedFormats")}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isLoading}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          {t("uploadButton")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
