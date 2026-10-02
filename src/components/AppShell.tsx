import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarCheck,
  Crown,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  MessageSquareText,
  Mic,
  MoreHorizontal,
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  { to: "/coach", label: "AI Speaking", icon: MessageSquareText },
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
  { to: "/coach", label: "AI Speaking", icon: MessageSquareText },
  { to: "/writing", label: "Writing", icon: PenLine },
  { to: "/teacher", label: "AI Teacher", icon: Sparkles },
] as const;

const dashboardAccountNav = [
  { to: "/progress", label: "My Progress", icon: LineChart },
  { to: "/premium", label: "My Subscription", icon: Crown },
] as const;

type MobileNavigationMenuProps = {
  translate: (label: string) => string;
  className?: string;
  presentation?: "menu" | "bottom-tab";
  bottomLabel?: string;
};

export function MobileNavigationMenu({
  translate,
  className,
  presentation = "menu",
  bottomLabel = "More",
}: MobileNavigationMenuProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        {presentation === "bottom-tab" ? (
          <Button
            variant="ghost"
            aria-label={translate("Open menu")}
            className={cn(
              "h-14 min-w-0 flex-col gap-0.5 rounded-none px-1 text-muted-foreground",
              className,
            )}
          >
            <MoreHorizontal className="size-6" />
            <span className="text-[10px] font-medium leading-none">{bottomLabel}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label={translate("Open menu")}
            className={cn("size-10 shrink-0", className)}
          >
            <Menu className="size-5" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side="left"
        className="dashboard-shell dark flex w-[min(19rem,86vw)] flex-col border-sidebar-border bg-sidebar p-4 text-sidebar-foreground"
      >
        <SheetHeader className="border-b border-sidebar-border pb-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
            <Logo className="size-[2.8rem] shrink-0" />
            <BrandName className="text-base" />
          </SheetTitle>
        </SheetHeader>
        <nav className="grid gap-1 overflow-y-auto py-3">
          {sidebarNav.map((item) => (
            <SheetClose asChild key={item.to}>
              <Link
                to={item.to}
                className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                activeProps={{ className: "bg-sidebar-accent text-brand-green" }}
              >
                <item.icon className="size-5 shrink-0" />
                <span className="truncate">{translate(item.label)}</span>
              </Link>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-auto border-t border-sidebar-border pt-3">
          <SheetClose asChild>
            <ProfileMenu presentation="mobile-menu" />
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant="ghost"
              className="mt-1 w-full justify-start gap-2 text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={signOut}
            >
              <LogOut className="size-5" />
              {translate("Sign out")}
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

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

  const dashboardMobileNav = [
    { to: "/dashboard", label: lang === "pt" ? "Início" : "Home", icon: LayoutDashboard },
    { to: "/teacher", label: "AI Teacher", icon: Sparkles },
    { to: "/progress", label: lang === "pt" ? "Progresso" : "Progress", icon: LineChart },
    { to: "/coach", label: "AI Speaking", icon: Mic },
  ] as const;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "dashboard-shell dark min-h-screen bg-background",
          dashboardLayout
            ? "h-dvh overflow-hidden lg:h-auto lg:overflow-visible lg:pb-0"
            : "pb-[calc(4.275rem+_env(safe-area-inset-bottom))] lg:pb-0",
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
            <Logo className={dashboardLayout ? "size-[3.45rem] shrink-0" : "size-[3.45rem]"} />
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

        <main
          className={cn(
            "w-full max-w-none px-4 py-6 sm:px-6 lg:px-8 lg:py-6 xl:px-10",
            dashboardLayout &&
              "h-[calc(100dvh-4.275rem)] overflow-hidden py-3 pb-[10px] lg:h-auto lg:overflow-visible lg:py-6 lg:pb-6 xl:px-5 xl:py-2",
          )}
        >
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid h-[4.275rem] grid-cols-5 border-t border-sidebar-border bg-sidebar/98 px-1 pb-[env(safe-area-inset-bottom)] text-sidebar-foreground shadow-[0_-10px_28px_oklch(0.04_0.02_240/0.42)] backdrop-blur lg:hidden"
          aria-label={lang === "pt" ? "Navegação principal" : "Main navigation"}
        >
          {dashboardMobileNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="grid min-w-0 place-items-center text-muted-foreground"
              activeProps={{ className: "text-brand-green" }}
            >
              <span className="grid justify-items-center gap-0.5">
                <item.icon className="size-6" />
                <span className="max-w-full truncate text-[10px] font-medium leading-none">
                  {item.label}
                </span>
              </span>
            </Link>
          ))}
          <MobileNavigationMenu
            translate={translate}
            presentation="bottom-tab"
            bottomLabel={lang === "pt" ? "Mais" : "More"}
            className="w-full hover:bg-transparent hover:text-brand-green"
          />
        </nav>

        <div
          className={cn(
            "mb-0",
            dashboardLayout && "hidden lg:block",
            mobileOneScreen && "hidden sm:block",
          )}
        >
          <Footer
            lang={lang}
            containerClassName="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10"
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
