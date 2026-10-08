import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  BookOpen,
  CalendarCheck,
  Crown,
  GraduationCap,
  Headphones,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Mic,
  PenLine,
  Sparkles,
  SpellCheck,
  Target,
  Trophy,
  Video,
} from "lucide-react";
import { Fragment, useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { registerAppServiceWorker } from "@/lib/firebaseConfig";
import { stopSpeaking } from "@/lib/speech";
import { retryPendingPedagogicalWrites } from "@/lib/pedagogy/dualWrite.functions";
import { sendActivityPush } from "@/lib/push.functions";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { cn } from "@/lib/utils";
import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { useLessonRound } from "@/hooks/useLessonRound";
import { readStorage, writeStorage } from "@/lib/safeStorage";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { studyToday } from "@/lib/today";

// Mobile sheet menu: excludes the four items already in the bottom navigation bar.
// My Subscription sits with the settings rows at the bottom, as on desktop.
const mobileSheetNav = [
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/learning", label: "Learning", icon: GraduationCap },
  { to: "/listening", label: "Listening", icon: Headphones },
  { to: "/writing", label: "Writing", icon: PenLine },
  { to: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { to: "/mistakes", label: "My mistakes", icon: SpellCheck },
  { to: "/league", label: "Weekly league", icon: Trophy },
] as const;

// One list in study order, in small titled groups so 13 items read as 3
// steps: plan, practise, talk with EVO; the weekly league is the reward.
// My Progress opens from the Dashboard's Today's Progress card; My
// Subscription lives with the settings rows at the bottom.
// `group` is the title above a group's first item ("" draws a plain divider).
const dashboardSidebarNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/goals", label: "Goals", icon: Target, group: "Plan" },
  { to: "/study-plan", label: "Study Plan", icon: CalendarCheck },
  { to: "/learning", label: "Learning", icon: GraduationCap },
  { to: "/vocabulary", label: "Vocabulary", icon: BookOpen, group: "Practice" },
  { to: "/listening", label: "Listening", icon: Headphones },
  { to: "/writing", label: "Writing", icon: PenLine },
  { to: "/mistakes", label: "My mistakes", icon: SpellCheck },
  { to: "/coach", label: "AI Speaking", icon: MessageSquareText, group: "With EVO" },
  { to: "/call", label: "Video call", icon: Video },
  { to: "/teacher", label: "AI Teacher", icon: Sparkles },
  { to: "/league", label: "Weekly league", icon: Trophy, group: "" },
] as const;

// Translation and notification controls moved here from the dashboard reflection
// block: one home in the sidebar (desktop) and the sheet menu (mobile).
function UtilityButtons({ variant }: { variant: "sidebar" | "sheet" }) {
  const { lang, setLang } = useUiLang();
  const push = usePushNotifications();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const pushOn = push.state === "enabled";
  const pushLabel = pushOn ? t("Notifications on") : t("Notifications off");

  function toggleLang() {
    setLang(lang === "pt" ? "en" : "pt");
  }

  async function togglePush() {
    if (pushOn) {
      await push.disable();
      toast(t("Notifications off"));
      return;
    }
    const result = await push.enable();
    if (result === "enabled") {
      toast(t("Notifications on"));
    } else if (result === "disabled") {
      // Browser-level causes: iframe preview or denied permission.
      if (window.top !== window.self) {
        toast(t("Open the app in its own tab to enable notifications"));
      } else {
        toast(t("Notification permission was denied"));
      }
    } else if (result === "unsupported") {
      toast(t("Notifications are not supported on this device"));
    }
  }

  // Desktop sidebar and mobile sheet share the same full-width icon + text rows.
  if (variant === "sidebar") {
    return (
      <div className="flex flex-col items-stretch gap-0.5">
        <Button
          variant="ghost"
          aria-label={t("Change language")}
          className="h-11 min-w-0 justify-start gap-2 rounded-lg px-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={toggleLang}
        >
          <Languages className="size-5 shrink-0" />
          <span className="min-w-0 truncate text-left">
            {lang === "pt" ? "Português" : "English"}
          </span>
        </Button>
        <Button
          variant="ghost"
          aria-label={t("Notifications")}
          className="h-11 min-w-0 justify-start gap-2 rounded-lg px-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={() => void togglePush()}
        >
          {pushOn ? <Bell className="size-5 shrink-0" /> : <BellOff className="size-5 shrink-0" />}
          <span className="min-w-0 truncate text-left">{pushLabel}</span>
        </Button>
      </div>
    );
  }

  // Mobile sheet matches the desktop sidebar: full-width icon + text rows,
  // no borders.
  return (
    <div className="flex flex-col items-stretch gap-0.5">
      <Button
        variant="ghost"
        aria-label={t("Change language")}
        className="h-11 min-w-0 justify-start gap-2 rounded-lg px-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        onClick={toggleLang}
      >
        <Languages className="size-5 shrink-0" />
        <span className="min-w-0 truncate text-left">
          {lang === "pt" ? "Português" : "English"}
        </span>
      </Button>
      <Button
        variant="ghost"
        aria-label={t("Notifications")}
        className="h-11 min-w-0 justify-start gap-2 rounded-lg px-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        onClick={() => void togglePush()}
      >
        {pushOn ? <Bell className="size-5 shrink-0" /> : <BellOff className="size-5 shrink-0" />}
        <span className="min-w-0 truncate text-left">{pushLabel}</span>
      </Button>
    </div>
  );
}

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
  const pathname = useLocation().pathname;
  // The More button lights up when the current route belongs to one of its
  // own sections (the four bottom tabs stay responsible for themselves).
  const moreActive =
    pathname.startsWith("/premium") || mobileSheetNav.some((item) => pathname.startsWith(item.to));
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
              "h-full min-w-0 flex-col items-center justify-start gap-0.5 rounded-none px-0 pt-2.5 [&_svg]:size-6",
              moreActive ? "text-brand-green" : "text-muted-foreground",
              className,
            )}
          >
            <Menu strokeWidth={2.25} />
            <span className="pb-0.5 text-[10px] font-medium leading-none">{bottomLabel}</span>
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
          {mobileSheetNav.map((item) => {
            return (
              <div key={item.to}>
                <SheetClose asChild>
                  <Link
                    to={item.to}
                    className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    activeProps={{ className: "bg-sidebar-accent text-brand-green" }}
                    inactiveProps={{ className: "text-sidebar-foreground/75" }}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="truncate">{translate(item.label)}</span>
                  </Link>
                </SheetClose>
              </div>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-sidebar-border pt-3">
          <UtilityButtons variant="sheet" />
          <SheetClose asChild>
            <Link
              to="/premium"
              className="flex h-11 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              activeProps={{ className: "text-brand-green" }}
              inactiveProps={{ className: "text-sidebar-foreground/70" }}
            >
              <Crown className="size-5 shrink-0" />
              <span className="min-w-0 truncate text-left">{translate("My Subscription")}</span>
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant="ghost"
              className="h-11 w-full justify-start gap-2 rounded-lg px-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={signOut}
            >
              <LogOut className="size-5" />
              {translate("Sign out")}
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <ProfileMenu presentation="mobile-menu" />
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
  const activityIndicators = useActivityIndicators();
  const translate = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);

  // Stop any playing audio (flashcards, listening, vocabulary, AI voice) on page change.
  useEffect(() => {
    stopSpeaking();
  }, [location.pathname]);

  // Offline support: the service worker keeps the app and saved words available
  // without a connection. Installed after the first screen, never blocking it.
  useEffect(() => {
    const timer = window.setTimeout(registerAppServiceWorker, 3000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const retryKey = "pedagogical-retry-checked";
    if (window.sessionStorage.getItem(retryKey)) return;
    window.sessionStorage.setItem(retryKey, "1");
    void retryPendingPedagogicalWrites({ data: { limit: 3 } }).catch(() => undefined);
  }, []);

  // Push warning for new activities: at most once per day, only when the
  // device is registered and something new (lesson, writing or vocabulary)
  // is waiting for the student.
  const hasNewActivity =
    activityIndicators.listening || activityIndicators.writing || activityIndicators.vocabulary;
  useEffect(() => {
    if (!hasNewActivity) return;
    const today = studyToday();
    try {
      if (localStorage.getItem("push-token") === null) return;
      if (localStorage.getItem("push-activity-notified") === today) return;
      localStorage.setItem("push-activity-notified", today);
    } catch {
      return; // storage unavailable (private mode): skip the reminder
    }
    void sendActivityPush({
      data: {
        title: translate("New activities available"),
        body: translate("Small consistent actions create meaningful progress."),
        path: "/dashboard",
      },
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNewActivity]);

  // A finished lesson's vocabulary batch gets its own push, once per lesson
  // round: the daily push above is usually spent earlier by the day's new
  // Writing and Listening tasks, so new words were never announced.
  const { data: lessonRound } = useLessonRound();
  useEffect(() => {
    if (!activityIndicators.vocabulary || lessonRound === undefined) return;
    const round = String(lessonRound);
    if (readStorage("push-token") === null) return;
    if (readStorage("push-vocabulary-notified") === round) return;
    writeStorage("push-vocabulary-notified", round);
    void sendActivityPush({
      data: {
        title: translate("New vocabulary words"),
        body: translate("New words from your last lesson are ready to practise."),
        path: "/vocabulary",
      },
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityIndicators.vocabulary, lessonRound]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const dashboardMobileNav = [
    { to: "/dashboard", label: lang === "pt" ? "Início" : "Home", icon: LayoutDashboard },
    { to: "/teacher", label: "AI Teacher", icon: Sparkles },
    // My Progress opens from the Today's Progress card, as on desktop.
    { to: "/coach", label: "AI Speaking", icon: Mic },
    { to: "/call", label: lang === "pt" ? "Videochamada" : "Video call", icon: Video },
  ] as const;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "dashboard-shell dark flex min-h-screen flex-col bg-background",
          dashboardLayout
            ? "h-dvh overflow-hidden lg:h-auto lg:overflow-visible lg:pb-0"
            : "pb-[calc(4.275rem+_env(safe-area-inset-bottom))] lg:pb-0",
          "lg:pl-[13.2rem]",
        )}
      >
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[13.2rem] flex-col items-stretch overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 pt-3 pb-4 text-sidebar-foreground lg:flex">
          <Link
            to="/dashboard"
            aria-label={translate("Dashboard")}
            className="flex h-14 min-w-0 items-center gap-2 rounded-lg px-1 hover:bg-sidebar-accent"
          >
            <Logo className="size-[3.45rem] shrink-0" />
            <span className="min-w-0 whitespace-nowrap leading-none">
              <span className="block font-display text-lg font-semibold">
                Evoluir<span className="text-brand-green">+</span>
              </span>
              <span className="mt-1 block text-xs font-semibold uppercase text-sidebar-foreground/70">
                English AI
              </span>
            </span>
          </Link>

          <nav className="mt-3 flex flex-1 flex-col gap-0.5">
            {dashboardSidebarNav.map((item) => (
              <Fragment key={item.to}>
                {"group" in item ? (
                  item.group ? (
                    <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                      {translate(item.group)}
                    </p>
                  ) : (
                    <span className="mx-2 my-2 border-t border-sidebar-border" aria-hidden="true" />
                  )
                ) : null}
                <Link
                  to={item.to}
                  aria-label={translate(item.label)}
                  className="grid h-10 grid-cols-[2.4rem_minmax(0,1fr)] items-center rounded-lg px-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  // Just a soft background and green text: no border or side bar.
                  activeProps={{ className: "bg-sidebar-accent text-brand-green" }}
                  inactiveProps={{ className: "text-sidebar-foreground/70" }}
                >
                  <item.icon className="size-5" />
                  <span className="truncate text-left">{translate(item.label)}</span>
                </Link>
              </Fragment>
            ))}
          </nav>

          <div className="flex flex-col items-stretch gap-1">
            <div className="flex flex-col items-stretch gap-0.5 border-t border-sidebar-border pb-1 pt-2">
              <UtilityButtons variant="sidebar" />
              <Link
                to="/premium"
                className="flex h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                activeProps={{ className: "text-brand-green" }}
                inactiveProps={{ className: "text-sidebar-foreground/70" }}
              >
                <Crown className="size-5 shrink-0" />
                <span className="min-w-0 truncate text-left">{translate("My Subscription")}</span>
              </Link>
              <Button
                variant="ghost"
                aria-label={translate("Sign out")}
                className="h-11 min-w-0 justify-start gap-2 rounded-lg px-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={signOut}
              >
                <LogOut className="size-5 shrink-0" />
                <span className="min-w-0 truncate text-left">{translate("Sign out")}</span>
              </Button>
            </div>
            <ProfileMenu
              presentation="dashboard-sidebar"
              className="hover:bg-sidebar-accent hover:text-sidebar-foreground"
            />
          </div>
        </aside>

        <main
          className={cn(
            "w-full max-w-none px-4 py-6 sm:px-6 lg:px-8 lg:py-6 xl:px-10",
            !dashboardLayout && "flex-1",
            dashboardLayout &&
              "h-[calc(100dvh-4.275rem)] overflow-hidden py-3 pb-[10px] lg:h-auto lg:overflow-visible lg:py-6 lg:pb-6 xl:px-5 xl:py-2",
          )}
        >
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid h-[4.275rem] grid-cols-5 border-t border-sidebar-border bg-sidebar/98 px-0.5 pb-[calc(env(safe-area-inset-bottom)_+_2px)] text-sidebar-foreground shadow-[0_-10px_28px_oklch(0.04_0.02_240/0.42)] backdrop-blur lg:hidden"
          aria-label={lang === "pt" ? "Navegação principal" : "Main navigation"}
        >
          {dashboardMobileNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-w-0 flex-col items-center pt-2.5 transition-colors"
              activeProps={{ className: "text-brand-green" }}
              inactiveProps={{ className: "text-muted-foreground" }}
            >
              <span className="grid justify-items-center gap-0.5">
                <item.icon className="size-6" />
                {/* Two short lines instead of a cut label on 360 px phones
                    ("Professor de IA", "Videochamada"). */}
                <span className="line-clamp-2 max-w-full pb-0.5 text-center text-[10px] font-medium leading-[1.1] tracking-tight">
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
            minimal
            lang={lang}
            containerClassName="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10"
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
