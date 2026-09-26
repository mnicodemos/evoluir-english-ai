import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { BrandName } from "@/components/BrandName";
import { Footer } from "@/components/Footer";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { UiLangToggle, useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Entrar" },
      { name: "description", content: "Entre ou crie sua conta na Evoluir+ English AI." },
      { property: "og:title", content: "Evoluir+ English AI · Entrar" },
      { property: "og:description", content: "Entre ou crie sua conta na Evoluir+ English AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  // Login page is always dark, regardless of the user's theme preference.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!wasDark) root.classList.remove("dark");
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setResetSent(true);
        setSent(true);
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { name } },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
        navigate({ to: "/onboarding", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-shell brand-dashboard-theme dark flex min-h-dvh flex-col bg-background text-foreground">
      <div className="grid flex-1 lg:grid-cols-2">
        <div className="relative hidden flex-col border-r border-border bg-card p-12 shadow-[var(--shadow-soft)] lg:flex">
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="max-w-sm text-3xl font-bold text-foreground">
              {t("Your English teacher is waiting for you.")}
            </h2>
            <p className="mt-4 max-w-sm text-muted-foreground">
              {t("Conversation, writing and vocabulary practice with feedback in seconds.")}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center px-5 py-8 sm:py-14">
          <div className="w-full max-w-sm">
            <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
              <Logo className="size-[1.2rem]" />
              <BrandName />
            </Link>

            <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <span aria-hidden="true">←</span> {t("Back to home")}
              </Link>
              <UiLangToggle />
            </div>

            {sent ? (
              <div className="card-soft p-7 text-center">
                <h1 className="text-xl font-semibold">{t("Check your email")}</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  {resetSent ? (
                    <>
                      {t("We sent a password reset link to")} <strong>{email}</strong>.
                    </>
                  ) : (
                    <>
                      {t("We sent a confirmation link to")} <strong>{email}</strong>.{" "}
                      {t("Click it to activate your account, then come back and sign in.")}
                    </>
                  )}
                </p>
                <Button
                  variant="outline"
                  className="mt-6 w-full"
                  onClick={() => {
                    setSent(false);
                    setResetSent(false);
                    setForgot(false);
                    setMode("signin");
                  }}
                >
                  {t("Back to sign in")}
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold">
                  {t(
                    forgot
                      ? "Reset your password"
                      : mode === "signup"
                        ? "Create your account"
                        : "Welcome back",
                  )}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {forgot
                    ? t("Enter your email and we'll send you a link to create a new password.")
                    : mode === "signup"
                      ? t("Two minutes to set up your personal learning plan.")
                      : t("Sign in to continue your streak.")}
                </p>

                <form onSubmit={onSubmit} className="mt-7 space-y-4">
                  {mode === "signup" && !forgot && (
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("Your name")}</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="scroll-mt-20"
                        placeholder="Marcelo"
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("Email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="scroll-mt-20"
                      placeholder="you@company.com"
                      required
                    />
                  </div>
                  {!forgot && (
                    <div className="space-y-2">
                      <Label htmlFor="password">{t("Password")}</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          minLength={6}
                          required
                          className="scroll-mt-20 pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={t(showPassword ? "Hide password" : "Show password")}
                          className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading && <Loader2 className="size-4 animate-spin" />}
                    {t(
                      forgot
                        ? "Send reset link"
                        : mode === "signup"
                          ? "Start my evolution"
                          : "Sign in",
                    )}
                  </Button>
                </form>

                <p className="mt-4 text-center text-sm">
                  <button
                    type="button"
                    className="font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                    onClick={() => setForgot((v) => !v)}
                  >
                    {t(forgot ? "Back to sign in" : "Forgot my password")}
                  </button>
                </p>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  {t(mode === "signup" ? "Already have an account?" : "New here?")}{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline underline-offset-4"
                    onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                  >
                    {t(mode === "signup" ? "Sign in" : "Create an account")}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer leftAligned lang={lang} />
    </div>
  );
}
