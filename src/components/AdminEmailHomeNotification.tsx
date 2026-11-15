import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { UserRound, Wrench } from "lucide-react";

import { isAdminUser } from "@/lib/admin.functions";
import { getAdminEmailUnreadCount } from "@/lib/admin-email.functions";

/** Admin-only shortcuts to the separate contact and support inbox tabs. */
export function AdminEmailHomeNotification() {
  const checkAdmin = useServerFn(isAdminUser);
  const loadUnreadCount = useServerFn(getAdminEmailUnreadCount);

  const admin = useQuery({
    queryKey: ["admin-access"],
    queryFn: () => checkAdmin(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const contact = useQuery({
    queryKey: ["admin-email-unread-count", "contact"],
    queryFn: () => loadUnreadCount({ data: { mailbox: "contact" } }),
    enabled: admin.data?.isAdmin === true,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const support = useQuery({
    queryKey: ["admin-email-unread-count", "support"],
    queryFn: () => loadUnreadCount({ data: { mailbox: "support" } }),
    enabled: admin.data?.isAdmin === true,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  if (admin.data?.isAdmin !== true) return null;

  const shortcuts = [
    {
      mailbox: "contact",
      label: "Contato",
      hash: "#contact",
      Icon: UserRound,
      count: contact.data?.unread ?? 0,
    },
    {
      mailbox: "support",
      label: "Suporte",
      hash: "#support",
      Icon: Wrench,
      count: support.data?.unread ?? 0,
    },
  ] as const;

  return (
    <div className="flex items-center gap-1.5">
      {shortcuts.map(({ mailbox, label, hash, Icon, count }) => (
        <Link
          key={mailbox}
          to="/admin"
          search={{ folder: "communication", tab: "inbox" }}
          hash={hash}
          aria-label={
            count > 0
              ? `${label}: ${count} mensagens não lidas`
              : `Abrir caixa de ${label.toLowerCase()}`
          }
          title={
            count > 0 ? `${label}: ${count} mensagens não lidas` : `Caixa de ${label.toLowerCase()}`
          }
          className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-muted-foreground transition-colors hover:bg-white/15 hover:text-foreground"
        >
          <Icon className="size-4" aria-hidden="true" />
          {count > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
