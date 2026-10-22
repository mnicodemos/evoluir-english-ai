import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  BookMarked,
  BookOpen,
  BookOpenText,
  Briefcase,
  CalendarCheck,
  Crown,
  GraduationCap,
  Headphones,
  House,
  Languages,
  LogOut,
  Menu,
  MessageSquareText,
  Mic,
  PenLine,
  Sparkles,
  SpellCheck,
  Sprout,
  Target,
  Trophy,
  Video,
} from "lucide-react";
import { Fragment, useEffect, useRef, type ReactNode, type TouchEvent } from "react";

import { FocusController } from "@/components/focus/FocusWidget";
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
import { graphitePanelClass } from "@/lib/surfaces";
import { cn } from "@/lib/utils";
import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { useLessonRound } from "@/hooks/useLessonRound";
import { readStorage, writeStorage } from "@/lib/safeStorage";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { studyToday } from "@/lib/today";

// Mobile sheet menu: excludes the four items already in the bottom navigation bar.
// My Subscription sits with the settings rows at the bottom, as on desktop.
const mobileSheetNav = [
  { to: "/life", label: "Life+ AI", icon: Sprout },
  { to: "/learning", label: "Learning", icon: GraduationCap },
  { to: "/business", label: "Business English", icon: Briefcase },
  { to: "/listening", label: "Listening", icon: Headphones },
  { to: "/reading", label: "Reading", icon: BookOpenText },
  { to: "/writing", label: "Writing", icon: PenLine },
  { to: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { to: "/mistakes", label: "My mistakes", icon: SpellCheck },
  { to: "/league", label: "Weekly league", icon: Trophy },
] as const;

// One list in study order, in small titled groups: plan, practise, talk with
// EVO. The weekly league opens from the Dashboard header (user request: not in
// the desktop sidebar); the phone menu keeps it.
// My Progress opens from the Dashboard's Today's Progress card; My
// Subscription lives with the settings rows at the bottom.
// `group` is the title above a group's first item ("" draws a plain divider).
const dashboardSidebarNav = [
  { to: "/dashboard", label: "Home", icon: House },
  // Life+ AI holds the goals (user decision): Today, Goals, Routine, Habits, Life Coach.
  { to: "/life", label: "Life+ AI", icon: Sprout, group: "Plan" },
  { to: "/study-plan", label: "Study Plan", icon: CalendarCheck },
  { to: "/learning", label: "Learning", icon: GraduationCap },
  { to: "/vocabulary", label: "Vocabulary", icon: BookOpen, group: "Practice" },
  { to: "/listening", label: "Listening", icon: Headphones },
  { to: "/reading", label: "Reading", icon: BookOpenText },
  { to: "/writing", label: "Writing", icon: PenLine },
  { to: "/mistakes", label: "My mistakes", icon: SpellCheck },
  { to: "/coach", label: "AI Speaking", icon: MessageSquareText, group: "With EVO" },
  { to: "/call", label: "Video call", icon: Video },
  { to: "/teacher", label: "AI Teacher", icon: Sparkles },
] as const;

/** The Goals screen is a Life+ AI tab, so the Life+ AI menu item stays lit there. */
function lifeTabOpen(pathname: string, to: string) {
  return to === "/life" && pathname.startsWith("/goals");
}

// Translation and notification controls moved here from the dashboard reflection
// block: one home in the sidebar (desktop) and the sheet menu (mobile).
function UtilityButtons() {
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
        toast(
          t(
            "Notifications are blocked in this browser. Allow them in the site settings (the icon next to the address) and try again.",
          ),
        );
      }
    } else if (result === "unsupported") {
      toast(t("Notifications are not supported on this device"));
    }
  }

  // Two equal cells of the profile card's icon row (ProfileMenu, desktop
  // sidebar and phone menu), the language with its short code beside the
  // icon, not over it.
  return (
    <>
      <Button
        variant="ghost"
        aria-label={`${t("Change language")}: ${lang === "pt" ? "Português" : "English"}`}
        title={lang === "pt" ? "Português" : "English"}
        className="h-9 w-full gap-1 rounded-lg px-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        onClick={toggleLang}
      >
        <Languages className="size-[1.15rem]" />
        <span className="text-[10px] font-bold">{lang === "pt" ? "PT" : "EN"}</span>
      </Button>
      <Button
        variant="ghost"
        aria-label={pushLabel}
        title={pushLabel}
        aria-pressed={pushOn}
        className={cn(
          "h-9 w-full rounded-lg px-0 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          pushOn ? "text-brand-green" : "text-sidebar-foreground/70",
        )}
        onClick={() => void togglePush()}
      >
        {pushOn ? <Bell className="size-[1.15rem]" /> : <BellOff className="size-[1.15rem]" />}
      </Button>
    </>
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
    pathname.startsWith("/premium") ||
    pathname.startsWith("/goals") ||
    mobileSheetNav.some((item) => pathname.startsWith(item.to));
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    // Only this device (user report, 2026-10-17): Supabase's default "global"
    // scope also ended the student's sessions on every other phone or computer,
    // and made the signed-in CI tests of parallel runs log each other out.
    await supabase.auth.signOut({ scope: "local" });
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
        // Translucent graphite like Weather talk and the bell (user request), over
        // a lighter dim so the page shows through.
        overlayClassName="bg-black/30"
        className={cn(
          "dashboard-shell dark flex w-[min(16rem,78vw)] flex-col p-4 text-sidebar-foreground",
          graphitePanelClass,
          "border-y-0 border-l-0",
        )}
      >
        <SheetHeader className="border-b border-sidebar-border pb-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
            <Logo className="size-[3.32rem] shrink-0" />
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
                    inactiveProps={{
                      className: lifeTabOpen(pathname, item.to)
                        ? "bg-sidebar-accent text-brand-green"
                        : "text-sidebar-foreground/75",
                    }}
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
          {/* The app guide ("Diário de bordo", user request) sits with the settings rows. */}
          <SheetClose asChild>
            <Link
              to="/guide"
              className="flex h-11 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              activeProps={{ className: "text-brand-green" }}
              inactiveProps={{ className: "text-sidebar-foreground/70" }}
            >
              <BookMarked className="size-5 shrink-0" />
              <span className="min-w-0 truncate text-left">{translate("App guide")}</span>
            </Link>
          </SheetClose>
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
          {/* The same profile card as the desktop sidebar (user request); the
              menu stays open behind the profile dialog. */}
          <ProfileMenu className="mt-2" presentation="mobile-menu" toolbar={<UtilityButtons />} />
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

  // Mobile swipe between the four destinations already shown in the bottom bar.
  // Keep navigation route-driven so the bottom bar stays in sync.
  const mainSwipeTabs = ["/dashboard", "/teacher", "/coach", "/call"] as const;
  const touchStart = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);

  function handleMainTouchStart(event: TouchEvent<HTMLElement>) {
    if (window.matchMedia("(min-width: 1024px)").matches || event.touches.length !== 1) {
      touchStart.current = null;
      return;
    }
    const touch = event.touches[0];
    if (!touch) {
      touchStart.current = null;
      return;
    }
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      target: event.target,
    };
  }

  function handleMainTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || window.matchMedia("(min-width: 1024px)").matches) return;

    const target = start.target instanceof Element ? start.target : null;
    if (
      target?.closest(
        'a, button, input, textarea, select, [role="button"], [role="slider"], video, audio, [data-no-swipe]',
      )
    ) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.35) return;

    const currentIndex = mainSwipeTabs.indexOf(location.pathname as (typeof mainSwipeTabs)[number]);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + (dx < 0 ? 1 : -1);
    const nextTab = mainSwipeTabs[nextIndex];
    if (!nextTab) return;
    void navigate({ to: nextTab });
  }

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
    // Only this device (user report, 2026-10-17): Supabase's default "global"
    // scope also ended the student's sessions on every other phone or computer,
    // and made the signed-in CI tests of parallel runs log each other out.
    await supabase.auth.signOut({ scope: "local" });
    navigate({ to: "/auth", replace: true });
  }

  const dashboardMobileNav = [
    { to: "/dashboard", label: lang === "pt" ? "Início" : "Home", icon: House },
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
            aria-label={translate("Home")}
            className="flex h-14 min-w-0 items-center gap-2 rounded-lg px-1 hover:bg-sidebar-accent"
          >
            {/* One line, the same lockup as the public home header. */}
            <Logo className="size-[3.32rem] shrink-0" />
            <BrandName className="min-w-0 whitespace-nowrap text-base" />
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
                  inactiveProps={{
                    className: lifeTabOpen(location.pathname, item.to)
                      ? "bg-sidebar-accent text-brand-green"
                      : "text-sidebar-foreground/70",
                  }}
                >
                  <item.icon className="size-5" />
                  <span className="truncate text-left">{translate(item.label)}</span>
                </Link>
              </Fragment>
            ))}
          </nav>

          <div className="flex flex-col items-stretch gap-1">
            <div className="flex flex-col items-stretch gap-0.5 border-t border-sidebar-border pb-1 pt-2">
              {/* The app guide ("Diário de bordo", user request). */}
              <Link
                to="/guide"
                className="flex h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                activeProps={{ className: "text-brand-green" }}
                inactiveProps={{ className: "text-sidebar-foreground/70" }}
              >
                <BookMarked className="size-5 shrink-0" />
                <span className="min-w-0 truncate text-left">{translate("App guide")}</span>
              </Link>
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
            {/* The profile: icons on top (gear, language, notifications), the
                photo, name and plan below (user request). */}
            <ProfileMenu
              presentation="dashboard-sidebar"
              className="hover:bg-sidebar-accent hover:text-sidebar-foreground"
              toolbar={<UtilityButtons />}
            />
          </div>
        </aside>

        <main
          onTouchStart={handleMainTouchStart}
          onTouchEnd={handleMainTouchEnd}
          className={cn(
            "animate-page-in w-full max-w-none px-4 py-6 sm:px-6 lg:px-8 lg:py-6 xl:px-10",
            !dashboardLayout && "flex-1",
            dashboardLayout &&
              "h-[calc(100dvh-4.275rem)] overflow-hidden py-3 pb-[5px] lg:h-auto lg:overflow-visible lg:py-6 lg:pb-6 xl:px-5 xl:py-2",
          )}
        >
          {children}
        </main>

        {/* The Focus timer ends its phases and floats over every page. */}
        <FocusController />

        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid h-[4.275rem] grid-cols-5 border-t border-white/10 bg-sidebar/80 px-0.5 pb-[calc(env(safe-area-inset-bottom)_+_2px)] text-sidebar-foreground shadow-[0_-10px_28px_oklch(0.04_0.02_240/0.42)] backdrop-blur-xl lg:hidden"
          aria-label={lang === "pt" ? "Navegação principal" : "Main navigation"}
        >
          {dashboardMobileNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group flex min-w-0 flex-col items-center pt-1.5 transition-colors"
              activeProps={{ className: "text-brand-green" }}
              inactiveProps={{ className: "text-muted-foreground" }}
            >
              <span className="grid justify-items-center gap-0.5">
                {/* The active tab sits in a soft pill (user request: a
                    sophisticated app), like native tab bars. */}
                <span className="grid h-7 w-14 place-items-center rounded-full transition-colors group-data-[status=active]:bg-brand-green/15">
                  <item.icon className="size-6" />
                </span>
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
