import { Link } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";

import { useShortsShortcut } from "@/hooks/useShortsShortcut";

/**
 * Shorts shortcut in the phone Dashboard's header capsule, right after the
 * jewel (owner request, 2026-10-31: shorts appeal most on the phone). Shown
 * only while the student's level has shorts; a green dot marks shorts this
 * device has not seen. It opens /shorts playing (Premium), or the Shorts grid
 * with the locks and the Premium invitation (free).
 */
export function ShortsHeaderButton({
  userId,
  level,
  translate: t,
}: {
  userId: string | undefined;
  level: string | null | undefined;
  translate: (label: string) => string;
}) {
  const { count, hasNew } = useShortsShortcut(userId, level);
  if (count === 0) return null;
  const label = hasNew ? `${t("Shorts")} · ${t("Just added")}` : t("Shorts");
  return (
    <Link
      to="/shorts"
      search={{ play: 1 }}
      aria-label={label}
      title={label}
      className="relative grid h-8 w-7 shrink-0 place-items-center rounded-full text-slate-100 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Clapperboard
        className="size-[1.15rem] text-amber-300"
        strokeWidth={2.2}
        aria-hidden="true"
      />
      {hasNew ? (
        <span
          className="absolute right-0.5 top-1 size-2 rounded-full bg-brand-green ring-2 ring-background"
          aria-hidden="true"
        />
      ) : null}
    </Link>
  );
}
