// Admin page. Same layout as every other authenticated page (AppShell), with
// server-side authorization through the existing user_roles/has_role authority.
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminAiUsage } from "@/components/AdminAiUsage";
import { AdminAlerts } from "@/components/AdminAlerts";
import { AdminGoals } from "@/components/AdminGoals";
import { AdminRetention } from "@/components/AdminRetention";
import { AdminSpeakingWait } from "@/components/AdminSpeakingWait";
import { AdminCostPerformance } from "@/components/AdminCostPerformance";
import { AdminPushTest } from "@/components/AdminPushTest";
import { AdminLessonCompare } from "@/components/AdminLessonCompare";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAdminUser, listRegisteredUsers } from "@/lib/admin.functions";
import { captureSentryException } from "@/lib/sentry";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel - Evoluir+ English AI" },
      {
        name: "description",
        content: "Registered users, AI usage and cost performance.",
      },
      { property: "og:title", content: "Admin panel - Evoluir+ English AI" },
      { property: "og:description", content: "Registered users, AI usage and cost performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const navigate = useNavigate();
  const [sentrySent, setSentrySent] = useState(false);

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
    enabled: adminQuery.data?.isAdmin === true,
    retry: false,
  });

  // Not an admin: leave the page instead of showing anything.
  useEffect(() => {
    if (adminQuery.data && adminQuery.data.isAdmin !== true) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [adminQuery.data, navigate]);

  if (adminQuery.isPending || adminQuery.data?.isAdmin !== true) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("Loading")}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-xl font-bold lg:text-3xl">{t("Admin panel")}</h1>

      <div className="mt-3 sm:mt-6">
        <section className="card-soft p-3 sm:p-5">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                captureSentryException(new Error("Teste do Sentry pelo painel de admin"));
                setSentrySent(true);
              }}
            >
              {t("Send test error to Sentry")}
            </Button>
            {sentrySent ? (
              <span className="text-sm text-muted-foreground" role="status">
                {t("Test error sent")}
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
            {t("Registered users")}
            {usersQuery.data ? `: ${usersQuery.data.total}` : ""}
          </p>

          <AdminAlerts />

          <Tabs defaultValue="users" className="mt-2 min-w-0 sm:mt-4">
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:grid-cols-6">
              <TabsTrigger
                value="users"
                className="min-w-0 truncate px-2 py-1.5 text-xs sm:text-sm"
              >
                {t("Users")}
              </TabsTrigger>
              <TabsTrigger
                value="usage"
                className="min-w-0 truncate px-2 py-1.5 text-xs sm:text-sm"
              >
                {t("AI Usage")}
              </TabsTrigger>
              <TabsTrigger value="cost" className="min-w-0 truncate px-2 py-1.5 text-xs sm:text-sm">
                <span className="sm:hidden">{t("Cost")}</span>
                <span className="hidden sm:inline">{t("Cost & Performance")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="lesson-test"
                className="min-w-0 truncate px-2 py-1.5 text-xs sm:text-sm"
              >
                {t("Lesson test")}
              </TabsTrigger>
              <TabsTrigger value="push" className="min-w-0 truncate px-2 py-1.5 text-xs sm:text-sm">
                {t("Push")}
              </TabsTrigger>
              <TabsTrigger
                value="retention"
                className="min-w-0 truncate px-2 py-1.5 text-xs sm:text-sm"
              >
                {t("Retention")}
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
                        <th className="py-2 pr-3">{t("Email")}</th>
                        <th className="py-2 pr-3">{t("Plan")}</th>
                        <th className="py-2 pr-3">{t("Signed up")}</th>
                        <th className="py-2">{t("Member for")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersQuery.data?.users.map((user, index) => (
                        <tr key={`${user.email}-${index}`} className="border-b border-border/60">
                          <td className="py-2 pr-3 font-medium">{user.name}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{user.email}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${user.plan === "premium" ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"}`}
                            >
                              {user.plan === "premium" ? "Premium" : "Free"}
                            </span>
                            {user.campaign ? (
                              <span className="ml-1.5 text-[11px] text-muted-foreground">
                                {t("launch campaign")}
                              </span>
                            ) : null}
                            {user.premiumUntil ? (
                              <span className="block text-[11px] text-muted-foreground">
                                {t("until")}{" "}
                                {new Date(user.premiumUntil).toLocaleDateString("pt-BR")}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="py-2 whitespace-nowrap text-muted-foreground">
                            {memberFor(user.createdAt, lang)}
                          </td>
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
              <AdminSpeakingWait />
              <AdminCostPerformance />
            </TabsContent>
            <TabsContent value="lesson-test">
              <AdminLessonCompare />
            </TabsContent>
            <TabsContent value="push">
              <AdminPushTest />
            </TabsContent>
            <TabsContent value="retention">
              <AdminRetention />
              <AdminGoals />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </AppShell>
  );
}

/** "Today", "3 days", "2 months", "1 year" since signing up. */
function memberFor(createdAt: string, lang: string, now = new Date()) {
  const days = Math.max(
    0,
    Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000),
  );
  const pt = lang === "pt";
  if (days === 0) return pt ? "Hoje" : "Today";
  if (days < 30)
    return pt ? `${days} ${days === 1 ? "dia" : "dias"}` : `${days} ${days === 1 ? "day" : "days"}`;
  const months = Math.floor(days / 30);
  if (months < 12)
    return pt
      ? `${months} ${months === 1 ? "mês" : "meses"}`
      : `${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.floor(days / 365);
  return pt
    ? `${years} ${years === 1 ? "ano" : "anos"}`
    : `${years} ${years === 1 ? "year" : "years"}`;
}
