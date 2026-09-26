import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  Crown,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  LineChart,
  LogOut,
  MessageSquareText,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "@/components/Logo";
import { BrandName } from "@/components/BrandName";
import { Footer } from "@/components/Footer";
import { ProfileMenu } from "@/components/ProfileMenu";
import { supabase } from "@/integrations/supabase/client";
import { stopSpeaking } from "@/lib/speech";
import { retryPendingPedagogicalWrites } from "@/lib/pedagogy/dualWrite.functions";
import { UiLangToggle, useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/study-plan", label: "Study Plan", icon: CalendarCheck },
  { to: "/learning", label: "Learning", icon: GraduationCap },
  { to: "/listening", label: "Listening", icon: Headphones },
  { to: "/coach", label: "AI Talking", icon: MessageSquareText },
  { to: "/teacher", label: "AI Teacher", icon: Sparkles },
  { to: "/writing", label: "Writing", icon: PenLine },
  { to: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { to: "/progress", label: "Progress", icon: LineChart },
] as const;

const sidebarNav = [...nav, { to: "/premium", label: "Premium", icon: Crown }] as const;

const dashboardSidebarNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/study-plan", label: "Study Plan", icon: CalendarCheck },
  { to: "/learning", label: "Lessons", icon: GraduationCap },
  { to: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { to: "/listening", label: "Listening", icon: Headphones },
  { to: "/coach", label: "Speaking", icon: MessageSquareText },
  { to: "/writing", label: "Writing", icon: PenLine },
  { to: "/teacher", label: "AI Teacher", icon: Sparkles },
] as const;

const dashboardAccountNav = [
  { to: "/progress", label: "My Progress", icon: LineChart },
  { to: "/premium", label: "My Subscription", icon: Crown },
] as const;

export function AppShell({
  children,
  dashboardLayout = false,
  mobileOneScreen = false,
}: {
  children: ReactNode;
  dashboardLayout?: boolean;
  /** Opt-in: drops the page footer on mobile so the screen fits one viewport. */
  mobileOneScreen?: boolean;
}) {
  return (
    <AppShellContent dashboardLayout={dashboardLayout} mobileOneScreen={mobileOneScreen}>
      {children}
    </AppShellContent>
  );
}

function AppShellContent({
  children,
  dashboardLayout,
  mobileOneScreen,
}: {
  children: ReactNode;
  dashboardLayout: boolean;
  mobileOneScreen: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { lang } = useUiLang();
  const showBackButton = location.pathname !== "/dashboard";
  const translate = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);

  // Stop any playing audio (flashcards, listening, vocabulary, AI voice) on page change.
  useEffect(() => {
    stopSpeaking();
  }, [location.pathname]);

  useEffect(() => {
    const retryKey = "pedagogical-retry-checked";
    if (window.sessionStorage.getItem(retryKey)) return;
    window.sessionStorage.setItem(retryKey, "1");
    void retryPendingPedagogicalWrites({ data: { limit: 3 } }).catch(() => undefined);
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "dashboard-shell dark min-h-screen bg-background pb-[calc(8rem+env(safe-area-inset-bottom))] sm:pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0",
          dashboardLayout ? "lg:pl-[13.2rem]" : "lg:pl-20",
        )}
      >
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar py-5 text-sidebar-foreground lg:flex",
            dashboardLayout ? "w-[13.2rem] items-stretch px-3 pt-3 pb-4" : "w-20 items-center",
          )}
        >
          <Link
            to="/dashboard"
            aria-label={translate("Dashboard")}
            className={cn(
              "rounded-lg hover:bg-sidebar-accent",
              dashboardLayout
                ? "flex h-14 min-w-0 items-center gap-2 px-1"
                : "grid size-11 place-items-center",
            )}
          >
            <Logo className={dashboardLayout ? "size-11 shrink-0" : "size-11"} />
            {dashboardLayout && (
              <span className="min-w-0 whitespace-nowrap leading-none">
                <span className="block font-display text-lg font-semibold">
                  Evoluir<span className="text-brand-green">+</span>
                </span>
                <span className="mt-1 block text-xs font-semibold uppercase text-sidebar-foreground/70">
                  English AI
                </span>
              </span>
            )}
          </Link>

          <nav className={cn("flex flex-1 flex-col gap-1", dashboardLayout ? "mt-4" : "mt-8")}>
            {(dashboardLayout ? dashboardSidebarNav : sidebarNav).map((item) => (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.to}
                    aria-label={translate(item.label)}
                    className={cn(
                      "rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      dashboardLayout
                        ? "grid h-12 grid-cols-[2.4rem_minmax(0,1fr)] items-center px-2 text-sm font-medium"
                        : "grid size-10 place-items-center",
                    )}
                    activeProps={{
                      className:
                        "border border-brand-green/35 bg-sidebar-accent text-brand-green shadow-[inset_3px_0_0_var(--brand-green)]",
                    }}
                  >
                    <item.icon className={dashboardLayout ? "size-6" : "size-5"} />
                    {dashboardLayout && (
                      <span className="truncate text-left">{translate(item.label)}</span>
                    )}
                  </Link>
                </TooltipTrigger>
                {!dashboardLayout && (
                  <TooltipContent side="right" sideOffset={8}>
                    {translate(item.label)}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
            {dashboardLayout && (
              <>
                <div className="my-2 border-t border-sidebar-border" />
                {dashboardAccountNav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-label={translate(item.label)}
                    className="grid h-12 grid-cols-[2.4rem_minmax(0,1fr)] items-center rounded-lg px-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    activeProps={{
                      className:
                        "border border-brand-green/35 bg-sidebar-accent text-brand-green shadow-[inset_3px_0_0_var(--brand-green)]",
                    }}
                  >
                    <item.icon className="size-6" />
                    <span className="truncate text-left">{translate(item.label)}</span>
                  </Link>
                ))}
              </>
            )}
          </nav>

          <div
            className={cn(
              "flex gap-1",
              dashboardLayout ? "flex-col items-stretch" : "flex-col items-center",
            )}
          >
            {dashboardLayout && (
              <div className="flex items-center gap-1 px-1 pb-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={translate("Sign out")}
                      className="size-9 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      onClick={signOut}
                    >
                      <LogOut className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    {translate("Sign out")}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            {!dashboardLayout && (
              <UiLangToggle className="border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
            )}
            {!dashboardLayout && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={translate("Sign out")}
                    className="size-10 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    onClick={signOut}
                  >
                    <LogOut className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {translate("Sign out")}
                </TooltipContent>
              </Tooltip>
            )}
            <ProfileMenu
              presentation={dashboardLayout ? "dashboard-sidebar" : "icon"}
              className="hover:bg-sidebar-accent hover:text-sidebar-foreground"
            />
          </div>
        </aside>

        <header className="sticky top-0 z-20 grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4 lg:hidden">
          <Link to="/dashboard" className="flex min-h-11 min-w-0 items-center gap-2">
            <Logo className="size-[1.3rem] shrink-0" />
            <BrandName className="truncate text-sm" />
          </Link>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <UiLangToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label={translate("Sign out")}
            >
              <LogOut className="size-4" />
            </Button>
            <ProfileMenu className="hover:bg-accent hover:text-foreground" />
          </div>
        </header>

        <main
          className={cn(
            "w-full max-w-none px-4 py-6 sm:px-6 lg:px-8 lg:py-6 xl:px-10",
            dashboardLayout && "xl:px-5 xl:py-2",
          )}
        >
          {showBackButton && (
            <Link
              to="/dashboard"
              className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-accent"
            >
              <ArrowLeft className="size-4" />
              {translate("Back to Dashboard")}
            </Link>
          )}
          {children}
        </main>

        <div className={cn("mb-0", dashboardLayout && "hidden")}>
          <Footer
            lang={lang}
            containerClassName="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10"
          />
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 place-items-center border-t border-border bg-background/95 px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur sm:grid-cols-10 lg:hidden">
          {sidebarNav.map((item) => (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>
                <Link
                  to={item.to}
                  aria-label={translate(item.label)}
                  className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:size-10"
                  activeProps={{ className: "bg-accent text-foreground" }}
                >
                  <item.icon className="size-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {translate(item.label)}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>

      </div>
    </TooltipProvider>
  );
}
