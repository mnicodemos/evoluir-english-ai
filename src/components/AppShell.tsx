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
  LineChart,
  LogOut,
  Menu,
  MessageSquareText,
  Mic,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useWeatherCondition,
  weatherIcons,
  type WeatherCondition,
} from "@/hooks/useWeatherCondition";
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
import { stopSpeaking } from "@/lib/speech";
import { retryPendingPedagogicalWrites } from "@/lib/pedagogy/dualWrite.functions";
import { sendActivityPush } from "@/lib/push.functions";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { cn } from "@/lib/utils";
import { useActivityIndicators, type ActivityIndicators } from "@/hooks/useActivityIndicators";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// Mobile sheet menu: excludes the four items already in the bottom navigation bar.
const mobileSheetNav = [
  { to: "/study-plan", label: "Study Plan", icon: CalendarCheck },
  { to: "/learning", label: "Learning", icon: GraduationCap },
  { to: "/listening", label: "Listening", icon: Headphones },
  { to: "/writing", label: "Writing", icon: PenLine },
  { to: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { to: "/premium", label: "Premium", icon: Crown },
] as const;

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

const weatherLabels: Record<WeatherCondition, string> = {
  sunny: "Sunny",
  "partly-cloudy": "Partly cloudy",
  cloudy: "Cloudy",
  rain: "Rain",
  storm: "Storm",
  snow: "Snow",
  night: "Clear night",
};

// Translation and weather controls moved here from the dashboard reflection
// block: one home in the sidebar (desktop) and the sheet menu (mobile).
function UtilityButtons({ variant }: { variant: "sidebar" | "sheet" }) {
  const { lang, setLang } = useUiLang();
  const { condition, refresh } = useWeatherCondition();
  const push = usePushNotifications();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const WeatherIcon = weatherIcons[condition];
  const weatherText = t(weatherLabels[condition]);
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

  function refreshWeather() {
    refresh();
    toast(`${t("Weather")}: ${weatherText}`);
  }

  // Desktop sidebar matches the mobile sheet: icon + text, one item per row.
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
          aria-label={t("Weather")}
          className="h-11 min-w-0 justify-start gap-2 rounded-lg px-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={refreshWeather}
        >
          <WeatherIcon className="size-5 shrink-0" />
          <span className="min-w-0 truncate text-left">{weatherText}</span>
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

  return (
    <div className="grid grid-cols-2 gap-2 pb-2">
      <Button
        variant="ghost"
        className="h-10 min-w-0 justify-start gap-2 overflow-hidden border border-sidebar-border text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        onClick={toggleLang}
      >
        <Languages className="size-5 shrink-0" />
        <span className="min-w-0 truncate">{lang === "pt" ? "Português" : "English"}</span>
      </Button>
      <Button
        variant="ghost"
        className="h-10 min-w-0 justify-start gap-2 overflow-hidden border border-sidebar-border text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        onClick={refreshWeather}
      >
        <WeatherIcon className="size-5 shrink-0" />
        <span className="min-w-0 truncate">{weatherText}</span>
      </Button>
      <Button
        variant="ghost"
        aria-label={t("Notifications")}
        className="h-10 min-w-0 justify-start gap-2 overflow-hidden border border-sidebar-border text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        onClick={() => void togglePush()}
      >
        {pushOn ? <Bell className="size-5 shrink-0" /> : <BellOff className="size-5 shrink-0" />}
        <span className="min-w-0 truncate">{pushLabel}</span>
      </Button>
    </div>
  );
}

type MobileNavigationMenuProps = {
  translate: (label: string) => string;
  className?: string;
  presentation?: "menu" | "bottom-tab";
  bottomLabel?: string;
  indicators: ActivityIndicators;
};

export function MobileNavigationMenu({
  translate,
  className,
  presentation = "menu",
  bottomLabel = "More",
  indicators,
}: MobileNavigationMenuProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useLocation().pathname;
  // The More button lights up when the current route belongs to one of its
  // own sections (the four bottom tabs stay responsible for themselves).
  const moreActive = mobileSheetNav.some((item) => pathname.startsWith(item.to));
  const hasPendingActivity = indicators.listening || indicators.writing || indicators.vocabulary;

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
              "h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-none px-1 [&_svg]:size-6",
              moreActive ? "text-brand-green" : "text-muted-foreground",
              className,
            )}
          >
            <span className="relative grid place-items-center">
              <Menu strokeWidth={2.25} />
              {hasPendingActivity && (
                <span
                  className="absolute -right-1.5 -top-0.5 size-2 rounded-full bg-brand-green ring-2 ring-sidebar"
                  aria-label={translate("New activity")}
                />
              )}
            </span>
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
          {mobileSheetNav.map((item, index) => {
            const hasNew =
              (item.to === "/listening" && indicators.listening) ||
              (item.to === "/writing" && indicators.writing) ||
              (item.to === "/vocabulary" && indicators.vocabulary);
            return (
              <div
                key={item.to}
                className={
                  index > 0 && item.to === "/premium"
                    ? "border-t border-sidebar-border pt-2"
                    : undefined
                }
              >
                <SheetClose asChild>
                  <Link
                    to={item.to}
                    className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    activeProps={{ className: "bg-sidebar-accent text-brand-green" }}
                    inactiveProps={{ className: "text-sidebar-foreground/75" }}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="truncate">{translate(item.label)}</span>
                    {hasNew && (
                      <span
                        className="size-2.5 shrink-0 rounded-full bg-brand-green"
                        aria-label={translate("New activity")}
                      />
                    )}
                  </Link>
                </SheetClose>
              </div>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-sidebar-border pt-3">
          <UtilityButtons variant="sheet" />
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
  const activityIndicators = useActivityIndicators();
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

  // Push warning for new activities: at most once per day, only when the
  // device is registered and something new (lesson, writing or vocabulary)
  // is waiting for the student.
  const hasNewActivity =
    activityIndicators.listening || activityIndicators.writing || activityIndicators.vocabulary;
  useEffect(() => {
    if (!hasNewActivity) return;
    if (localStorage.getItem("push-token") === null) return;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("push-activity-notified") === today) return;
    localStorage.setItem("push-activity-notified", today);
    void sendActivityPush({
      data: {
        title: translate("New activities available"),
        body: translate("Small consistent actions create meaningful progress."),
        path: "/dashboard",
      },
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNewActivity]);

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
          "lg:pl-[13.2rem]",
        )}
      >
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[13.2rem] flex-col items-stretch border-r border-sidebar-border bg-sidebar px-3 pt-3 pb-4 text-sidebar-foreground lg:flex">
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

          <nav className="mt-4 flex flex-1 flex-col gap-1">
            {dashboardSidebarNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-label={translate(item.label)}
                className="grid h-12 grid-cols-[2.4rem_minmax(0,1fr)] items-center rounded-lg px-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                activeProps={{
                  className:
                    "border border-brand-green/35 bg-sidebar-accent text-brand-green shadow-[inset_3px_0_0_var(--brand-green)]",
                }}
                inactiveProps={{ className: "text-sidebar-foreground/70" }}
              >
                <item.icon className="size-6" />
                <span className="truncate text-left">{translate(item.label)}</span>
              </Link>
            ))}
            <div className="my-2 border-t border-sidebar-border" />
            {dashboardAccountNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-label={translate(item.label)}
                className="grid h-12 grid-cols-[2.4rem_minmax(0,1fr)] items-center rounded-lg px-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                activeProps={{
                  className:
                    "border border-brand-green/35 bg-sidebar-accent text-brand-green shadow-[inset_3px_0_0_var(--brand-green)]",
                }}
                inactiveProps={{ className: "text-sidebar-foreground/70" }}
              >
                <item.icon className="size-6" />
                <span className="truncate text-left">{translate(item.label)}</span>
              </Link>
            ))}
          </nav>

          <div className="flex flex-col items-stretch gap-1">
            <div className="flex flex-col items-stretch gap-0.5 pb-1">
              <UtilityButtons variant="sidebar" />
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
              className="grid min-w-0 place-items-center transition-colors"
              activeProps={{ className: "text-brand-green" }}
              inactiveProps={{ className: "text-muted-foreground" }}
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
            indicators={activityIndicators}
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
