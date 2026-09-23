// Gear button + admin dialog. The gear only renders when the server confirms the
// signed-in user is the authorized admin; the user list itself is also protected
// server-side, so a normal user calling the operation directly gets nothing.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Settings } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { isAdminUser, listRegisteredUsers } from "@/lib/admin.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export function AdminPanelButton({ className }: { className?: string }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const [open, setOpen] = useState(false);

  const checkAdmin = useServerFn(isAdminUser);
  const fetchUsers = useServerFn(listRegisteredUsers);

  const adminQuery = useQuery({
    queryKey: ["admin-access"],
    queryFn: () => checkAdmin(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    enabled: open && adminQuery.data?.isAdmin === true,
    retry: false,
  });

  if (adminQuery.data?.isAdmin !== true) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("Admin panel")}
          className={className}
        >
          <Settings className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Admin panel")}</DialogTitle>
          <DialogDescription>
            {t("Registered users")}
            {usersQuery.data ? `: ${usersQuery.data.total}` : ""}
          </DialogDescription>
        </DialogHeader>

        {usersQuery.isPending ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("Loading")}
          </div>
        ) : usersQuery.isError ? (
          <p className="py-6 text-sm text-muted-foreground">
            {t("Could not load the users right now.")}
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-2 pr-3">{t("Name")}</th>
                  <th className="py-2">{t("Email")}</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data?.users.map((user, index) => (
                  <tr key={`${user.email}-${index}`} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{user.name}</td>
                    <td className="py-2 text-muted-foreground">{user.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
