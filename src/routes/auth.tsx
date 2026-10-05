import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { BrandName } from "@/components/BrandName";
import { Footer } from "@/components/Footer";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import evoImage from "@/assets/evo-landing.webp";
import { authErrorMessage } from "@/lib/authErrors";
import { uiPt } from "@/lib/uiDictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ mode: z.enum(["signin", "signup", "forgot"]).optional() });

/** Seconds before another confirmation or reset e-mail can be requested. */
const RESEND_SECONDS = 60;

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
  // Login screen is always in Portuguese — no language option here.
  const lang = "pt" as const;
  const t = (label: string) => uiPt[label] ?? label;
  const [mode, setMode] = useState<"signin" | "signup">(
    search.mode === "signup" ? "signup" : "signin",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgot, setForgot] = useState(search.mode === "forgot");
  const [resetSent, setResetSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

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
        setResendIn(RESEND_SECONDS);
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
          setResendIn(RESEND_SECONDS);
          return;
        }
        navigate({ to: "/onboarding", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setNeedsConfirmation(
            error.code === "email_not_confirmed" || /not confirmed/i.test(error.message),
          );
          throw error;
        }
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  /** Sends the confirmation or reset e-mail again (Supabase rate-limits it too). */
  async function resend() {
    if (resendIn > 0 || !email) return;
    setLoading(true);
    try {
      const { error } = resetSent
        ? await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          })
        : await supabase.auth.resend({
            type: "signup",
            email,
            options: { emailRedirectTo: window.location.origin },
          });
      if (error) throw error;
      setResendIn(RESEND_SECONDS);
      toast.success(t("Email sent again"));
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function backToSignIn() {
    setSent(false);
    setResetSent(false);
    setForgot(false);
    setNeedsConfirmation(false);
    setMode("signin");
  }

  return (
    <div className="dashboard-shell brand-dashboard-theme dark flex min-h-dvh flex-col bg-background text-foreground">
      <div className="grid flex-1 lg:grid-cols-2">
        <aside className="relative hidden flex-col overflow-hidden border-r border-border bg-card p-10 shadow-[var(--shadow-soft)] lg:flex">
          <div className="absolute inset-0 surface-hero opacity-40" aria-hidden="true" />
          <Link to="/" className="relative flex items-center gap-2.5">
            <Logo className="size-10" />
            <BrandName />
          </Link>
          <div className="relative grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] items-center gap-4">
            <div>
              <h2 className="max-w-sm text-3xl font-bold leading-tight text-foreground xl:text-4xl">
                {t("Your English teacher is waiting for you.")}
              </h2>
              <p className="mt-4 max-w-sm text-muted-foreground">
                {t("Conversation, writing and vocabulary practice with feedback in seconds.")}
              </p>
            </div>
            <img
              src={evoImage}
              alt=""
              width={848}
              height={1264}
              className="max-h-[min(70dvh,34rem)] w-full object-contain object-bottom drop-shadow-2xl"
            />
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-8 sm:py-14">
          <div className="w-full max-w-sm">
            <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
              <Logo className="size-[1.5rem]" />
              <BrandName />
            </Link>

            <Link
              to="/"
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span aria-hidden="true">←</span> {t("Back to home")}
            </Link>

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
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("It can take a few minutes. Check your spam folder too.")}
                </p>
                <Button
                  variant="secondary"
                  className="mt-5 w-full"
                  disabled={loading || resendIn > 0}
                  onClick={() => void resend()}
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  {resendIn > 0 ? (
                    <span>
                      {t("Resend in")} {resendIn}s
                    </span>
                  ) : (
                    t("Resend email")
                  )}
                </Button>
                <Button variant="outline" className="mt-3 w-full" onClick={backToSignIn}>
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
                        autoComplete="name"
                        className="scroll-mt-20"
                        placeholder="Como você quer ser chamado"
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
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="scroll-mt-20"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                  {!forgot && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="password">{t("Password")}</Label>
                        {mode === "signin" && (
                          <button
                            type="button"
                            className="text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                            onClick={() => setForgot(true)}
                          >
                            {t("Forgot my password")}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          minLength={6}
                          required
                          autoComplete={mode === "signup" ? "new-password" : "current-password"}
                          aria-describedby={mode === "signup" ? "password-hint" : undefined}
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
                      {mode === "signup" && (
                        <p id="password-hint" className="text-xs text-muted-foreground">
                          {t("At least 6 characters.")}
                        </p>
                      )}
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
                  {needsConfirmation && mode === "signin" && !forgot && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={loading || resendIn > 0 || !email}
                      onClick={() => void resend()}
                    >
                      {resendIn > 0 ? (
                        <span>
                          {t("Resend in")} {resendIn}s
                        </span>
                      ) : (
                        t("Resend confirmation email")
                      )}
                    </Button>
                  )}
                  {mode === "signup" && !forgot ? (
                    <p className="text-center text-xs leading-relaxed text-muted-foreground">
                      Ao criar uma conta, você concorda com os{" "}
                      <Link
                        to="/terms"
                        className="font-medium text-foreground underline underline-offset-4"
                      >
                        Termos de Uso
                      </Link>{" "}
                      e a{" "}
                      <Link
                        to="/privacy"
                        className="font-medium text-foreground underline underline-offset-4"
                      >
                        Política de Privacidade
                      </Link>
                      .
                    </p>
                  ) : null}
                </form>

                {forgot ? (
                  <p className="mt-6 text-center text-sm">
                    <button
                      type="button"
                      className="font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                      onClick={backToSignIn}
                    >
                      {t("Back to sign in")}
                    </button>
                  </p>
                ) : (
                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    {t(mode === "signup" ? "Already have an account?" : "New here?")}{" "}
                    <button
                      type="button"
                      className="font-medium text-foreground underline underline-offset-4"
                      onClick={() => {
                        setNeedsConfirmation(false);
                        setMode(mode === "signup" ? "signin" : "signup");
                      }}
                    >
                      {t(mode === "signup" ? "Sign in" : "Create an account")}
                    </button>
                  </p>
                )}
              </>
            )}
          </div>
        </main>
      </div>
      <Footer minimal leftAligned lang={lang} />
    </div>
  );
}
