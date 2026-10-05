import { Link } from "@tanstack/react-router";
import { Bell, BookOpen, Check, Headphones, PenLine } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { readStorage, writeStorage } from "@/lib/safeStorage";

type DashboardNotificationsProps = {
  indicators: ReturnType<typeof useActivityIndicators>;
  translate: (label: string) => string;
  placement: "mobile" | "desktop";
};

/** Manual "read" marks last for the current São Paulo day only, so tomorrow's activity shows again. */
function readKey() {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return `notifications-read:${day}`;
}

function loadRead(): string[] {
  try {
    const parsed = JSON.parse(readStorage(readKey()) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Bell with the list of new activities (Listening, Writing, Vocabulary). */
export function DashboardNotifications({
  indicators,
  translate,
  placement,
}: DashboardNotificationsProps) {
  const [read, setRead] = useState<string[]>([]);
  useEffect(() => {
    setRead(loadRead());
    const sync = () => setRead(loadRead());
    window.addEventListener("notifications-read", sync);
    return () => window.removeEventListener("notifications-read", sync);
  }, []);

  const markRead = (ids: string[]) => {
    const next = Array.from(new Set([...loadRead(), ...ids]));
    writeStorage(readKey(), JSON.stringify(next));
    setRead(next);
    window.dispatchEvent(new Event("notifications-read"));
  };

  const items = [
    { to: "/listening", label: "New listening activity", icon: Headphones, visible: indicators.listening },
    { to: "/writing", label: "New writing activity", icon: PenLine, visible: indicators.writing },
    { to: "/vocabulary", label: "New vocabulary activity", icon: BookOpen, visible: indicators.vocabulary },
  ] as const;
  const activeItems = items.filter((item) => item.visible && !read.includes(item.to));
  const hasNotifications = activeItems.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={translate("Open notifications")}
          className={
            placement === "mobile"
              ? "relative size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              : "relative size-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          }
        >
          <Bell className={placement === "mobile" ? "size-[1.15rem]" : "size-4"} />
          {hasNotifications && (
            <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-brand-green ring-2 ring-background">
              <span className="sr-only">{translate("New activities available")}</span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={placement === "mobile" ? "end" : "start"}
        sideOffset={8}
        className="dashboard-shell dark w-[min(20rem,calc(100vw-1.5rem))] border-notification-border bg-popover/80 p-2 text-popover-foreground backdrop-blur-md backdrop-saturate-150"
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <p className="font-display text-sm font-semibold">{translate("Notifications")}</p>
          {activeItems.length > 1 && (
            <button
              type="button"
              onClick={() => markRead(activeItems.map((i) => i.to))}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {translate("Mark all as read")}
            </button>
          )}
        </div>
        {hasNotifications ? (
          <div className="grid gap-1">
            {activeItems.map((item) => (
              <div
                key={item.to}
                className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-center rounded-md transition-colors hover:bg-accent"
              >
                <Link
                  to={item.to}
                  className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 px-2 text-sm font-medium text-foreground"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-brand-green/15 text-brand-green">
                    <item.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span>{translate(item.label)}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => markRead([item.to])}
                  aria-label={translate("Mark as read")}
                  title={translate("Mark as read")}
                  className="grid size-9 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <Check className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {translate("No new activities right now")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
