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
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { ProfileMenu } from "@/components/ProfileMenu";
import { AdminPanelButton } from "@/components/AdminPanelButton";
import { AiTeacherFloatButton } from "@/components/AiTeacherFloatButton";
import { supabase } from "@/integrations/supabase/client";
import { stopSpeaking } from "@/lib/speech";
import { retryPendingPedagogicalWrites } from "@/lib/pedagogy/dualWrite.functions";
import { UiLangToggle, useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/study-plan", label: "My Study Plan", icon: CalendarCheck },
  { to: "/learning", label: "Learning", icon: GraduationCap },
  { to: "/listening", label: "Listening", icon: Headphones },
  { to: "/coach", label: "AI Talking", icon: MessageSquareText },
  { to: "/teacher", label: "AI Teacher", icon: Sparkles },
  { to: "/writing", label: "Writing", icon: PenLine },
  { to: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { to: "/progress", label: "Progress", icon: LineChart },
] as const;

const sidebarNav = [...nav, { to: "/premium", label: "Premium", icon: Crown }] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return <AppShellContent>{children}</AppShellContent>;
}

function AppShellContent({ children }: { children: ReactNode }) {
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
      <div className="min-h-screen bg-background pb-[calc(8rem+env(safe-area-inset-bottom))] sm:pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-20">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center bg-sidebar py-5 text-sidebar-foreground lg:flex">
          <Link
            to="/dashboard"
            aria-label={translate("Dashboard")}
            className="grid size-11 place-items-center rounded-lg hover:bg-sidebar-accent"
          >
            <Logo className="size-11" />
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {sidebarNav.map((item) => (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.to}
                    aria-label={translate(item.label)}
                    className="grid size-10 place-items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground" }}
                  >
                    <item.icon className="size-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {translate(item.label)}
                </TooltipContent>
              </Tooltip>
            ))}
          </nav>

          <div className="flex flex-col items-center gap-1">
            <AdminPanelButton className="size-10 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
            <UiLangToggle className="border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
            <ThemeToggle className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
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
            <ProfileMenu className="hover:bg-sidebar-accent hover:text-sidebar-foreground" />
          </div>
        </aside>

        <header className="sticky top-0 z-20 grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur sm:px-4 lg:hidden">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <Logo className="size-[1.3rem] shrink-0" />
            <span className="truncate font-display text-sm font-semibold">Evoluir+ English AI</span>
          </Link>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <AdminPanelButton />
            <UiLangToggle />
            <ThemeToggle />
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

        <main className="w-full max-w-none px-4 py-6 sm:px-6 lg:px-8 lg:py-6 xl:px-10">
          {showBackButton && (
            <Link
              to="/dashboard"
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-accent"
            >
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
          )}
          {children}
        </main>

        <div className="mb-0">
          <Footer lang={lang} containerClassName="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10" />
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

        {location.pathname === "/dashboard" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AiTeacherFloatButton />
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              {translate("AI Teacher")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
