"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoadbookSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  storageKey?: string;
  nested?: boolean;
  children: React.ReactNode;
  className?: string;
}

function readStoredOpen(storageKey: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function RoadbookSection({
  title,
  description,
  defaultOpen = true,
  storageKey,
  nested = false,
  children,
  className,
}: RoadbookSectionProps) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(!storageKey);

  useEffect(() => {
    if (!storageKey) return;
    setOpen(readStoredOpen(storageKey, defaultOpen));
    setHydrated(true);
  }, [storageKey, defaultOpen]);

  const toggle = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, String(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, [storageKey]);

  const isOpen = storageKey && !hydrated ? defaultOpen : open;

  return (
    <section
      className={cn(
        nested
          ? "rounded-lg border border-zinc-200 bg-zinc-50/50"
          : "rounded-xl border border-zinc-200 bg-white shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={cn(
          "flex w-full touch-manipulation items-start gap-3 text-left transition-colors",
          nested ? "px-3 py-2.5 sm:px-4 sm:py-3" : "px-4 py-3.5 sm:px-5 sm:py-4",
          "hover:bg-zinc-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2",
          nested && "rounded-lg",
          !nested && "rounded-t-xl",
        )}
      >
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform",
            !isOpen && "-rotate-90",
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block font-semibold text-zinc-900",
              nested ? "text-sm" : "text-base",
            )}
          >
            {title}
          </span>
          {description ? (
            <span className="mt-0.5 block text-xs text-zinc-500 sm:text-sm">{description}</span>
          ) : null}
        </span>
      </button>
      {isOpen ? (
        <div
          id={panelId}
          className={cn(
            "border-t border-zinc-200",
            nested ? "space-y-3 px-3 py-3 sm:px-4 sm:py-4" : "space-y-4 px-4 py-4 sm:px-5 sm:py-5",
          )}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
