import { Sparkles } from "lucide-react";

import { showAppNotification } from "@/components/ui/AppNotificationToast";

type LifeNotificationVariant = "success" | "error" | "info";

/** Life+ AI notifications reuse the same visual HUD as Vocabulary. */
export function notifyLife(message: string, variant: LifeNotificationVariant = "info") {
  showAppNotification({
    title: "Life+ AI",
    description: message,
    variant,
    icon: <Sparkles className="size-[18px]" strokeWidth={2.25} aria-hidden="true" />,
    duration: variant === "error" ? 6500 : 5000,
  });
}
