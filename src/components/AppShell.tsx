import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
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
import { supabase } from "@/integrations/supabase/client";
import { stopSpeaking } from "@/lib/speech";
import { retryPendingPedagogicalWrites } from "@/lib/pedagogy/dualWrite.functions";
import { UiLangProvider, UiLangToggle, useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/learning", label: "Learning", icon: GraduationCap },
  { to: "/listening", label: "Listening", icon: Headphones },
  { to: "/coach", label: "AI Talking", icon: MessageSquareText },
  { to: "/teacher", label: "AI Teacher", icon: GraduationCap },
  { to: "/writing", label: "Writing", icon: PenLine },
  { to: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { to: "/progress", label: "Progress", icon: LineChart },
] as const;

const sidebarNav = [...nav, { to: "/premium", label: "Premium", icon: Crown }] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <UiLangProvider>
      <AppShellContent>{children}</AppShellContent>
    </UiLangProvider>
  );
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
      <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-20">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center bg-sidebar py-5 text-sidebar-foreground lg:flex">
          <Link
            to="/dashboard"
            aria-label={translate("Dashboard")}
            className="grid size-10 place-items-center rounded-lg hover:bg-sidebar-accent"
          >
            <Logo className="size-8" />
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

        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur lg:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Logo className="size-[1.3rem]" />
            <span className="font-display text-sm font-semibold">Evoluir+ English AI</span>
          </Link>
          <div className="flex items-center gap-1">
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

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-6 xl:px-10">
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

        <div className="mb-20 lg:mb-0">
          <Footer lang={lang} containerClassName="max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-10" />
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-8 place-items-center border-t border-border bg-background/95 backdrop-blur py-2 lg:hidden">
          {nav.map((item) => (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>
                <Link
                  to={item.to}
                  aria-label={translate(item.label)}
                  className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/teacher"
              aria-label={translate("AI Teacher")}
              className="fixed bottom-[4.5rem] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 transition-transform duration-200 hover:scale-110 animate-pulse lg:bottom-8 lg:right-8"
            >
              <Sparkles className="size-7" aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            {translate("AI Teacher")}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
