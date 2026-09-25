// Gear button + admin dialog. The gear only renders when the server confirms the
// signed-in user is the authorized admin; the user list itself is also protected
// server-side, so a normal user calling the operation directly gets nothing.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Settings } from "lucide-react";
import { useState } from "react";

import { AdminAiUsage } from "@/components/AdminAiUsage";
import { AdminCostPerformance } from "@/components/AdminCostPerformance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAdminUser, listRegisteredUsers } from "@/lib/admin.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export function AdminPanelButton({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
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
          size={showLabel ? "sm" : "icon"}
          aria-label={t("Admin panel")}
          className={className}
        >
          <Settings className="size-5" />
          {showLabel && <span>{t("Admin panel")}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-[min(96vw,90rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Admin panel")}</DialogTitle>
          <DialogDescription>
            {t("Registered users")}
            {usersQuery.data ? `: ${usersQuery.data.total}` : ""}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="users" className="min-w-0">
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="users" className="min-w-0 px-2 text-xs sm:text-sm">
              {t("Users")}
            </TabsTrigger>
            <TabsTrigger value="usage" className="min-w-0 px-2 text-xs sm:text-sm">
              {t("AI Usage")}
            </TabsTrigger>
            <TabsTrigger value="cost" className="min-w-0 px-2 text-xs sm:text-sm">
              {t("Cost & Performance")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
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
          </TabsContent>
          <TabsContent value="usage">
            <AdminAiUsage />
          </TabsContent>
          <TabsContent value="cost">
            <AdminCostPerformance />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
