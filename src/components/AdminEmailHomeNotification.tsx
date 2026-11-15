import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";

import { isAdminUser } from "@/lib/admin.functions";
import { getAdminEmailUnreadCount } from "@/lib/admin-email.functions";
import { Button } from "@/components/ui/button";

/** Admin-only email inbox shortcut for the desktop dashboard header. */
export function AdminEmailHomeNotification() {
  const checkAdmin = useServerFn(isAdminUser);
  const loadUnreadCount = useServerFn(getAdminEmailUnreadCount);

  const admin = useQuery({
    queryKey: ["admin-access"],
    queryFn: () => checkAdmin(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const unread = useQuery({
    queryKey: ["admin-email-unread-count"],
    queryFn: () => loadUnreadCount(),
    enabled: admin.data?.isAdmin === true,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  if (admin.data?.isAdmin !== true) return null;

  const count = unread.data?.unread ?? 0;

  return (
    <a
      href="/admin?folder=communication&tab=inbox"
      aria-label={count > 0 ? `Caixa de e-mail: ${count} mensagens não lidas` : "Abrir caixa de e-mail"}
      title={count > 0 ? `${count} mensagens não lidas` : "Caixa de e-mail"}
      className="relative inline-flex"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tabIndex={-1}
        aria-hidden="true"
        className="relative size-9 rounded-full bg-white/10 text-muted-foreground hover:bg-white/15 hover:text-foreground"
      >
        <Mail className="size-4" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Button>
    </a>
  );
}
