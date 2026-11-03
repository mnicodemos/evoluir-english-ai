import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type AppNotificationVariant = "success" | "error" | "info";

type NotificationAction = {
  label: string;
  onClick: () => void;
};

type AppNotificationOptions = {
  id?: string;
  title: string;
  description?: string;
  variant?: AppNotificationVariant;
  icon?: ReactNode;
  duration?: number;
  action?: NotificationAction;
  cancel?: NotificationAction;
};

const STYLE = {
  success: {
    accent: "text-brand-green",
    badge: "bg-brand-green/15 text-brand-green ring-brand-green/35",
    line: "via-brand-green/70",
    glow: "bg-brand-green/20",
    Icon: CheckCircle2,
  },
  error: {
    accent: "text-rose-400",
    badge: "bg-rose-400/12 text-rose-300 ring-rose-400/35",
    line: "via-rose-400/70",
    glow: "bg-rose-400/15",
    Icon: AlertCircle,
  },
  info: {
    accent: "text-slate-200",
    badge: "bg-white/10 text-slate-200 ring-white/20",
    line: "via-white/50",
    glow: "bg-white/10",
    Icon: Info,
  },
} as const;

/** Shared notification HUD, matching the Vocabulary pronunciation notification. */
function AppNotificationToast({
  toastId,
  title,
  description,
  variant = "info",
  icon,
  action,
  cancel,
}: AppNotificationOptions & { toastId: string | number }) {
  const style = STYLE[variant];
  const Icon = style.Icon;

  return (
    <div
      role="status"
      className="pronunciation-hud relative w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-2xl p-3.5 text-slate-100"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          style.line,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -left-8 -top-8 size-24 rounded-full blur-2xl",
          style.glow,
        )}
      />
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10",
            style.accent,
          )}
        >
          {icon ?? <Icon className="size-[18px]" strokeWidth={2.25} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold leading-tight">{title}</p>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{description}</p>
          ) : null}
          {action || cancel ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.dismiss(toastId);
                    action.onClick();
                  }}
                  className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:brightness-110"
                >
                  {action.label}
                </button>
              ) : null}
              {cancel ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.dismiss(toastId);
                    cancel.onClick();
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {cancel.label}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(toastId)}
          aria-label="Close notification"
          className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function showAppNotification(options: AppNotificationOptions) {
  const { id, duration = 5000 } = options;
  return toast.custom((toastId) => <AppNotificationToast {...options} toastId={toastId} />, {
    ...(id !== undefined ? { id } : {}),
    duration,
  });
}
