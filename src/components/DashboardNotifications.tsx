import { Link } from "@tanstack/react-router";
import { Bell, BookOpen, Headphones, PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useActivityIndicators } from "@/hooks/useActivityIndicators";

type DashboardNotificationsProps = {
  indicators: ReturnType<typeof useActivityIndicators>;
  translate: (label: string) => string;
  placement: "mobile" | "desktop";
};

/** Bell with the list of new activities (Listening, Writing, Vocabulary). */
export function DashboardNotifications({
  indicators,
  translate,
  placement,
}: DashboardNotificationsProps) {
  const items = [
    {
      to: "/listening",
      label: "New listening activity",
      icon: Headphones,
      visible: indicators.listening,
    },
    {
      to: "/writing",
      label: "New writing activity",
      icon: PenLine,
      visible: indicators.writing,
    },
    {
      to: "/vocabulary",
      label: "New vocabulary activity",
      icon: BookOpen,
      visible: indicators.vocabulary,
    },
  ] as const;
  const activeItems = items.filter((item) => item.visible);
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
        <p className="px-2 py-1.5 font-display text-sm font-semibold">
          {translate("Notifications")}
        </p>
        {hasNotifications ? (
          <div className="grid gap-1">
            {activeItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <span className="grid size-8 place-items-center rounded-full bg-brand-green/15 text-brand-green">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <span>{translate(item.label)}</span>
              </Link>
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
